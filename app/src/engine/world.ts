// An in-memory copy of the contract rules (contract/src/lib.rs), used to simulate weeks of the
// economy in seconds, tune parameters and let judges watch the economy without a wallet.
// If you change a rule in the contract, change it here too.

import type { Action, CatInfo, GameConfig, GameEvent, OfferInfo, PlotInfo, Traits, WorldView } from "./types";
import { PERSONALITIES } from "./personalities";

export const DEFAULT_CONFIG: GameConfig = {
  maxCats: 9,
  dayLengthMs: 60_000,
  gasTank: 50,
  minStake: 100,
  fishBasePrice: 5,
  plotBasePrice: 75,
  hungerLimit: 3,
  fishCap: 10,
  startingFish: 3,
  catchChancePct: 12,
  maxOpenOffers: 3,
  offerTtlDays: 2,
  maxRefuel: 25,
};

export const PLOTS: Omit<PlotInfo, "owner">[] = [
  { id: 0, name: "Cardboard Box", fishPerDay: 1 },
  { id: 1, name: "Laundry Basket", fishPerDay: 1 },
  { id: 2, name: "Sunny Windowsill", fishPerDay: 1 },
  { id: 3, name: "Warm Laptop", fishPerDay: 2 },
  { id: 4, name: "Fishmonger's Roof", fishPerDay: 2 },
];

/** Gas a cat burns per transaction in the simulation (mN). Roughly what testnet charges. */
export const SIM_GAS_PER_TX = 0.5;

export class SimWorld {
  day = 1;
  fishPrice: number;
  fishSoldToday = 0;
  treasury = 0;
  cats: CatInfo[] = [];
  plots: PlotInfo[];
  offers: OfferInfo[] = [];
  events: GameEvent[] = [];
  recentFishPrices: number[] = [];
  private nextOffer = 1;
  private nextEvent = 0;

  constructor(public config: GameConfig = DEFAULT_CONFIG, stake = 130) {
    this.fishPrice = config.fishBasePrice;
    this.plots = PLOTS.map((p) => ({ ...p, owner: null }));
    PERSONALITIES.forEach((p, i) => {
      this.cats.push({
        id: i + 1,
        name: p.name,
        accountId: `cat-${i + 1}.ninelives.sim`,
        personality: p.key,
        traits: p.traits,
        balance: stake,
        stake,
        fish: config.startingFish,
        hunger: 0,
        alive: true,
        accountReady: true,
        bornDay: 1,
        diedDay: null,
        trades: 0,
        claimed: 0,
        lastWords: "",
        ownerId: "sim.owner",
        plots: [],
        gasBalance: config.gasTank,
        home: i,
        generation: 1,
        parent: null,
        life: 1,
      });
      this.event("adopt", i + 1, null, null, 0, 0, null, `${p.name} the ${p.key} cat is born`);
    });
  }

  view(): WorldView {
    for (const c of this.cats) c.plots = this.plots.filter((p) => p.owner === c.id).map((p) => p.id);
    return {
      day: this.day,
      fishPrice: this.fishPrice,
      treasury: this.treasury,
      config: this.config,
      cats: this.cats.map((c) => ({ ...c })),
      plots: this.plots.map((p) => ({ ...p })),
      offers: this.offers.map((o) => ({ ...o })),
      recentFishPrices: [...this.recentFishPrices],
    };
  }

  private event(kind: string, cat: number | null, other: number | null, item: string | null, qty: number, price: number, offerId: number | null, text: string) {
    this.events.push({ id: this.nextEvent++, day: this.day, tsMs: 0, kind, cat, other, item, qty, price, offerId, text });
  }

  private cat(id: number): CatInfo {
    const c = this.cats.find((x) => x.id === id);
    if (!c) throw new Error("No such cat");
    return c;
  }

