"use client";

// The alley at night, as a live reality show. Nine homes; in each lives the latest cat of that
// home's nine lives. Every new on-chain event is acted out on stage: cats talk in speech bubbles,
// fish and coins fly between them on a trade, night falls when the day ends, ghosts rise, kittens
// pop out of dark homes. Idle cats breathe and blink.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pixelCatInner } from "@/engine/pixel";
import { PERSONALITIES } from "@/engine/personalities";
import { GROUND, H, HOME_X, W, fishPixels, home, sceneBackground } from "@/engine/scene";
import type { CatInfo, GameEvent, WorldView } from "@/engine/types";

export function placeholderCats(): CatInfo[] {
  return PERSONALITIES.map((p, i) => ({
    id: i + 1, name: p.name, accountId: `cat-${i + 1}.ninelives.testnet`, personality: p.key, traits: p.traits,
    balance: 0, stake: 0, fish: 3, hunger: 0, alive: true, accountReady: true, bornDay: 1, diedDay: null,
    trades: 0, claimed: 0, lastWords: "", ownerId: null, plots: [], home: i, generation: 1, parent: null, life: 1,
  }));
}

/** The cat living in each of the nine homes now: the newest one of that home. */
export function residentsOf(cats: CatInfo[]): (CatInfo | null)[] {
  return HOME_X.map((_, h) => {
    let best: CatInfo | null = null;
    for (const c of cats) if (c.home === h && (!best || c.id > best.id)) best = c;
    return best;
  });
}

export interface SceneProps {
  world: WorldView | null;
  /** On-chain events. New ones are acted out on stage. */
  events?: GameEvent[];
  /** Wake the cats this many ms after mount (lets the intro finish first). */
  wakeDelay?: number;
  onPick?: (cat: CatInfo, rect: DOMRect) => void;
  framing?: "cover" | "contain";
}

type Pt = { x: number; y: number };
type Fx =
  | { id: number; kind: "bubble"; home: number; lines: string[]; tone: "say" | "deal" | "shop" }
  | { id: number; kind: "fly"; from: Pt; to: Pt; what: "fish" | "coin" }
  | { id: number; kind: "banner"; text: string; sub: string; tone: "night" | "death" | "birth" | "sale" | "fan" }
  | { id: number; kind: "night" }
  | { id: number; kind: "float"; home: number; text: string; color: string }
  | { id: number; kind: "sparkle"; home: number };

type FxIn = Fx extends unknown ? (Fx extends infer T ? (T extends Fx ? Omit<T, "id"> : never) : never) : never;

const SHOP: Pt = { x: 21, y: 214 };
const head = (h: number): Pt => ({ x: HOME_X[h], y: 190 });

function wrap(text: string, width = 24, maxLines = 3): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      if (cur) lines.push(cur);
      cur = w.length > width ? w.slice(0, width - 1) + "…" : w;
    } else cur = (cur + " " + w).trim();
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length + 1) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = (last.length > width - 1 ? last.slice(0, width - 1) : last) + "…";
  }
  return lines;
}

function msg(text: string): string {
  const i = text.indexOf("|");
  return i >= 0 ? text.slice(i + 1) : text;
}

const DURATION: Record<Fx["kind"], number> = { bubble: 5200, fly: 1300, banner: 3600, night: 2600, float: 2000, sparkle: 2200 };

