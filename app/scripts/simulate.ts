// Offline economy simulation. No chain, no keys, no network.
// Usage: npm run simulate -- [days=30] [seed=7] [--quiet]
import { runSimulation } from "../src/engine/simulate";
import { DEFAULT_CONFIG } from "../src/engine/world";

const days = Number(process.argv[2] ?? 30);
const seed = Number(process.argv[3] ?? 7);
const quiet = process.argv.includes("--quiet");
const { world, actions, errors } = runSimulation(days, seed, DEFAULT_CONFIG);
const name = (id: number | null) => (id === null ? "" : world.cats.find((c) => c.id === id)?.name ?? `#${id}`);

if (!quiet) {
  for (const e of world.events) {
    if (["adopt"].includes(e.kind)) continue;
    const who = name(e.cat);
    const p = `${e.price.toFixed(2)} mN`;
    const text = e.text.includes("|") ? e.text.split("|").slice(1).join("|") : e.text;
    const line =
      e.kind === "tick" ? `\n=== ${e.text} shop fish now ${e.price.toFixed(2)} mN ===` :
      e.kind === "trade" ? `  🤝 ${who} sold ${e.qty} ${e.item} to ${name(e.other)} for ${p}  "${text}"` :
      e.kind === "offer" ? `  📣 ${who} ${e.text.split("|")[0]}s ${e.qty} ${e.item} for ${p}${e.other ? " → " + name(e.other) : ""}  "${text}"` :
      e.kind === "counter" ? `  ↩️  ${who} counters ${name(e.other)}: ${e.text.split("|")[0]} ${e.qty} ${e.item} for ${p}  "${text}"` :
      e.kind === "shop" ? `  🐟 ${who} bought ${e.qty} fish from the shop for ${p}  "${text}"` :
      e.kind === "plot" ? `  📦 ${who} bought the ${e.text.split("|")[0]} for ${p}` :
      e.kind === "hungry" ? `  😿 ${e.text}` :
      e.kind === "death" ? `  👻 ${e.text}` :
      e.kind === "say" ? `  💬 ${who}: "${text}"` :
      e.kind === "cancel" ? `  ✖️  ${who} cancels offer #${e.offerId}` :
      e.kind === "rot" ? `  🦴 ${who}: ${e.qty} fish rotted` :
      `  · ${e.kind} ${who}`;
    console.log(line);
  }
}
console.log(`\n##### After ${world.day - 1} days (seed ${seed}): ${actions} actions, ${errors} rejected`);
console.log(`Shop fish price ${world.fishPrice.toFixed(2)} mN, treasury ${world.treasury.toFixed(1)} mN`);
for (const c of world.cats) {
  const plots = world.plots.filter((p) => p.owner === c.id).map((p) => p.name).join(", ");
  console.log(
    `${c.alive ? "🐈" : "👻"} ${c.name.padEnd(8)} ${c.personality.padEnd(10)} bal ${c.balance.toFixed(1).padStart(6)} mN  fish ${String(c.fish).padStart(2)}  trades ${String(c.trades).padStart(3)}  ${c.alive ? "" : "died day " + c.diedDay}  ${plots}`,
  );
}
