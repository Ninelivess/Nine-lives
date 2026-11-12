"use client";

import { useEffect, useRef, useState } from "react";
import { AlleyView } from "@/components/AlleyView";
import { simDay } from "@/engine/simulate";
import { SimWorld, mulberry32 } from "@/engine/world";

// The same brains and the same rules as the live contract, run in your browser at high speed.
export default function SimulatePage() {
  const [seed, setSeed] = useState(7);
  const [speed, setSpeed] = useState(600);
  const [playing, setPlaying] = useState(true);
  const worldRef = useRef<SimWorld>(new SimWorld());
  const randRef = useRef<() => number>(mulberry32(7));
  const [, setVersion] = useState(0);

  const reset = (s: number) => {
    worldRef.current = new SimWorld();
    randRef.current = mulberry32(s);
    setVersion((v) => v + 1);
  };

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const w = worldRef.current;
      if (!w.cats.some((c) => c.alive) || w.day > 60) return setPlaying(false);
      simDay(w, randRef.current);
      setVersion((v) => v + 1);
    }, speed);
    return () => clearInterval(t);
  }, [playing, speed]);

  const w = worldRef.current;
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Offline simulation · no wallet needed</p>
          <h1>Fast-forward a month in the alley</h1>
          <p className="lede">
            Same cat brains, same rules as the contract (mirrored in <code>world.ts</code>), one day every {speed / 1000}s. Each seed replays
            exactly, so you can rerun any story.
          </p>
        </div>
      </section>
      <div className="controls">
        <button onClick={() => setPlaying((p) => !p)}>{playing ? "⏸ Pause" : "▶ Play"}</button>
        <button onClick={() => { simDay(w, randRef.current); setVersion((v) => v + 1); }} disabled={playing}>Step one day</button>
        <label>
          Speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value={1500}>slow</option>
            <option value={600}>normal</option>
            <option value={150}>fast</option>
          </select>
        </label>
        <label>
          Seed
          <input type="number" value={seed} min={1} onChange={(e) => setSeed(Number(e.target.value))} />
        </label>
        <button onClick={() => { reset(seed); setPlaying(true); }}>Restart with seed</button>
      </div>
      <AlleyView world={w.view()} events={w.events} mode="sim" countdownMs={null} />
    </>
  );
}
