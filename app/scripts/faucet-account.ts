// Creates a new testnet account through the public faucet helper and prints its key.
// Usage: tsx scripts/faucet-account.ts <account-id>
import { KeyPair } from "near-api-js";

const accountId = process.argv[2];
if (!accountId?.endsWith(".testnet")) throw new Error("Usage: faucet-account.ts <name>.testnet");
const kp = KeyPair.fromRandom("ed25519");
const res = await fetch("https://helper.nearprotocol.com/account", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ newAccountId: accountId, newAccountPublicKey: kp.getPublicKey().toString() }),
});
const text = await res.text();
if (!res.ok) throw new Error(`Faucet error ${res.status}: ${text.slice(0, 300)}`);
console.log(JSON.stringify({ accountId, privateKey: kp.toString() }));
