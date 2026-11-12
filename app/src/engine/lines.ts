// What the cats say. Every on-chain action carries a short line in character.
// These templates are the default; if NEAR AI Cloud is configured, dialogue.ts rewrites them
// with an LLM, keeping the same intent and numbers.

export type LineType =
  | "sell"
  | "buy"
  | "counter_buy"
  | "counter_sell"
  | "accept_buy"
  | "accept_sell"
  | "shop"
  | "plot_buy"
  | "plot_sell"
  | "plot_accept"
  | "plot_bid"
  | "beg"
  | "cancel"
  | "charity";

type Lines = Partial<Record<LineType, string[]>>;

const COMMON: Record<LineType, string[]> = {
  sell: ["{qty} fish for {price}. Fresh this morning.", "Selling {qty} fish, {price} total."],
  buy: ["Looking for {qty} fish. Paying {price}.", "Need {qty} fish. {price}, take it or leave it."],
  counter_buy: ["{price} for your {qty} fish. That's fair.", "Too pricey. {price}?"],
  counter_sell: ["Can't go that low. {price} and they're yours.", "Meet me at {price}."],
  accept_buy: ["Deal.", "Fine, I'll take it."],
  accept_sell: ["Sold.", "Pleasure doing business."],
  shop: ["Back to the fishmonger again. {price} for {qty}.", "Shop fish, {price}. Highway robbery."],
  plot_buy: ["I'm moving into the {plot}.", "The {plot} is mine now."],
  plot_sell: ["Selling my {plot}. {price}.", "The {plot} could be yours for {price}."],
  plot_accept: ["The {plot} changes paws.", "Signed. Enjoy the {plot}."],
  plot_bid: ["I'll give you {price} for the {plot}.", "{price} for the {plot}. Think about it."],
  beg: ["Anyone? I haven't eaten in {hunger} days.", "Please. One fish. I'll pay you back."],
  cancel: ["Changed my mind.", "Offer withdrawn."],
  charity: ["You look hungry. {qty} fish for {price}, no profit.", "Take them, friend. {price} is just my cost."],
};

const BY_PERSONALITY: Record<string, Lines> = {
  shark: {
    sell: ["{qty} fish, {price}. Price goes up tomorrow.", "Hungry? {price} for {qty}. Supply and demand, kitten."],
    buy: ["I'll take {qty} fish at {price}. Nobody else is buying.", "{price} for {qty}. Cash now."],
    accept_sell: ["Pleasure. Come back when you're hungrier.", "Sold. Someone always pays."],
    counter_sell: ["{price}. I don't do charity.", "You want food or not? {price}."],
  },
  hoarder: {
    sell: ["I... suppose I can spare {qty}. {price}. Maybe.", "Only {qty}. I need the rest. {price}."],
    buy: ["Need {qty} more fish. Just to be safe. {price}?", "What if there's a famine? Buying {qty} at {price}."],
    shop: ["The shop is expensive but an empty bowl is worse.", "Bought {qty} more. You can never have too many."],
    accept_buy: ["Yes! Into the stash.", "More fish. Good. Safe."],
    counter_sell: ["No no no. {price} or I keep them.", "These are my emergency fish. {price}."],
  },
  bluffer: {
    sell: ["LAST {qty} FISH IN THE ALLEY. {price}. Final offer.", "The shop is closing tomorrow. {qty} fish, {price}.", "Three cats already asked. {price} for {qty}, final."],
    buy: ["I have a better offer elsewhere. {price} for {qty}.", "Fish prices are crashing. I'll do {price}."],
    counter_sell: ["Absolutely final this time: {price}.", "My cousin in the next alley pays more. {price}."],
    counter_buy: ["{price} or I walk. I mean it this time.", "Everyone knows they're worth {price}."],
    cancel: ["Price is going UP. Offer withdrawn.", "Too many buyers. Repricing."],
  },
  gambler: {
    plot_buy: ["ALL IN on the {plot}! Real estate never goes down.", "Bought the {plot}. Fish? I'll figure it out."],
    plot_bid: ["{price} for the {plot}. YOLO.", "Name your price. Fine, {price}."],
    beg: ["I own property! I just... have no fish.", "Rich on paper. Starving in practice."],
    shop: ["Emergency fish. Don't tell anyone.", "{price}?! Fine."],
  },
  saint: {
    sell: ["{qty} fish for {price}. Anyone hungry gets first dibs.", "Fair price for everyone: {price} for {qty}."],
    charity: ["You need this more than I do. {qty} for {price}.", "No one starves on my watch. {price}, at cost."],
    accept_sell: ["Eat well, friend.", "Glad I could help."],
  },
  follower: {
    buy: ["Everyone's paying about that. {price} for {qty}.", "Same as the others: {price}."],
    sell: ["Market price, {price} for {qty}.", "Whatever they're paying: {price}."],
    accept_buy: ["If they paid that, it must be right.", "Okay! Same as everyone."],
  },
  panicker: {
    plot_sell: ["SELLING THE {plot}. {price}. I NEED FOOD.", "Take the {plot}. Just give me {price}."],
    beg: ["I'M GOING TO DIE. Somebody sell me a fish!", "Day {hunger} without food. Please."],
    sell: ["Selling {qty} before prices crash! {price}!", "{qty} fish, {price}, quick!"],
    shop: ["Panic buy! {qty} fish!", "Bought {qty} at {price}. Was that too much? Probably."],
  },
  monopolist: {
    plot_buy: ["The {plot} joins my empire.", "Another plot. The alley will be mine."],
    plot_bid: ["{price} for the {plot}. Generous, considering.", "Sell me the {plot}. {price}. You won't get a better offer."],
    sell: ["My fish, my price. {qty} for {price}.", "From my estates: {qty} fish, {price}."],
    counter_sell: ["I own the supply. {price}.", "{price}. Where else will you go?"],
  },
  lazy: {
    shop: ["Ugh. Fine. Shop fish.", "Easier than haggling. {price}."],
    accept_buy: ["Sure, whatever.", "Yeah okay."],
    beg: ["I'll deal with this tomorrow... oh. It's tomorrow.", "Should have bought fish yesterday."],
  },
};

export function fmtNear(mN: number): string {
  return `${(mN / 1000).toFixed(3)} NEAR`;
}

export function line(
  personality: string,
  type: LineType,
  vars: { qty?: number; price?: number; plot?: string; hunger?: number },
  rand: () => number,
): string {
  const pool = BY_PERSONALITY[personality]?.[type] ?? COMMON[type];
  const t = pool[Math.floor(rand() * pool.length)] ?? "";
  return t
    .replaceAll("{qty}", String(vars.qty ?? 1))
    .replaceAll("{price}", vars.price !== undefined ? fmtNear(vars.price) : "")
    .replaceAll("{plot}", vars.plot ?? "plot")
    .replaceAll("{hunger}", String(vars.hunger ?? 1));
}
