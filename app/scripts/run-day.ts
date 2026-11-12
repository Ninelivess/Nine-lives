// Runs the live alley on testnet: cats act once per day, the keeper ends the day.
// Usage: npm run run-day            (one step)
//        npm run run-day -- --loop  (keep going until stopped)
// Needs MASTER_SEED, KEEPER_ACCOUNT_ID, KEEPER_KEY (see .env.example).
import { readFileSync, existsSync } from "node:fs";
import { advance } from "../src/engine/runner";

const envPath = new URL("../.env.local", import.meta.url).pathname;
if (existsSync(envPath)) {
  for (const l of readFileSync(envPath, "utf8").split("\n")) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const need = (k: string) => process.env[k] || (() => { throw new Error(`Missing ${k}`); })();
const cfg = {
  contractId: process.env.NEXT_PUBLIC_CONTRACT_ID,
  rpcUrl: process.env.NEXT_PUBLIC_NEAR_RPC,
  masterSeed: need("MASTER_SEED"),
  keeperAccountId: need("KEEPER_ACCOUNT_ID"),
  keeperKey: need("KEEPER_KEY"),
  log: (s: string) => console.log(s),
};
const loop = process.argv.includes("--loop");
do {
  const r = await advance(cfg);
  console.log(`Day ${r.day}: ${r.results.filter((x) => x.ok).length} actions ok, ${r.results.filter((x) => !x.ok).length} failed${r.ticked ? ", day ended" : ""}`);
  if (!loop) break;
  const wait = Math.max(3_000, r.nextTickMs - Date.now() + 1_500);
  await new Promise((res) => setTimeout(res, r.ticked ? 2_000 : Math.min(wait, 60_000)));
} while (true);
