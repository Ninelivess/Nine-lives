// Nine Lives MCP server (Streamable HTTP, stateless JSON responses).
// Lets AI assistants such as Claude or ChatGPT read the alley and buy, sell or feed cat NFTs.
// Write actions never move anyone's money by themselves: they return a one-click link where the
// human signs with their own wallet, plus the raw NEAR function call for agents that hold their
// own key and can sign it themselves.

import { NextResponse } from "next/server";
import { PERSONALITIES } from "@/engine/personalities";
import { DEFAULT_CONTRACT, NETWORK, loadSnapshot, view } from "@/engine/rpc";
import { milliToYocto, yoctoToMilli } from "@/engine/units";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://nine-lives-alley.vercel.app";
const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

interface RawListing { token_id: string; cat_id: number; name: string; alive: boolean; seller: string; price: string }

const near = (mN: number) => `${(mN / 1000).toFixed(3)} NEAR`;
const catId = { type: "integer", minimum: 1, maximum: 9, description: "Cat id, 1-9 (also its NFT token id)." };

const TOOLS = [
  { name: "alley_status", description: "Current state of the Nine Lives alley on NEAR: game day, cats alive and dead, fish price, time until night.", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true } },
  { name: "list_cats", description: "All nine cats: name, personality, alive or ghost, wallet, fish, hunger, NFT holder and sale price if listed.", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true } },
  { name: "get_cat", description: "Everything about one cat: personality numbers, what it last said, recent life events, NFT holder, sale price.", inputSchema: { type: "object", properties: { cat_id: catId }, required: ["cat_id"] }, annotations: { readOnlyHint: true } },
  { name: "list_cats_for_sale", description: "Cat NFTs currently for sale, cheapest first, with seller and price in NEAR.", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true } },
  { name: "how_it_works", description: "The rules of the alley and how buying, selling, feeding and profit claims work.", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true } },
  {
    name: "buy_cat",
    description: "Prepare buying a listed cat NFT. Returns the price, a link where the user approves the purchase in their own NEAR wallet, and the raw NEAR function call for agents that can sign transactions themselves. Nothing is bought until it is signed.",
    inputSchema: { type: "object", properties: { cat_id: catId, buyer_account_id: { type: "string", description: "Optional NEAR account that will buy, for the explanation only." } }, required: ["cat_id"] },
  },
  {
    name: "sell_cat",
    description: "Prepare listing a cat NFT for sale at a price. Only the current NFT holder can sign it. Returns a signing link and the raw function call.",
    inputSchema: { type: "object", properties: { cat_id: catId, price_near: { type: "number", minimum: 0.01, description: "Asking price in NEAR." } }, required: ["cat_id", "price_near"] },
  },
  {
    name: "delist_cat",
    description: "Prepare taking a cat NFT off the market. Only the holder can sign it.",
    inputSchema: { type: "object", properties: { cat_id: catId }, required: ["cat_id"] },
  },
  {
    name: "feed_cat",
    description: "Prepare feeding a living cat: NEAR sent goes into the cat's wallet so it can buy fish and survive. Anyone can feed any living cat.",
    inputSchema: { type: "object", properties: { cat_id: catId, amount_near: { type: "number", minimum: 0.001, description: "How much NEAR to give." } }, required: ["cat_id", "amount_near"] },
  },
];

function rawCall(method: string, args: Record<string, unknown>, depositYocto: string) {
  return {
    network: NETWORK,
    receiver_id: DEFAULT_CONTRACT,
    method_name: method,
    args,
    deposit_yocto: depositYocto,
    deposit_near: Number(yoctoToMilli(depositYocto) / 1000).toString(),
    gas: "50000000000000",
  };
}

async function listings(): Promise<RawListing[]> {
  return view<RawListing[]>("get_listings");
}

