"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { milliToYocto } from "@/engine/units";
import type { CatInfo } from "@/engine/types";
import { near } from "@/lib/describe";

// Audience participation: anyone can feed a living cat (it raises the cat's wallet and stake).
// The NFT holder can claim the cat's profit.
export function CatActions({ cat, network }: { cat: CatInfo; network?: string }) {
  const { accountId, connect, call } = useWallet();
  const [status, setStatus] = useState<string>("");
  const isHolder = !!accountId && accountId === cat.ownerId;
  const profit = cat.alive ? Math.max(0, cat.balance - cat.stake) : cat.balance;
  const explorerTx = (h: string) => `https://${network === "mainnet" ? "" : "testnet."}nearblocks.io/txns/${h}`;

  const run = async (label: string, fn: () => Promise<string | null>) => {
    try {
      setStatus(`${label}: waiting for your wallet…`);
      const h = await fn();
      setStatus(h ? `${label}: done. tx ${h}` : `${label}: sent.`);
    } catch (e) {
      setStatus(`${label}: ${e instanceof Error ? e.message : "cancelled"}`);
    }
  };

  return (
    <div className="cat-actions">
      {cat.alive ? (
        <>
          <p className="small">Feed {cat.name}: the NEAR goes into its wallet. A fed cat can buy fish and survive longer. (testnet NEAR)</p>
          <div className="btn-row">
            {[10, 50].map((mN) => (
              <button key={mN} onClick={() => (accountId ? run("Feed", () => call("feed", { token_id: String(cat.id) }, milliToYocto(mN))) : connect())}>
                🍽️ Feed {near(mN, 2)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="small">Ghosts cannot eat.</p>
      )}
      {isHolder && (
        <div className="btn-row">
          <button disabled={profit <= 0} onClick={() => run("Claim", () => call("claim_profit", { token_id: String(cat.id) }))}>
            💰 Claim profit ({near(profit)})
          </button>
        </div>
      )}
      {!accountId && <p className="muted small">Connect a NEAR testnet wallet to feed or claim.</p>}
      {status && (
        <p className="small mono status-line">
          {status.includes("tx ") ? (
            <a href={explorerTx(status.split("tx ")[1])} target="_blank" rel="noreferrer">{status}</a>
          ) : (
            status
          )}
        </p>
      )}
    </div>
  );
}
