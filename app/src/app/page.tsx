"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlleyScene, placeholderCats } from "@/components/AlleyScene";
import { DEFAULT_CONFIG, PLOTS } from "@/engine/world";
import type { WorldView } from "@/engine/types";
import { CatsScreen, GazetteScreen, GraveyardScreen, HowScreen, Icon } from "@/components/AlleyView";
import { FamilyScreen, FansScreen, FaqScreen, TalkScreen } from "@/components/MoreScreens";
import { describe } from "@/lib/describe";
import type { GameEvent } from "@/engine/types";
import { Intro } from "@/components/Intro";
import { Pager, goToPage } from "@/components/Pager";
import { PERSONALITIES } from "@/engine/personalities";
import type { CatInfo } from "@/engine/types";
import { useSnapshot } from "@/lib/snapshot";

const waiting: WorldView = {
  day: 1, fishPrice: 5, treasury: 0, config: DEFAULT_CONFIG, cats: placeholderCats(),
  plots: PLOTS.map((p) => ({ ...p, owner: null })), offers: [], recentFishPrices: [],
};

const LINES = [
  "Nine AI cats live in one alley on NEAR.",
  "Each one is an NFT and its own account.",
  "They trade, bluff and must eat to survive.",
  "Three hungry nights and the NFT becomes a ghost.",
  "Then a kitten is born. Every home has nine lives.",
  "3,150 fans can back them. Your AI can too.",
];

/** A news crawl of the latest on-chain events along the bottom of the stage. */
function Ticker({ world, events }: { world: WorldView | null; events: GameEvent[] }) {
  const items = useMemo(() => {
    if (!world) return [];
    const cats = new Map(world.cats.map((c) => [c.id, c]));
    return events
      .filter((e) => !["config", "refuel", "rot", "adopt", "listed", "delisted"].includes(e.kind))
      .slice(-14)
      .reverse()
      .map((e) => {
        const d = describe(e, cats, world.plots);
        return { id: e.id, day: e.day, text: d.quote && e.kind !== "born" ? `${d.text}: “${d.quote}”` : d.text };
      });
  }, [world, events]);
  if (!items.length) return null;
  const row = items.map((i) => (
    <span key={i.id} className="tick-item"><b>D{i.day}</b> {i.text}</span>
  ));
  return (
    <div className="ticker" aria-label="Latest from the alley">
      <span className="ticker-live"><i /> LIVE</span>
      <div className="ticker-track" style={{ animationDuration: `${Math.max(40, items.length * 7)}s` }}>
        <div>{row}</div>
        <div aria-hidden>{row}</div>
      </div>
    </div>
  );
}

function useTyped(lines: string[], start: number) {
  const [text, setText] = useState("");
  useEffect(() => {
    let line = 0;
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = lines[line];
      i += 1;
      setText(full.slice(0, i));
      if (i < full.length) t = setTimeout(tick, 32);
      else
        t = setTimeout(() => {
          line = (line + 1) % lines.length;
          i = 0;
          tick();
        }, 2200);
    };
    t = setTimeout(tick, start);
    return () => clearTimeout(t);
  }, [lines, start]);
  return text;
}

export default function Home() {
  const snap = useSnapshot();
  const typed = useTyped(LINES, 2900);
  const [pick, setPick] = useState<{ cat: CatInfo; x: number; y: number } | null>(null);

  // While someone watches, nudge the cats: each acts at most once per game day.
  useEffect(() => {
    const nudge = () => fetch("/api/advance", { method: "POST" }).catch(() => {});
    nudge();
    const t = setInterval(nudge, 15000);
    return () => clearInterval(t);
  }, []);

  // On phones the alley scrolls sideways: start in the middle.
  // (the pager handles vertical movement between pages)
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".home-scene");
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  const world = snap?.world ?? null;
  const live = pick ? world?.cats.find((c) => c.id === pick.cat.id) ?? pick.cat : null;
  const title = live ? PERSONALITIES.find((p) => p.key === live.personality)?.title : "";

  const alley = (
    <section className="screen home in" id="alley" data-screen="alley">
      <div className="home-scene">
        <AlleyScene world={world} events={snap?.events} wakeDelay={2800} onPick={(cat, r) => setPick({ cat, x: r.left + r.width / 2, y: r.top })} />
      </div>
      <div className="home-card pbox">
        <h1 className="home-title">Nine<br /><span className="gold">Lives</span></h1>
        <p className="typing" aria-live="polite">{typed}</p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => goToPage("cats")}><Icon name="cat" /> Meet the cats</button>
          <Link className="btn" href="/simulate"><Icon name="ff" /> Fast-forward</Link>
        </div>
      </div>
      {live && pick && (
        <div
          className="cat-dialog pbox"
          style={{ left: Math.min(Math.max(12, pick.x - 180), (typeof window !== "undefined" ? window.innerWidth : 1200) - 372), top: Math.max(90, pick.y - 170) }}
          role="dialog"
          aria-label={live.name}
        >
          <button className="close" onClick={() => setPick(null)} aria-label="Close">x</button>
          <b>{live.alive ? live.name : `Ghost of ${live.name}`}</b> <span className="label">{title}</span>
          <p>{live.alive ? (live.lastWords ? `“${live.lastWords}”` : "…purr.") : `Starved on day ${live.diedDay}. Its NFT is a ghost now.`}</p>
          <Link className="btn" href={`/cat/${live.id}`}><Icon name="paper" /> Open profile</Link>
        </div>
      )}
      <Ticker world={world} events={snap?.events ?? []} />
      <button className="scroll-down" onClick={() => goToPage("cats")}>▼ next page</button>
      <span className="swipe-hint">◀ swipe the alley ▶</span>
    </section>
  );

  // Until the chain answers, the pages render with the cats' starting state so the site is never empty.
  const w = world ?? waiting;
  return (
    <>
      <Intro />
      <Pager
        pages={[
          { id: "alley", node: alley },
          { id: "cats", node: <CatsScreen world={w} listings={snap?.listings ?? []} homes={snap?.homes} /> },
          { id: "fans", node: <FansScreen world={w} homes={snap?.homes} fans={snap?.fans} fanSeats={snap?.fanSeats} /> },
          { id: "family", node: <FamilyScreen world={w} homes={snap?.homes} listings={snap?.listings ?? []} /> },
          { id: "gazette", node: <GazetteScreen world={w} events={snap?.events ?? []} /> },
          { id: "graveyard", node: <GraveyardScreen world={w} /> },
          { id: "talk", node: <TalkScreen world={w} /> },
          { id: "how", node: <HowScreen world={world} /> },
          { id: "faq", node: <FaqScreen world={world} /> },
        ]}
      />
    </>
  );
}