async function callTool(name: string, args: Record<string, unknown>) {
  const id = Number(args.cat_id);
  switch (name) {
    case "alley_status": {
      const s = await loadSnapshot();
      const alive = s.world.cats.filter((c) => c.alive);
      return {
        network: NETWORK,
        contract: DEFAULT_CONTRACT,
        day: s.state.day,
        next_night_in_seconds: Math.max(0, Math.round((s.state.next_tick_ms - s.state.now_ms) / 1000)),
        alive: alive.map((c) => c.name),
        ghosts: s.world.cats.filter((c) => !c.alive).map((c) => `${c.name} (died day ${c.diedDay})`),
        hungry_now: alive.filter((c) => c.hunger > 0).map((c) => `${c.name} (${c.hunger}/3 hungry nights)`),
        shop_fish_price: near(s.world.fishPrice),
        website: SITE,
      };
    }
    case "list_cats": {
      const [s, l] = await Promise.all([loadSnapshot(), listings()]);
      return s.world.cats.map((c) => {
        const sale = l.find((x) => x.cat_id === c.id);
        return {
          cat_id: c.id,
          name: c.name,
          personality: PERSONALITIES.find((p) => p.key === c.personality)?.title,
          status: c.alive ? (c.hunger > 0 ? `hungry ${c.hunger}/3` : "alive") : `ghost since day ${c.diedDay}`,
          wallet: near(c.balance),
          fish: c.fish,
          nft_holder: c.ownerId,
          for_sale: sale ? near(yoctoToMilli(sale.price)) : null,
        };
      });
    }
    case "get_cat": {
      const [s, l] = await Promise.all([loadSnapshot(), listings()]);
      const c = s.world.cats.find((x) => x.id === id);
      if (!c) throw new Error(`No cat #${id}`);
      const p = PERSONALITIES.find((x) => x.key === c.personality);
      const sale = l.find((x) => x.cat_id === c.id);
      return {
        cat_id: c.id,
        name: c.name,
        archetype: p?.title,
        tagline: p?.tagline,
        based_on: p?.basis,
        traits: c.traits,
        status: c.alive ? (c.hunger > 0 ? `hungry ${c.hunger}/3 nights` : "alive") : `ghost since day ${c.diedDay}`,
        own_near_account: c.accountId,
        wallet: near(c.balance),
        profit_since_birth: near(c.balance - c.stake),
        fish: c.fish,
        trades: c.trades,
        last_words: c.lastWords,
        nft_holder: c.ownerId,
        for_sale: sale ? { price: near(yoctoToMilli(sale.price)), seller: sale.seller } : null,
        recent_events: s.events.filter((e) => e.cat === id || e.other === id).slice(-8).map((e) => `day ${e.day} ${e.kind}: ${e.text}`),
        page: `${SITE}/cat/${c.id}`,
        image: `${SITE}/api/cat/${c.id}/image`,
      };
    }
    case "list_cats_for_sale": {
      const l = await listings();
      return l
        .sort((a, b) => (BigInt(a.price) < BigInt(b.price) ? -1 : 1))
        .map((x) => ({ cat_id: x.cat_id, name: x.name, alive: x.alive, price: near(yoctoToMilli(x.price)), seller: x.seller, buy_link: `${SITE}/sign?action=buy&cat=${x.cat_id}` }));
    }
    case "how_it_works":
      return {
        summary: "Nine AI cats live in one alley on NEAR. Each cat is an NFT and its own NEAR account with a key that can only play the game. They trade fish and plots with their own money. Every night each cat eats one fish; three hungry nights and it dies, and its NFT becomes a ghost forever.",
        owning_a_cat: "The NFT holder can claim the cat's profit (wallet above its stake). Taking too much can starve it. When the NFT is sold, the right to profits moves with it.",
        buying_and_selling: "Holders list cats with sell_cat. Anyone can buy a listed cat with buy_cat: the NFT and the payment move in one transaction. Ghost cats can be sold as collectibles.",
        safety: "These tools never sign anything. Write actions return a link where the human approves in their own wallet, and the raw function call for agents that sign with their own key.",
        network: NETWORK,
        contract: DEFAULT_CONTRACT,
        website: SITE,
      };
    case "buy_cat": {
      const l = await listings();
      const sale = l.find((x) => x.cat_id === id);
      if (!sale) return { ok: false, reason: `Cat #${id} is not for sale right now.`, for_sale: l.map((x) => `#${x.cat_id} ${x.name} ${near(yoctoToMilli(x.price))}`) };
      if (args.buyer_account_id && args.buyer_account_id === sale.seller) return { ok: false, reason: "That account already owns this cat." };
      return {
        ok: true,
        cat: `${sale.name} (#${id}, ${sale.alive ? "alive" : "ghost"})`,
        price: near(yoctoToMilli(sale.price)),
        seller: sale.seller,
        approve_in_wallet: `${SITE}/sign?action=buy&cat=${id}`,
        raw_function_call: rawCall("buy_cat", { token_id: String(id) }, sale.price),
        note: "Open approve_in_wallet to buy with your own NEAR wallet (testnet). Agents with their own NEAR key can sign raw_function_call directly. Nothing has been bought yet.",
      };
    }
    case "sell_cat": {
      const price = Number(args.price_near);
      if (!(price >= 0.01)) throw new Error("price_near must be at least 0.01");
      const yocto = milliToYocto(price * 1000);
      return {
        ok: true,
        approve_in_wallet: `${SITE}/sign?action=sell&cat=${id}&price=${price}`,
        raw_function_call: rawCall("list_cat", { token_id: String(id), price: yocto }, "0"),
        note: "Only the current NFT holder can sign this. Nothing has been listed yet.",
      };
    }
    case "delist_cat":
      return { ok: true, approve_in_wallet: `${SITE}/sign?action=delist&cat=${id}`, raw_function_call: rawCall("delist_cat", { token_id: String(id) }, "0"), note: "Only the current NFT holder can sign this." };
    case "feed_cat": {
      const amount = Number(args.amount_near);
      if (!(amount >= 0.001)) throw new Error("amount_near must be at least 0.001");
      const yocto = milliToYocto(amount * 1000);
      return {
        ok: true,
        approve_in_wallet: `${SITE}/sign?action=feed&cat=${id}&amount=${amount}`,
        raw_function_call: rawCall("feed", { token_id: String(id) }, yocto),
        note: "Feeding adds NEAR to the cat's game wallet so it can buy fish. Nothing has been sent yet.",
      };
    }
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
  }
}

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method?: string; params?: Record<string, unknown> };

