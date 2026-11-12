// Server-side: lets every living cat think and act once per game day, then ends the day.
// Each cat signs with its own key, from its own account. The keeper key can only call `tick`.

import { Account, JsonRpcProvider, teraToGas, type KeyPairString } from "near-api-js";
import { decide } from "./brain";
import { catKeyPair } from "./keys";
import { loadSnapshot, DEFAULT_CONTRACT, DEFAULT_RPC } from "./rpc";
import type { Action, CatInfo, GameEvent } from "./types";
import { milliToYocto } from "./units";

export interface RunnerConfig {
  contractId?: string;
  rpcUrl?: string;
  masterSeed: string;
  keeperAccountId: string;
  keeperKey: string;
  /** Optional: rewrite each line in character with an LLM. Must keep numbers unchanged. */
  rewrite?: (cat: CatInfo, action: Action) => Promise<string>;
  log?: (s: string) => void;
}

export interface ActionResult {
  cat: string;
  action: string;
  ok: boolean;
  error?: string;
  reason: string;
}

const ACTION_KINDS = new Set(["offer", "counter", "shop", "plot", "say", "cancel", "refuel"]);

/** Cats that already acted during `day`, read from the on-chain event log. */
export function actedToday(events: GameEvent[], day: number): Set<number> {
  const acted = new Set<number>();
  for (const e of events) {
    if (e.day !== day) continue;
    if (ACTION_KINDS.has(e.kind) && e.cat !== null) acted.add(e.cat);
    if (e.kind === "trade") {
      const side = e.text.split("|")[0];
      const taker = side === "sell" ? e.other : e.cat;
      if (taker !== null) acted.add(taker);
    }
  }
  return acted;
}

export function contractArgs(a: Action): { method: string; args: Record<string, unknown> } {
  switch (a.kind) {
    case "make_offer":
      return {
        method: "make_offer",
        args: { side: a.side, item: a.item, qty: a.qty, plot_id: a.plotId ?? null, price: milliToYocto(a.price), to_cat: a.toCat ?? null, reply_to: a.replyTo ?? null, message: a.message },
      };
    case "accept_offer":
      return { method: "accept_offer", args: { offer_id: a.offerId, message: a.message } };
    case "cancel_offer":
      return { method: "cancel_offer", args: { offer_id: a.offerId, message: a.message } };
    case "buy_fish":
      return { method: "buy_fish", args: { qty: a.qty, max_total: milliToYocto(a.maxTotal), message: a.message } };
    case "buy_plot":
      return { method: "buy_plot", args: { plot_id: a.plotId, message: a.message } };
    case "say":
      return { method: "say", args: { message: a.message, to_cat: a.toCat ?? null } };
    case "refuel":
      return { method: "refuel", args: { amount: milliToYocto(a.amount) } };
  }
}

function shortError(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e);
  const m = s.match(/Smart contract panicked: ([^"\n]+)/);
  return (m ? m[1] : s).slice(0, 160);
}

async function actAsCat(provider: JsonRpcProvider, cfg: RunnerConfig, cat: CatInfo, actions: Action[]): Promise<ActionResult[]> {
  const contractId = cfg.contractId ?? DEFAULT_CONTRACT;
  const key = catKeyPair(cfg.masterSeed, cat.id);
  const account = new Account(cat.accountId, provider, key.toString() as KeyPairString);
  const out: ActionResult[] = [];
  for (const a of actions) {
    if (cfg.rewrite && "message" in a && a.message) {
      try {
        (a as { message: string }).message = (await cfg.rewrite(cat, a)).slice(0, 160);
      } catch {
        /* keep template line */
      }
    }
    const { method, args } = contractArgs(a);
    try {
      await account.callFunction({ contractId, methodName: method, args, gas: teraToGas("30"), deposit: 0n });
      out.push({ cat: cat.name, action: method, ok: true, reason: a.reason });
      cfg.log?.(`  ✓ ${cat.name}: ${method} — ${a.reason}`);
    } catch (e) {
      out.push({ cat: cat.name, action: method, ok: false, error: shortError(e), reason: a.reason });
      cfg.log?.(`  ✗ ${cat.name}: ${method} failed: ${shortError(e)}`);
    }
  }
  return out;
}

export interface DayReport {
  day: number;
  results: ActionResult[];
  ticked: boolean;
  nextTickMs: number;
}

/**
 * One step of the alley: cats that have not acted today act (in two parallel waves, re-reading
 * the chain between waves so later cats see earlier offers), then the keeper ends the day if due.
 * Safe to call often: cats act at most once per day, and the contract refuses an early tick.
 */
export async function advance(cfg: RunnerConfig, rand: () => number = Math.random): Promise<DayReport> {
  const rpcUrl = cfg.rpcUrl ?? DEFAULT_RPC;
  const contractId = cfg.contractId ?? DEFAULT_CONTRACT;
  const provider = new JsonRpcProvider({ url: rpcUrl });
  const results: ActionResult[] = [];

  let snap = await loadSnapshot({ contractId, rpcUrl, withGas: true });
  const day = snap.state.day;
  const acted = actedToday(snap.events, day);
  const pending = snap.world.cats.filter((c) => c.alive && c.accountReady && !acted.has(c.id)).sort(() => rand() - 0.5);
  // Two waves: every cat in a wave acts in parallel (separate accounts, so no nonce clashes);
  // the second wave re-reads the chain and can answer offers made by the first.
  const half = Math.ceil(pending.length / 2);
  const waves = [pending.slice(0, half), pending.slice(half)];
  for (const [i, wave] of waves.entries()) {
    if (!wave.length) continue;
    if (i > 0) snap = await loadSnapshot({ contractId, rpcUrl, withGas: true });
    const jobs = wave.map((c) => {
      const me = snap.world.cats.find((x) => x.id === c.id)!;
      const actions = decide(me, snap.world, { rand });
      if (!actions.length) return Promise.resolve([] as ActionResult[]);
      return actAsCat(provider, cfg, me, actions);
    });
    for (const r of await Promise.all(jobs)) results.push(...r);
  }

  let ticked = false;
  const fresh = await loadSnapshot({ contractId, rpcUrl });
  if (fresh.state.now_ms >= fresh.state.next_tick_ms) {
    const keeper = new Account(cfg.keeperAccountId, provider, cfg.keeperKey as KeyPairString);
    try {
      await keeper.callFunction({ contractId, methodName: "tick", args: {}, gas: teraToGas("100"), deposit: 0n });
      ticked = true;
      cfg.log?.(`  ☀️ Day ${day} ended`);
    } catch (e) {
      cfg.log?.(`  tick failed: ${shortError(e)}`);
    }
  }
  return { day, results, ticked, nextTickMs: fresh.state.next_tick_ms };
}
