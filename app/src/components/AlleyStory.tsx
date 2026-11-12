"use client";

// The scroll story: the alley stays pinned on screen while the reader scrolls through five
// chapters. Cats sleep in their homes, wake up one by one, haggle, go hungry at night and, if
// the chain says so, rise as ghosts. Everything is drawn from live on-chain state.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { pixelCatInner } from "@/engine/pixel";
import { PERSONALITIES } from "@/engine/personalities";
import { GROUND, H, HOME_X, W, fishPixels, home, sceneBackground } from "@/engine/scene";
import type { CatInfo, WorldView } from "@/engine/types";

const CHAPTERS = [
  { from: 0, to: 0.08, num: "00", label: "Nine Lives" },
  { from: 0.08, to: 0.4, num: "01", label: "Wake" },
  { from: 0.4, to: 0.58, num: "02", label: "Trade" },
  { from: 0.58, to: 0.76, num: "03", label: "Night" },
  { from: 0.76, to: 0.92, num: "04", label: "Ghosts" },
  { from: 0.92, to: 1.01, num: "05", label: "Live" },
];

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** 0..1 fade for a chapter window, with soft edges. */
const windowFade = (p: number, from: number, to: number, edge = 0.025) =>
  from === 0 ? clamp((to - p) / edge) : clamp(Math.min((p - from) / edge, (to - p) / edge));

