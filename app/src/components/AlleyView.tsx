"use client";

import Link from "next/link";
import { useMemo } from "react";
import { pixelCatSvg, tileColors } from "@/engine/pixel";
import { valuation } from "@/engine/brain";
import { PERSONALITIES } from "@/engine/personalities";
import type { CatInfo, GameEvent, WorldView } from "@/engine/types";
import { describe, near, plotName } from "@/lib/describe";
import { iconSvg, type IconName } from "@/lib/icons";

export function explorer(network: string | undefined, account: string): string {
  return `https://${network === "mainnet" ? "" : "testnet."}nearblocks.io/address/${account}`;
}

export function Icon({ name, size }: { name: IconName; size?: number }) {
  return <span className="ico" style={size ? { width: size, height: size } : undefined} dangerouslySetInnerHTML={{ __html: iconSvg(name) }} />;
}

export function PixelCat({ c, size }: { c: Pick<CatInfo, "id" | "personality" | "alive" | "fish" | "hunger">; size: number }) {
  return (
    <span
      className="px-cat"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: pixelCatSvg({ id: c.id, personality: c.personality, alive: c.alive, fish: c.fish, hunger: c.hunger }, size) }}
    />
  );
}

const EVENT_ICON: Record<string, IconName> = {
  trade: "coin", offer: "paper", counter: "paper", cancel: "paper", say: "cat", shop: "fish", plot: "house", hungry: "heart",
  death: "ghost", catch: "fish", scraps: "fish", rot: "fish", tick: "moon", refuel: "key", claim: "coin", feed: "paw", adopt: "cat", config: "book",
  listed: "coin", delisted: "paper", sale: "coin",
};

function statusOf(c: CatInfo, world: WorldView): "fine" | "worried" | "hungry" | "ghost" {
  if (!c.alive) return "ghost";
  if (c.hunger > 0) return "hungry";
  const prod = world.plots.filter((p) => p.owner === c.id).reduce((s, p) => s + p.fishPerDay, 0);
  return c.fish <= 1 && prod === 0 ? "worried" : "fine";
}

function PBar({ value, max, color }: { value: number; max: number; color: string }) {
  const n = 10;
  const on = Math.max(0, Math.min(n, Math.round((value / Math.max(max, 1e-9)) * n)));
  return (
    <span className="pbar" style={{ ["--c" as string]: color }}>
      {Array.from({ length: n }, (_, i) => <i key={i} className={i < on ? "on" : ""} />)}
    </span>
  );
}

