// Read-only access to the contract over plain JSON-RPC. Works in the browser and in Node,
// needs no keys and no NEAR library.

import type { CatInfo, GameConfig, GameEvent, OfferInfo, PlotInfo, Traits, WorldView } from "./types";
import { yoctoToMilli } from "./units";

export const DEFAULT_RPC = process.env.NEXT_PUBLIC_NEAR_RPC || "https://rpc.testnet.near.org";
export const DEFAULT_CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ID || "ninelives.testnet";
export const NETWORK = process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet";

async function rpc<T>(method: string, params: unknown, rpcUrl = DEFAULT_RPC): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "nl", method, params }),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error?.cause?.name ?? json.error?.message ?? "RPC error");
  return json.result as T;
}

function b64(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s).toString("base64");
  return btoa(unescape(encodeURIComponent(s)));
}

function decodeResult(bytes: number[]): unknown {
  const text = typeof Buffer !== "undefined" ? Buffer.from(bytes).toString() : new TextDecoder().decode(new Uint8Array(bytes));
  return JSON.parse(text);
}

export async function view<T>(method: string, args: object = {}, contractId = DEFAULT_CONTRACT, rpcUrl = DEFAULT_RPC): Promise<T> {
  const r = await rpc<{ result: number[] }>(
    "query",
    { request_type: "call_function", finality: "optimistic", account_id: contractId, method_name: method, args_base64: b64(JSON.stringify(args)) },
    rpcUrl,
  );
  return decodeResult(r.result) as T;
}

export async function accountBalance(accountId: string, rpcUrl = DEFAULT_RPC): Promise<number | null> {
  try {
    const r = await rpc<{ amount: string }>("query", { request_type: "view_account", finality: "optimistic", account_id: accountId }, rpcUrl);
    return yoctoToMilli(r.amount);
  } catch {
    return null;
  }
}

// ---- Raw contract JSON shapes -------------------------------------------------------------

interface RawConfig {
  max_cats: number; day_length_ms: number; gas_tank: string; min_stake: string; fish_base_price: string;
  plot_base_price: string; hunger_limit: number; fish_cap: number; starting_fish: number; catch_chance_pct: number;
  max_open_offers: number; offer_ttl_days: number; max_refuel: string;
}
export interface RawState {
  day: number; last_tick_ms: number; next_tick_ms: number; now_ms: number; fish_price: string; fish_sold_today: number;
  treasury: string; cats: number; alive: number; open_offers: number; event_count: number;
  plots: { id: number; name: string; fish_per_day: number; owner: number | null }[]; config: RawConfig; admin: string;
}
interface RawCat {
  id: number; name: string; account_id: string; personality: string; traits: string; balance: string; stake: string;
  fish: number; hunger: number; alive: boolean; account_ready: boolean; born_day: number; died_day: number | null;
  trades: number; claimed: string; last_words: string; owner_id: string | null; plots: number[];
}
interface RawOffer {
  id: number; maker: number; side: "sell" | "buy"; item: "fish" | "plot"; qty: number; plot_id: number | null;
  price: string; to_cat: number | null; reply_to: number | null; day: number; message: string;
}
interface RawEvent {
  id: number; day: number; ts_ms: number; kind: string; cat: number | null; other: number | null; item: string | null;
  qty: number; price: string; offer_id: number | null; text: string;
}

const NEUTRAL: Traits = { risk: 0.5, lossAversion: 1.5, greed: 0.3, bluff: 0, patience: 0.5, generosity: 0.2, herding: 0.5, safetyStock: 3, endowment: 1, activity: 1 };

export function toConfig(c: RawConfig): GameConfig {
  return {
    maxCats: c.max_cats, dayLengthMs: c.day_length_ms, gasTank: yoctoToMilli(c.gas_tank), minStake: yoctoToMilli(c.min_stake),
    fishBasePrice: yoctoToMilli(c.fish_base_price), plotBasePrice: yoctoToMilli(c.plot_base_price), hungerLimit: c.hunger_limit,
    fishCap: c.fish_cap, startingFish: c.starting_fish, catchChancePct: c.catch_chance_pct, maxOpenOffers: c.max_open_offers,
    offerTtlDays: c.offer_ttl_days, maxRefuel: yoctoToMilli(c.max_refuel),
  };
}

export function toCat(c: RawCat): CatInfo {
  let traits = NEUTRAL;
  try {
    traits = { ...NEUTRAL, ...JSON.parse(c.traits) };
  } catch {
    /* keep neutral */
  }
  return {
    id: c.id, name: c.name, accountId: c.account_id, personality: c.personality, traits,
    balance: yoctoToMilli(c.balance), stake: yoctoToMilli(c.stake), fish: c.fish, hunger: c.hunger, alive: c.alive,
    accountReady: c.account_ready, bornDay: c.born_day, diedDay: c.died_day, trades: c.trades, claimed: yoctoToMilli(c.claimed),
    lastWords: c.last_words, ownerId: c.owner_id, plots: c.plots,
  };
}

export function toOffer(o: RawOffer): OfferInfo {
  return { id: o.id, maker: o.maker, side: o.side, item: o.item, qty: o.qty, plotId: o.plot_id, price: yoctoToMilli(o.price), toCat: o.to_cat, replyTo: o.reply_to, day: o.day, message: o.message };
}

export function toEvent(e: RawEvent): GameEvent {
  return { id: e.id, day: e.day, tsMs: e.ts_ms, kind: e.kind, cat: e.cat, other: e.other, item: e.item, qty: e.qty, price: yoctoToMilli(e.price), offerId: e.offer_id, text: e.text };
}

export function toPlots(s: RawState): PlotInfo[] {
  return s.plots.map((p) => ({ id: p.id, name: p.name, fishPerDay: p.fish_per_day, owner: p.owner }));
}

export interface ChainSnapshot {
  state: RawState;
  world: WorldView;
  events: GameEvent[];
}

/** Everything the brains and the UI need, in one call. */
export async function loadSnapshot(opts: { contractId?: string; rpcUrl?: string; withGas?: boolean } = {}): Promise<ChainSnapshot> {
  const contractId = opts.contractId ?? DEFAULT_CONTRACT;
  const rpcUrl = opts.rpcUrl ?? DEFAULT_RPC;
  const [state, rawCats, rawOffers, rawEvents] = await Promise.all([
    view<RawState>("get_state", {}, contractId, rpcUrl),
    view<RawCat[]>("get_cats", {}, contractId, rpcUrl),
    view<RawOffer[]>("get_offers", {}, contractId, rpcUrl),
    view<RawEvent[]>("get_events", { limit: 200 }, contractId, rpcUrl),
  ]);
  const cats = rawCats.map(toCat);
  if (opts.withGas) {
    const gas = await Promise.all(cats.map((c) => accountBalance(c.accountId, rpcUrl)));
    cats.forEach((c, i) => (c.gasBalance = gas[i] ?? 0));
  }
  const events = rawEvents.map(toEvent);
  const recentFishPrices = events.filter((e) => e.kind === "trade" && e.item === "fish" && e.qty > 0).slice(-20).map((e) => e.price / e.qty);
  const world: WorldView = {
    day: state.day,
    fishPrice: yoctoToMilli(state.fish_price),
    treasury: yoctoToMilli(state.treasury),
    config: toConfig(state.config),
    cats,
    plots: toPlots(state),
    offers: rawOffers.map(toOffer),
    recentFishPrices,
  };
  return { state, world, events };
}
