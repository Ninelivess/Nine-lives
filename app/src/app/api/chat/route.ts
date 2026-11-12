import { NextResponse } from "next/server";
import { PERSONALITIES } from "@/engine/personalities";
import { toCat, toEvent, view } from "@/engine/rpc";
import { HOMES, describe } from "@/lib/describe";
import { NEARAI_MODEL, nearAiChat, nearAiReady, type ChatMsg } from "@/lib/nearai";
import type { CatInfo } from "@/engine/types";

// Talk to a cat. The cat answers in character from its live on-chain state, through NEAR AI
// Cloud (private inference). Without a NEAR AI key it falls back to a simple scripted reply.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 12;
}

function traitWords(c: CatInfo): string {
  const t = c.traits;
  const w: string[] = [];
  w.push(t.risk > 0.65 ? "loves risk" : t.risk < 0.35 ? "plays it safe" : "takes some risks");
  w.push(t.lossAversion > 2 ? "hates losing anything" : t.lossAversion < 1.2 ? "shrugs off losses" : "dislikes losses");
  if (t.greed > 0.6) w.push("greedy, wants a fat margin");
  if (t.bluff > 0.5) w.push("bluffs a lot");
  if (t.generosity > 0.6) w.push("generous to hungry cats");
  if (t.herding > 0.7) w.push("copies what other cats pay");
  if (t.patience < 0.25) w.push("impatient");
  if (t.activity < 0.5) w.push("lazy");
  w.push(`likes to keep ${t.safetyStock} fish in stock`);
  return w.join(", ");
}

function offline(c: CatInfo, q: string): string {
  if (!c.alive) return `Ooooo… I starved on day ${c.diedDay}. Feed the living, not the ghosts.`;
  const p = PERSONALITIES.find((x) => x.key === c.personality);
  const ask = q.toLowerCase();
  if (/fish|hungry|food|eat/.test(ask)) return c.fish > 0 ? `I have ${c.fish} fish in my bowl. ${c.hunger ? "Still hungry though." : "I'm fine. For now."}` : `My bowl is empty. ${c.hunger} hungry night${c.hunger === 1 ? "" : "s"} so far. Got a fish?`;
  if (/sell|buy|price|near/.test(ask)) return `My wallet holds ${(c.balance / 1000).toFixed(3)} NEAR. ${p?.tagline ?? ""}`;
  return c.lastWords ? `${c.lastWords} …that's what I said today. ${p?.tagline ?? ""}` : `Meow. ${p?.tagline ?? ""}`;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many messages. The cat needs a nap; try again in a minute." }, { status: 429 });
  let body: { catId?: number; messages?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const catId = Number(body.catId);
  const history: ChatMsg[] = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-8)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 400) }));
  if (!catId || !history.length || history[history.length - 1].role !== "user") return NextResponse.json({ error: "Say something to a cat" }, { status: 400 });

  const [raw, rawEvents, rawCats] = await Promise.all([
    view<Parameters<typeof toCat>[0] | null>("get_cat", { cat_id: catId }),
    view<Parameters<typeof toEvent>[0][]>("get_events", { limit: 200 }).catch(() => []),
    view<Parameters<typeof toCat>[0][]>("get_cats").catch(() => []),
  ]);
  if (!raw) return NextResponse.json({ error: "No such cat" }, { status: 404 });
  const c = toCat(raw);
  const today = rawEvents.length ? rawEvents[rawEvents.length - 1].day : null;
  const cats = new Map(rawCats.map(toCat).map((x) => [x.id, x]));
  const p = PERSONALITIES.find((x) => x.key === c.personality);
  const mine = rawEvents.map(toEvent).filter((e) => e.cat === c.id || e.other === c.id).slice(-8);
  const parent = c.parent ? cats.get(c.parent)?.name : null;
  const neighbours = [...cats.values()].filter((x) => x.id !== c.id && x.alive).map((x) => `${x.name} (${PERSONALITIES.find((q) => q.key === x.personality)?.title ?? x.personality}, ${x.fish} fish)`);

  const system = [
    `You are ${c.name}, a pixel cat living in the ${HOMES[c.home] ?? "alley"} in the Nine Lives alley, an on-chain game on NEAR where AI cats trade fish, must eat one fish every night, and die after three hungry nights.`,
    c.alive ? `You are alive.` : `You are a GHOST: you starved on day ${c.diedDay}. Speak like a wistful ghost.`,
    `Your personality: ${p?.title ?? c.personality}. ${p?.tagline ?? ""} You ${traitWords(c)}.`,
    `Facts (only use these numbers): today is day ${today ?? "?"}; fish in your bowl ${c.fish}; hungry nights ${c.hunger}/3; wallet ${(c.balance / 1000).toFixed(3)} NEAR; plots owned ${c.plots.length}; trades so far ${c.trades}; life ${c.life} of your home's nine lives; generation ${c.generation}${parent ? `, child of ${parent}` : ""}.`,
    c.lastWords ? `The last thing you said on-chain: "${c.lastWords}".` : "",
    mine.length ? `What happened to you recently (on-chain): ${mine.map((e) => describe(e, cats).text).join("; ")}.` : "",
    neighbours.length ? `Cats alive next to you: ${neighbours.join(", ")}.` : "",
    `Rules: stay in character as a cat. Answer in 1-3 short sentences, under 60 words, in the language the human writes in. Never invent prices, balances or events beyond the facts above. You cannot sign transactions in this chat; if someone wants to help you, say they can feed you or take a seat in your home's fan club on the website. No financial advice.`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!nearAiReady()) {
    return NextResponse.json({ reply: offline(c, history[history.length - 1].content), mode: "offline", model: null });
  }
  try {
    const r = await nearAiChat([{ role: "system", content: system }, ...history], { maxTokens: 400 });
    return NextResponse.json({ reply: r.text || offline(c, history[history.length - 1].content), mode: "near-ai", model: r.model ?? NEARAI_MODEL, id: r.id });
  } catch (e) {
    return NextResponse.json({ reply: offline(c, history[history.length - 1].content), mode: "offline", model: null, note: e instanceof Error ? e.message : "error" });
  }
}