function placeholderCats(): CatInfo[] {
  return PERSONALITIES.map((p, i) => ({
    id: i + 1, name: p.name, accountId: `cat-${i + 1}.ninelives.testnet`, personality: p.key, traits: p.traits,
    balance: 0, stake: 0, fish: 3, hunger: 0, alive: true, accountReady: true, bornDay: 1, diedDay: null,
    trades: 0, claimed: 0, lastWords: "", ownerId: null, plots: [],
  }));
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function AlleyStory({ world, countdownMs }: { world: WorldView | null; countdownMs: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [wide, setWide] = useState(true);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      setP(clamp(-rect.top / Math.max(1, total)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    // Wider than the scene: crop the sky. Narrower: show the whole alley, sky continues above.
    const onResize = () => {
      const aspect = window.innerWidth / window.innerHeight;
      setWide(aspect > W / H);
      setNarrow(aspect < 0.8);
      onScroll();
    };
    onResize();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const cats = world?.cats.length ? world.cats : placeholderCats();
  const bg = useMemo(() => sceneBackground(), []);
  const homes = useMemo(() => HOME_X.map((_, i) => home(i)), []);
  const sprites = useMemo(
    () =>
      cats.map((c) => ({
        asleep: pixelCatInner({ ...c, alive: true, hunger: 0, sleeping: true }),
        happy: pixelCatInner({ ...c, alive: true, hunger: 0 }),
        sad: pixelCatInner({ ...c, alive: true, hunger: Math.max(1, c.hunger) }),
        ghost: pixelCatInner({ ...c, alive: false }),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cats.map((c) => `${c.id}${c.personality}${c.alive}${c.hunger}`).join()],
  );

  const chapter = CHAPTERS.findIndex((c) => p >= c.from && p < c.to);
  // Phones: a camera that starts close, follows each cat as it wakes, then pulls back.
  let viewBox = `0 0 ${W} ${H}`;
  if (narrow) {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const vw = lerp(210, 440, clamp((p - 0.38) / 0.06));
    const follow = clamp((p - 0.1) / (0.031 * 8 + 0.03));
    const cx = p < 0.38 ? lerp(HOME_X[0] - 20, HOME_X[8], follow) : lerp(HOME_X[8], 262, clamp((p - 0.38) / 0.06));
    const vx = clamp(cx - vw / 2, 0, W - vw);
    viewBox = `${vx.toFixed(1)} 0 ${vw.toFixed(1)} ${H}`;
  }
  const night = clamp((p - 0.58) / 0.1) * 0.42;
  const tradeFade = windowFade(p, 0.42, 0.58);
  const nightFade = windowFade(p, 0.6, 0.76);
  const ghostP = clamp((p - 0.78) / 0.08);
  const alive = cats.filter((c) => c.alive).length;
  const ghosts = cats.length - alive;
  const hungry = cats.filter((c) => c.alive && c.hunger > 0).length;
  const talkers = [1, 4, 7];

  return (
    <div className="story" ref={ref}>
      <div className="stage">
        <svg
          className="scene-svg"
          viewBox={viewBox}
          preserveAspectRatio={wide ? "xMidYMax slice" : "xMidYMax meet"}
          shapeRendering="crispEdges"
          role="img"
          aria-label="Nine pixel cats in their homes in a night alley"
        >
          <g dangerouslySetInnerHTML={{ __html: bg }} />
          <clipPath id="aboveGround"><rect x="0" y="0" width={W} height={GROUND} /></clipPath>
          {world && (
            <text x="21" y="235" textAnchor="middle" className="px-text" fontSize="5" fill="#ffd27a">
              {(world.fishPrice / 1000).toFixed(3)}N
            </text>
          )}
          {cats.map((c, i) => {
            const t0 = 0.11 + i * 0.031;
            const out = clamp((p - t0) / 0.045);
            const hm = homes[i];
            const yIn = hm.insideY;
            const yOut = 216 - 31;
            const y = yIn + (yOut - yIn) * (out > 0 ? easeOutBack(out) : 0);
            const x = HOME_X[i] - 16;
            const dead = !c.alive;
            const sprite = out === 0 ? sprites[i].asleep : p > 0.6 && (dead || c.hunger > 0) ? sprites[i].sad : sprites[i].happy;
            const aliveOpacity = dead ? 1 - ghostP : 1;
            const tagFade = out >= 1 ? windowFade(p, t0 + 0.04, 0.4) : 0;
            const quote = c.lastWords || "…";
            const bubbleW = Math.min(118, 10 + truncate(quote, 30).length * 2.9);
            const bubbleY = i % 2 === 0 ? 150 : 132;
            return (
              <g key={c.id}>
                <g dangerouslySetInnerHTML={{ __html: hm.back }} />
                <g clipPath="url(#aboveGround)">
                  <g transform={`translate(${x} ${y.toFixed(2)})`} opacity={aliveOpacity} dangerouslySetInnerHTML={{ __html: sprite }} />
                </g>
                <g dangerouslySetInnerHTML={{ __html: hm.front }} />
                {out === 0 && (
                  <text x={HOME_X[i] + 9} y={200} className="px-text zz" fontSize="6" fill="#b9cdfa" style={{ animationDelay: `${i * 0.37}s` }}>z</text>
                )}
                {tagFade > 0 && (
                  <g opacity={tagFade}>
                    <line x1={HOME_X[i]} y1={183} x2={HOME_X[i]} y2={i % 2 === 0 ? 168 : 156} stroke="#00ec97" strokeWidth=".5" opacity=".7" />
                    <text x={HOME_X[i]} y={i % 2 === 0 ? 164 : 152} textAnchor="middle" className="px-text" fontSize="4.6" fill="#f3efe4">{c.name.toUpperCase()}</text>
                    <text x={HOME_X[i]} y={i % 2 === 0 ? 158 : 146} textAnchor="middle" className="px-text" fontSize="3.6" fill="#00ec97">cat-{c.id}</text>
                  </g>
                )}
                {tradeFade > 0 && talkers.includes(i) && (
                  <g opacity={tradeFade}>
                    <rect x={HOME_X[i] - bubbleW / 2} y={bubbleY} width={bubbleW} height={11} fill="#f6f2e6" />
                    <rect x={HOME_X[i] - bubbleW / 2} y={bubbleY + 11} width={bubbleW} height={1} fill="#0007" />
                    <rect x={HOME_X[i] - 1} y={bubbleY + 11} width={3} height={2} fill="#f6f2e6" />
                    <rect x={HOME_X[i]} y={bubbleY + 13} width={1} height={1} fill="#f6f2e6" />
                    <text x={HOME_X[i]} y={bubbleY + 7.4} textAnchor="middle" className="bubble-text" fontSize="4.6" fill="#1b1a26">
                      {truncate(quote, 30)}
                    </text>
                  </g>
                )}
                {nightFade > 0 && (dead || c.hunger > 0) && (
                  <g opacity={nightFade} className="blink">
                    <rect x={HOME_X[i] - 1} y={170} width={3} height={7} fill="#ff5c7a" />
                    <rect x={HOME_X[i] - 1} y={179} width={3} height={2} fill="#ff5c7a" />
                  </g>
                )}
                {dead && ghostP > 0 && (
                  <g className="ghost-rise" style={{ animationDelay: `${i * 0.4}s` }}>
                    <g transform={`translate(${x} ${(yOut - 34 * ghostP).toFixed(2)})`} opacity={ghostP * 0.92} dangerouslySetInnerHTML={{ __html: sprites[i].ghost }} />
                    <text x={HOME_X[i]} y={yOut - 38 * ghostP} textAnchor="middle" className="px-text" fontSize="4" fill="#b9cdfa" opacity={ghostP}>
                      DAY {c.diedDay}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          {tradeFade > 0 && (
            <g opacity={tradeFade}>
              {[[0, 3, "0s"], [5, 1, "0.8s"], [6, 4, "1.6s"]].map(([a, b, d], k) => {
                const xa = HOME_X[a as number];
                const xb = HOME_X[b as number];
                const mid = (xa + xb) / 2;
                return (
                  <g key={k}>
                    <g dangerouslySetInnerHTML={{ __html: fishPixels() }} />
                    <animateMotion dur="2.4s" begin={d as string} repeatCount="indefinite" path={`M ${xa} 190 Q ${mid} 150 ${xb} 190`} />
                  </g>
                );
              })}
            </g>
          )}
          <rect x="0" y="0" width={W} height={H} fill="#03040d" opacity={night} pointerEvents="none" />
        </svg>

        <div className="story-copy" aria-live="polite">
          <Chapter show={windowFade(p, 0, 0.08)} num="00" label="Nine Lives on NEAR">
            <h1 className="story-title">Nine cats.<br />One alley.</h1>
            <p>Nine AI cats live on NEAR testnet. Each one is an NFT <em>and</em> its own account. They are asleep. For now.</p>
          </Chapter>
          <Chapter show={windowFade(p, 0.08, 0.4)} num="01" label="Wake">
            <h2 className="story-h">Every cat is<br />an account.</h2>
            <p>At birth the contract creates <code>cat-&lt;id&gt;.ninelives.testnet</code> and gives it exactly one key. The key can play the game. It can never move NEAR out, even if it leaks.</p>
          </Chapter>
          <Chapter show={windowFade(p, 0.4, 0.58)} num="02" label="Trade">
            <h2 className="story-h">They haggle with<br />their own money.</h2>
            <p>Offers, counter-offers, bluffs. Each trade is a transaction the cat signs itself and the contract settles in one atomic step. These lines are the last things they actually said.</p>
          </Chapter>
          <Chapter show={windowFade(p, 0.58, 0.76)} num="03" label="Night">
            <h2 className="story-h">Every night, every<br />cat must eat.</h2>
            <p>The alley grows fewer fish than nine cats need. The shop always sells, but each fish sold makes the next one dearer. {hungry ? `${hungry} cat${hungry > 1 ? "s are" : " is"} hungry right now.` : "Nobody is hungry right now."}</p>
          </Chapter>
          <Chapter show={windowFade(p, 0.76, 0.92)} num="04" label="Ghosts">
            <h2 className="story-h">Three hungry nights.<br />Then a ghost.</h2>
            <p>{ghosts ? `${ghosts} cat${ghosts > 1 ? "s have" : " has"} died so far. ` : "No cat has died yet. "}The NFT is renamed “Ghost of …” and its picture changes on-chain, forever. Nobody can bring it back.</p>
          </Chapter>
          <Chapter show={windowFade(p, 0.92, 1.01)} num="05" label="Live">
            <h2 className="story-h">This is happening<br />right now.</h2>
            <p>
              {world ? <>Day {world.day} · {alive} alive · {ghosts} ghost{ghosts === 1 ? "" : "s"}{countdownMs !== null ? ` · night falls in ${Math.max(0, Math.ceil(countdownMs / 1000))}s` : ""}</> : "Connecting to the chain…"}
            </p>
            <div className="story-cta">
              <a className="btn btn-primary" href="#alley"><span className="btn-num">01</span> Enter the alley</a>
              <Link className="btn" href="/simulate"><span className="btn-num">02</span> Fast-forward a month</Link>
            </div>
          </Chapter>
        </div>

        <ol className="story-index" aria-hidden>
          {CHAPTERS.map((c, i) => (
            <li key={c.num} className={i === chapter ? "on" : ""}>
              <span>{c.num}</span> {c.label}
            </li>
          ))}
        </ol>
        <div className="scroll-hint" style={{ opacity: windowFade(p, 0, 0.05) }}>
          <span className="bracket">Scroll to wake them</span>
        </div>
      </div>
    </div>
  );
}

function Chapter({ show, num, label, children }: { show: number; num: string; label: string; children: React.ReactNode }) {
  if (show <= 0) return null;
  return (
    <div className="chapter" style={{ opacity: show, transform: `translateY(${(1 - show) * 14}px)`, pointerEvents: show > 0.6 ? "auto" : "none" }}>
      <p className="chapter-num"><span className="bracket">{num} · {label}</span></p>
      {children}
    </div>
  );
}
