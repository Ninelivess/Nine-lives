"use client";

import Link from "next/link";
import { useMemo } from "react";
import { pixelCatSvg, tileColors } from "@/engine/pixel";
import { valuation } from "@/engine/brain";
import { PERSONALITIES } from "@/engine/personalities";
import type { CatInfo, GameEvent, WorldView } from "@/engine/types";
import { describe, near, plotName } from "@/lib/describe";

export function explorer(network: string | undefined, account: string): string {
  return `https://${network === "mainnet" ? "" : "testnet."}nearblocks.io/address/${account}`;
}

const ICONS: Record<string, string> = {
  fish: '<svg viewBox="0 0 9 5" shape-rendering="crispEdges"><rect x="0" y="1" width="6" height="3" fill="#7fc3e8"/><rect x="6" y="0" width="2" height="5" fill="#5aa0c8"/><rect x="1" y="2" width="1" height="1" fill="#06070d"/></svg>',
  coin: '<svg viewBox="0 0 7 7" shape-rendering="crispEdges"><rect x="2" y="0" width="3" height="7" fill="#ffd27a"/><rect x="0" y="2" width="7" height="3" fill="#ffd27a"/><rect x="1" y="1" width="5" height="5" fill="#ffd27a"/><rect x="3" y="2" width="1" height="3" fill="#a87a1e"/></svg>',
  up: '<svg viewBox="0 0 5 5" shape-rendering="crispEdges"><rect x="2" y="0" width="1" height="1" fill="#00ec97"/><rect x="1" y="1" width="3" height="1" fill="#00ec97"/><rect x="0" y="2" width="5" height="1" fill="#00ec97"/><rect x="2" y="3" width="1" height="2" fill="#00ec97"/></svg>',
  down: '<svg viewBox="0 0 5 5" shape-rendering="crispEdges"><rect x="2" y="0" width="1" height="2" fill="#ff5c7a"/><rect x="0" y="2" width="5" height="1" fill="#ff5c7a"/><rect x="1" y="3" width="3" height="1" fill="#ff5c7a"/><rect x="2" y="4" width="1" height="1" fill="#ff5c7a"/></svg>',
};

export function Icon({ name }: { name: keyof typeof ICONS }) {
  return <span className="ico-px" style={{ display: "inline-block", width: 11, height: 11, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

const KIND: Record<string, string> = {
  trade: "Trade", offer: "Offer", counter: "Counter", shop: "Shop", plot: "Plot", say: "Says", hungry: "Hungry", death: "Death",
  catch: "Luck", scraps: "Scraps", rot: "Rot", refuel: "Gas", claim: "Claim", feed: "Fed", tick: "Night", adopt: "Born", cancel: "Cancel", config: "Rules",
};

export function PixelCat({ c, size, bg = false }: { c: Pick<CatInfo, "id" | "personality" | "alive" | "fish" | "hunger">; size: number; bg?: boolean }) {
  return (
    <span
      className="px-cat"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: pixelCatSvg({ id: c.id, personality: c.personality, alive: c.alive, fish: c.fish, hunger: c.hunger }, size, bg) }}
    />
  );
}

function statusOf(c: CatInfo, world: WorldView): "fine" | "worried" | "hungry" | "ghost" {
  if (!c.alive) return "ghost";
  if (c.hunger > 0) return "hungry";
  const prod = world.plots.filter((p) => p.owner === c.id).reduce((s, p) => s + p.fishPerDay, 0);
  return c.fish <= 1 && prod === 0 ? "worried" : "fine";
}

// ---------------------------------------------------------------- rooftop scene

const STARS = Array.from({ length: 42 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 53) % 58, d: (i % 7) * 0.4 }));

