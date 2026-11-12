import { NextResponse } from "next/server";
import { loadSnapshot, DEFAULT_CONTRACT, NETWORK } from "@/engine/rpc";

export const dynamic = "force-dynamic";

let cache: { at: number; body: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 2500) return NextResponse.json(cache.body);
  try {
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
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