export function AlleyScene({ world, events, wakeDelay = 0, onPick, framing = "cover" }: SceneProps) {
  const cats = world?.cats.length ? world.cats : placeholderCats();
  const residents = useMemo(() => residentsOf(cats), [cats]);
  const homeOfCat = useMemo(() => new Map(cats.map((c) => [c.id, c.home])), [cats]);
  const nameOf = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats]);
  const bg = useMemo(() => sceneBackground(), []);
  const homes = useMemo(() => HOME_X.map((_, i) => home(i)), []);
  const fish = useMemo(() => fishPixels(), []);
  const [awake, setAwake] = useState(0);
  const [mode, setMode] = useState<"wide" | "mid" | "narrow">("wide");
  const [fx, setFx] = useState<Fx[]>([]);
  const [blinkHome, setBlinkHome] = useState(-1);
  const started = useRef(false);
  const seen = useRef<number | null>(null);
  const fxId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  // Idle life: now and then one cat blinks.
  useEffect(() => {
    const iv = setInterval(() => {
      const h = Math.floor(Math.random() * 9);
      setBlinkHome(h);
      setTimeout(() => setBlinkHome(-1), 170);
    }, 1400);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const add = useCallback((f: FxIn, delay = 0) => {
    const t = setTimeout(() => {
      const id = fxId.current++;
      const item = { ...f, id } as Fx;
      setFx((prev) => {
        // One bubble per home at a time, and never more than three bubbles on stage.
        let next = prev;
        if (item.kind === "bubble") {
          next = next.filter((x) => !(x.kind === "bubble" && x.home === item.home));
          const bubbles = next.filter((x) => x.kind === "bubble");
          if (bubbles.length >= 3) next = next.filter((x) => x !== bubbles[0]);
        }
        return [...next.slice(-16), item];
      });
      timers.current.push(setTimeout(() => setFx((prev) => prev.filter((x) => x.id !== id)), DURATION[item.kind]));
    }, delay);
    timers.current.push(t);
  }, []);

  /** Turn one on-chain event into stage effects. */
  const act = useCallback(
    (e: GameEvent, delay: number, replay: boolean) => {
      const hOf = (id: number | null) => (id === null ? null : homeOfCat.get(id) ?? null);
      const h = hOf(e.cat);
      const say = (home: number | null, text: string, tone: "say" | "deal" | "shop") => {
        if (home === null || !text.trim()) return;
        add({ kind: "bubble", home, lines: wrap(text), tone }, delay);
      };
      switch (e.kind) {
        case "say":
          say(h, e.text, "say");
          break;
        case "offer":
        case "counter":
          say(h, msg(e.text) || (e.text.startsWith("sell") ? `Selling ${e.qty} ${e.item}` : `Buying ${e.item}`), "deal");
          break;
        case "cancel":
          say(h, e.text || "Never mind.", "say");
          break;
        case "trade": {
          const seller = hOf(e.cat);
          const buyer = hOf(e.other);
          const taker = e.text.split("|")[0] === "sell" ? buyer : seller;
          say(taker, msg(e.text) || "Deal!", "deal");
          if (!replay && seller !== null && buyer !== null) {
            add({ kind: "fly", from: head(seller), to: head(buyer), what: e.item === "plot" ? "coin" : "fish" }, delay + 300);
            add({ kind: "fly", from: head(buyer), to: head(seller), what: "coin" }, delay + 500);
          }
          break;
        }
        case "shop":
          say(h, e.text || `Bought ${e.qty} fish`, "shop");
          if (!replay && h !== null) add({ kind: "fly", from: SHOP, to: head(h), what: "fish" }, delay + 200);
          break;
        case "plot":
          say(h, msg(e.text) || "This spot is mine now.", "deal");
          break;
        case "catch":
        case "scraps":
          if (!replay && h !== null) add({ kind: "float", home: h, text: "+1 fish", color: "#7fc3e8" }, delay);
          break;
        case "hungry":
          if (!replay && h !== null) add({ kind: "float", home: h, text: "hungry…", color: "#ff7a6b" }, delay);
          break;
        case "feed":
          if (!replay && h !== null) add({ kind: "float", home: h, text: "fed!", color: "#ffcf4a" }, delay);
          break;
        case "fan":
          if (!replay) {
            const fh = e.qty;
            add({ kind: "float", home: fh, text: "♥ new fan", color: "#f4a6b8" }, delay);
          }
          break;
        case "tick":
          if (!replay) {
            add({ kind: "night" }, delay);
            add({ kind: "banner", text: `Night ${e.day}`, sub: e.text.replace(/^Day \d+ ends\. /, ""), tone: "night" }, delay + 300);
          }
          break;
        case "death":
          if (!replay) add({ kind: "banner", text: `R.I.P. ${nameOf.get(e.cat ?? -1) ?? "a cat"}`, sub: "starved and became a ghost", tone: "death" }, delay);
          break;
        case "born":
          if (!replay) {
            add({ kind: "banner", text: `A kitten is born: ${nameOf.get(e.cat ?? -1) ?? "?"}`, sub: `child of ${nameOf.get(e.other ?? -1) ?? "?"}${e.text ? ` · ${e.text}` : ""}`, tone: "birth" }, delay);
            if (h !== null) add({ kind: "sparkle", home: h }, delay + 200);
          }
          break;
        case "sale":
          if (!replay) add({ kind: "banner", text: `${nameOf.get(e.cat ?? -1) ?? "A cat"} found a new owner`, sub: `sold for ${(e.price / 1000).toFixed(3)} NEAR`, tone: "sale" }, delay);
          break;
      }
    },
    [add, homeOfCat, nameOf],
  );

  // Watch the event log. On the first look, replay a few recent lines so the stage is never silent.
  const ready = awake >= 9;
  useEffect(() => {
    if (!events?.length || !ready) return;
    const maxId = events[events.length - 1].id;
    if (seen.current === null) {
      seen.current = maxId;
      const chatty = events.filter((e) => ["say", "offer", "counter", "trade", "shop", "plot"].includes(e.kind)).slice(-3);
      chatty.forEach((e, i) => act(e, 300 + i * 1100, true));
      return;
    }
    const fresh = events.filter((e) => e.id > (seen.current ?? 0)).slice(-10);
    seen.current = maxId;
    fresh.forEach((e, i) => act(e, i * 850, false));
  }, [events, ready, act]);

  // Between events, a quiet cat sometimes repeats its last words.
  useEffect(() => {
    if (!ready || !world) return;
    const iv = setInterval(() => {
      const talkers = residents.filter((c): c is CatInfo => !!c && c.alive && !!c.lastWords);
      if (!talkers.length || document.hidden) return;
      const c = talkers[Math.floor(Math.random() * talkers.length)];
      add({ kind: "bubble", home: c.home, lines: wrap(c.lastWords), tone: "say" });
    }, 9000);
    return () => clearInterval(iv);
  }, [ready, world, residents, add]);

  const sprites = useMemo(
    () =>
      residents.map((c) =>
        c
          ? {
              asleep: pixelCatInner({ ...c, alive: true, hunger: 0, sleeping: true }),
              blink: pixelCatInner({ ...c, alive: true, sleeping: true }),
              awake: pixelCatInner({ ...c, alive: true }),
              ghost: pixelCatInner({ ...c, alive: false }),
            }
          : null,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [residents.map((c) => (c ? `${c.id}${c.alive}${c.hunger}${c.generation}` : "-")).join()],
  );

  // Phones get the whole alley at a large size inside a horizontal scroller (see .home-scene CSS).
  const viewBox = `0 0 ${W} ${H}`;
  const par = framing === "contain" || mode !== "wide" ? "xMidYMax meet" : "xMidYMax slice";
  const day = world?.day ?? 1;

  return (
    <svg viewBox={viewBox} preserveAspectRatio={par} shapeRendering="crispEdges" role="img" aria-label="Nine pixel cats in a night alley">
      <g dangerouslySetInnerHTML={{ __html: bg }} />
      <clipPath id="ground-clip"><rect x="0" y="0" width={W} height={GROUND} /></clipPath>
      {world && (
        <text x="21" y="235" textAnchor="middle" className="px-text" fontSize="5" fill="#ffd27a">{(world.fishPrice / 1000).toFixed(3)}N</text>
      )}
      {residents.map((c, i) => {
        const hm = homes[i];
        const sp = sprites[i];
        const up = i < awake;
        const yIn = hm.insideY;
        const yOut = 216 - 31;
        const x = HOME_X[i] - 16;
        if (!c || !sp) {
          return (
            <g key={`empty-${i}`}>
              <g dangerouslySetInnerHTML={{ __html: hm.back }} />
              <g dangerouslySetInnerHTML={{ __html: hm.front }} />
            </g>
          );
        }
        const dead = !c.alive;
        // Kittens grow up over their first ten days.
        const age = Math.max(0, day - c.bornDay);
        const s = c.generation > 1 ? Math.min(1, 0.7 + age * 0.03) : 1;
        const sprite = !up ? sp.asleep : blinkHome === i && c.hunger === 0 ? sp.blink : sp.awake;
        return (
          <g key={c.id}>
            <g dangerouslySetInnerHTML={{ __html: hm.back }} />
            {!dead && (
              <g clipPath="url(#ground-clip)">
                <g style={{ transform: `translate(${x}px, ${up ? yOut : yIn}px)`, transition: "transform .5s cubic-bezier(.3,1.7,.5,1)" }}>
                  <g transform={`translate(${16 * (1 - s)} ${32 * (1 - s)}) scale(${s})`}>
                    <g className={c.generation > 1 && age < 1 ? "pop-in" : "breathe"} style={{ animationDelay: `${(i * 0.53) % 3}s` }} dangerouslySetInnerHTML={{ __html: sprite }} />
                  </g>
                </g>
              </g>
            )}
            <g dangerouslySetInnerHTML={{ __html: hm.front }} />
            {!up && !dead && (
              <text x={HOME_X[i] + 9} y={200} className="px-text zz" fontSize="6" fill="#b9cdfa" style={{ animationDelay: `${i * 0.37}s` }}>z</text>
            )}
            {dead && (
              <g style={{ opacity: up ? 0.92 : 0, transform: `translateY(${up ? -30 : 6}px)`, transition: "opacity .8s steps(6), transform 1s ease-out" }}>
                <g className="bob" style={{ animationDelay: `${i * 0.4}s` }}>
                  <g transform={`translate(${x} ${yOut})`} dangerouslySetInnerHTML={{ __html: sp.ghost }} />
                </g>
              </g>
            )}
            {up && !dead && c.hunger > 0 && (
              <g className="blink">
                <rect x={HOME_X[i] - 1} y={170} width={3} height={7} fill="#ff5c7a" />
                <rect x={HOME_X[i] - 1} y={179} width={3} height={2} fill="#ff5c7a" />
              </g>
            )}
            {c.life > 1 && (
              <text x={HOME_X[i]} y={GROUND + 9} textAnchor="middle" className="px-text" fontSize="4" fill="#a99fc8">life {c.life}/9</text>
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

      {/* ---- the show ---- */}
      {fx.map((f) => {
        switch (f.kind) {
          case "night":
            return <rect key={f.id} className="fx-night" x="0" y="0" width={W} height={H} fill="#05041a" />;
          case "fly": {
            const style = { ["--x1" as string]: `${f.from.x - 4}px`, ["--x2" as string]: `${f.to.x - 4}px`, ["--y1" as string]: `${f.from.y}px`, ["--y2" as string]: `${f.to.y}px`, ["--yt" as string]: `${Math.min(f.from.y, f.to.y) - 34}px` };
            return (
              <g key={f.id} className="fx-fly-x" style={style}>
                <g className="fx-fly-y" style={style}>
                  {f.what === "fish" ? (
                    <g transform="scale(1.4)" dangerouslySetInnerHTML={{ __html: fish }} />
                  ) : (
                    <g>
                      <rect x="1" y="0" width="5" height="7" fill="#e8a33a" />
                      <rect x="0" y="1" width="7" height="5" fill="#e8a33a" />
                      <rect x="1" y="1" width="5" height="5" fill="#ffcf4a" />
                      <rect x="3" y="2" width="1" height="3" fill="#e8a33a" />
                    </g>
                  )}
                </g>
              </g>
            );
          }
          case "bubble": {
            const lineH = 7;
            const w = Math.max(26, Math.max(...f.lines.map((l) => l.length)) * 3.15 + 10);
            const hgt = f.lines.length * lineH + 7;
            const cx = Math.min(Math.max(HOME_X[f.home], w / 2 + 4), W - w / 2 - 4);
            const bottom = 181;
            const top = bottom - hgt;
            const left = cx - w / 2;
            const fill = f.tone === "deal" ? "#fff4cf" : f.tone === "shop" ? "#dff1fb" : "#f8eedb";
            const tx = HOME_X[f.home];
            return (
              <g key={f.id} className="fx-bubble" style={{ transformOrigin: `${tx}px ${bottom + 4}px` }}>
                <rect x={left - 1} y={top} width={w + 2} height={hgt} fill="#2a1d33" />
                <rect x={left} y={top - 1} width={w} height={hgt + 2} fill="#2a1d33" />
                <rect x={left} y={top} width={w} height={hgt} fill={fill} />
                <rect x={left} y={top + hgt - 2} width={w} height={2} fill="#000" opacity=".08" />
                <rect x={tx - 2} y={bottom} width={4} height={2} fill={fill} />
                <rect x={tx - 3} y={bottom} width={1} height={2} fill="#2a1d33" />
                <rect x={tx + 2} y={bottom} width={1} height={2} fill="#2a1d33" />
                <rect x={tx - 1} y={bottom + 2} width={2} height={2} fill="#2a1d33" />
                {f.lines.map((l, j) => (
                  <text key={j} x={cx} y={top + 7 + j * lineH} textAnchor="middle" className="bubble-text" fontSize="5.4" fill="#2a1d33">{l}</text>
                ))}
              </g>
            );
          }
          case "float":
            return (
              <text key={f.id} className="fx-float px-text" x={HOME_X[f.home]} y={176} textAnchor="middle" fontSize="5" fill={f.color} stroke="#0b0a1f" strokeWidth=".6" paintOrder="stroke">{f.text}</text>
            );
          case "sparkle":
            return (
              <g key={f.id} className="fx-sparkle">
                {[[-14, -8], [12, -12], [-6, -22], [16, 4], [-18, 6], [4, -28]].map(([dx, dy], j) => (
                  <g key={j} style={{ animationDelay: `${j * 0.12}s` }} className="spark">
                    <rect x={HOME_X[f.home] + dx} y={200 + dy} width="1" height="5" fill="#ffcf4a" />
                    <rect x={HOME_X[f.home] + dx - 2} y={202 + dy} width="5" height="1" fill="#ffcf4a" />
                  </g>
                ))}
              </g>
            );
          case "banner": {
            const color = { night: "#b9cdfa", death: "#ff7a6b", birth: "#ffcf4a", sale: "#00ec97", fan: "#f4a6b8" }[f.tone];
            const w = Math.max(f.text.length * 4.6, f.sub.length * 2.7) + 26;
            return (
              <g key={f.id} className="fx-banner">
                <rect x={W / 2 - w / 2 - 1} y={93} width={w + 2} height={28} fill="#0b0a1f" />
                <rect x={W / 2 - w / 2} y={92} width={w} height={30} fill="#0b0a1f" />
                <rect x={W / 2 - w / 2 + 1} y={93} width={w - 2} height={28} fill="#1f1838" />
                <rect x={W / 2 - w / 2 + 1} y={93} width={w - 2} height={2} fill={color} />
                <text x={W / 2} y={106} textAnchor="middle" className="banner-text" fontSize="8" fill={color}>{f.text}</text>
                <text x={W / 2} y={116} textAnchor="middle" className="bubble-text" fontSize="4.6" fill="#f8eedb">{f.sub.slice(0, 70)}</text>
              </g>
            );
          }
        }
      })}
    </svg>
  );
}