  /** Apply one action signed by `catId`. Throws with the same messages as the contract. */
  apply(catId: number, a: Action): void {
    const me = this.cat(catId);
    if (!me.alive) throw new Error("Ghost cats cannot act");
    if (a.kind !== "refuel") {
      if ((me.gasBalance ?? 0) < SIM_GAS_PER_TX) throw new Error("Out of gas");
      me.gasBalance = (me.gasBalance ?? 0) - SIM_GAS_PER_TX;
    }
    const msg = "message" in a ? a.message : "";
    if (msg) me.lastWords = msg;
    switch (a.kind) {
      case "make_offer": {
        if (this.offers.filter((o) => o.maker === me.id).length >= this.config.maxOpenOffers) throw new Error("Too many open offers");
        if (a.toCat !== undefined && !this.cat(a.toCat).alive) throw new Error("Target cat is not alive");
        if (a.item === "plot") {
          const plot = this.plots[a.plotId!];
          if (a.side === "sell" && plot.owner !== me.id) throw new Error("You do not own this plot");
          if (a.side === "buy" && (plot.owner === null || plot.owner === me.id)) throw new Error("Plot is not owned by another cat");
        }
        if (a.side === "sell" && a.item === "fish" && me.fish < a.qty) throw new Error("Not enough fish");
        if (a.side === "buy" && me.balance < a.price) throw new Error("Not enough NEAR");
        const o: OfferInfo = { id: this.nextOffer++, maker: me.id, side: a.side, item: a.item, qty: a.item === "plot" ? 1 : a.qty, plotId: a.item === "plot" ? a.plotId! : null, price: a.price, toCat: a.toCat ?? null, replyTo: a.replyTo ?? null, day: this.day, message: a.message };
        this.offers.push(o);
        this.event(o.replyTo !== null ? "counter" : "offer", me.id, o.toCat, o.item, o.qty, o.price, o.id, `${o.side}|${a.message}`);
        return;
      }
      case "accept_offer": {
        const o = this.offers.find((x) => x.id === a.offerId);
        if (!o) throw new Error("No such offer");
        if (o.maker === me.id) throw new Error("Cannot accept your own offer");
        if (o.toCat !== null && o.toCat !== me.id) throw new Error("This offer is for another cat");
        const seller = this.cat(o.side === "sell" ? o.maker : me.id);
        const buyer = this.cat(o.side === "sell" ? me.id : o.maker);
        if (!seller.alive || !buyer.alive) throw new Error("Both cats must be alive");
        if (buyer.balance < o.price) throw new Error("Buyer cannot pay");
        if (o.item === "fish") {
          if (seller.fish < o.qty) throw new Error("Seller does not have the fish");
          seller.fish -= o.qty;
          buyer.fish += o.qty;
          this.recentFishPrices.push(o.price / o.qty);
          if (this.recentFishPrices.length > 20) this.recentFishPrices.shift();
        } else {
          const plot = this.plots[o.plotId!];
          if (plot.owner !== seller.id) throw new Error("Seller no longer owns the plot");
          plot.owner = buyer.id;
          this.offers = this.offers.filter((x) => !(x.item === "plot" && x.plotId === o.plotId && x.id !== o.id));
        }
        buyer.balance -= o.price;
        seller.balance += o.price;
        seller.trades++;
        buyer.trades++;
        this.offers = this.offers.filter((x) => x.id !== o.id);
        this.event("trade", seller.id, buyer.id, o.item, o.qty, o.price, o.id, `${o.side}|${a.message}`);
        return;
      }
      case "cancel_offer": {
        const o = this.offers.find((x) => x.id === a.offerId);
        if (!o) throw new Error("No such offer");
        if (o.maker !== me.id) throw new Error("Not your offer");
        this.offers = this.offers.filter((x) => x.id !== o.id);
        this.event("cancel", me.id, o.toCat, o.item, o.qty, o.price, o.id, a.message);
        return;
      }
      case "say":
        this.event("say", me.id, a.toCat ?? null, null, 0, 0, null, a.message);
        return;
      case "buy_fish": {
        let total = 0;
        let p = this.fishPrice;
        const cap = this.config.fishBasePrice * 20;
        for (let i = 0; i < a.qty; i++) {
          total += p;
          p = Math.min(p * 1.05, cap);
        }
        if (total > a.maxTotal + 1e-9) throw new Error("Price moved above max_total");
        if (me.balance < total) throw new Error("Not enough NEAR");
        this.fishPrice = p;
        this.fishSoldToday += a.qty;
        this.treasury += total;
        me.balance -= total;
        me.fish += a.qty;
        this.event("shop", me.id, null, "fish", a.qty, total, null, a.message);
        return;
      }
      case "buy_plot": {
        const plot = this.plots[a.plotId];
        if (plot.owner !== null) throw new Error("Plot already owned; make an offer to its owner");
        if (me.balance < this.config.plotBasePrice) throw new Error("Not enough NEAR");
        me.balance -= this.config.plotBasePrice;
        this.treasury += this.config.plotBasePrice;
        plot.owner = me.id;
        this.event("plot", me.id, null, "plot", 1, this.config.plotBasePrice, null, `${plot.name}|${a.message}`);
        return;
      }
      case "refuel": {
        if (a.amount <= 0 || a.amount > this.config.maxRefuel) throw new Error("Refuel amount out of range");
        if (me.balance < a.amount) throw new Error("Not enough NEAR");
        me.balance -= a.amount;
        me.gasBalance = (me.gasBalance ?? 0) + a.amount;
        this.event("refuel", me.id, null, null, 0, a.amount, null, "");
        return;
      }
    }
  }

