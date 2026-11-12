// Admin: put every cat the admin still holds up for sale. Usage: tsx scripts/list-cats.ts <admin-key-json> [alive NEAR] [ghost NEAR]
import { Account, JsonRpcProvider, teraToGas, nearToYocto, type KeyPairString } from "near-api-js";
import { readFileSync } from "node:fs";

const [keyFile, alivePrice = "0.3", ghostPrice = "0.05"] = process.argv.slice(2) as [string, `${number}`?, `${number}`?];
const { accountId, privateKey } = JSON.parse(readFileSync(keyFile, "utf8"));
const provider = new JsonRpcProvider({ url: process.env.NEXT_PUBLIC_NEAR_RPC || "https://test.rpc.fastnear.com" });
const admin = new Account(accountId, provider, privateKey as KeyPairString);
const cats = (await provider.callFunction<{ id: number; name: string; alive: boolean; owner_id: string }[]>({ contractId: accountId, method: "get_cats", args: {} }))!;
for (const c of cats) {
  if (c.owner_id !== accountId) continue;
  const price = c.alive ? alivePrice : ghostPrice;
  await admin.callFunction({ contractId: accountId, methodName: "list_cat", args: { token_id: String(c.id), price: nearToYocto(price).toString() }, gas: teraToGas("30"), deposit: 0n });
  console.log(`listed ${c.name} (#${c.id}, ${c.alive ? "alive" : "ghost"}) for ${price} NEAR`);
}
