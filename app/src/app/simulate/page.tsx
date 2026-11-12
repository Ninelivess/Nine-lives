"use client";

import { useEffect, useRef, useState } from "react";
import { AlleyScene } from "@/components/AlleyScene";
import { CatsScreen, GazetteScreen, GraveyardScreen, Icon } from "@/components/AlleyView";
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
  const view = w.view();
  const alive = view.cats.filter((c) => c.alive).length;
  return (
    <>
      <div className="page" style={{ paddingBottom: 0 }}>
        <div className="container">
          <p className="screen-kicker"><Icon name="ff" /> Offline simulation · no wallet needed</p>
          <h1 className="page-title">Fast-forward a month.</h1>
          <p className="screen-sub">Same cat brains, same rules as the contract (mirrored in <code>world.ts</code>). Each seed replays exactly. Seed 7: keep an eye on Smokey around day 19.</p>
          <div className="controls">
            <button className="btn-primary" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
            <button onClick={() => { simDay(w, randRef.current); setVersion((v) => v + 1); }} disabled={playing}>Step a day</button>
            <label>Speed
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={1500}>slow</option>
                <option value={600}>normal</option>
                <option value={150}>fast</option>
              </select>
            </label>
            <label>Seed <input type="number" value={seed} min={1} onChange={(e) => setSeed(Number(e.target.value))} /></label>
            <button onClick={() => { reset(seed); setPlaying(true); }}>Restart</button>
            <span className="pbox dark" style={{ padding: "8px 14px", fontFamily: "var(--pixel)" }}>Day {view.day} · {alive} alive · {9 - alive} ghosts</span>
          </div>
          <div className="sim-scene"><AlleyScene world={view} framing="contain" /></div>
        </div>
      </div>
      <CatsScreen world={view} linked={false} />
      <GazetteScreen world={view} events={w.events} />
      <GraveyardScreen world={view} linked={false} />
    </>
  );
}
