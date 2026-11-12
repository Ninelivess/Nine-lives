// Every cat's brain key is derived from one secret (MASTER_SEED), so the operator stores a single
// value instead of nine private keys. The key can only call this game's methods on the contract
// (see CAT_KEY_METHODS in contract/src/lib.rs); it cannot move NEAR out of the cat's account.
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { KeyPairEd25519, baseEncode } from "near-api-js";

export function catKeyPair(masterSeedHex: string, catId: number): KeyPairEd25519 {
  if (!/^[0-9a-f]{64}$/i.test(masterSeedHex)) throw new Error("MASTER_SEED must be 32 bytes of hex");
  const seed = sha256(new TextEncoder().encode(`nine-lives:cat:${catId}:${masterSeedHex.toLowerCase()}`));
  const pub = ed25519.getPublicKey(seed);
  const extended = new Uint8Array(64);
  extended.set(seed, 0);
  extended.set(pub, 32);
  return new KeyPairEd25519(baseEncode(extended));
}
