import { NextResponse } from "next/server";
import { loadSnapshot, DEFAULT_CONTRACT, NETWORK } from "@/engine/rpc";

export const dynamic = "force-dynamic";

// Stale-while-revalidate: answer from memory at once, refresh in the background.
let cache: { at: number; body: unknown } | null = null;
let inflight: Promise<unknown> | null = null;

async function refresh() {
  const snap = await loadSnapshot({ withGas: true });
  const body = {
    contractId: DEFAULT_CONTRACT,
    network: NETWORK,
    day: snap.state.day,
    nowMs: snap.state.now_ms,
    nextTickMs: snap.state.next_tick_ms,
    dayLengthMs: snap.state.config.day_length_ms,
    world: snap.world,
    events: snap.events,
  };
  cache = { at: Date.now(), body };
  return body;
}

export async function GET() {
  if (cache && Date.now() - cache.at > 2500 && !inflight) {
    inflight = refresh().catch(() => null).finally(() => (inflight = null));
  }
  if (cache) return NextResponse.json(cache.body);
  try {
    inflight ??= refresh().finally(() => (inflight = null));
    return NextResponse.json(await inflight);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
