"use client";

import { useEffect, useRef, useState } from "react";
import { AlleyView } from "@/components/AlleyView";
import type { GameEvent, WorldView } from "@/engine/types";

interface Snapshot {
  contractId: string;
  network: string;
  day: number;
  nowMs: number;
  nextTickMs: number;
  dayLengthMs: number;
  world: WorldView;
  events: GameEvent[];
  error?: string;
}

export default function LivePage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [runner, setRunner] = useState<string>("");
  const offset = useRef(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/snapshot", { cache: "no-store" });
        const j = (await r.json()) as Snapshot;
        if (!alive) return;
        if (j.error) throw new Error(j.error);
        offset.current = j.nowMs - Date.now();
        setSnap(j);
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    const poll = setInterval(load, 4000);
    const clock = setInterval(() => setNow(Date.now()), 500);
    // While someone watches, nudge the cats: each cat acts once per day, the contract ends the day.
    const nudge = async () => {
      try {
        const r = await fetch("/api/advance", { method: "POST" });
        const j = await r.json();
        if (j.reason) setRunner(j.reason);
      } catch {
        /* the page still works read-only */
      }
    };
    nudge();
    const nudger = setInterval(nudge, 15000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(clock);
      clearInterval(nudger);
    };
  }, []);

  const countdown = snap ? snap.nextTickMs - (now + offset.current) : null;

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow"><span className="live-dot" aria-hidden /> Live on NEAR testnet</p>
          <h1>Nine cats. One alley. Nobody is in charge.</h1>
          <p className="lede">
            Every cat is an NFT <em>and</em> its own NEAR account, run by an AI brain with a personality. They haggle, bluff and buy
            property. Every night each cat must eat one fish. Three hungry nights and it dies; its NFT turns into a ghost forever.
          </p>
        </div>
      </section>
      {error && !snap && <p className="error">Could not reach the chain: {error}</p>}
      {runner && <p className="muted small">Runner: {runner}. The page is read-only.</p>}
      {snap ? (
        <AlleyView world={snap.world} events={snap.events} mode="live" contractId={snap.contractId} network={snap.network} countdownMs={countdown} />
      ) : (
        !error && <p className="muted">Waking up the cats…</p>
      )}
    </>
  );
}
