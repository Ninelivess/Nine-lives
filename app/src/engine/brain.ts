// The cat brain. Pure function: (who I am, what I see) -> what I do today.
// No LLM is needed to decide; prices come from the personality numbers in personalities.ts.
// Every action carries a `reason` so the UI can show why a cat did what it did.

import type { Action, CatInfo, OfferInfo, Traits, WorldView } from "./types";
import { line } from "./lines";

export interface BrainOptions {
  rand: () => number;
  maxActions?: number;
}

export interface Valuation {
  /** What a fish is "worth" to this cat today (mN). */
  ref: number;
  /** Max unit price it will pay. */
  wtp: number;
  /** Min unit price it will sell for. */
  ask: number;
  /** Fish it wants to buy. */
  need: number;
  /** Fish it can sell without feeling unsafe. */
  sellable: number;
  /** 0 = calm, 1 = will be hungry tonight, >1 = already starving. */
  urgency: number;
  /** Fish its plots produce per day. */
  production: number;
}

const round = (x: number) => Math.max(0.01, Math.round(x * 100) / 100);

export function shopQuote(fishPrice: number, base: number, qty: number): number {
  let total = 0;
  let p = fishPrice;
  for (let i = 0; i < qty; i++) {
    total += p;
    p = Math.min(p * 1.05, base * 20);
  }
  return total;
}

export function production(me: CatInfo, world: WorldView): number {
  return world.plots.filter((p) => p.owner === me.id).reduce((s, p) => s + p.fishPerDay, 0);
}

export function referencePrice(world: WorldView, t: Traits): number {
  const own = world.fishPrice * 0.8;
  const recent = world.recentFishPrices.slice(-8);
  const crowd = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : own;
  return t.herding * crowd + (1 - t.herding) * own;
}

export function valuation(me: CatInfo, world: WorldView): Valuation {
  const t = me.traits;
  const prod = production(me, world);
  const ref = referencePrice(world, t);
  const target = prod >= 1 ? Math.min(t.safetyStock, 2) : t.safetyStock;
  const need = Math.max(0, Math.ceil(target - me.fish));
  const keep = prod >= 2 ? Math.max(1, target - 1) : target;
  const sellable = Math.max(0, me.fish - Math.max(keep, prod >= 1 ? 0 : 1));

  let urgency = 0;
  if (me.hunger > 0) urgency = 1 + me.hunger * 0.5;
  else if (prod === 0 && me.fish === 0) urgency = 1;
  else if (prod === 0 && me.fish === 1) urgency = 0.5;
  else if (need > 0) urgency = 0.2;

  // Loss-averse cats fear an empty bowl more, so they pay more when they need food.
  let wtp = need > 0 || urgency >= 1 ? ref * (1 + 0.6 * urgency) * (1 + 0.15 * (t.lossAversion - 1)) : ref * 0.7;
  const shopCap = world.fishPrice * (urgency >= 1 ? (t.lossAversion >= 2.5 ? 1.2 : 1.0) : 0.95);
  wtp = Math.min(wtp, shopCap);
  // Selling feels like a loss to loss-averse cats, so they ask more.
  const ask = Math.max(ref * 0.6, ref * (1 + 0.8 * t.greed) * (1 + 0.08 * (t.lossAversion - 1)));
  return { ref, wtp, ask, need, sellable, urgency, production: prod };
}

export function plotValue(fishPerDay: number, ref: number, t: Traits): number {
  const horizonDays = 4 + 8 * t.risk;
  return fishPerDay * ref * horizonDays;
}

function isHungry(c: CatInfo, world: WorldView): boolean {
  return c.alive && (c.hunger > 0 || (c.fish === 0 && production(c, world) === 0));
}