export function Scene({ world, linkCats = true }: { world: WorldView; linkCats?: boolean }) {
  return (
    <div className="scene" aria-label="The alley at night">
      {STARS.map((s, i) => (
        <span key={i} className="star" style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }} />
      ))}
      <span className="moon" />
      <div className="skyline" />
      <div className="windows" />
      <div className="fence" />
      <div className="roof" />
      <div className="scene-cats">
        {world.cats.map((c) => {
          const inner = (
            <>
              <span className="tag">{c.alive ? c.name : `Ghost of ${c.name}`}{c.hunger > 0 && c.alive ? " · hungry" : ""}</span>
              {c.alive && c.hunger > 0 && <span className="zz">!</span>}
              <PixelCat c={c} size={88} />
            </>
          );
          const cls = `scene-cat ${c.alive ? "" : "ghost"}`;
          return linkCats ? (
            <Link key={c.id} href={`/cat/${c.id}`} className={cls} style={{ animationDelay: `${c.id * 0.3}s` }}>
              {inner}
            </Link>
          ) : (
            <div key={c.id} className={cls} style={{ animationDelay: `${c.id * 0.3}s` }}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ticker

export function Ticker({ events, world }: { events: GameEvent[]; world: WorldView }) {
  const cats = useMemo(() => new Map(world.cats.map((c) => [c.id, c])), [world.cats]);
  const items = [...events]
    .reverse()
    .filter((e) => ["trade", "death", "hungry", "plot", "shop", "catch", "scraps", "tick"].includes(e.kind))
    .slice(0, 14)
    .map((e) => describe(e, cats, world.plots));
  const kinds = [...events].reverse().filter((e) => ["trade", "death", "hungry", "plot", "shop", "catch", "scraps", "tick"].includes(e.kind)).slice(0, 14).map((e) => e.kind);
  if (!items.length) {
    items.push({ icon: "", text: "Nine cats wake up in the alley", tone: "info" });
    kinds.push("adopt");
  }
  const loop = [...items, ...items];
  const tone: Record<string, string> = { trade: "var(--green)", death: "var(--ghost)", hungry: "var(--red)", tick: "var(--warm)" };
  return (
    <div className="ticker" aria-hidden>
      <div className="ticker-track">
        {loop.map((d, i) => {
          const k = kinds[i % kinds.length];
          return (
            <span key={i} className="ticker-item"><span className="k" style={{ color: tone[k] ?? "var(--muted)" }}>{KIND[k] ?? k}</span> {d.text}</span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- cat cards

function CatCard({ c, world, mode }: { c: CatInfo; world: WorldView; mode: "live" | "sim" }) {
  const p = PERSONALITIES.find((x) => x.key === c.personality);
  const v = c.alive ? valuation(c, world) : null;
  const plots = world.plots.filter((x) => x.owner === c.id);
  const status = statusOf(c, world);
  const profit = c.balance - c.stake;
  const [t1, t2] = tileColors(c.personality, c.alive);
  const body = (
    <>
      <div className="tile" style={{ ["--t1" as string]: t1, ["--t2" as string]: t2 }}>
        <span className="num">#{String(c.id).padStart(2, "0")}</span>
        <span className={`status pill pill-${status}`}>{status === "ghost" ? `died day ${c.diedDay}` : status}</span>
        <PixelCat c={c} size={150} />
      </div>
      <div className="cat-body">
        <div>
          <div className="cat-name"><b>{c.alive ? c.name : `Ghost of ${c.name}`}</b></div>
          <div className="cat-title">{p?.title ?? c.personality}</div>
        </div>
        <div className="chips">
          <span className="chip" title="Fish in the bowl"><Icon name="fish" /> {c.fish}{v && v.production > 0 ? ` +${v.production}/d` : ""}</span>
          <span className="chip" title="Game wallet, NEAR"><Icon name="coin" /> {(c.balance / 1000).toFixed(3)}</span>
          <span className={`chip ${profit >= 0 ? "pos" : "neg"}`} title="Profit since birth, NEAR"><Icon name={profit >= 0 ? "up" : "down"} /> {(Math.abs(profit) / 1000).toFixed(3)}</span>
        </div>
        {plots.length > 0 && (
          <div className="chips">{plots.map((x) => <span key={x.id} className="plot-chip">{x.name} +{x.fishPerDay}</span>)}</div>
        )}
        {c.alive && c.hunger > 0 && (
          <div className="hunger" title="Hungry nights (3 = death)">
            {Array.from({ length: world.config.hungerLimit }, (_, i) => <i key={i} className={i < c.hunger ? "" : "off"} />)}
            <span>{world.config.hungerLimit - c.hunger} night(s) left</span>
          </div>
        )}
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

export function Feed({ events, world, title }: { events: GameEvent[]; world: WorldView; title?: string }) {
  const cats = useMemo(() => new Map(world.cats.map((c) => [c.id, c])), [world.cats]);
  const items = [...events].reverse().filter((e) => e.kind !== "adopt" || events.length < 30).slice(0, 90);
  const list = (
    <ol className="feed" aria-live="polite">
      {items.map((e) => {
        const d = describe(e, cats, world.plots);
        return (
          <li key={e.id} className={`feed-item tone-${d.tone}`}>
            <span className="feed-kind">{KIND[e.kind] ?? e.kind}</span>
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
  if (!title) return list;
  return (
    <aside className="feed-col">
      <div className="feed-head">
        <h3 className="feed-title"><span className="live-dot" /> {title}</h3>
        <span className="label">Day {world.day}</span>
      </div>
      <div className="feed-scroll">{list}</div>
    </aside>
  );
}

export function SectionHead({ num, title, sub, right }: { num: string; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="section-head">
      <div>
        <p className="section-num"><span className="bracket">{num}</span></p>
        <h2 className="section-title">{title}</h2>
        {sub && <p className="section-sub">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function AlleySection({ world, events, mode }: { world: WorldView; events: GameEvent[]; mode: "live" | "sim" }) {
  const alive = world.cats.filter((c) => c.alive);
  const ghosts = world.cats.filter((c) => !c.alive);
  return (
    <section className="section" id="alley">
      <SectionHead
        num="01 · The alley"
        title="Who is still alive."
        sub="Every card is an NFT with its own NEAR account. Click a cat to see what it is thinking."
      />
      <div className="alley-grid">
        <div className="cats">
          {[...alive, ...ghosts].map((c) => <CatCard key={c.id} c={c} world={world} mode={mode} />)}
        </div>
        <Feed events={events} world={world} title={mode === "live" ? "Live from the alley" : "Simulation feed"} />
      </div>
    </section>
  );
}

export function MarketSection({ world }: { world: WorldView }) {
  const cats = new Map(world.cats.map((c) => [c.id, c]));
  const name = (id: number | null) => (id === null ? "—" : cats.get(id)?.name ?? `#${id}`);
  const offers = [...world.offers].sort((a, b) => b.id - a.id);
  return (
    <section className="section" id="market">
      <SectionHead num="02 · The market" title="Fish, plots and bluffs." sub="Offers and counter-offers between cats. Settlement is atomic on-chain: money and goods move in one step." />
      <div className="market">
        <div className="panel">
          <h3>Open offers ({offers.length})</h3>
          {offers.length === 0 ? (
            <p className="muted">No open offers right now.</p>
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
        </div>
        <div className="panel">
          <h3>Plots · they produce fish every day</h3>
          <div className="plots-grid">
            {world.plots.map((p) => (
              <div key={p.id} className={`plot-card ${p.owner === null ? "free" : ""}`}>
                <span className="pname">{p.name}</span>
                <span className="yield">+{p.fishPerDay} fish / day</span>
                <span className="owner">{p.owner === null ? `For sale · ${near(world.config.plotBasePrice)}` : `Owned by ${name(p.owner)}`}</span>
              </div>
            ))}
          </div>
          <div className="shop-row">
            <span className="chip"><Icon name="fish" /> Shop price {near(world.fishPrice)}</span>
            <span className="chip"><Icon name="coin" /> Locked in vault {near(world.treasury, 2)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function GraveyardSection({ world, mode }: { world: WorldView; mode: "live" | "sim" }) {
  const ghosts = world.cats.filter((c) => !c.alive).sort((a, b) => (a.diedDay ?? 0) - (b.diedDay ?? 0));
  return (
    <section className="section" id="graveyard">
      <SectionHead num="03 · The graveyard" title="Ghosts, forever." sub="Three hungry nights and a cat dies. Its NFT is renamed “Ghost of …” and its picture turns into a ghost. Nobody can bring it back." />
      {ghosts.length === 0 ? (
        <div className="empty-graves">
          <span className="tomb" />
          <div>
            <b style={{ color: "var(--text)" }}>No ghosts yet.</b>
            <div>Every cat is still alive on day {world.day}. Keep watching the hunger bars.</div>
          </div>
        </div>
      ) : (
        <div className="graves">
          {ghosts.map((c) => {
            const inner = (
              <>
                <PixelCat c={c} size={110} />
                <b>{c.name}</b>
                <div className="label">Died on day {c.diedDay}</div>
              </>
            );
            return mode === "live" ? (
              <Link key={c.id} href={`/cat/${c.id}`} className="grave">{inner}</Link>
            ) : (
              <div key={c.id} className="grave">{inner}</div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function HowSection() {
  const cards = [
    { ico: "01", t: "Each NFT is an account", d: "Every cat owns cat-<id>.ninelives.testnet. Its only key can call 7 game methods. It can never move NEAR out." },
    { ico: "02", t: "Brains with personalities", d: "Loss aversion, herding, bluffing, present bias: nine sets of numbers decide every price. No LLM, fully reproducible." },
    { ico: "03", t: "Eat or become a ghost", d: "Every night each cat eats a fish. Three hungry nights and the NFT turns into a ghost, on-chain, forever." },
    { ico: "04", t: "Keep one alive", d: "Anyone can feed a cat from a wallet. The NFT holder can claim its profit. Take too much and it starves." },
  ];
  return (
    <section className="section" id="how">
      <SectionHead num="04 · How it works" title="Nobody is in charge." right={<Link className="btn" href="/how"><span className="btn-num">→</span> Read the rules</Link>} />
      <div className="how-grid">
        {cards.map((c) => (
          <div key={c.t} className="how-card">
            <span className="ico" aria-hidden>{c.ico}</span>
            <h3>{c.t}</h3>
            <p>{c.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function fmtCountdown(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms <= 0) return "now";
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function HeroStats({ world, countdownMs }: { world: WorldView; countdownMs: number | null }) {
  const alive = world.cats.filter((c) => c.alive).length;
  const hungry = world.cats.filter((c) => c.alive && c.hunger > 0).length;
  return (
    <div className="hero-stats" role="status">
      <div className="stat"><span className="stat-label">Day</span><span className="stat-value amber">{world.day}</span></div>
      <div className="stat"><span className="stat-label">Night falls in</span><span className="stat-value">{fmtCountdown(countdownMs)}</span></div>
      <div className="stat"><span className="stat-label">Alive</span><span className="stat-value">{alive}/{world.cats.length}</span></div>
      <div className="stat"><span className="stat-label">Hungry now</span><span className={`stat-value ${hungry ? "pink" : ""}`}>{hungry}</span></div>
      <div className="stat"><span className="stat-label">Shop fish</span><span className="stat-value mono" style={{ fontSize: 18 }}>{near(world.fishPrice)}</span></div>
      <div className="stat"><span className="stat-label">Locked in vault</span><span className="stat-value mono" style={{ fontSize: 18 }}>{near(world.treasury, 2)}</span></div>
    </div>
  );
}
