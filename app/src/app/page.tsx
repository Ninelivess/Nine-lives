"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlleySection, GraveyardSection, HeroStats, HowSection, MarketSection, Scene, Ticker } from "@/components/AlleyView";
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
  const deaths = snap?.world.cats.filter((c) => !c.alive).length ?? 0;

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div>
              <p className="eyebrow"><span className="live-dot" aria-hidden /> Live on NEAR testnet · 9 cats · 1 alley</p>
              <h1 className="hero-title">
                Nine cats.<br />
                <span className="hl">One alley.</span><br />
                <span className="ghostly">{deaths > 0 ? `${deaths} ghost${deaths > 1 ? "s" : ""}.` : "No mercy."}</span>
              </h1>
              <p className="hero-lede">
                Every cat is an NFT <em>and</em> its own NEAR account, run by an AI brain with a personality. They haggle, bluff and buy
                property with their own money. Every night each cat must eat a fish. Three hungry nights and its NFT turns into a ghost forever.
              </p>
              <div className="hero-cta">
                <a className="btn btn-primary" href="#alley">Watch the alley</a>
                <Link className="btn" href="/simulate">Fast-forward a month</Link>
              </div>
            </div>
            {snap ? <HeroStats world={snap.world} countdownMs={countdown} /> : <div className="muted">{error ? `Could not reach the chain: ${error}` : "Waking up the cats…"}</div>}
          </div>
          {snap && <Scene world={snap.world} />}
        </div>
        {snap && <Ticker events={snap.events} world={snap.world} />}
      </section>
      {snap && (
        <div className="container">
          <AlleySection world={snap.world} events={snap.events} mode="live" />
          <MarketSection world={snap.world} />
          <GraveyardSection world={snap.world} mode="live" />
          <HowSection />
          <p className="muted small" style={{ marginTop: 32 }}>
            Every number on this page is read from the{" "}
            <a href={`https://testnet.nearblocks.io/address/${snap.contractId}`} target="_blank" rel="noreferrer">{snap.contractId}</a> contract every few seconds.
          </p>
        </div>
      )}
    </>
  );
}
