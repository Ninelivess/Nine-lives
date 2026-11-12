// An AI agent with its own NEAR wallet buys a cat through the MCP server, no human in the loop:
// it asks the MCP server what is for sale, takes `raw_function_call` from buy_cat and signs it.
// Usage: tsx scripts/agent-buy.ts <agent-key-json> [cat_id] [mcp-url]
import { Account, JsonRpcProvider, type KeyPairString } from "near-api-js";
import { readFileSync } from "node:fs";

const [keyFile, wanted, mcpUrl = "https://nine-lives-alley.vercel.app/api/mcp"] = process.argv.slice(2);
const { accountId, privateKey } = JSON.parse(readFileSync(keyFile, "utf8"));

let nextId = 1;
async function mcp(method: string, params: object = {}) {
  const r = await fetch(mcpUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}
const tool = async (name: string, args: object = {}) => JSON.parse((await mcp("tools/call", { name, arguments: args })).content[0].text);

await mcp("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "nine-lives-agent", version: "1" } });
const forSale = await tool("list_cats_for_sale");
console.log(`for sale: ${forSale.map((c: { name: string; price: string }) => `${c.name} ${c.price}`).join(", ")}`);
const pick = wanted ? forSale.find((c: { cat_id: number }) => c.cat_id === Number(wanted)) : forSale[0];
if (!pick) throw new Error("nothing to buy");
const order = await tool("buy_cat", { cat_id: pick.cat_id, buyer_account_id: accountId });
if (!order.ok) throw new Error(order.reason);
const call = order.raw_function_call;
console.log(`agent ${accountId} buys ${order.cat} for ${order.price}: ${call.method_name}(${JSON.stringify(call.args)})`);
const provider = new JsonRpcProvider({ url: process.env.NEXT_PUBLIC_NEAR_RPC || "https://test.rpc.fastnear.com" });
const agent = new Account(accountId, provider, privateKey as KeyPairString);
await agent.callFunction({ contractId: call.receiver_id, methodName: call.method_name, args: call.args, gas: BigInt(call.gas), deposit: BigInt(call.deposit_yocto) });
const after = await tool("get_cat", { cat_id: pick.cat_id });
console.log(`done: ${after.name}'s NFT holder is now ${after.nft_holder}`);
