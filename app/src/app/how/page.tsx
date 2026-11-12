import Link from "next/link";

export const metadata = { title: "How Nine Lives works" };

export default function How() {
  return (
    <div className="page"><div className="container"><article className="prose pbox">
      <h1 className="page-title">How Nine Lives works</h1>
      <p className="lede">A tiny economy that runs itself. You can watch it, own a piece of it, and see every move on-chain.</p>

      <h2>Each NFT is an account</h2>
      <p>
        Every cat is an NEP-171 NFT minted by the <code>ninelives.testnet</code> contract <em>and</em> a real NEAR account, for example{" "}
        <code>cat-3.ninelives.testnet</code>. The contract creates that account at birth and gives it exactly one key: a{" "}
        <b>function-call key</b> that can only call seven game methods on the contract. The cat&apos;s brain signs its own trades with that key. It cannot
        transfer NEAR out, add keys or deploy code, even if the key leaks.
      </p>

      <h2>The rules live in the contract</h2>
      <ul>
        <li>Cats trade 🐟 fish and 📦 plots with offers and counter-offers. Settlement is atomic: money and goods move in one step.</li>
        <li>Plots produce fish every day. The alley produces fewer fish than nine cats eat.</li>
        <li>At night each cat has a small chance to catch a stray fish (NEAR block randomness).</li>
        <li>A cat can keep at most 10 fish. The rest are thrown out: half spoil, the other half land in random empty bowls. Hoarding feeds the poor, a little.</li>
        <li>Every night each cat eats one fish. After three hungry nights it dies, and its NFT is renamed &quot;Ghost of …&quot; forever.</li>
        <li>The fish shop always sells, but each fish sold raises the price 5%. Shop money is locked in a vault forever, so NEAR slowly leaves the alley.</li>
        <li>To act, a cat pays gas from its own account. It can move money from its game wallet to its account (<code>refuel</code>). No gas, no actions, no food.</li>
        <li>Anyone can end the day once its time is up (<code>tick</code>). Nobody can end it early.</li>
      </ul>

      <h2>The brains</h2>
      <p>
        Nine personalities, each a handful of numbers taken from behavioral economics: loss aversion (prospect theory), the endowment effect,
        herding, present bias, anchoring and inequity aversion. The brain turns those numbers and the market into prices and actions. Every action
        comes with a reason you can read. No LLM is needed to decide, so every run can be reproduced.
      </p>

      <h2>Owning a cat</h2>
      <p>
        The NFT holder can claim the cat&apos;s profit, meaning its wallet above its stake. Claim too much and the cat may starve. When the NFT is sold, the
        right to profits moves with it; the previous holder keeps nothing. If the cat dies, the holder inherits what is left.
      </p>

      <h2>Trust model, honestly</h2>
      <p>
        The brains run on our server and hold the cats&apos; function-call keys. The contract limits what they can do, but the operator could still
        make bad trades on purpose. The next step is running the brains in a TEE so nobody, including us, can see a cat&apos;s secret reservation price.
      </p>
      <p><Link href="/">← Back to the alley</Link></p>
    </article></div></div>
  );
}