  /** Same order as `tick()` in the contract. */
  tick(rand: () => number = Math.random): void {
    const day = this.day;
    for (const plot of this.plots) {
      if (plot.owner !== null) {
        const c = this.cat(plot.owner);
        if (c.alive) c.fish += plot.fishPerDay;
      }
    }
    for (const c of this.cats) {
      if (c.alive && rand() * 100 < this.config.catchChancePct) {
        c.fish++;
        this.event("catch", c.id, null, "fish", 1, 0, null, `${c.name} caught a stray fish at night`);
      }
    }
    // Scraps: fish above the cap are not wasted; they go to cats with an empty bowl, hungriest first.
    let scraps = 0;
    const donors: number[] = [];
    for (const c of this.cats) {
      if (c.alive && c.fish > this.config.fishCap) {
        scraps += c.fish - this.config.fishCap;
        c.fish = this.config.fishCap;
        donors.push(c.id);
      }
    }
    // Half of the excess spoils on the way; the rest lands with random cats that have nothing.
    const spoiled = Math.ceil(scraps / 2);
    scraps -= spoiled;
    const needy = this.cats.filter((c) => c.alive && c.fish === 0).map((c) => ({ c, r: rand() })).sort((a, b) => a.r - b.r).map((x) => x.c);
    for (const c of needy) {
      if (scraps === 0) break;
      c.fish++;
      scraps--;
      this.event("scraps", c.id, donors[0] ?? null, "fish", 1, 0, null, `${c.name} found a fish in the trash`);
    }
    if (scraps + spoiled > 0 && donors.length) this.event("rot", donors[0], null, "fish", scraps + spoiled, 0, null, "");
    let ate = 0;
    const deaths: number[] = [];
    for (const c of this.cats) {
      if (!c.alive) continue;
      if (c.fish > 0) {
        c.fish--;
        c.hunger = 0;
        ate++;
      } else {
        c.hunger++;
        if (c.hunger >= this.config.hungerLimit) deaths.push(c.id);
        else this.event("hungry", c.id, null, null, c.hunger, 0, null, `${c.name} went to sleep hungry`);
      }
    }
    for (const id of deaths) {
      const c = this.cat(id);
      c.alive = false;
      c.diedDay = this.day;
      for (const p of this.plots) if (p.owner === id) p.owner = null;
      this.offers = this.offers.filter((o) => o.maker !== id && o.toCat !== id);
      this.event("death", id, null, null, 0, 0, null, `${c.name} starved and became a ghost`);
    }
    this.fishPrice = Math.max(this.config.fishBasePrice, this.fishPrice * 0.9);
    this.fishSoldToday = 0;
    this.offers = this.offers.filter((o) => !(o.day + this.config.offerTtlDays <= day + 1));
    this.day++;
    const alive = this.cats.filter((c) => c.alive).length;
    this.event("tick", null, null, null, ate, this.fishPrice, null, `Day ${day} ends. ${ate} cats ate, ${alive} alive.`);
    this.birth(rand);
  }

