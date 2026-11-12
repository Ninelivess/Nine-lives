"use client";

// One shared poller for the live chain snapshot, used by the HUD and every page.
import { useSyncExternalStore } from "react";
import type { GameEvent, WorldView } from "@/engine/types";

export interface Snapshot {
  contractId: string;
  network: string;
  day: number;
  nowMs: number;
  nextTickMs: number;
  dayLengthMs: number;
  world: WorldView;
  events: GameEvent[];
  /** Chain clock minus local clock, ms. */
  skew: number;
}

let current: Snapshot | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  try {
    const r = await fetch("/api/snapshot", { cache: "no-store" });
    const j = await r.json();
    if (j.error) return;
    current = { ...j, skew: j.nowMs - Date.now() };
    listeners.forEach((l) => l());
  } catch {
    /* keep the last snapshot */
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (!timer) {
    load();
    timer = setInterval(load, 4000);
  }
  return () => {
    listeners.delete(l);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useSnapshot(): Snapshot | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
