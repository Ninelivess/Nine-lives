"use client";

// Opening: a blank sheet of paper. A cat's paw reaches in from the bottom-right corner, drags its
// claws up across the paper, rips out the strips between the claw marks as it pulls back; the
// tear cracks on to the top edge and the sheet falls apart in two halves, showing the alley.
// One clock drives every part, so the claw marks appear exactly where the paw passes.
// Click or press any key to skip.

import { useEffect, useMemo, useRef, useState } from "react";

/** A big pixel paw with claws out, drawn procedurally on a 24x24 grid. */
function pawSvg(): string {
  const N = 24;
  const fill: string[][] = Array.from({ length: N }, () => Array(N).fill(""));
  const ellipse = (cx: number, cy: number, rx: number, ry: number, c: string) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) fill[y][x] = c;
  };
  ellipse(12, 15, 9, 8, "f");
  for (const [cx, cy] of [[4.5, 9], [9, 5.5], [15, 5.5], [19.5, 9]]) ellipse(cx, cy, 3.1, 3.3, "f");
  ellipse(12, 16.5, 4.6, 3.6, "p");
  for (const [cx, cy] of [[4.5, 9.3], [9, 5.8], [15, 5.8], [19.5, 9.3]]) ellipse(cx, cy, 1.6, 1.8, "p");
  const claws: [number, number][] = [[4, 3], [9, 0], [14, 0], [19, 3]];
  const pal: Record<string, string> = { f: "#f8eedb", p: "#f4a6b8", c: "#ffffff", o: "#2a1d33", s: "#e2cfa5" };
  for (let y = 18; y < N; y++) for (let x = 0; x < N; x++) if (fill[y][x] === "f") fill[y][x] = "s";
  const out = fill.map((r) => [...r]);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (fill[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fill[y + dy]?.[x + dx])) out[y][x] = "o";
    }
  for (const [x, y] of claws) {
    out[y][x] = "o"; out[y + 1][x] = "c"; out[y + 2][x] = "c"; out[y + 1][x + 1] = "o"; out[y + 2][x + 1] = "c"; out[y + 1][x - 1] = "o"; out[y + 2][x - 1] = "o";
  }
  let rects = "";
  out.forEach((row, y) => row.forEach((c, x) => c && (rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[c]}"/>`)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" shape-rendering="crispEdges">${rects}</svg>`;
}

// Geometry in percent of the screen. Claw marks run from the bottom-right edge up-left.
const CLAWS: [number, number, number, number][] = [
  [100, 60, 58, 20],
  [100, 79, 54, 35],
  [93, 100, 50, 51],
];
const CRACK: [number, number, number, number] = [54, 35, 17, 0];
const STRIP_A = "100% 60%, 58% 20%, 54% 35%, 100% 79%";
const STRIP_B = "100% 79%, 54% 35%, 50% 51%, 93% 100%, 100% 100%";
const UPPER = "17% 0%, 100% 0%, 100% 60%, 58% 20%, 54% 35%";
const LOWER = "0% 0%, 17% 0%, 54% 35%, 50% 51%, 93% 100%, 0% 100%";

/** A jagged tear in screen pixels; points are given in percent of a w x h screen. */
function jagged(w: number, h: number, x0: number, y0: number, x1: number, y1: number, steps = 18): string {
  const X = (v: number) => (v / 100) * w;
  const Y = (v: number) => (v / 100) * h;
  let d = `M ${X(x0).toFixed(1)} ${Y(y0).toFixed(1)}`;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const j = i === steps ? 0 : i % 2 ? 4 : -4;
    d += ` L ${(X(x0 + (x1 - x0) * t) + j).toFixed(1)} ${(Y(y0 + (y1 - y0) * t) - j).toFixed(1)}`;
  }
  return d;
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

// Paw path: [time ms, x vw, y vh, rotation deg] relative to the screen centre.
const PAW: [number, number, number, number][] = [
  [0, 64, 64, -45],
  [420, 32, 32, -45],
  [700, 4, -14, -45], // the scratch
  [800, 9, -6, -40], // grip
  [1350, 74, 74, -32], // pull back, taking the strips
];
const END = 2250;

function pawAt(t: number): [number, number, number] {
  for (let i = 1; i < PAW.length; i++) {
    const [t1, x1, y1, r1] = PAW[i];
    const [t0, x0, y0, r0] = PAW[i - 1];
    if (t <= t1) {
      const k = ease(span(t, t0, t1));
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, r0 + (r1 - r0) * k];
    }
  }
  const last = PAW[PAW.length - 1];
  return [last[1], last[2], last[3]];
}

export function Intro() {
  const [done, setDone] = useState(false);
  const [size, setSize] = useState<[number, number] | null>(null);
  const paw = useMemo(() => pawSvg(), []);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDone(true);
      return;
    }
    document.documentElement.classList.add("intro-lock");
    setSize([window.innerWidth, window.innerHeight]);
  }, []);

  useEffect(() => {
    if (!size || done) return;
    const el = root.current!;
    const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
    const pawEl = q<HTMLElement>(".intro-paw");
    const claws = Array.from(el.querySelectorAll<SVGPathElement>(".claw-line"));
    const clawG = q<SVGGElement>(".intro-claws-g");
    const crack = q<SVGPathElement>(".crack-line");
    const stripA = q<HTMLElement>(".intro-strip-a");
    const stripB = q<HTMLElement>(".intro-strip-b");
    const upper = q<HTMLElement>(".intro-upper");
    const lower = q<HTMLElement>(".intro-lower");
    const mark = q<HTMLElement>(".intro-mark");
    let start = 0;
    let raf = 0;
    const frame = (now: number) => {
      if (!start) start = now;
      const t = now - start;
      const [x, y, r] = pawAt(t);
      pawEl.style.transform = `translate(${x}vw, ${y}vh) rotate(${r}deg)`;
      // claws are drawn while the paw sweeps up-left (420 → 700 ms), each a beat after the last
      claws.forEach((c, i) => {
        const p = span(t, 440 + i * 25, 700 + i * 25);
        c.style.strokeDashoffset = String(100 * (1 - p));
      });
      // the paw grips at 800 ms and pulls the strips out with it
      const pull = ease(span(t, 800, 1350));
      stripA.style.transform = `translate(${42 * pull}vw, ${46 * pull}vh) rotate(${16 * pull}deg)`;
      stripB.style.transform = `translate(${34 * pull}vw, ${52 * pull}vh) rotate(${26 * pull}deg)`;
      clawG.style.opacity = String(1 - span(t, 820, 960));
      // the tear cracks to the top edge, then the sheet falls apart
      crack.style.strokeDashoffset = String(100 * (1 - span(t, 1300, 1450)));
      crack.style.opacity = String(1 - span(t, 1500, 1650));
      mark.style.opacity = String(1 - span(t, 1250, 1450));
      const open = ease(span(t, 1450, END));
      upper.style.transform = `translate(${34 * open}vw, ${-62 * open}vh) rotate(${14 * open}deg)`;
      lower.style.transform = `translate(${-46 * open}vw, ${84 * open}vh) rotate(${-14 * open}deg)`;
      if (t < END + 60) raf = requestAnimationFrame(frame);
      else setDone(true);
    };
    raf = requestAnimationFrame(frame);
    const skip = () => setDone(true);
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  useEffect(() => {
    if (done) document.documentElement.classList.remove("intro-lock");
  }, [done]);

  if (done) return null;
  return (
    <div className="intro" ref={root} onClick={() => setDone(true)} role="presentation" aria-hidden>
      <div className="intro-piece intro-upper" style={{ clipPath: `polygon(${UPPER})` }}><div className="intro-paper" /></div>
      <div className="intro-piece intro-lower" style={{ clipPath: `polygon(${LOWER})` }}><div className="intro-paper" /></div>
      <div className="intro-piece intro-strip-a" style={{ clipPath: `polygon(${STRIP_A})` }}><div className="intro-paper" /></div>
      <div className="intro-piece intro-strip-b" style={{ clipPath: `polygon(${STRIP_B})` }}><div className="intro-paper" /></div>
      <div className="intro-mark">
        <span className="intro-logo">NINE LIVES</span>
        <span className="intro-sub">something is scratching at the paper…</span>
      </div>
      {size && (
        <svg className="intro-claws" viewBox={`0 0 ${size[0]} ${size[1]}`}>
          <g className="intro-claws-g">
            {CLAWS.map(([x0, y0, x1, y1], i) => (
              <g key={i}>
                <path d={jagged(size[0], size[1], x0, y0 + 0.8, x1, y1 + 0.8)} pathLength={100} className="claw-shadow claw-line" />
                <path d={jagged(size[0], size[1], x0, y0, x1, y1)} pathLength={100} className="claw claw-line" />
              </g>
            ))}
          </g>
          <path d={jagged(size[0], size[1], ...CRACK, 12)} pathLength={100} className="crack crack-line" />
        </svg>
      )}
      <span className="intro-paw" dangerouslySetInnerHTML={{ __html: paw }} />
      <span className="intro-skip">click to skip</span>
    </div>
  );
}
