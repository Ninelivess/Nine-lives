import { NextResponse } from "next/server";
import { advance } from "@/engine/runner";

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
  running = advance({ masterSeed: MASTER_SEED, keeperAccountId: KEEPER_ACCOUNT_ID, keeperKey: KEEPER_KEY });
  try {
    const r = (await running) as Awaited<ReturnType<typeof advance>>;
    return NextResponse.json({ ok: true, day: r.day, actions: r.results.length, ticked: r.ticked });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    running = null;
  }
}
