"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { valuation } from "@/engine/brain";
import { tileColors } from "@/engine/pixel";
import { PERSONALITIES } from "@/engine/personalities";
import type { Traits } from "@/engine/types";
import { Feed, Icon, PixelCat, explorer } from "@/components/AlleyView";
import { CatActions } from "@/components/CatActions";
import { near } from "@/lib/describe";
import { useSnapshot } from "@/lib/snapshot";

const TRAITS: { key: keyof Traits; label: string; max: number; help: string }[] = [
  { key: "risk", label: "Risk appetite", max: 1, help: "How readily it buys plots and other risky assets." },
  { key: "lossAversion", label: "Loss aversion λ", max: 3, help: "Prospect theory: how much more a loss hurts than an equal gain. Humans ≈ 2.25." },
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
  const snap = useSnapshot();
  const cat = snap?.world.cats.find((c) => c.id === catId);
  const events = useMemo(() => snap?.events.filter((e) => e.cat === catId || e.other === catId) ?? [], [snap, catId]);
  if (!snap) return <div className="page"><div className="container"><p className="muted">Loading…</p></div></div>;
  if (!cat) return <div className="page"><div className="container"><p>No cat #{catId}. <Link href="/">Back to the alley</Link></p></div></div>;
  const p = PERSONALITIES.find((x) => x.key === cat.personality);
  const v = cat.alive ? valuation(cat, snap.world) : null;
  const profit = cat.balance - cat.stake;
  const [t1, t2] = tileColors(cat.personality, cat.alive);
  const prev = ((catId + 7) % 9) + 1;
  const next = (catId % 9) + 1;

  return (
    <div className="page">
      <div className="container">
        <div className="cat-hero">
          <div>
            <div className="portrait-big" style={{ ["--t1" as string]: t1, ["--t2" as string]: t2 }}>
              <PixelCat c={cat} size={280} />
            </div>
            <div className="btn-row" style={{ justifyContent: "space-between", marginTop: 22 }}>
              <Link className="btn" href={`/cat/${prev}`}>◀ Prev</Link>
              <Link className="btn" href="/#cats"><Icon name="house" /></Link>
              <Link className="btn" href={`/cat/${next}`}>Next ▶</Link>
            </div>
          </div>
          <div>
            <p className="screen-kicker"><Icon name={cat.alive ? "cat" : "ghost"} /> NFT #{cat.id} · {p?.title}</p>
            <h1 className="page-title">{cat.alive ? cat.name : `Ghost of ${cat.name}`}</h1>
            <p className="screen-sub" style={{ color: "var(--text)" }}>{p?.tagline} <span className="muted">Built on: {p?.basis}</span></p>
            {cat.lastWords && <blockquote className="bubble pbox">“{cat.lastWords}”</blockquote>}
            <dl className="facts">
              <div><dt>Status</dt><dd>{cat.alive ? (cat.hunger > 0 ? `hungry ${cat.hunger}/3 nights` : "alive and fed") : `ghost since day ${cat.diedDay}`}</dd></div>
              <div><dt>Wallet</dt><dd className="mono">{near(cat.balance)}</dd></div>
              <div><dt>Profit since birth</dt><dd className="mono" style={{ color: profit >= 0 ? "#1f6e46" : "#b23a4c" }}>{near(profit)}</dd></div>
              <div><dt>Fish · trades</dt><dd className="mono">{cat.fish} · {cat.trades}</dd></div>
              <div><dt>Its own NEAR account</dt><dd><a href={explorer(snap.network, cat.accountId)} target="_blank" rel="noreferrer" style={{ color: "#8a4b12" }}>{cat.accountId}</a></dd></div>
              <div><dt>Gas left on it</dt><dd className="mono">{cat.gasBalance !== undefined ? near(cat.gasBalance) : "—"}</dd></div>
            </dl>
          </div>
        </div>

        <div className="two-col">
          <section className="pbox">
            <h3 className="box-title">Personality</h3>
            <p className="small" style={{ marginTop: -4, color: "#6b5a72" }}>Stored on-chain with the cat. The only input to its brain besides market data.</p>
            <ul className="traits">
              {TRAITS.map((t) => (
                <li key={t.key} title={t.help}>
                  <span>{t.label}</span>
                  <span className="pbar" style={{ ["--c" as string]: "#e8a33a" }}>
                    {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < Math.round(Math.min(1, cat.traits[t.key] / t.max) * 10) ? "on" : ""} />)}
                  </span>
                  <span className="mono">{cat.traits[t.key]}</span>
                </li>
              ))}
            </ul>
            {v && (
              <>
                <h3 className="box-title">What it is thinking</h3>
                <ul className="thinking">
                  <li>A fish is worth about <b className="mono">{near(v.ref)}</b> to it.</li>
                  <li>It pays up to <b className="mono">{near(v.wtp)}</b> per fish and sells for at least <b className="mono">{near(v.ask)}</b>.</li>
                  <li>{v.need > 0 ? `It wants ${v.need} more fish.` : v.sellable > 0 ? `It can spare ${v.sellable} fish.` : "It is happy with its bowl."}</li>
                  <li>{v.urgency >= 1 ? "It is in survival mode." : "It is calm."}</li>
                </ul>
              </>
            )}
            <h3 className="box-title">Help it, or cash in</h3>
            <CatActions cat={cat} network={snap.network} />
            <pre className="code">{`near contract call-function as-transaction ${snap.contractId} claim_profit json-args '{"token_id":"${cat.id}"}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as <holder>.testnet network-config testnet sign-with-keychain send`}</pre>
          </section>
          <section className="pbox">
            <h3 className="box-title">Life story</h3>
            <div className="feed-scroll"><Feed events={events} world={snap.world} /></div>
          </section>
        </div>
      </div>
    </div>
  );
}
