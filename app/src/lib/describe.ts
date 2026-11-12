import type { CatInfo, GameEvent, PlotInfo } from "@/engine/types";
import { PERSONALITIES } from "@/engine/personalities";

export const HOMES = ["Cardboard Box", "Laundry Basket", "Trash Can", "Wooden Crate", "Flowerpot", "Paper Bag", "Fish Crate", "Treasure Chest", "Cat Bed"];

export function near(mN: number, digits = 3): string {
  return `${(mN / 1000).toFixed(digits)} NEAR`;
}

export function titleOf(personality: string): string {
  return PERSONALITIES.find((p) => p.key === personality)?.title ?? personality;
}

export interface Described {
  icon: string;
  text: string;
  quote?: string;
  tone: "trade" | "talk" | "bad" | "death" | "good" | "night" | "info";
}

export function describe(e: GameEvent, cats: Map<number, CatInfo>, plots: PlotInfo[] = []): Described {
  const n = (id: number | null) => (id === null ? "someone" : cats.get(id)?.name ?? `Cat #${id}`);
  const [head, ...rest] = e.text.split("|");
  const msg = e.text.includes("|") ? rest.join("|") : e.text;
  const quote = msg && msg.trim() ? msg.trim() : undefined;
  const what = e.item === "plot" ? "a plot" : `${e.qty} fish`;
  switch (e.kind) {
    case "adopt":
      return { icon: "🐣", text: `${n(e.cat)} (${titleOf(cats.get(e.cat!)?.personality ?? "")}) moves into the alley`, tone: "info" };
    case "offer":
      return head === "sell"
        ? { icon: "📣", text: `${n(e.cat)} offers ${what} for ${near(e.price)}${e.other !== null ? ` to ${n(e.other)}` : ""}`, quote, tone: "talk" }
        : { icon: "📣", text: `${n(e.cat)} wants ${what} for ${near(e.price)}${e.other !== null ? ` from ${n(e.other)}` : ""}`, quote, tone: "talk" };
    case "counter":
      return { icon: "↩️", text: `${n(e.cat)} counters ${n(e.other)}: ${head === "sell" ? "sell" : "buy"} ${what} for ${near(e.price)}`, quote, tone: "talk" };
    case "trade":
      return { icon: e.item === "plot" ? "🏠" : "🤝", text: `${n(e.cat)} sold ${what} to ${n(e.other)} for ${near(e.price)}`, quote, tone: "trade" };
    case "cancel":
      return { icon: "✖️", text: `${n(e.cat)} withdrew an offer`, quote, tone: "talk" };
    case "shop":
      return { icon: "🐟", text: `${n(e.cat)} bought ${e.qty} fish at the shop for ${near(e.price)}`, quote, tone: "bad" };
    case "plot":
      return { icon: "📦", text: `${n(e.cat)} bought the ${head} for ${near(e.price)}`, quote: rest.join("|") || undefined, tone: "good" };
    case "say":
      return { icon: "💬", text: `${n(e.cat)}${e.other !== null ? ` → ${n(e.other)}` : ""}`, quote, tone: "talk" };
    case "hungry":
      return { icon: "😿", text: `${n(e.cat)} went to sleep hungry (day ${e.qty} without food)`, tone: "bad" };
    case "death":
      return { icon: "👻", text: `${n(e.cat)} starved and became a ghost`, tone: "death" };
    case "catch":
      return { icon: "🐭", text: `${n(e.cat)} caught a stray fish at night`, tone: "good" };
    case "scraps":
      return { icon: "🗑️", text: `${n(e.cat)} found a fish in ${e.other !== null ? `${n(e.other)}'s` : "the"} trash`, tone: "good" };
    case "rot":
      return { icon: "🦴", text: `${e.qty} fish rotted${e.cat !== null ? ` in ${n(e.cat)}'s stash` : ""}`, tone: "bad" };
    case "refuel":
      return { icon: "⛽", text: `${n(e.cat)} moved ${near(e.price)} to its own account to pay for gas`, tone: "info" };
    case "claim":
      return { icon: "💰", text: `The owner of ${n(e.cat)} claimed ${near(e.price)} of profit`, tone: "info" };
    case "feed":
      return { icon: "🍽️", text: `${n(e.cat)} was fed ${near(e.price)} by a human`, tone: "good" };
    case "tick":
      return { icon: "🌙", text: e.text, tone: "night" };
    case "listed":
      return { icon: "", text: `${n(e.cat)} was put up for sale for ${near(e.price)}`, tone: "info" };
    case "delisted":
      return { icon: "", text: `${n(e.cat)} was taken off the market`, tone: "info" };
    case "sale": {
      const [seller, buyer] = e.text.split("|");
      if (seller?.split(".")[0] === "ninelives" && (cats.get(e.cat ?? -1)?.generation ?? 1) > 1) return { icon: "", text: `${n(e.cat)} was adopted from the nursery by ${short(buyer)} for ${near(e.price)}`, tone: "good" };
      return { icon: "", text: `${n(e.cat)} was sold for ${near(e.price)}: ${short(seller)} → ${short(buyer)}`, tone: "trade" };
    }
    case "born": {
      const kid = e.cat !== null ? cats.get(e.cat) : undefined;
      return {
        icon: "",
        text: `${n(e.cat)} is born in the ${HOMES[e.qty] ?? "alley"}, child of ${n(e.other)}${kid ? ` (life ${kid.life}/9, generation ${kid.generation})` : ""}. Up for adoption.`,
        quote: e.text ? `mutations: ${e.text}` : undefined,
        tone: "good",
      };
    }
    case "fan":
      return { icon: "", text: `${short(e.text)} took a seat in the ${HOMES[e.qty] ?? "home"} fan club`, tone: "good" };
    case "fan_claim":
      return { icon: "", text: `A fan of the ${HOMES[e.qty] ?? "home"} collected ${near(e.price)}`, tone: "info" };
    case "nursery":
      return { icon: "", text: `${short(e.text)} saved ${near(e.price)} for the ${HOMES[e.qty] ?? "home"}'s next kitten`, tone: "good" };
    case "config":
      return { icon: "⚙️", text: "The alley rules were updated", tone: "info" };
    default:
      return { icon: "·", text: `${e.kind}`, tone: "info" };
  }
}

function short(account: string | undefined): string {
  if (!account) return "?";
  return account.length > 24 ? `${account.slice(0, 10)}…${account.slice(-8)}` : account;
}

export function plotName(plots: PlotInfo[], id: number): string {
  return plots.find((p) => p.id === id)?.name ?? `Plot ${id}`;
}
