import type { Personality } from "./types";

// Nine archetypes, one per cat. Each is a small set of numbers taken from well-known
// behavioral-economics findings. The brain (brain.ts) turns these numbers into prices and
// decisions; nothing here is hidden in a prompt. See PERSONALITIES.md for the sources.

export const PERSONALITIES: Personality[] = [
  {
    key: "shark",
    title: "The Shark",
    name: "Mochi",
    tagline: "Buys fear, sells hunger. Never gives a discount.",
    basis: "Low loss aversion, profit-maximizing trader (homo economicus baseline).",
    traits: { risk: 0.7, lossAversion: 1.1, greed: 0.6, bluff: 0.3, patience: 0.4, generosity: 0, herding: 0.3, safetyStock: 2, endowment: 1.0, activity: 1 },
  },
  {
    key: "hoarder",
    title: "The Hoarder",
    name: "Biscuit",
    tagline: "Terrified of an empty bowl. Keeps six fish, just in case.",
    basis: "Strong loss aversion (λ≈2.8) and a large precautionary buffer.",
    traits: { risk: 0.2, lossAversion: 2.8, greed: 0.3, bluff: 0, patience: 0.8, generosity: 0.1, herding: 0.5, safetyStock: 6, endowment: 2.0, activity: 0.9 },
  },
  {
    key: "bluffer",
    title: "The Bluffer",
    name: "Smokey",
    tagline: "\"Last fish in town, final offer.\" It is never the final offer.",
    basis: "Anchoring: opens far above value, then concedes slowly.",
    traits: { risk: 0.5, lossAversion: 1.5, greed: 0.8, bluff: 0.9, patience: 0.6, generosity: 0.1, herding: 0.2, safetyStock: 3, endowment: 1.2, activity: 1 },
  },
  {
    key: "gambler",
    title: "The Gambler",
    name: "Luna",
    tagline: "All in on real estate. Food is a problem for tomorrow.",
    basis: "Risk-seeking, λ below 1, tiny safety stock.",
    traits: { risk: 0.95, lossAversion: 0.9, greed: 0.4, bluff: 0.2, patience: 0.2, generosity: 0.2, herding: 0.6, safetyStock: 1, endowment: 1.0, activity: 1 },
  },
  {
    key: "saint",
    title: "The Saint",
    name: "Pasha",
    tagline: "Sells at cost to anyone who is starving.",
    basis: "Inequity aversion and reciprocity (Fehr & Schmidt).",
    traits: { risk: 0.4, lossAversion: 1.5, greed: 0.1, bluff: 0, patience: 0.5, generosity: 0.9, herding: 0.4, safetyStock: 3, endowment: 1.0, activity: 1 },
  },
  {
    key: "follower",
    title: "The Follower",
    name: "Pamuk",
    tagline: "Pays whatever the last cat paid.",
    basis: "Herding / information cascades.",
    traits: { risk: 0.5, lossAversion: 2.0, greed: 0.3, bluff: 0.1, patience: 0.5, generosity: 0.3, herding: 0.95, safetyStock: 3, endowment: 1.0, activity: 1 },
  },
  {
    key: "panicker",
    title: "The Panicker",
    name: "Pickles",
    tagline: "One hungry night and it sells everything it owns.",
    basis: "High loss aversion plus impatience: panic selling under stress.",
    traits: { risk: 0.3, lossAversion: 2.5, greed: 0.2, bluff: 0, patience: 0.1, generosity: 0.2, herding: 0.7, safetyStock: 4, endowment: 0.8, activity: 1 },
  },
  {
    key: "monopolist",
    title: "The Monopolist",
    name: "Kaiser",
    tagline: "Wants every plot in the alley. Will not sell one back.",
    basis: "Endowment effect: values what it owns at 2.5x.",
    traits: { risk: 0.8, lossAversion: 1.8, greed: 0.7, bluff: 0.4, patience: 0.7, generosity: 0, herding: 0.1, safetyStock: 3, endowment: 2.5, activity: 1 },
  },
  {
    key: "lazy",
    title: "The Lazy One",
    name: "Noodle",
    tagline: "Will deal with it tomorrow. Usually.",
    basis: "Present bias: acts only when the problem is today.",
    traits: { risk: 0.3, lossAversion: 1.3, greed: 0.2, bluff: 0, patience: 0.9, generosity: 0.4, herding: 0.3, safetyStock: 1, endowment: 1.0, activity: 0.35 },
  },
];

export function personalityByKey(key: string): Personality {
  const p = PERSONALITIES.find((x) => x.key === key);
  if (!p) throw new Error(`Unknown personality ${key}`);
  return p;
}
