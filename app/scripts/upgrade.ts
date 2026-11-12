// Redeploys contract code without touching state (only for changes that keep the state layout).
// Usage: tsx scripts/upgrade.ts <admin-key-json>
import { Account, JsonRpcProvider, actions, type KeyPairString } from "near-api-js";
import { readFileSync } from "node:fs";

const { accountId, privateKey } = JSON.parse(readFileSync(process.argv[2], "utf8"));
const provider = new JsonRpcProvider({ url: process.env.NEXT_PUBLIC_NEAR_RPC || "https://rpc.testnet.near.org" });
const admin = new Account(accountId, provider, privateKey as KeyPairString);
const wasm = readFileSync(new URL("../../contract/target/near/nine_lives.wasm", import.meta.url));
await admin.signAndSendTransaction({ receiverId: accountId, actions: [actions.deployContract(new Uint8Array(wasm))] });
const state = await provider.callFunction<{ day: number; alive: number }>({ contractId: accountId, method: "get_state", args: {} });
console.log(`Upgraded ${accountId}: day ${state!.day}, ${state!.alive} cats alive`);
