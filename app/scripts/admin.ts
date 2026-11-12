// Calls an admin method on the contract. Usage: tsx scripts/admin.ts <admin-key-json> <method> '<json-args>'
import { Account, JsonRpcProvider, teraToGas, type KeyPairString } from "near-api-js";
import { readFileSync } from "node:fs";

const [keyFile, method, json = "{}"] = process.argv.slice(2);
const { accountId, privateKey } = JSON.parse(readFileSync(keyFile, "utf8"));
const provider = new JsonRpcProvider({ url: process.env.NEXT_PUBLIC_NEAR_RPC || "https://rpc.testnet.near.org" });
const admin = new Account(accountId, provider, privateKey as KeyPairString);
await admin.callFunction({ contractId: accountId, methodName: method, args: JSON.parse(json), gas: teraToGas("100"), deposit: 0n });
console.log(`${method} ok`);