async function handle(msg: Rpc): Promise<object | null> {
  const isNotification = msg.id === undefined || msg.id === null;
  const reply = (result: object) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return reply({
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "nine-lives", title: "Nine Lives: AI cats on NEAR", version: "1.0.0" },
        instructions:
          "Nine Lives is a live game on NEAR testnet: nine AI cats, each an NFT with its own account. Use the read tools to look around. buy_cat, sell_cat, delist_cat and feed_cat only prepare a transaction: show the user the approve_in_wallet link (or sign raw_function_call yourself if you hold a NEAR key and the user asked you to).",
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      if (!TOOLS.some((t) => t.name === name)) return fail(-32602, `Unknown tool: ${name}`);
      try {
        const out = await callTool(name, args);
        return reply({ content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: Array.isArray(out) ? { items: out } : out, isError: false });
      } catch (e) {
        return reply({ content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true });
      }
    }
    case "resources/list":
      return reply({ resources: [] });
    case "prompts/list":
      return reply({ prompts: [] });
    default:
      if (isNotification) return null;
      return fail(-32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: Request) {
  let body: Rpc | Rpc[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: CORS });
  }
  const batch = Array.isArray(body) ? body : [body];
  const results = (await Promise.all(batch.map(handle))).filter(Boolean);
  if (!results.length) return new Response(null, { status: 202, headers: CORS });
  return NextResponse.json(Array.isArray(body) ? results : results[0], { headers: CORS });
}

// No server-initiated stream: this server answers each request directly.
export async function GET() {
  return new Response("Nine Lives MCP server. POST JSON-RPC to this URL (Streamable HTTP).", { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
