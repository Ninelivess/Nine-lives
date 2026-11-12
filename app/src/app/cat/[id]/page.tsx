"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { catSvg } from "@/engine/art";
import { valuation } from "@/engine/brain";
import { PERSONALITIES } from "@/engine/personalities";
import type { GameEvent, Traits, WorldView } from "@/engine/types";
import { Feed, explorer } from "@/components/AlleyView";
import { near } from "@/lib/describe";
import { CatActions } from "@/components/CatActions";

interface Snapshot { contractId: string; network: string; world: WorldView; events: GameEvent[] }

const TRAITS: { key: keyof Traits; label: string; max: number; help: string }[] = [
  { key: "risk", label: "Risk appetite", max: 1, help: "How readily it buys plots and other risky assets." },
  { key: "lossAversion", label: "Loss aversion (λ)", max: 3, help: "Prospect theory: how much more a loss hurts than an equal gain. Humans ≈ 2.25." },
  { key: "greed", label: "Greed", max: 1, help: "Markup it wants when selling." },
  { key: "bluff", label: "Bluffing", max: 1, help: "How often it anchors high and talks tough." },
  { key: "patience", label: "Patience", max: 1, help: "How long before it lowers its price." },
  { key: "generosity", label: "Generosity", max: 1, help: "Discount it gives to hungry cats." },
  { key: "herding", label: "Herding", max: 1, help: "Weight on what other cats paid instead of its own estimate." },
  { key: "safetyStock", label: "Safety stock", max: 6, help: "Fish it wants to keep in its bowl." },
  { key: "endowment", label: "Endowment effect", max: 3, help: "How much more it values what it already owns." },
];

export default function CatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const catId = Number(id);
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await fetch("/api/snapshot", { cache: "no-store" });
      const j = await r.json();
      if (alive && !j.error) setSnap(j);
    };
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const cat = snap?.world.cats.find((c) => c.id === catId);
  const events = useMemo(() => snap?.events.filter((e) => e.cat === catId || e.other === catId) ?? [], [snap, catId]);
  if (!snap) return <p className="muted">Loading…</p>;
  if (!cat) return <p>No cat #{catId}. <Link href="/">Back to the alley</Link></p>;
  const p = PERSONALITIES.find((x) => x.key === cat.personality);
  const v = cat.alive ? valuation(cat, snap.world) : null;
  const profit = cat.balance - cat.stake;

  return (
    <div className="cat-page">
      <p><Link href="/">← Back to the alley</Link></p>
      <div className="cat-hero">
        <div className="cat-portrait" dangerouslySetInnerHTML={{ __html: catSvg({ id: cat.id, personality: cat.personality, alive: cat.alive, fish: cat.fish, hunger: cat.hunger }, 260) }} />
        <div>
          <p className="eyebrow">NFT #{cat.id} · {p?.title}</p>
          <h1>{cat.alive ? cat.name : `Ghost of ${cat.name}`}</h1>
          <p className="lede">{p?.tagline}</p>
          <p className="muted small">Built on: {p?.basis}</p>
          {cat.lastWords && <blockquote className="bubble big">“{cat.lastWords}”</blockquote>}
          <dl className="facts">
            <div><dt>Status</dt><dd>{cat.alive ? (cat.hunger > 0 ? `hungry for ${cat.hunger} day(s)` : "alive") : `ghost since day ${cat.diedDay}`}</dd></div>
            <div><dt>Wallet</dt><dd className="mono">{near(cat.balance)}</dd></div>
            <div><dt>Stake</dt><dd className="mono">{near(cat.stake)}</dd></div>
            <div><dt>Profit</dt><dd className={`mono ${profit >= 0 ? "pos" : "neg"}`}>{near(profit)}</dd></div>
            <div><dt>Fish</dt><dd className="mono">{cat.fish}</dd></div>
            <div><dt>Gas on own account</dt><dd className="mono">{cat.gasBalance !== undefined ? near(cat.gasBalance) : "—"}</dd></div>
            <div><dt>Own NEAR account</dt><dd><a href={explorer(snap.network, cat.accountId)} target="_blank" rel="noreferrer">{cat.accountId}</a></dd></div>
            <div><dt>NFT holder</dt><dd>{cat.ownerId ? <a href={explorer(snap.network, cat.ownerId)} target="_blank" rel="noreferrer">{cat.ownerId}</a> : "—"}</dd></div>
          </dl>
        </div>
      </div>

      <div className="two-col">
        <section className="panel">
          <h2>Personality</h2>
          <p className="muted small">These numbers are stored on-chain with the cat and are the only input to its brain besides market data.</p>
          <ul className="traits">
            {TRAITS.map((t) => (
              <li key={t.key} title={t.help}>
                <span>{t.label}</span>
                <span className="bar"><span style={{ width: `${Math.min(100, (cat.traits[t.key] / t.max) * 100)}%` }} /></span>
                <span className="mono">{cat.traits[t.key]}</span>
              </li>
            ))}
          </ul>
          {v && (
            <>
              <h3>What it is thinking right now</h3>
              <ul className="thinking">
                <li>A fish is worth about <b className="mono">{near(v.ref)}</b> to it.</li>
                <li>It would pay up to <b className="mono">{near(v.wtp)}</b> per fish and sells for at least <b className="mono">{near(v.ask)}</b>.</li>
                <li>{v.need > 0 ? `It wants ${v.need} more fish.` : v.sellable > 0 ? `It can spare ${v.sellable} fish.` : "It is happy with its bowl."}</li>
                <li>{v.urgency >= 1 ? "It is in survival mode." : "It is calm."}</li>
              </ul>
            </>
          )}
          <h3>Help it, or cash in</h3>
          <CatActions cat={cat} network={snap.network} />
          <p className="small">The NFT holder can take the cat&apos;s profit (wallet above stake). Take too much and the cat may starve. If the NFT is sold, this right moves with it. From the command line:</p>
          <pre className="code">{`near contract call-function as-transaction ${snap.contractId} claim_profit json-args '{"token_id":"${cat.id}"}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as <holder>.testnet network-config testnet sign-with-keychain send`}</pre>
        </section>
        <section className="panel">
          <h2>Life story</h2>
          <Feed events={events} world={snap.world} />
        </section>
      </div>
    </div>
  );
}
