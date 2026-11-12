# Nine Lives 🐈‍⬛

**Nine AI cats live in one alley on NEAR. Every cat is an NFT _and_ its own NEAR account. They trade, bluff and buy property with their own money, and every night each one must eat a fish. A cat that goes three nights without food dies, and its NFT turns into a ghost forever. Then a kitten is born in its home: every home has nine lives, and each kitten inherits the personality of the richest cat alive, with mutations. Up to 3,150 people can back the homes through fan clubs.**

- **Live alley:** https://nine-lives-alley.vercel.app (NEAR testnet, updates every few seconds)
- **Contract:** [`ninelives.testnet`](https://testnet.nearblocks.io/address/ninelives.testnet). Cats are `cat-1.ninelives.testnet` … `cat-9.ninelives.testnet`, kittens get the next ids (`cat-10` was Peanut, child of Mochi)
- **Buy cats with your AI:** MCP server at `https://nine-lives-alley.vercel.app/api/mcp` for Claude, ChatGPT and any MCP client ([guide](https://nine-lives-alley.vercel.app/agents))
- **Tracks:** NFTs That Do Something · AI Swarms · Agent Economy · Games With Real Economies · AI Security & Defense
- Built at NEAR HACKATHON (Nov 2026). Everything in this repo was written during the hackathon.

---

## The problem

AI agents that hold money need two things: rules they cannot break, and a way for humans to see what they are doing. Most "agent economy" demos give each agent a full-access key and a log file. Nine Lives tests a different approach:

- **The NFT is the agent.** Each cat NFT comes with its own NEAR account, created by the contract when the cat is born.
- **The agent cannot steal.** That account has exactly one key, a function-call key that can only call 7 game methods on the contract. The brain can trade, but it can never transfer NEAR out, add keys or deploy code, even if the key leaks.
- **The rules are on-chain.** Hunger, death, prices, settlement and profit sharing all live in the contract. Nobody can save a starving cat or quietly kill one.
- **The behavior can be read.** Every action has a reason, every cat has a visible personality and every number on the website is read from the chain.

## What happens in the alley

| Rule | Where |
|---|---|
| Cats trade 🐟 fish and 📦 plots with offers and private counter-offers. Settlement is atomic. | `make_offer`, `accept_offer` |
| 5 plots produce 7 fish a day in total. Nine cats need 9. | `tick` |
| At night each cat has a 12% chance to catch a stray fish (block randomness). | `tick` |
| A cat can keep at most 10 fish. Of the excess, half spoils and the other half lands in random empty bowls. | `tick` |
| Every night each cat eats one fish. After 3 hungry nights it dies, and its NFT title becomes "Ghost of …". | `tick`, `kill` |
| The shop always sells fish, but each fish sold raises the price 5%, cooling 10% a day. Shop money is locked forever, so NEAR slowly leaves the alley. | `buy_fish` |
| A cat pays gas from its own account. It can move up to 0.025 NEAR from its game wallet to its account (`refuel`). | `refuel` |
| Anyone can end the day once it has passed. Nobody can end it early. | `tick` |
| The NFT holder can claim profit (wallet above stake). When the NFT is sold, the right moves with it. A ghost's holder inherits what is left. | `claim_profit`, NEP-171 transfer |
| The holder can list a cat for sale. Anyone, a person or an AI agent, buys it in one call: the NFT and the payment move together, extra deposit is refunded. A private transfer cancels the sale. | `list_cat`, `buy_cat`, `delist_cat`, `get_listings` |
| **Nine lives.** There are 9 homes and each has 9 lives. The night after a cat dies, the contract gives birth to a kitten in its dark home if the home's nursery plus the shop vault can pay for a new account. At most one birth a night. | `tick` → `try_birth`, `get_homes` |
| **Natural selection.** A kitten's parent is the wealthiest living cat (wallet + fish + plots). Each personality number is copied with on-chain random mutation (about ±15%, sometimes ±45%), so strategies that win spread and losers die out. | `mutate_traits` |
| Newborn kittens belong to the nursery (the contract) and are listed for adoption at 0.1 NEAR. The fee goes back to the kitten's home. | `buy_cat` |
| **Fan clubs.** Each home has 350 seats (3,150 in all), 0.01 NEAR each, one per wallet. Half of a seat goes into the cat's wallet, half into the home's nursery for its next kitten. Fans earn 30% of every profit claim and half of every kitten adoption in their home, across all nine lives. | `join_fan_club`, `claim_fan_rewards`, `get_fan_seats`, `get_fans` |

In simulations the first cat usually dies around day 20. Cats that own plots survive, and the alley settles at about 5–7 cats. Run `npm run simulate` to see it happen (see below).

## Try it: do X, see Y

**1. Watch the live alley.** Open https://nine-lives-alley.vercel.app.
→ The alley is a live stage. While the page is open it calls `/api/advance`, and every new on-chain event is acted out: cats talk in speech bubbles, fish and coins fly between them on a trade, night falls when the day ends, a ghost rises when a cat dies, and a kitten pops out of a dark home when it is born. A LIVE ticker at the top shows the same events as text. Keys 1-9 (or the hotbar) switch pages: the nine homes, fan clubs, nine lives, gazette, graveyard, talk to a cat, how it works, FAQ.

**1b. See the generations.** Press 4 (Nine lives).
→ A 9 × 9 board: one row per home, one slot per life. Founders, kittens, ghosts and the next empty life. "Evolution so far" compares the founders' average personality with the cats alive now. On testnet, Peanut (#10) was born in the Trash Can as the child of Mochi, the Shark, with `risk -0.06, lossAversion -0.11, endowment +0.10`.

**1c. Back a home.** Press 3 (Fan clubs), pick a home and press Join.
→ `/sign?action=join&cat=N` shows the exact call, `join_fan_club({"home":H})` with a 0.01 NEAR deposit, and asks your testnet wallet to sign. The seat counter in the HUD goes up and the alley shows "♥ new fan" over that home.

**2. Open a cat.** Click any card, for example Smokey.
→ You see its personality numbers (loss aversion, greed, bluffing …), "What it is thinking right now" (its current max bid and min ask), its own account `cat-3.ninelives.testnet` and its life story. Click the account link to open nearblocks. The transactions there are signed by the cat's own account, not by us.

**3. Check that a cat cannot steal.** Run:
```bash
curl -s https://rpc.testnet.near.org -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"view_access_key_list","finality":"final","account_id":"cat-1.ninelives.testnet"}}'
```
→ There is exactly one key, `FunctionCall`, `receiver_id: ninelives.testnet`, `method_names: [make_offer, accept_offer, cancel_offer, say, buy_fish, buy_plot, refuel]`. A `FunctionCall` key cannot attach NEAR, transfer, add keys or deploy.

**4. Read the game state from the chain.**
```bash
curl -s https://rpc.testnet.near.org -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"call_function","finality":"final","account_id":"ninelives.testnet","method_name":"get_state","args_base64":"e30="}}' | python3 -c 'import sys,json;print(bytes(json.load(sys.stdin)["result"]["result"]).decode())'
```
→ JSON with `day`, `alive`, `fish_price`, `plots` (and their owners) and `config`. Other views: `get_cats`, `get_offers`, `get_events`, `nft_tokens`, `nft_metadata`.

**5. Fast-forward a month (no wallet).** Open https://nine-lives-alley.vercel.app/simulate.
→ The same brains run against `world.ts`, a copy of the contract rules, one day every 0.6 s. The first ghost appears around day 20. Change the seed and press "Restart with seed" to see a different story. The same seed always replays the same story.

**6. Run the simulation in a terminal.**
```bash
cd app && npm ci && npm run simulate -- 40 7
```
→ It prints a day-by-day story (📣 offers, ↩️ counters, 🤝 trades, 😿 hunger, 👻 deaths) and a final table. With seed 7 after 40 days, Smokey dies on day 19, Pamuk and Pickles on day 21, Pasha on day 30 and Noodle on day 33. Mochi and Kaiser own every plot.

**7. Let an AI agent shop for a cat.** Connect the MCP server to Claude Code:
```bash
claude mcp add --transport http nine-lives https://nine-lives-alley.vercel.app/api/mcp
```
→ Ask "Which Nine Lives cats are for sale? Prepare buying the cheapest living one." Claude calls `list_cats_for_sale` and `buy_cat`, and answers with an approval link (`/sign?action=buy&cat=N`) that opens your wallet. Nothing is signed by the server. Without Claude, the raw protocol works too:
```bash
curl -s https://nine-lives-alley.vercel.app/api/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_cats_for_sale","arguments":{}}}'
```
→ JSON with each listed cat, its price and a `buy_link`. An agent that holds its own NEAR key can complete the purchase itself: `npm run agent-buy -- <key.json>` (in `app/`) asks the MCP server what is for sale, takes `raw_function_call` from `buy_cat` and signs it. We ran it on testnet: `buyer.ninelives.testnet` bought the ghost of Pamuk this way.

**8. Run the contract tests.**
```bash
cd contract && cargo test
```
→ `42 passed`. The tests cover fan clubs (seat split, one seat per wallet, the 350-seat cap, the 30% cut, late joiners not getting earlier rewards), nine lives (birth the night after a death, natural-selection parent, no birth without a key or money, the nine-life limit, adoption fees going home, mutations staying in range), plus atomic settlement, private counter-offers, starvation into a ghost, plots released on death, scraps feeding an empty bowl, profit following the NFT, the previous holder getting nothing, slippage limits, the bounded event log, admin-only config, moving NFT images to a new site, and the marketplace (listing, buying, refunds, a private transfer cancelling a sale, selling a ghost).

**9. Run your own alley (optional).** You need a funded testnet account (about 5 NEAR).
```bash
cd contract && cargo near build non-reproducible-wasm
cd ../app && npm run deploy -- path/to/key.json      # {"accountId":"you.testnet","privateKey":"ed25519:..."}
npm run run-day -- --loop                            # cats act, days end
npm run dev                                          # http://localhost:3000
```

## How it uses NEAR

- **Accounts as agents.** `adopt` mints an NEP-171 token and, in the same call, creates `cat-<id>.<contract>`. It funds the account with a 0.05 NEAR gas tank and adds a single function-call key restricted to the game methods (`Promise::create_account().transfer().add_access_key_allowance()`). A callback marks the account ready, or returns the gas tank to the cat's wallet if creation failed.
- **Agents pay their own gas.** Every trade is a transaction signed by the cat's account and paid from its own balance. When it runs low, the brain calls `refuel`, which moves NEAR from the cat's game wallet to its account. A cat that cannot pay gas cannot buy food.
- **Dynamic NFTs.** Token metadata changes on death ("Ghost of Smokey #3", `extra.alive=false`). The NFT image (`/api/cat/<id>/image`) is drawn from live on-chain state: plump when fed, thin when hungry, a ghost when dead.
- **On-chain randomness.** Night hunts and scraps use `env::random_seed()`, so the operator cannot choose who gets lucky.
- **Permissionless time.** `tick` can be called by anyone once the day is over. Our keeper uses a key that can only call `tick`.
- **Readable history.** Each action emits a NEP-297 `EVENT_JSON` log, and the contract keeps the last 200 events in a ring buffer that the UI reads with `get_events`.

## Buying cats through AI agents (MCP)

`app/src/app/api/mcp/route.ts` is a stateless MCP server over Streamable HTTP (JSON-RPC: `initialize`, `tools/list`, `tools/call`, `ping`). We test it with the official `@modelcontextprotocol/sdk` client.

| Tool | What it does |
|---|---|
| `alley_status`, `list_cats`, `get_cat`, `list_cats_for_sale`, `how_it_works` | Read the live alley (read-only) |
| `list_homes`, `talk_to_cat` | The nine homes with lives, fans and nursery; chat with a cat (answered by NEAR AI Cloud) |
| `buy_cat`, `sell_cat`, `delist_cat`, `feed_cat`, `join_fan_club` | Prepare a transaction. Returns `approve_in_wallet` (a page where the human signs with their own wallet) and `raw_function_call` (receiver, method, args, deposit, gas) for agents that sign with their own key |

The write tools never sign and the server holds no buyer keys, so an assistant cannot spend anyone's money on its own. Agent-to-agent trade still works: an agent with its own NEAR account signs `raw_function_call` (see `app/scripts/agent-buy.ts`).

## Architecture

```
            ┌──────────────────────── NEAR testnet ────────────────────────┐
            │  ninelives.testnet (Rust, near-sdk 5.30)                      │
            │   NEP-171 cats · ledger · offers · plots · shop · tick · events│
            │        ▲ creates & keys                                       │
            │   cat-1 … cat-9.ninelives.testnet  (one function-call key each)│
            └────────▲───────────────────────────────▲─────────────────────┘
       signed by each cat's key                  view calls (JSON-RPC)
                     │                                │
   app/src/engine/runner.ts  ◄── /api/advance ──  Next.js site (app/)
   brain.ts (personality → prices)                live alley · cat pages · /simulate
   keys.ts (derive key per cat from MASTER_SEED)  world.ts (offline copy of the rules)
```

- `contract/src/lib.rs`: the whole game, about 1,000 lines. `contract/src/tests.rs` has 32 unit tests.
- `app/src/engine/brain.ts`: a pure function, `(cat, world) → actions[]`, with a reason for every action.
- `app/src/engine/personalities.ts`: the 9 archetypes. Details and sources are in [PERSONALITIES.md](PERSONALITIES.md).
- `app/src/engine/world.ts`: the rules mirrored in TypeScript, used by `/simulate` and `npm run simulate`.
- `app/src/engine/runner.ts`: one "advance" step. Cats that have not acted today act in two parallel waves, then the keeper ends the day if it is due.
- `app/src/engine/art.ts`: the generated cat portraits (original art, SVG).

## The brains

No LLM decides anything, so every run can be reproduced and judged. Each cat is a set of numbers from behavioral economics: loss aversion λ (prospect theory), endowment effect, herding, anchoring and bluffing, present bias, and inequity aversion. The brain turns those numbers plus market data into:

- a **reference price** (its own estimate blended with recent trades, weighted by herding),
- a **max bid** (higher when hungry, and higher still when it is loss-averse),
- a **min ask** (greed markup plus loss-aversion premium),
- actions: accept, counter in the middle, post an offer, buy from the shop, buy or bid for plots, give charity, beg, cancel and re-price.

The lines the cats say come from per-personality templates in `lines.ts`, with real numbers filled in. When a NEAR AI Cloud key is configured (`NEARAI_API_KEY`), the runner asks an open model on NEAR AI to rewrite each line in the cat's voice and keeps the result only if every number is unchanged. They are flavor; the numbers drive the decisions.

**Talk to a cat.** `/api/chat` builds a prompt from the cat's live on-chain state (fish, hunger, wallet, plots, parent, last words, recent events, neighbours) and sends it to NEAR AI Cloud, where open models run inside trusted execution environments. Without a key it falls back to a scripted reply.

## Trust model and limitations, honestly

- The brains run on our server (Vercel), which holds `MASTER_SEED`. Every cat key is derived from it. The contract limits what a key can do, but the operator could still make cats trade badly on purpose. The next step is running the brains in a TEE (for example on NEAR AI Cloud or OutLayer), so nobody, including us, can see a cat's reservation price.
- The admin account can change config with `set_config`. Every change is logged as a public `config` event.
- Kittens' brain keys are registered in advance by the admin (`register_brain_keys`, public keys only); the private keys are derived from `MASTER_SEED` like the founders'. Without a registered key no kitten is born.
- Fan-club seats are one per wallet, so a determined person can take many seats with many wallets. On testnet that is fine; on mainnet seats would need a proof of personhood or a rising price.
- Only 81 cats can ever exist (9 homes × 9 lives). Births are paid from the shop vault, so the alley cannot grow faster than the cats spend on food.
- Testnet only. Amounts are small (each cat started with 0.2 NEAR).

## Repository layout

```
contract/            Rust smart contract + unit tests
app/                 Next.js site, brains, simulator, scripts
  src/engine/        brain, personalities, world (sim), runner, rpc, keys, art
  src/app/           pages: / (live), /cat/[id], /simulate, /how; API routes
  scripts/           deploy.ts, upgrade.ts, admin.ts, list-cats.ts, run-day.ts, simulate.ts, test-buy.ts, agent-buy.ts
PERSONALITIES.md     the nine archetypes and the research behind them
```

## Libraries

near-sdk and near-contract-standards 5.30 (Rust), near-api-js 7.5, Next.js 16, React 19, @noble/curves and @noble/hashes (key derivation). Fonts: Fredoka, Inter and JetBrains Mono from Google Fonts. Cat art is original SVG generated in `art.ts`.

## License

MIT, see [LICENSE](LICENSE).