  /** Same rule as the contract: at most one kitten a night, in a home dark since before last night. */
  private birth(rand: () => number): void {
    const cost = this.config.gasTank + this.config.minStake + 20;
    const start = Math.floor(rand() * 9);
    for (let step = 0; step < 9; step++) {
      const home = (start + step) % 9;
      const mine = this.cats.filter((c) => c.home === home);
      const last = mine.reduce<CatInfo | null>((a, c) => (!a || c.id > a.id ? c : a), null);
      if (!last || last.alive || last.diedDay === null || last.diedDay + 1 >= this.day) continue;
      if (mine.length >= 9 || this.treasury < cost) continue;
      const living = this.cats.filter((c) => c.alive);
      const wealth = (c: CatInfo) => c.balance + c.fish * this.fishPrice + this.plots.filter((p) => p.owner === c.id).length * this.config.plotBasePrice;
      const parent = living.length ? living.reduce((a, c) => (wealth(c) > wealth(a) ? c : a)) : last;
      const { traits, changes } = mutateTraits(parent.traits, rand);
      const taken = new Set(living.map((c) => c.name));
      let n = Math.floor(rand() * KITTEN_NAMES.length);
      for (let i = 0; i < KITTEN_NAMES.length && taken.has(KITTEN_NAMES[n]); i++) n = (n + 1) % KITTEN_NAMES.length;
      const id = this.cats.length + 1;
      const stake = this.config.minStake;
      this.treasury -= cost;
      this.cats.push({
        id, name: KITTEN_NAMES[n], accountId: `cat-${id}.ninelives.sim`, personality: parent.personality, traits,
        balance: stake, stake, fish: this.config.startingFish, hunger: 0, alive: true, accountReady: true,
        bornDay: this.day, diedDay: null, trades: 0, claimed: 0, lastWords: "", ownerId: "nursery", plots: [],
        gasBalance: this.config.gasTank, home, generation: parent.generation + 1, parent: parent.id, life: mine.length + 1,
      });
      this.event("born", id, parent.id, null, home, stake, null, changes);
      return;
    }
  }
}

export const KITTEN_NAMES = [
  "Miso", "Tofu", "Pepper", "Ginger", "Olive", "Pudding", "Bean", "Sushi", "Waffle", "Nugget", "Boba", "Clover", "Pixel", "Simit",
  "Lokum", "Peanut", "Mango", "Bubbles", "Socks", "Cookie", "Zeytin", "Pumpkin", "Mocha", "Tiny", "Kiwi", "Pesto", "Tarcin",
];

const RANGES: Partial<Record<keyof Traits, [number, number, boolean]>> = {
  lossAversion: [0.5, 3.5, false], endowment: [0.5, 3, false], safetyStock: [0, 8, true], activity: [0.2, 1, false],
};

/** JS twin of `mutate_traits` in the contract: about +-15% per trait, ~10% chance of a big jump. */
export function mutateTraits(parent: Traits, rand: () => number): { traits: Traits; changes: string } {
  const out = { ...parent };
  const changes: string[] = [];
  for (const k of Object.keys(parent) as (keyof Traits)[]) {
    const v = parent[k];
    const [lo, hi, int] = RANGES[k] ?? [0, 1, false];
    const spread = rand() < 0.1 ? 0.45 : 0.15;
    const b = rand();
    let nv = int ? v + Math.floor(b * 3) - 1 : v === 0 ? 0.05 * b : v * (1 + (b * 2 - 1) * spread);
    nv = Math.min(hi, Math.max(lo, nv));
    if (!int) nv = Math.round(nv * 100) / 100;
    const d = nv - v;
    if (Math.abs(d) >= 0.05 || (int && d !== 0)) changes.push(`${String(k)} ${d > 0 ? "+" : ""}${int ? d : d.toFixed(2)}`);
    out[k] = nv;
  }
  return { traits: out, changes: changes.join(", ") };
}

/** Small deterministic PRNG so every simulation run can be reproduced from its seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
