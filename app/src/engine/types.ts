// Shared types for the cat brains, the offline simulator and the web UI.
// Amounts inside the engine are in milliNEAR (mN, 1 mN = 0.001 NEAR) as plain numbers.
// The chain adapter converts to and from yoctoNEAR strings.

export type Side = "sell" | "buy";
export type ItemKind = "fish" | "plot";

export interface Traits {
  /** 0..1 appetite for risky purchases such as plots. */
  risk: number;
  /** Prospect-theory loss aversion λ. 1 = neutral, ~2.25 = typical human. */
  lossAversion: number;
  /** 0..1 markup a cat wants when selling. */
  greed: number;
  /** 0..1 chance to anchor high and talk tough when it does not mean it. */
  bluff: number;
  /** 0..1 how long a cat waits before it lowers its price. */
  patience: number;
  /** 0..1 discount given to hungry cats (reciprocity / altruism). */
  generosity: number;
  /** 0..1 weight on what others paid instead of its own valuation. */
  herding: number;
  /** Fish the cat wants to keep in stock (days of food). */
  safetyStock: number;
  /** Endowment effect: multiplier on the value of things the cat already owns. */
  endowment: number;
  /** 0..1 chance the cat bothers to act on a calm day (present bias / laziness). */
  activity: number;
}

export interface Personality {
  key: string;
  title: string;
  name: string;
  /** One-line description shown in the UI. */
  tagline: string;
  /** Which behavioral-economics idea the archetype is built on. */
  basis: string;
  traits: Traits;
}

export interface CatInfo {
  id: number;
  name: string;
  accountId: string;
  personality: string;
  traits: Traits;
  balance: number; // mN
  stake: number; // mN
  fish: number;
  hunger: number;
  alive: boolean;
  accountReady: boolean;
  bornDay: number;
  diedDay: number | null;
  trades: number;
  claimed: number; // mN
  lastWords: string;
  ownerId: string | null;
  plots: number[];
  /** NEAR left on the cat's own account for gas, mN (chain only). */
  gasBalance?: number;
  /** Which of the nine homes the cat lives in (0-8). */
  home: number;
  /** 1 for the founders, parent's generation + 1 for kittens. */
  generation: number;
  /** The cat it was born from (the wealthiest living cat at the time). */
  parent: number | null;
  /** Which of its home's nine lives it is (1-9). */
  life: number;
}

/** One of the nine homes in the alley, with its fan club. */
export interface HomeInfo {
  home: number;
  name: string;
  /** The cat living there now, or the ghost of the last one. 0 = nobody. */
  resident: number;
  residentAlive: boolean;
  livesUsed: number;
  livesLeft: number;
  /** Every cat that has lived there, oldest first. */
  cats: number[];
  fans: number;
  seats: number;
  seatPrice: number; // mN
  nursery: number; // mN
  rewardPerSeat: number; // mN
}

export interface PlotInfo {
  id: number;
  name: string;
  fishPerDay: number;
  owner: number | null;
}

export interface OfferInfo {
  id: number;
  maker: number;
  side: Side;
  item: ItemKind;
  qty: number;
  plotId: number | null;
  price: number; // mN, total
  toCat: number | null;
  replyTo: number | null;
  day: number;
  message: string;
}

export interface GameConfig {
  maxCats: number;
  dayLengthMs: number;
  gasTank: number;
  minStake: number;
  fishBasePrice: number;
  plotBasePrice: number;
  hungerLimit: number;
  fishCap: number;
  startingFish: number;
  catchChancePct: number;
  maxOpenOffers: number;
  offerTtlDays: number;
  maxRefuel: number;
}

export interface GameEvent {
  id: number;
  day: number;
  tsMs: number;
  kind: string;
  cat: number | null;
  other: number | null;
  item: string | null;
  qty: number;
  price: number; // mN
  offerId: number | null;
  text: string;
}

export interface WorldView {
  day: number;
  fishPrice: number; // mN, price of the next fish in the shop
  treasury: number;
  config: GameConfig;
  cats: CatInfo[];
  plots: PlotInfo[];
  offers: OfferInfo[];
  /** Unit prices of recent cat-to-cat fish trades, newest last. */
  recentFishPrices: number[];
}

/** What a brain asks the world to do. Maps 1:1 to contract methods. */
export type Action =
  | { kind: "make_offer"; side: Side; item: ItemKind; qty: number; plotId?: number; price: number; toCat?: number; replyTo?: number; message: string; reason: string }
  | { kind: "accept_offer"; offerId: number; message: string; reason: string }
  | { kind: "cancel_offer"; offerId: number; message: string; reason: string }
  | { kind: "buy_fish"; qty: number; maxTotal: number; message: string; reason: string }
  | { kind: "buy_plot"; plotId: number; message: string; reason: string }
  | { kind: "say"; message: string; toCat?: number; reason: string }
  | { kind: "refuel"; amount: number; reason: string };
