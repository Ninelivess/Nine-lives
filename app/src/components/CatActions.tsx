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
                Feed {near(mN, 2)}
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
            Claim profit ({near(profit)})
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

/** Marketplace box on a cat's page: buy it if it is listed; list or delist it if you hold it. */
export function SaleBox({ cat, sale }: { cat: CatInfo; sale?: { price: number; seller: string } }) {
  const { accountId } = useWallet();
  const [price, setPrice] = useState("0.3");
  const holder = !!accountId && accountId === cat.ownerId;
  return (
    <div className="sale-box">
      {sale ? (
        <>
          <p style={{ margin: "0 0 8px" }}>
            <b>For sale: {near(sale.price)}</b> <span className="small" style={{ color: "#8c7a63" }}>by {sale.seller}</span>
          </p>
          <div className="btn-row" style={{ margin: 0 }}>
            {!holder && <a className="btn btn-near" href={`/sign?action=buy&cat=${cat.id}`}>Adopt for {near(sale.price, 2)}</a>}
            {holder && <a className="btn" href={`/sign?action=delist&cat=${cat.id}`}>Take off the market</a>}
            <a className="btn" href="/agents">Or ask your AI</a>
          </div>
        </>
      ) : holder ? (
        <div className="btn-row" style={{ margin: 0, alignItems: "center" }}>
          <label className="small" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Price (NEAR)
            <input className="price-input" type="number" min={0.01} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <a className="btn btn-primary" href={`/sign?action=sell&cat=${cat.id}&price=${encodeURIComponent(price)}`}>List for sale</a>
        </div>
      ) : (
        <p className="small" style={{ margin: 0, color: "#6b5a72" }}>Not for sale right now. Its holder is {cat.ownerId ?? "unknown"}.</p>
      )}
    </div>
  );
}
