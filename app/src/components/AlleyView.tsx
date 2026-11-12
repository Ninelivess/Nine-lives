"use client";

import Link from "next/link";
import { useMemo } from "react";
import { catSvg } from "@/engine/art";
import { valuation } from "@/engine/brain";
import { PERSONALITIES } from "@/engine/personalities";
import type { CatInfo, GameEvent, WorldView } from "@/engine/types";
import { describe, near, plotName } from "@/lib/describe";

export interface AlleyProps {
  world: WorldView;
  events: GameEvent[];
  /** "live" links to on-chain accounts; "sim" is the offline fast-forward. */
  mode: "live" | "sim";
  contractId?: string;
  network?: string;
  countdownMs?: number | null;
}

export function explorer(network: string | undefined, account: string): string {
  return `https://${network === "mainnet" ? "" : "testnet."}nearblocks.io/address/${account}`;
}

function CatCard({ c, world, mode, network }: { c: CatInfo; world: WorldView; mode: AlleyProps["mode"]; network?: string }) {
  const p = PERSONALITIES.find((x) => x.key === c.personality);
  const v = c.alive ? valuation(c, world) : null;
  const plots = world.plots.filter((x) => x.owner === c.id);
  const status = !c.alive ? "ghost" : c.hunger > 0 ? "hungry" : c.fish <= 1 && (v?.production ?? 0) === 0 ? "worried" : "fine";
  const profit = c.balance - c.stake;
  const art = catSvg({ id: c.id, personality: c.personality, alive: c.alive, fish: c.fish, hunger: c.hunger }, 120);
  const body = (
    <>
      <div className="cat-art" dangerouslySetInnerHTML={{ __html: art }} />
      <div className="cat-main">
        <div className="cat-name">
          <span>{c.alive ? c.name : `Ghost of ${c.name}`}</span>
          <span className={`pill pill-${status}`}>{status === "ghost" ? `died day ${c.diedDay}` : status}</span>
        </div>
        <div className="cat-title">{p?.title ?? c.personality}</div>
        <dl className="cat-stats">
          <div><dt>Wallet Ⓝ</dt><dd className="mono">{(c.balance / 1000).toFixed(3)}</dd></div>
          <div><dt>Fish</dt><dd className="mono">{c.fish} 🐟{v && v.production > 0 ? ` +${v.production}/day` : ""}</dd></div>
          <div><dt>P&amp;L Ⓝ</dt><dd className={`mono ${profit >= 0 ? "pos" : "neg"}`}>{profit >= 0 ? "+" : ""}{(profit / 1000).toFixed(3)}</dd></div>
          <div><dt>Trades</dt><dd className="mono">{c.trades}</dd></div>
        </dl>
        {plots.length > 0 && <div className="cat-plots">{plots.map((x) => <span key={x.id} className="plot-chip">📦 {x.name}</span>)}</div>}
        {c.hunger > 0 && c.alive && <div className="hunger">{"😿".repeat(c.hunger)} {world.config.hungerLimit - c.hunger} day(s) left without food</div>}
        {c.lastWords && <blockquote className="bubble">“{c.lastWords}”</blockquote>}
      </div>
    </>
  );
  return mode === "live" ? (
    <Link href={`/cat/${c.id}`} className={`cat-card ${c.alive ? "" : "is-ghost"}`} aria-label={`${c.name}, ${p?.title}`}>
      {body}
    </Link>
  ) : (
    <div className={`cat-card ${c.alive ? "" : "is-ghost"}`}>{body}</div>
  );
}

