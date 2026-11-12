import { NextResponse } from "next/server";
import { advance } from "@/engine/runner";
import { PERSONALITIES } from "@/engine/personalities";
import type { Action, CatInfo } from "@/engine/types";
import { nearAiChat, nearAiReady } from "@/lib/nearai";

const nums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).sort().join(",");

/** NEAR AI rewrites each template line in the cat's own voice. Numbers must survive unchanged. */
async function rewrite(cat: CatInfo, action: Action): Promise<string> {
  const line = "message" in action ? action.message : "";
  if (!line) return line;
  const p = PERSONALITIES.find((x) => x.key === cat.personality);
  const r = await nearAiChat(
    [
      { role: "system", content: `You write one line of dialogue for ${cat.name}, a pixel cat in an alley where cats trade fish to survive. Personality: ${p?.title ?? cat.personality}. ${p?.tagline ?? ""} Rewrite the line in this cat's voice. Keep every number exactly as written and keep the meaning. At most 110 characters. Reply with the line only, no quotes.` },
      { role: "user", content: line },
    ],
    { maxTokens: 200, timeoutMs: 4000, temperature: 0.9 },
  );
  const out = r.text.replace(/^["“]|["”]$/g, "").split("\n")[0].trim();
  return out && out.length <= 150 && nums(out) === nums(line) ? out : line;
}

// Lets the alley live while someone is watching: the page calls this every few seconds.
// It is safe to call often: each cat acts at most once per game day and the contract refuses
// to end a day early. Only server-side secrets can sign; none are sent to the browser.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

let running: Promise<unknown> | null = null;
let lastStart = 0;

export async function POST() {
  const { MASTER_SEED, KEEPER_ACCOUNT_ID, KEEPER_KEY } = process.env;
  if (!MASTER_SEED || !KEEPER_ACCOUNT_ID || !KEEPER_KEY) {
    return NextResponse.json({ ok: false, reason: "runner not configured" }, { status: 503 });
  }
  if (running || Date.now() - lastStart < 8000) return NextResponse.json({ ok: true, skipped: true });
  lastStart = Date.now();
  running = advance({ masterSeed: MASTER_SEED, keeperAccountId: KEEPER_ACCOUNT_ID, keeperKey: KEEPER_KEY, rewrite: nearAiReady() ? rewrite : undefined });
  try {
    const r = (await running) as Awaited<ReturnType<typeof advance>>;
    return NextResponse.json({ ok: true, day: r.day, actions: r.results.length, ticked: r.ticked });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    running = null;
  }
}
