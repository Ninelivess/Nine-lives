// Registers the public brain keys of future kittens (cat ids FROM..TO) on the contract.
// Private keys are never stored: the runner derives them from MASTER_SEED when a kitten is born.
// Usage: tsx scripts/register-keys.ts <admin-key-json> [from=10] [to=81]
// MASTER_SEED is read from the environment or app/.env.local and is never printed.
import { Account, JsonRpcProvider, teraToGas, type KeyPairString } from "near-api-js";
import { readFileSync } from "node:fs";
import { catKeyPair } from "../src/engine/keys";

const [keyFile, fromArg, toArg] = process.argv.slice(2);
let seed = process.env.MASTER_SEED ?? "";
if (!seed) {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  seed = env.match(/^MASTER_SEED=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
}
const from = Number(fromArg ?? 10);
const to = Number(toArg ?? 81);
const { accountId, privateKey } = JSON.parse(readFileSync(keyFile, "utf8"));
const provider = new JsonRpcProvider({ url: process.env.NEXT_PUBLIC_NEAR_RPC || "https://test.rpc.fastnear.com" });
const admin = new Account(accountId, provider, privateKey as KeyPairString);
const keys: [number, string][] = [];
for (let id = from; id <= to; id++) keys.push([id, catKeyPair(seed, id).getPublicKey().toString()]);
await admin.callFunction({ contractId: accountId, methodName: "register_brain_keys", args: { keys }, gas: teraToGas("200"), deposit: 0n });
console.log(`Registered ${keys.length} kitten brain keys (cat ids ${from}-${to}) on ${accountId}`);