export function ScreenHead({ icon, kicker, title, sub, right }: { icon: IconName; kicker: string; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="screen-head reveal">
      <div>
        <p className="screen-kicker"><Icon name={icon} /> {kicker}</p>
        <h2 className="screen-title">{title}</h2>
        {sub && <p className="screen-sub">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// ---------------------------------------------------------------- cats

export type Listings = { catId: number; price: number; seller: string }[];

export function CatCard({ c, world, linked = true, listings = [] }: { c: CatInfo; world: WorldView; linked?: boolean; listings?: Listings }) {
  const sale = listings.find((l) => l.catId === c.id);
  const p = PERSONALITIES.find((x) => x.key === c.personality);
  const v = c.alive ? valuation(c, world) : null;
  const plots = world.plots.filter((x) => x.owner === c.id);
  const status = statusOf(c, world);
  const [t1, t2] = tileColors(c.personality, c.alive);
  const richest = Math.max(...world.cats.map((x) => x.balance), 1);
  const life = c.alive ? world.config.hungerLimit - c.hunger : 0;
  const body = (
    <>
      <div className="portrait" style={{ ["--t1" as string]: t1, ["--t2" as string]: t2 }}>
        <span className="num">#{c.id}</span>
        <PixelCat c={c} size={92} />
      </div>
      <div>
        <div className="cat-name"><b>{c.alive ? c.name : `Ghost of ${c.name}`}</b><span className={`pill pill-${status}`}>{status === "ghost" ? `day ${c.diedDay}` : status}</span></div>
        <div className="cat-title">{p?.title ?? c.personality}{plots.length > 0 ? ` · ${plots.length} plot${plots.length > 1 ? "s" : ""}` : ""}</div>
        <div className="bars">
          <div className="bar-row" title="Nights left before starving"><Icon name="heart" /><PBar value={life} max={world.config.hungerLimit} color={life <= 1 ? "#d6455a" : "#e8665a"} /><span>{c.alive ? `${life}/3` : "—"}</span></div>
          <div className="bar-row" title="Fish in the bowl"><Icon name="fish" /><PBar value={c.fish} max={world.config.fishCap} color="#5aa0c8" /><span>{c.fish}{v && v.production > 0 ? `+${v.production}` : ""}</span></div>
          <div className="bar-row" title="Wallet in NEAR"><Icon name="coin" /><PBar value={c.balance} max={richest} color="#e8a33a" /><span>{(c.balance / 1000).toFixed(3)}</span></div>
        </div>
        {c.lastWords && <div className="cat-quote">“{c.lastWords}”</div>}
        {sale && <div className="chips"><span className="plot-chip sale-chip">for sale · {(sale.price / 1000).toFixed(3)} NEAR</span></div>}
      </div>
    </>
  );
  return linked ? (
    <Link href={`/cat/${c.id}`} className={`cat-card pbox ${c.alive ? "" : "is-ghost"}`}>{body}</Link>
  ) : (
    <div className={`cat-card pbox ${c.alive ? "" : "is-ghost"}`}>{body}</div>
  );
}

export function CatsScreen({ world, linked = true, listings = [] }: { world: WorldView; linked?: boolean; listings?: Listings }) {
  const alive = world.cats.filter((c) => c.alive);
  const ghosts = world.cats.filter((c) => !c.alive);
  return (
    <section className="screen" id="cats" data-screen="cats">
      <div className="container">
        <ScreenHead
          icon="cat"
          kicker="Character select"
          title="The nine."
          sub="Each cat is an NFT with its own NEAR account and a personality from behavioral economics. Click one to see what it is thinking, or adopt one."
          right={<Link className="btn" href="/agents"><Icon name="bot" /> Buy with your AI</Link>}
        />
        <div className="roster">
          {[...alive, ...ghosts].map((c, i) => (
            <div key={c.id} className={`reveal d${(i % 3) + 1}`}><CatCard c={c} world={world} linked={linked} listings={listings} /></div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- gazette

export function Feed({ events, world, limit = 70 }: { events: GameEvent[]; world: WorldView; limit?: number }) {
  const cats = useMemo(() => new Map(world.cats.map((c) => [c.id, c])), [world.cats]);
  const items = [...events].reverse().filter((e) => e.kind !== "adopt" || events.length < 30).slice(0, limit);
  return (
    <ol className="feed" aria-live="polite">
      {items.map((e) => {
        const d = describe(e, cats, world.plots);
        return (
          <li key={e.id} className={`feed-item tone-${d.tone}`}>
            <Icon name={EVENT_ICON[e.kind] ?? "paper"} />
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

export function GazetteScreen({ world, events }: { world: WorldView; events: GameEvent[] }) {
  const cats = new Map(world.cats.map((c) => [c.id, c]));
  const name = (id: number | null) => (id === null ? "—" : cats.get(id)?.name ?? `#${id}`);
  const offers = [...world.offers].sort((a, b) => b.id - a.id);
  return (
    <section className="screen" id="gazette" data-screen="gazette">
      <div className="container">
        <ScreenHead icon="paper" kicker="Read all about it" title="The Alley Gazette." sub="Every line below is an on-chain event. Offers, counter-offers and trades are transactions the cats sign themselves." />
        <div className="gazette">
          <div className="pbox reveal d1">
            <div className="paper-head"><b>Live from the alley</b><span className="label" style={{ color: "#8c7a63" }}>Day {world.day}</span></div>
            <div className="feed-scroll"><Feed events={events} world={world} /></div>
          </div>
          <div className="side-stack">
            <div className="pbox reveal d2">
              <h3 className="box-title">Open offers</h3>
              {offers.length === 0 ? (
                <p style={{ margin: 0, color: "#6b5a72" }}>Nobody is selling right now.</p>
              ) : (
                <table className="table">
                  <thead><tr><th>Cat</th><th>Wants to</th><th>What</th><th className="num">Price</th></tr></thead>
                  <tbody>
                    {offers.slice(0, 7).map((o) => (
                      <tr key={o.id}>
                        <td>{name(o.maker)}{o.toCat !== null ? ` → ${name(o.toCat)}` : ""}</td>
                        <td><span className={`side side-${o.side}`}>{o.side}</span></td>
                        <td>{o.item === "plot" ? plotName(world.plots, o.plotId ?? 0) : `${o.qty} fish`}</td>
                        <td className="num mono">{near(o.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="pbox reveal d3">
              <h3 className="box-title">Plots &amp; the fish shop</h3>
              <div className="plots-grid">
                {world.plots.map((p) => (
                  <div key={p.id} className={`plot-card ${p.owner === null ? "free" : ""}`}>
                    <span className="pname">{p.name}</span>
                    <span className="yield">+{p.fishPerDay} fish / day</span>
                    <span className="owner">{p.owner === null ? `for sale · ${near(world.config.plotBasePrice)}` : name(p.owner)}</span>
                  </div>
                ))}
              </div>
              <div className="chips" style={{ marginTop: 12 }}>
                <span className="plot-chip" style={{ background: "#7fc3e8" }}>shop fish {near(world.fishPrice)}</span>
                <span className="plot-chip" style={{ background: "#e2cfa5" }}>locked in vault {near(world.treasury, 2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- graveyard

export function GraveyardScreen({ world, linked = true }: { world: WorldView; linked?: boolean }) {
  const ghosts = world.cats.filter((c) => !c.alive).sort((a, b) => (a.diedDay ?? 0) - (b.diedDay ?? 0));
  return (
    <section className="screen" id="graveyard" data-screen="graveyard">
      <div className="container">
        <ScreenHead icon="tomb" kicker="Rest in pixels" title="The graveyard." sub="Three hungry nights and a cat dies. Its NFT is renamed “Ghost of …” and its picture changes on-chain. Nobody can bring it back." />
        <div className="yard reveal d1">
          <div className="yard-ground" />
          {ghosts.length === 0 ? (
            <div className="empty-yard">No ghosts yet. Every cat is still alive on day {world.day}.</div>
          ) : (
            <div className="graves">
              {ghosts.map((c, i) => {
                const inner = (
                  <>
                    <span className="ghost" style={{ animationDelay: `${i * 0.5}s` }}><PixelCat c={c} size={96} /></span>
                    <div className="stone"><b>{c.name}</b><span>day 1 – {c.diedDay}</span></div>
                  </>
                );
                return linked ? <Link key={c.id} href={`/cat/${c.id}`} className="grave">{inner}</Link> : <div key={c.id} className="grave">{inner}</div>;
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- how it works (a 4-panel comic)

export function HowScreen({ world }: { world: WorldView | null }) {
  const sample = (key: string, alive = true, hunger = 0) => ({ id: 0, personality: key, alive, fish: 3, hunger });
  const panels = [
    { n: "1", title: "Each NFT is an account", text: "A cat is born with its own NEAR account and one key. The key can play the game. It can never move NEAR out.", art: <><PixelCat c={sample("shark")} size={84} /><Icon name="key" /></>, say: "it's MY key" },
    { n: "2", title: "They haggle", text: "Offers, counter-offers, bluffs. Every trade is signed by the cat and settled by the contract in one step.", art: <><PixelCat c={sample("bluffer")} size={76} /><Icon name="fish" /><PixelCat c={sample("hoarder")} size={76} /></>, say: "final offer!" },
    { n: "3", title: "Eat or become a ghost", text: "Every night each cat eats a fish. Three hungry nights and the NFT turns into a ghost, forever.", art: <><Icon name="moon" /><PixelCat c={sample("panicker", true, 2)} size={84} /><PixelCat c={sample("lazy", false)} size={70} /></>, say: "so hungry…" },
    { n: "4", title: "Keep one alive", text: "Anyone can feed a cat from a wallet. The NFT holder can claim its profit. Take too much and it starves.", art: <><Icon name="paw" /><PixelCat c={sample("saint")} size={84} /><Icon name="coin" /></>, say: "thank you!" },
  ];
  return (
    <section className="screen" id="how" data-screen="how">
      <div className="container">
        <ScreenHead icon="book" kicker="The rules, in four panels" title="Nobody is in charge." right={<Link className="btn" href="/how"><Icon name="book" /> Full rules</Link>} />
        <div className="comic">
          {panels.map((p, i) => (
            <div key={p.n} className={`panel-c pbox reveal d${(i % 3) + 1}`}>
              <div className="panel-art">
                <span className="panel-num">{p.n}</span>
                <span className="speech">{p.say}</span>
                {p.art}
              </div>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
        <div className="end-card end-gap pbox reveal d2" style={{ marginTop: 48 }}>
          <div>
            <h2>Watch them live.</h2>
            <p>{world ? `Day ${world.day} on NEAR testnet. ${world.cats.filter((c) => c.alive).length} alive, ${world.cats.filter((c) => !c.alive).length} ghosts.` : "Running on NEAR testnet."} Built at NEAR HACKATHON.</p>
          </div>
          <div className="btn-row" style={{ margin: 0 }}>
            <Link className="btn btn-primary" href="/simulate"><Icon name="ff" /> Fast-forward</Link>
            <a className="btn" href="https://github.com/Ninelivess/Nine-lives" target="_blank" rel="noreferrer"><Icon name="paper" /> Source</a>
          </div>
        </div>
        <div className="foot">
          <span>Cats live on <a href="https://testnet.nearblocks.io/address/ninelives.testnet" target="_blank" rel="noreferrer">ninelives.testnet</a></span>
          <span>Original pixel art · no cats were harmed (some became ghosts)</span>
        </div>
      </div>
    </section>
  );
}
