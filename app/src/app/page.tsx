"use client";

import { useEffect, useRef, useState } from "react";
import { AlleySection, GraveyardSection, HowSection, MarketSection, Ticker } from "@/components/AlleyView";
import { AlleyStory } from "@/components/AlleyStory";
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
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/snapshot", { cache: "no-store" });
        const j = (await r.json()) as Snapshot;
        if (!alive || j.error) return;
        offset.current = j.nowMs - Date.now();
        setSnap(j);
      } catch {
        /* keep the last snapshot */
      }
    };
    load();
    const poll = setInterval(load, 4000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    // While someone watches, nudge the cats: each cat acts once per day, the contract ends the day.
    const nudge = () => fetch("/api/advance", { method: "POST" }).catch(() => {});
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
      <AlleyStory world={snap?.world ?? null} countdownMs={countdown} />
      {snap && <Ticker events={snap.events} world={snap.world} />}
      <div className="container">
        {snap ? (
          <>
            <AlleySection world={snap.world} events={snap.events} mode="live" />
            <MarketSection world={snap.world} />
            <GraveyardSection world={snap.world} mode="live" />
            <HowSection />
            <p className="muted small" style={{ marginTop: 40 }}>
              Every number on this page is read from the{" "}
              <a href={`https://testnet.nearblocks.io/address/${snap.contractId}`} target="_blank" rel="noreferrer">{snap.contractId}</a> contract every few seconds.
            </p>
          </>
        ) : (
          <p className="muted" style={{ padding: "80px 0" }}>Connecting to NEAR testnet…</p>
        )}
      </div>
    </>
  );
}