export function decide(me: CatInfo, world: WorldView, opts: BrainOptions): Action[] {
  if (!me.alive || !me.accountReady) return [];
  const { rand } = opts;
  const t = me.traits;
  const v = valuation(me, world);
  const actions: Action[] = [];
  const max = opts.maxActions ?? 3;
  const say = (type: Parameters<typeof line>[1], vars: Parameters<typeof line>[2]) => line(me.personality, type, vars, rand);
  const catName = (id: number) => world.cats.find((c) => c.id === id)?.name ?? `#${id}`;

  let balance = me.balance;
  let fish = me.fish;
  let sellable = v.sellable;
  let need = v.need;
  const myOffers = world.offers.filter((o) => o.maker === me.id);
  let openOffers = myOffers.length;
  const takenOffers = new Set<number>();
  const push = (a: Action) => {
    if (actions.length < max) actions.push(a);
  };

  // Gas: a cat that cannot pay gas cannot act, and a cat that cannot act starves.
  if (me.gasBalance !== undefined && me.gasBalance < 15 && balance > 30) {
    actions.push({ kind: "refuel", amount: 20, reason: `Own account has ${me.gasBalance.toFixed(1)} mN left for gas` });
    balance -= 20;
  }

  // Present bias: on a calm day, the lazy cat may not bother at all.
  if (v.urgency < 1 && rand() > t.activity) return actions;

  // 1. Re-price stale offers (slow concession; patient cats wait longer).
  const concessionDays = Math.ceil(1 + 2 * t.patience);
  for (const o of myOffers) {
    if (world.day - o.day >= concessionDays && o.toCat === null) {
      push({ kind: "cancel_offer", offerId: o.id, message: say("cancel", {}), reason: `Offer #${o.id} unanswered for ${world.day - o.day} days` });
      openOffers--;
    }
  }

  // 2. Answer offers made directly to me (counter-offers) first, then public ones.
  const incoming = world.offers
    .filter((o) => o.maker !== me.id && (o.toCat === null || o.toCat === me.id))
    .sort((a, b) => (b.toCat === me.id ? 1 : 0) - (a.toCat === me.id ? 1 : 0) || a.price / a.qty - b.price / b.qty);

  for (const o of incoming) {
    if (actions.length >= max) break;
    const maker = world.cats.find((c) => c.id === o.maker);
    if (!maker?.alive) continue;
    const unit = o.price / o.qty;

    if (o.item === "fish" && o.side === "sell") {
      // Someone is selling fish.
      if ((need > 0 || v.urgency >= 1) && o.price <= balance) {
        const limit = (v.urgency >= 1 ? v.wtp * 1.15 : v.wtp) * 1.01; // 1% tolerance for rounding
        if (unit <= limit) {
          push({ kind: "accept_offer", offerId: o.id, message: say("accept_buy", {}), reason: `Needs ${need} fish; ${unit.toFixed(2)} mN/fish ≤ my limit ${limit.toFixed(2)}` });
          takenOffers.add(o.id);
          balance -= o.price;
          fish += o.qty;
          need = Math.max(0, need - o.qty);
          continue;
        }
        const alreadyCountered = world.offers.some((x) => x.maker === me.id && x.replyTo === o.id);
        if (!alreadyCountered && unit <= v.wtp * 1.4 && openOffers < 3 && rand() < 0.4 + t.patience * 0.5) {
          const bidUnit = round((unit + v.wtp) / 2);
          const price = round(bidUnit * o.qty);
          if (price <= balance) {
            push({ kind: "make_offer", side: "buy", item: "fish", qty: o.qty, price, toCat: o.maker, replyTo: o.id, message: say("counter_buy", { qty: o.qty, price }), reason: `${catName(o.maker)} asks ${unit.toFixed(2)}/fish, my limit is ${v.wtp.toFixed(2)}: counter in the middle` });
            openOffers++;
          }
        }
      }
    } else if (o.item === "fish" && o.side === "buy") {
      // Someone wants to buy fish from the market (or from me).
      if (sellable >= o.qty) {
        const buyerHungry = isHungry(maker, world);
        const discount = buyerHungry ? 0.5 * t.generosity : 0;
        // A counter-offer addressed to me means the other side already moved; meet it more easily.
        const flex = o.toCat === me.id ? 0.85 + 0.1 * t.patience : 1;
        const minUnit = v.ask * (1 - discount) * flex;
        if (unit >= minUnit) {
          push({ kind: "accept_offer", offerId: o.id, message: say(buyerHungry && discount > 0.2 ? "charity" : "accept_sell", { qty: o.qty, price: o.price }), reason: `Has ${sellable} spare fish; ${unit.toFixed(2)}/fish ≥ my minimum ${minUnit.toFixed(2)}` });
          takenOffers.add(o.id);
          balance += o.price;
          fish -= o.qty;
          sellable -= o.qty;
          continue;
        }
        const depth = o.replyTo !== null ? 1 : 0;
        const alreadyCountered = world.offers.some((x) => x.maker === me.id && x.replyTo === o.id);
        if (!alreadyCountered && depth <= 1 && unit >= minUnit * 0.7 && openOffers < 3 && rand() < 0.7) {
          const askUnit = round((unit + minUnit) / 2 + (rand() < t.bluff ? minUnit * 0.1 : 0));
          const price = round(askUnit * o.qty);
          push({ kind: "make_offer", side: "sell", item: "fish", qty: o.qty, price, toCat: o.maker, replyTo: o.id, message: say("counter_sell", { qty: o.qty, price }), reason: `${catName(o.maker)} bids ${unit.toFixed(2)}/fish, my minimum is ${minUnit.toFixed(2)}: counter` });
          openOffers++;
        }
      }
    } else if (o.item === "plot" && o.side === "sell" && o.plotId !== null) {
      const plot = world.plots[o.plotId];
      const value = plotValue(plot.fishPerDay, v.ref, t);
      const reserve = v.ref * (t.safetyStock + 3);
      if (o.price <= value && balance - o.price >= reserve) {
        push({ kind: "accept_offer", offerId: o.id, message: say("plot_accept", { plot: plot.name }), reason: `${plot.name} is worth ${value.toFixed(1)} mN to me, asked ${o.price.toFixed(1)}` });
        takenOffers.add(o.id);
        balance -= o.price;
      }
    } else if (o.item === "plot" && o.side === "buy" && o.plotId !== null && world.plots[o.plotId].owner === me.id) {
      const plot = world.plots[o.plotId];
      const mine = plotValue(plot.fishPerDay, v.ref, t) * t.endowment;
      // Under stress, loss-averse and impatient cats dump assets.
      const panic = v.urgency >= 1 ? 0.5 + 0.5 * t.patience : 1;
      if (o.price >= mine * panic) {
        push({ kind: "accept_offer", offerId: o.id, message: say("plot_accept", { plot: plot.name }), reason: `Offer ${o.price.toFixed(1)} ≥ what the ${plot.name} means to me (${(mine * panic).toFixed(1)})` });
        takenOffers.add(o.id);
        balance += o.price;
      }
    }
  }

  // 3. Survival: will I go to bed hungry tonight?
  if ((v.urgency >= 1 || (fish === 0 && v.production === 0)) && fish === 0 && actions.length < max) {
    const qty = Math.max(1, Math.min(2, v.need || 1));
    const quote = shopQuote(world.fishPrice, world.config.fishBasePrice, qty);
    if (quote <= balance) {
      push({ kind: "buy_fish", qty, maxTotal: round(quote * 1.12), message: say("shop", { qty, price: quote }), reason: `No fish left and no cheaper offer: shop sells ${qty} for ${quote.toFixed(2)} mN` });
      balance -= quote;
      fish += qty;
      need = Math.max(0, need - qty);
    } else {
      const q1 = shopQuote(world.fishPrice, world.config.fishBasePrice, 1);
      if (q1 <= balance) {
        push({ kind: "buy_fish", qty: 1, maxTotal: round(q1 * 1.12), message: say("shop", { qty: 1, price: q1 }), reason: `Last coins for one shop fish` });
        balance -= q1;
        fish += 1;
      } else {
        const myPlot = world.plots.find((p) => p.owner === me.id);
        if (myPlot && openOffers < 3) {
          const price = round(plotValue(myPlot.fishPerDay, v.ref, t) * 0.6);
          push({ kind: "make_offer", side: "sell", item: "plot", qty: 1, plotId: myPlot.id, price, message: say("plot_sell", { plot: myPlot.name, price }), reason: `Broke and starving: selling ${myPlot.name}` });
          openOffers++;
        } else {
          push({ kind: "say", message: say("beg", { hunger: me.hunger + 1 }), reason: `Broke: ${balance.toFixed(2)} mN, shop wants ${q1.toFixed(2)}` });
        }
      }
    }
  }

  // 4. Fear buying: very loss-averse cats top up from the shop before they run low.
  if (actions.length < max && need >= 3 && t.lossAversion >= 2.5 && v.urgency < 1) {
    const qty = 2;
    const quote = shopQuote(world.fishPrice, world.config.fishBasePrice, qty);
    if (quote <= balance - v.ref * 5) {
      push({ kind: "buy_fish", qty, maxTotal: round(quote * 1.12), message: say("shop", { qty, price: quote }), reason: `Only ${fish} fish, wants ${t.safetyStock}: fear buying` });
      balance -= quote;
      fish += qty;
      need -= qty;
    }
  }

  // 5. Charity: generous cats offer fish at cost to a hungry neighbour.
  if (actions.length < max && sellable >= 1 && t.generosity >= 0.6 && openOffers < 3) {
    const hungry = world.cats.find((c) => c.id !== me.id && isHungry(c, world) && !world.offers.some((o) => o.maker === me.id && o.toCat === c.id));
    if (hungry) {
      const price = round(v.ref * (1 - 0.5 * t.generosity));
      push({ kind: "make_offer", side: "sell", item: "fish", qty: 1, price, toCat: hungry.id, message: say("charity", { qty: 1, price }), reason: `${hungry.name} is hungry` });
      sellable -= 1;
      openOffers++;
    }
  }

  // 6. Market making: post a public offer for surplus or for a calm need.
  const hasPublic = (side: "sell" | "buy") => myOffers.some((o) => o.side === side && o.item === "fish" && o.toCat === null && !actions.some((a) => a.kind === "cancel_offer" && a.offerId === o.id));
  if (actions.length < max && sellable >= 1 && openOffers < 3 && !hasPublic("sell")) {
    const qty = Math.min(sellable, 3);
    const anchor = rand() < t.bluff ? 1 + 0.5 * t.bluff : 1;
    const price = round(v.ask * anchor * qty);
    push({ kind: "make_offer", side: "sell", item: "fish", qty, price, message: say("sell", { qty, price }), reason: `${sellable} spare fish, asking ${(price / qty).toFixed(2)}/fish${anchor > 1 ? " (anchoring high)" : ""}` });
    openOffers++;
  }
  if (actions.length < max && need >= 1 && v.urgency < 1 && openOffers < 3 && !hasPublic("buy")) {
    const qty = Math.min(need, 2);
    const unit = v.ref * (0.8 + 0.15 * t.herding);
    const price = round(unit * qty);
    if (price <= balance) {
      push({ kind: "make_offer", side: "buy", item: "fish", qty, price, message: say("buy", { qty, price }), reason: `Wants ${need} more fish for safety, bidding ${unit.toFixed(2)}/fish` });
      openOffers++;
    }
  }

  // 7. Real estate.
  if (actions.length < max) {
    const reserve = v.ref * (t.safetyStock + 4);
    const free = world.plots.filter((p) => p.owner === null).sort((a, b) => b.fishPerDay - a.fishPerDay);
    const best = free[0];
    if (best && rand() < t.risk) {
      const value = plotValue(best.fishPerDay, v.ref, t);
      const price = world.config.plotBasePrice;
      if (value >= price && balance - price >= reserve) {
        push({ kind: "buy_plot", plotId: best.id, message: say("plot_buy", { plot: best.name }), reason: `${best.name} worth ${value.toFixed(1)} mN to me, costs ${price}` });
        balance -= price;
      }
    } else if (!best && t.risk >= 0.7 && openOffers < 3 && rand() < t.risk * 0.5) {
      const targets = world.plots
        .filter((p) => p.owner !== null && p.owner !== me.id)
        .filter((p) => !world.offers.some((o) => o.maker === me.id && o.item === "plot" && o.plotId === p.id));
      const target = targets.sort((a, b) => b.fishPerDay - a.fishPerDay)[0];
      if (target) {
        const price = round(plotValue(target.fishPerDay, v.ref, t) * 0.85);
        if (balance - price >= reserve) {
          push({ kind: "make_offer", side: "buy", item: "plot", qty: 1, plotId: target.id, price, toCat: target.owner!, message: say("plot_bid", { plot: target.name, price }), reason: `Wants the ${target.name}; bids 85% of its value to me` });
          openOffers++;
        }
      }
    }
  }

  return actions.filter((a) => a.kind !== "accept_offer" || takenOffers.has(a.offerId));
}
