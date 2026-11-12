// End-to-end check of the marketplace on testnet: a fresh sub-account buys one listed cat.
// Usage: tsx scripts/test-buy.ts <admin-key-json> <token-id>
import { Account, JsonRpcProvider, KeyPair, teraToGas, nearToYocto, type KeyPairString } from "near-api-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const [keyFile, tokenId = "3"] = process.argv.slice(2);
const { accountId, privateKey } = JSON.parse(readFileSync(keyFile, "utf8"));
const provider = new JsonRpcProvider({ url: process.env.NEXT_PUBLIC_NEAR_RPC || "https://test.rpc.fastnear.com" });
const admin = new Account(accountId, provider, privateKey as KeyPairString);
const buyerId = `buyer.${accountId}`;
const buyerFile = new URL(`../../keys/${buyerId}.json`, import.meta.url).pathname;
if (!existsSync(buyerFile)) {
  const kp = KeyPair.fromRandom("ed25519");
  await admin.createSubAccount({ accountOrPrefix: "buyer", publicKey: kp.getPublicKey(), nearToTransfer: nearToYocto("0.2") });
  writeFileSync(buyerFile, JSON.stringify({ accountId: buyerId, privateKey: kp.toString() }), { mode: 0o600 });
  console.log(`created ${buyerId}`);
}
const buyerKey = JSON.parse(readFileSync(buyerFile, "utf8")).privateKey;
const buyer = new Account(buyerId, provider, buyerKey as KeyPairString);
const listing = (await provider.callFunction<{ token_id: string; price: string; seller: string; name: string }[]>({ contractId: accountId, method: "get_listings", args: {} }))!.find((l) => l.token_id === tokenId);
if (!listing) throw new Error(`token ${tokenId} is not listed`);
console.log(`buying ${listing.name} from ${listing.seller} for ${Number(BigInt(listing.price) / 10n ** 21n) / 1000} NEAR`);
await buyer.callFunction({ contractId: accountId, methodName: "buy_cat", args: { token_id: tokenId }, gas: teraToGas("50"), deposit: BigInt(listing.price) });
const tok = await provider.callFunction<{ owner_id: string }>({ contractId: accountId, method: "nft_token", args: { token_id: tokenId } });
console.log(`owner of #${tokenId} is now ${tok!.owner_id}`);
