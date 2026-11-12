// Deploys the contract to testnet, creates a tick-only keeper key and brings the nine cats to life.
// Usage: npm run deploy -- <admin-key-json> [media-base-url]
//   <admin-key-json>: {"accountId": "...", "privateKey": "ed25519:..."} for the contract account.
// Writes MASTER_SEED and KEEPER_KEY to app/.env.local (never committed).

import { Account, JsonRpcProvider, KeyPair, actions, teraToGas, nearToYocto, type KeyPairString } from "near-api-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PERSONALITIES } from "../src/engine/personalities";
import { catKeyPair } from "../src/engine/keys";

const [keyFile, mediaBase = "https://nine-lives-alley.vercel.app"] = process.argv.slice(2);
if (!keyFile) throw new Error("Usage: deploy.ts <admin-key-json> [media-base-url]");
const { accountId, privateKey } = JSON.parse(readFileSync(keyFile, "utf8"));
const rpcUrl = process.env.NEXT_PUBLIC_NEAR_RPC || "https://rpc.testnet.near.org";
const provider = new JsonRpcProvider({ url: rpcUrl });
const admin = new Account(accountId, provider, privateKey as KeyPairString);

// Secrets for the runner, created once.
const envPath = new URL("../.env.local", import.meta.url).pathname;
const env: Record<string, string> = {};
if (existsSync(envPath)) {
  for (const l of readFileSync(envPath, "utf8").split("\n")) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
}
env.NEXT_PUBLIC_CONTRACT_ID = accountId;
env.NEXT_PUBLIC_NEAR_RPC = rpcUrl;
env.MASTER_SEED ||= randomBytes(32).toString("hex");
env.KEEPER_ACCOUNT_ID = accountId;
env.KEEPER_KEY ||= KeyPair.fromRandom("ed25519").toString();
writeFileSync(envPath, Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", { mode: 0o600 });
console.log(`Secrets in ${envPath}`);

const wasm = readFileSync(new URL("../../contract/target/near/nine_lives.wasm", import.meta.url));
const state = await admin.getState();
const alreadyDeployed = state.codeHash !== "11111111111111111111111111111111";

if (!alreadyDeployed) {
  console.log(`Deploying ${wasm.length} bytes to ${accountId}...`);
  await admin.signAndSendTransaction({
    receiverId: accountId,
    actions: [
      actions.deployContract(new Uint8Array(wasm)),
      actions.functionCall("new", { admin: accountId, media_base: mediaBase, config: null }, teraToGas("100"), 0n),
    ],
  });
  const keeper = KeyPair.fromString(env.KEEPER_KEY as KeyPairString);
  await admin.signAndSendTransaction({
    receiverId: accountId,
    actions: [actions.addFunctionCallAccessKey(keeper.getPublicKey(), accountId, ["tick"], nearToYocto("0.5"))],
  });
  console.log("Deployed, initialized, keeper key added (can only call tick).");
} else {
  console.log("Contract already deployed; skipping deploy.");
}

const existing = (await provider.callFunction<{ cats: number }>({ contractId: accountId, method: "get_state", args: {} }))!.cats;
for (let i = existing; i < PERSONALITIES.length; i++) {
  const p = PERSONALITIES[i];
  const id = i + 1;
  const brain = catKeyPair(env.MASTER_SEED, id).getPublicKey().toString();
  await admin.callFunction({
    contractId: accountId,
    methodName: "adopt",
    args: { name: p.name, personality: p.key, traits: JSON.stringify(p.traits), brain_key: brain, receiver_id: null },
    gas: teraToGas("100"),
    deposit: nearToYocto("0.2"),
  });
  console.log(`🐈 ${p.name} (${p.title}) adopted as cat-${id}.${accountId}`);
}
console.log("All nine lives are in the alley.");
