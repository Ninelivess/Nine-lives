import Link from "next/link";
import { Icon } from "@/components/AlleyView";
import { CopyBox } from "@/components/CopyBox";

export const metadata = { title: "Buy cats with your AI — Nine Lives" };

const URL = "https://nine-lives-alley.vercel.app/api/mcp";

const TOOLS: [string, string][] = [
  ["alley_status", "Day, who is alive, who is hungry, fish price, time until night."],
  ["list_cats", "Every cat, founders and kittens, with personality, home, life, generation, wallet, fish, holder and sale price."],
  ["get_cat", "One cat in depth: personality numbers, last words, recent life events."],
  ["list_cats_for_sale", "Cats on the market, cheapest first."],
  ["buy_cat", "Prepares a purchase: price, an approval link and the raw NEAR call."],
  ["sell_cat / delist_cat", "Prepares listing or unlisting a cat you hold."],
  ["feed_cat", "Prepares sending NEAR to a cat's wallet so it can eat."],
  ["list_homes", "The nine homes, their nine lives, fan-club seats and nursery savings."],
  ["join_fan_club", "Prepares a 0.01 NEAR seat in a home's fan club (3,150 seats in all)."],
  ["talk_to_cat", "Chat with a cat; it answers in character through NEAR AI Cloud."],
  ["how_it_works", "The rules, for the assistant to explain."],
];

const PROMPTS = [
  "Which Nine Lives cats are still alive, and which one is closest to starving?",
  "Show me the cats for sale. Which living cat is the best deal, and why?",
  "I want to adopt the cheapest living cat. Prepare the purchase.",
  "Tell me about Luna's personality and what she said last.",
  "Feed whichever cat is hungriest with 0.02 NEAR.",
  "Which home's fan club should I join, and why? Then prepare the seat.",
  "Ask Luna what she thinks of Mochi.",
  "Is there a newborn kitten up for adoption? Who is its parent?",
];

export default function AgentsPage() {
  return (
    <div className="page">
      <div className="container prose" style={{ maxWidth: 900 }}>
        <p className="screen-kicker"><Icon name="bot" /> For Claude, ChatGPT and other AI agents</p>
        <h1 className="page-title">Buy cats with your AI.</h1>
        <p className="screen-sub" style={{ color: "var(--text)", maxWidth: 680 }}>
          Nine Lives runs an MCP server. Connect it to your AI assistant and it can look around the alley, compare cats, and prepare purchases,
          sales or feedings for you. Every purchase is approved by you, in your own NEAR wallet.
        </p>

        <div className="pbox" style={{ padding: "22px 24px", marginTop: 28 }}>
          <h2 className="box-title" style={{ marginTop: 0 }}>1 · Copy the server address</h2>
          <CopyBox text={URL} />
        </div>

        <div className="agents-grid">
          <div className="pbox" style={{ padding: "20px 22px" }}>
            <h2 className="box-title" style={{ marginTop: 0 }}>2a · Claude</h2>
            <p>In Claude (web or desktop), open <b>Settings → Connectors</b>, choose <b>Add custom connector</b>, name it Nine Lives and paste the address.</p>
            <p>Claude Code:</p>
            <pre className="code">{`claude mcp add --transport http nine-lives ${URL}`}</pre>
          </div>
          <div className="pbox" style={{ padding: "20px 22px" }}>
            <h2 className="box-title" style={{ marginTop: 0 }}>2b · ChatGPT</h2>
            <p>In ChatGPT, open <b>Settings → Connectors</b>, turn on <b>developer mode</b> under the advanced settings, then create a connector with the address above. Menu names can differ slightly between plans.</p>
            <p>Any other MCP client that speaks Streamable HTTP works the same way.</p>
          </div>
        </div>

        <div className="pbox" style={{ padding: "20px 24px", marginTop: 24 }}>
          <h2 className="box-title" style={{ marginTop: 0 }}>3 · Ask</h2>
          <ul>{PROMPTS.map((p) => <li key={p}>“{p}”</li>)}</ul>
          <p>
            When you ask it to buy, the assistant answers with an approval link. Open it, connect a NEAR testnet wallet, check the call and approve.
            The NFT and the payment move in one transaction.
          </p>
        </div>

        <div className="pbox" style={{ padding: "20px 24px", marginTop: 24 }}>
          <h2 className="box-title" style={{ marginTop: 0 }}>What the assistant can do</h2>
          <table className="table">
            <tbody>
              {TOOLS.map(([n, d]) => (
                <tr key={n}><td className="mono" style={{ whiteSpace: "nowrap" }}>{n}</td><td>{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pbox" style={{ padding: "20px 24px", marginTop: 24 }}>
          <h2 className="box-title" style={{ marginTop: 0 }}>Agents with their own wallet</h2>
          <p>
            Every write tool also returns <code>raw_function_call</code>: the receiver, method, arguments and deposit. An agent that holds its own NEAR key
            (for example through the NEAR MCP server or near-api-js) can sign that call directly and buy a cat on its own, agent to agent.
            The contract is the marketplace: <code>list_cat</code>, <code>delist_cat</code> and <code>buy_cat</code> on <code>ninelives.testnet</code>.
          </p>
          <p>
            Safety: the tools never sign anything. The server holds no buyer keys. A cat&apos;s own key can only play the game, never move NEAR out.
          </p>
        </div>

        <p style={{ marginTop: 24 }}><Link href="/#cats">← Back to the cats</Link></p>
      </div>
    </div>
  );
}
