"use client";

// The alley at night: nine homes, nine cats. On first view the cats wake up one by one and hop
// out of their homes; dead cats rise as ghosts. Click a cat and it talks.

import { useEffect, useMemo, useRef, useState } from "react";
import { pixelCatInner } from "@/engine/pixel";
import { PERSONALITIES } from "@/engine/personalities";
import { GROUND, H, HOME_X, W, home, sceneBackground } from "@/engine/scene";
import type { CatInfo, WorldView } from "@/engine/types";

export function placeholderCats(): CatInfo[] {
  return PERSONALITIES.map((p, i) => ({
    id: i + 1, name: p.name, accountId: `cat-${i + 1}.ninelives.testnet`, personality: p.key, traits: p.traits,
    balance: 0, stake: 0, fish: 3, hunger: 0, alive: true, accountReady: true, bornDay: 1, diedDay: null,
    trades: 0, claimed: 0, lastWords: "", ownerId: null, plots: [],
  }));
}

export interface SceneProps {
  world: WorldView | null;
  /** Wake the cats this many ms after mount (lets the intro finish first). */
  wakeDelay?: number;
  onPick?: (cat: CatInfo, rect: DOMRect) => void;
  framing?: "cover" | "contain";
}

export function AlleyScene({ world, wakeDelay = 0, onPick, framing = "cover" }: SceneProps) {
  const cats = world?.cats.length ? world.cats : placeholderCats();
  const bg = useMemo(() => sceneBackground(), []);
  const homes = useMemo(() => HOME_X.map((_, i) => home(i)), []);
  const [awake, setAwake] = useState(0);
  const [mode, setMode] = useState<"wide" | "mid" | "narrow">("wide");
  const started = useRef(false);

  useEffect(() => {
    const onResize = () => {
      const a = window.innerWidth / window.innerHeight;
      setMode(a > W / H ? "wide" : a < 0.8 ? "narrow" : "mid");
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let n = 0;
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      iv = setInterval(() => {
        n += 1;
        setAwake(n);
        if (n >= 9 && iv) clearInterval(iv);
      }, 230);
    }, wakeDelay);
    return () => {
      clearTimeout(t);
      if (iv) clearInterval(iv);
    };
  }, [wakeDelay]);

  const sprites = useMemo(
    () =>
      cats.map((c) => ({
        asleep: pixelCatInner({ ...c, alive: true, hunger: 0, sleeping: true }),
        awake: pixelCatInner({ ...c, alive: true }),
        ghost: pixelCatInner({ ...c, alive: false }),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cats.map((c) => `${c.id}${c.alive}${c.hunger}`).join()],
  );

  // Phones get the whole alley at a large size inside a horizontal scroller (see .home-scene CSS).
  const viewBox = `0 0 ${W} ${H}`;
  const par = framing === "contain" || mode !== "wide" ? "xMidYMax meet" : "xMidYMax slice";

  return (
    <svg viewBox={viewBox} preserveAspectRatio={par} shapeRendering="crispEdges" role="img" aria-label="Nine pixel cats in a night alley">
      <g dangerouslySetInnerHTML={{ __html: bg }} />
      <clipPath id="ground-clip"><rect x="0" y="0" width={W} height={GROUND} /></clipPath>
      {world && (
        <text x="21" y="235" textAnchor="middle" className="px-text" fontSize="5" fill="#ffd27a">{(world.fishPrice / 1000).toFixed(3)}N</text>
      )}
      {cats.map((c, i) => {
        const hm = homes[i];
        const up = i < awake;
        const yIn = hm.insideY;
        const yOut = 216 - 31;
        const x = HOME_X[i] - 16;
        const dead = !c.alive;
        return (
          <g key={c.id}>
            <g dangerouslySetInnerHTML={{ __html: hm.back }} />
            {!dead && (
              <g clipPath="url(#ground-clip)">
                <g
                  style={{ transform: `translate(${x}px, ${up ? yOut : yIn}px)`, transition: "transform .5s cubic-bezier(.3,1.7,.5,1)" }}
                  dangerouslySetInnerHTML={{ __html: up ? sprites[i].awake : sprites[i].asleep }}
                />
              </g>
            )}
            <g dangerouslySetInnerHTML={{ __html: hm.front }} />
            {!up && !dead && (
              <text x={HOME_X[i] + 9} y={200} className="px-text zz" fontSize="6" fill="#b9cdfa" style={{ animationDelay: `${i * 0.37}s` }}>z</text>
            )}
            {dead && (
              <g style={{ opacity: up ? 0.92 : 0, transform: `translateY(${up ? -30 : 6}px)`, transition: "opacity .8s steps(6), transform 1s ease-out" }}>
                <g className="bob" style={{ animationDelay: `${i * 0.4}s` }}>
                  <g transform={`translate(${x} ${yOut})`} dangerouslySetInnerHTML={{ __html: sprites[i].ghost }} />
                </g>
              </g>
            )}
            {up && !dead && c.hunger > 0 && (
              <g className="blink">
                <rect x={HOME_X[i] - 1} y={170} width={3} height={7} fill="#ff5c7a" />
                <rect x={HOME_X[i] - 1} y={179} width={3} height={2} fill="#ff5c7a" />
              </g>
            )}
            {onPick && (
              <rect
                className="cat-hit"
                x={HOME_X[i] - 18}
                y={dead ? 150 : 180}
                width={36}
                height={dead ? 70 : 58}
                fill="transparent"
                onClick={(e) => onPick(c, (e.currentTarget as SVGRectElement).getBoundingClientRect())}
              >
                <title>{c.alive ? c.name : `Ghost of ${c.name}`}</title>
              </rect>
            )}
          </g>
        );
      })}
    </svg>
  );
}
