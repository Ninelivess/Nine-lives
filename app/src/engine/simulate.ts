import { decide } from "./brain";
import { SimWorld, mulberry32 } from "./world";
import type { GameConfig } from "./types";

export interface SimResult {
  world: SimWorld;
  errors: number;
  actions: number;
}

/** Run one simulated day: every living cat (in random order) thinks and acts, then the day ends. */
export function simDay(world: SimWorld, rand: () => number): { actions: number; errors: number } {
  let actions = 0;
  let errors = 0;
  const order = world.cats.filter((c) => c.alive).map((c) => c.id).sort(() => rand() - 0.5);
  for (const id of order) {
    const me = world.cats.find((c) => c.id === id)!;
    if (!me.alive) continue;
    for (const a of decide({ ...me }, world.view(), { rand })) {
      try {
        world.apply(id, a);
        actions++;
      } catch {
        errors++;
      }
    }
  }
  world.tick(rand);
  return { actions, errors };
}

export function runSimulation(days: number, seed: number, config?: GameConfig, stake?: number): SimResult {
  const rand = mulberry32(seed);
  const world = new SimWorld(config, stake);
  let actions = 0;
  let errors = 0;
  for (let d = 0; d < days; d++) {
    const r = simDay(world, rand);
    actions += r.actions;
    errors += r.errors;
    if (!world.cats.some((c) => c.alive)) break;
  }
  return { world, errors, actions };
}
