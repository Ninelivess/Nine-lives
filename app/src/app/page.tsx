"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlleyScene, placeholderCats } from "@/components/AlleyScene";
import { DEFAULT_CONFIG, PLOTS } from "@/engine/world";
import type { WorldView } from "@/engine/types";
import { CatsScreen, GazetteScreen, GraveyardScreen, HowScreen, Icon } from "@/components/AlleyView";
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
];

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
        <AlleyScene world={world} wakeDelay={2800} onPick={(cat, r) => setPick({ cat, x: r.left + r.width / 2, y: r.top })} />
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
          { id: "cats", node: <CatsScreen world={w} /> },
          { id: "gazette", node: <GazetteScreen world={w} events={snap?.events ?? []} /> },
          { id: "graveyard", node: <GraveyardScreen world={w} /> },
          { id: "how", node: <HowScreen world={world} /> },
        ]}
      />
    </>
  );
}