export function Feed({ events, world }: { events: GameEvent[]; world: WorldView }) {
  const cats = useMemo(() => new Map(world.cats.map((c) => [c.id, c])), [world.cats]);
  const items = [...events].reverse().filter((e) => e.kind !== "adopt" || events.length < 30).slice(0, 80);
  return (
    <ol className="feed" aria-live="polite">
      {items.map((e) => {
        const d = describe(e, cats, world.plots);
        return (
          <li key={e.id} className={`feed-item tone-${d.tone}`}>
            <span className="feed-icon" aria-hidden>{d.icon}</span>
            <div>
              <div className="feed-text">{d.text}</div>
              {d.quote && <div className="feed-quote">“{d.quote}”</div>}
              <div className="feed-meta">Day {e.day}</div>
            </div>
          </li>
        );
      })}
      {items.length === 0 && <li className="feed-item">The alley is quiet…</li>}
    </ol>
  );
}

function Market({ world }: { world: WorldView }) {
  const cats = new Map(world.cats.map((c) => [c.id, c]));
  const name = (id: number | null) => (id === null ? "—" : cats.get(id)?.name ?? `#${id}`);
  const offers = [...world.offers].sort((a, b) => b.id - a.id);
  return (
    <div className="market">
      <section className="panel">
        <h3>Open offers <span className="muted">({offers.length})</span></h3>
        {offers.length === 0 ? (
          <p className="muted">No open offers.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Cat</th><th>Wants to</th><th>What</th><th className="num">Price</th><th>To</th></tr>
            </thead>
            <tbody>
              {offers.slice(0, 12).map((o) => (
                <tr key={o.id}>
                  <td>{name(o.maker)}</td>
                  <td><span className={`side side-${o.side}`}>{o.side}</span></td>
                  <td>{o.item === "plot" ? plotName(world.plots, o.plotId ?? 0) : `${o.qty} fish`}</td>
                  <td className="num mono">{near(o.price)}</td>
                  <td>{o.toCat === null ? "anyone" : name(o.toCat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="panel">
        <h3>Plots <span className="muted">(they produce fish every day)</span></h3>
        <ul className="plots">
          {world.plots.map((p) => (
            <li key={p.id}>
              <span>📦 {p.name}</span>
              <span className="muted mono">+{p.fishPerDay} 🐟/day</span>
              <span className={p.owner === null ? "muted" : ""}>{p.owner === null ? `for sale · ${near(world.config.plotBasePrice)}` : name(p.owner)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function AlleyView({ world, events, mode, contractId, network, countdownMs }: AlleyProps) {
  const alive = world.cats.filter((c) => c.alive);
  const ghosts = world.cats.filter((c) => !c.alive);
  const lastTick = [...events].reverse().find((e) => e.kind === "tick");
  return (
    <div className="alley">
      <div className="stats-bar" role="status">
        <div className="stat"><span className="stat-label">Day</span><span className="stat-value mono">{world.day}</span></div>
        <div className="stat">
          <span className="stat-label">Night falls in</span>
          <span className="stat-value mono">{countdownMs === null || countdownMs === undefined ? "—" : countdownMs <= 0 ? "now" : fmtCountdown(countdownMs)}</span>
        </div>
        <div className="stat"><span className="stat-label">Alive</span><span className="stat-value mono">{alive.length}/{world.cats.length}</span></div>
        <div className="stat"><span className="stat-label">Shop fish</span><span className="stat-value mono">{near(world.fishPrice)}</span></div>
        <div className="stat"><span className="stat-label">Locked in shop vault</span><span className="stat-value mono">{near(world.treasury, 2)}</span></div>
      </div>

      <div className="alley-grid">
        <div>
          <div className="cats">
            {[...alive, ...ghosts].map((c) => (
              <CatCard key={c.id} c={c} world={world} mode={mode} network={network} />
            ))}
          </div>
          <Market world={world} />
          {mode === "live" && contractId && (
            <p className="muted small">
              Every number on this page is read from the <a href={explorer(network, contractId)} target="_blank" rel="noreferrer">{contractId}</a> contract.
              {lastTick ? ` Last night: ${lastTick.text}` : ""}
            </p>
          )}
        </div>
        <aside className="feed-col">
          <h2 className="feed-title">{mode === "live" ? "Live from the alley" : "Simulation feed"}</h2>
          <Feed events={events} world={world} />
        </aside>
      </div>
    </div>
  );
}
