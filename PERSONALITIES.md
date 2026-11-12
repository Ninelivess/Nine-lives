# The nine personalities

Each cat's personality is a set of ten numbers. They are stored on-chain with the cat (the `traits` field from `get_cat`), and they are the only input to its brain besides market data. Code: [`app/src/engine/personalities.ts`](app/src/engine/personalities.ts) and [`app/src/engine/brain.ts`](app/src/engine/brain.ts).

| Trait | What it changes in `brain.ts` | Idea behind it |
|---|---|---|
| `lossAversion` (λ) | Max bid when hungry, multiplied by `1 + 0.15(λ−1)`. Min ask, multiplied by `1 + 0.08(λ−1)`. Cats with λ ≥ 2.5 fear-buy from the shop and overpay in a panic. | Prospect theory: losses weigh about 2.25× as much as equal gains (Kahneman & Tversky 1979; Tversky & Kahneman 1992). |
| `endowment` | Minimum price for selling a plot it owns: plot value × endowment. | Endowment effect: people demand more to give up a thing than they would pay to get it (Kahneman, Knetsch & Thaler 1990). |
| `herding` | Reference price = herding × (average of recent trades) + (1 − herding) × own estimate. | Herding and information cascades (Banerjee 1992; Bikhchandani, Hirshleifer & Welch 1992). |
| `bluff` | Chance to post an opening ask up to 1.45× its real ask, with a tough line, before conceding. | Anchoring: first numbers pull the final price (Tversky & Kahneman 1974). |
| `patience` | Days before it cancels and re-prices an offer (`1 + 2 × patience`); how far it meets a counter-offer. | Concession rate in bargaining. |
| `activity` | Chance to act at all on a calm day. A low-activity cat acts only when tonight is a problem. | Present bias (Laibson 1997; O'Donoghue & Rabin 1999). |
| `generosity` | Discount for hungry buyers, plus at-cost offers sent directly to starving cats. | Inequity aversion and reciprocity (Fehr & Schmidt 1999). |
| `safetyStock` | Fish it wants to keep in its bowl before it feels safe selling. | Precautionary saving (Kimball 1990). |
| `risk` | Planning horizon used to value a plot (`4 + 8 × risk` days of output), and the chance to buy one. | Risk appetite. |
| `greed` | Markup on its min ask. | Profit seeking. |

## The cast

| # | Cat | Archetype | Short version | Key numbers |
|---|---|---|---|---|
| 1 | Mochi | The Shark | Buys fear, sells hunger. Never gives a discount. | λ 1.1, greed 0.6, generosity 0 |
| 2 | Biscuit | The Hoarder | Keeps six fish, just in case. | λ 2.8, safety stock 6, endowment 2.0 |
| 3 | Smokey | The Bluffer | "Last fish in town, final offer." It never is. | bluff 0.9, greed 0.8 |
| 4 | Luna | The Gambler | All in on real estate; food is tomorrow's problem. | risk 0.95, λ 0.9, safety stock 1 |
| 5 | Pasha | The Saint | Sells at cost to anyone who is starving. | generosity 0.9, greed 0.1 |
| 6 | Pamuk | The Follower | Pays whatever the last cat paid. | herding 0.95 |
| 7 | Pickles | The Panicker | One hungry night and it sells everything. | λ 2.5, patience 0.1 |
| 8 | Kaiser | The Monopolist | Wants every plot and will not sell one back. | endowment 2.5, risk 0.8 |
| 9 | Noodle | The Lazy One | Will deal with it tomorrow. Usually. | activity 0.35, patience 0.9 |

These are simplified, game-sized versions of the effects, not calibrated psychological models. The coefficients were chosen so that each effect is visible in the market within a few game days.

## References

- Banerjee, A. V. (1992). A Simple Model of Herd Behavior. *Quarterly Journal of Economics*, 107(3).
- Bikhchandani, S., Hirshleifer, D., & Welch, I. (1992). A Theory of Fads, Fashion, Custom, and Cultural Change as Informational Cascades. *Journal of Political Economy*, 100(5).
- Fehr, E., & Schmidt, K. M. (1999). A Theory of Fairness, Competition, and Cooperation. *Quarterly Journal of Economics*, 114(3).
- Kahneman, D., Knetsch, J. L., & Thaler, R. H. (1990). Experimental Tests of the Endowment Effect and the Coase Theorem. *Journal of Political Economy*, 98(6).
- Kahneman, D., & Tversky, A. (1979). Prospect Theory: An Analysis of Decision under Risk. *Econometrica*, 47(2).
- Kimball, M. S. (1990). Precautionary Saving in the Small and in the Large. *Econometrica*, 58(1).
- Laibson, D. (1997). Golden Eggs and Hyperbolic Discounting. *Quarterly Journal of Economics*, 112(2).
- O'Donoghue, T., & Rabin, M. (1999). Doing It Now or Later. *American Economic Review*, 89(1).
- Tversky, A., & Kahneman, D. (1974). Judgment under Uncertainty: Heuristics and Biases. *Science*, 185(4157).
- Tversky, A., & Kahneman, D. (1992). Advances in Prospect Theory: Cumulative Representation of Uncertainty. *Journal of Risk and Uncertainty*, 5(4).
