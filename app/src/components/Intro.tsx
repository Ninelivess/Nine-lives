"use client";

// Opening: a blank sheet of paper. A cat's paw swipes across it, leaves three claw marks,
// and the paper tears along them to reveal the alley. Click or press any key to skip.

import { useEffect, useMemo, useState } from "react";

/** A big pixel paw with claws out, drawn procedurally on a 24x24 grid. */
function pawSvg(): string {
  const N = 24;
  const fill: string[][] = Array.from({ length: N }, () => Array(N).fill(""));
  const ellipse = (cx: number, cy: number, rx: number, ry: number, c: string) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) fill[y][x] = c;
  };
  ellipse(12, 15, 9, 8, "f"); // paw
  for (const [cx, cy] of [[4.5, 9], [9, 5.5], [15, 5.5], [19.5, 9]]) ellipse(cx, cy, 3.1, 3.3, "f"); // toes
  ellipse(12, 16.5, 4.6, 3.6, "p"); // main bean
  for (const [cx, cy] of [[4.5, 9.3], [9, 5.8], [15, 5.8], [19.5, 9.3]]) ellipse(cx, cy, 1.6, 1.8, "p"); // toe beans
  const claws: [number, number][] = [[4, 3], [9, 0], [14, 0], [19, 3]];
  const pal: Record<string, string> = { f: "#f8eedb", p: "#f4a6b8", c: "#ffffff", o: "#2a1d33", s: "#e2cfa5" };
  // shade the lower half of the fur
  for (let y = 18; y < N; y++) for (let x = 0; x < N; x++) if (fill[y][x] === "f") fill[y][x] = "s";
  // outline around everything
  const out = fill.map((r) => [...r]);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (fill[y][x]) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fill[y + dy]?.[x + dx]);
      if (near) out[y][x] = "o";
    }
  // claws drawn on top
  for (const [x, y] of claws) {
    out[y][x] = "o"; out[y + 1][x] = "c"; out[y + 2][x] = "c"; out[y + 1][x + 1] = "o"; out[y + 2][x + 1] = "c"; out[y + 1][x - 1] = "o"; out[y + 2][x - 1] = "o";
  }
  let rects = "";
  out.forEach((row, y) => row.forEach((c, x) => c && (rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[c]}"/>`)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" shape-rendering="crispEdges">${rects}</svg>`;
}

// Three parallel slashes from top-right to bottom-left, in percent of the screen.
const SLASH = [
  { x0: 64, x1: 4 },
  { x0: 76, x1: 16 },
  { x0: 88, x1: 28 },
];
const PIECES = [
  "0% 0%, 64% 0%, 4% 100%, 0% 100%",
  "64% 0%, 76% 0%, 16% 100%, 4% 100%",
  "76% 0%, 88% 0%, 28% 100%, 16% 100%",
  "88% 0%, 100% 0%, 100% 100%, 28% 100%",
];

/** A jagged pixel tear along a slash. */
function tearPath(x0: number, x1: number): string {
  const steps = 26;
  let d = `M ${x0} 0`;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t + (i % 2 ? 0.28 : -0.28);
    d += ` L ${x.toFixed(2)} ${(t * 100).toFixed(2)}`;
  }
  return d;
}

export function Intro() {
  const [phase, setPhase] = useState<"on" | "tear" | "done">("on");
  const paw = useMemo(() => pawSvg(), []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      return;
    }
    document.documentElement.classList.add("intro-lock");
    const t1 = setTimeout(() => setPhase("tear"), 1500);
    const t2 = setTimeout(() => setPhase("done"), 2700);
    const skip = () => setPhase("done");
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  useEffect(() => {
    if (phase === "done") document.documentElement.classList.remove("intro-lock");
  }, [phase]);

  if (phase === "done") return null;
  return (
    <div className={`intro intro-${phase}`} onClick={() => setPhase("done")} role="presentation" aria-hidden>
      {PIECES.map((poly, i) => (
        <div key={i} className={`intro-piece intro-piece-${i}`} style={{ clipPath: `polygon(${poly})` }}>
          <div className="intro-paper" />
        </div>
      ))}
      <div className="intro-mark">
        <span className="intro-logo">NINE LIVES</span>
        <span className="intro-sub">something is moving behind the paper…</span>
      </div>
      <svg className="intro-claws" viewBox="0 0 100 100" preserveAspectRatio="none">
        {SLASH.map((s, i) => (
          <g key={i}>
            <path d={tearPath(s.x0 + 0.5, s.x1 + 0.5)} className="claw-shadow" style={{ animationDelay: `${0.62 + i * 0.05}s` }} />
            <path d={tearPath(s.x0, s.x1)} className="claw" style={{ animationDelay: `${0.6 + i * 0.05}s` }} />
          </g>
        ))}
      </svg>
      <span className="intro-paw" dangerouslySetInnerHTML={{ __html: paw }} />
      <span className="intro-skip">click to skip</span>
    </div>
  );
}
