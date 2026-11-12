"use client";

// Wallet connection for humans (NFT holders and fans). Uses NEAR Connect, the connector the
// NEAR docs recommend. Humans can feed any living cat and NFT holders can claim profit.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { NearConnector } from "@hot-labs/near-connect";
import { DEFAULT_CONTRACT, NETWORK } from "@/engine/rpc";

interface WalletCtx {
  accountId: string | null;
  ready: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  call: (method: string, args: object, depositYocto?: string) => Promise<string | null>;
}

const Ctx = createContext<WalletCtx>({
  accountId: null,
  ready: false,
  connect: async () => {},
  disconnect: async () => {},
  call: async () => null,
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const connector = useRef<NearConnector | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { NearConnector } = await import("@hot-labs/near-connect");
      const c = new NearConnector({ network: NETWORK === "mainnet" ? "mainnet" : "testnet" });
      connector.current = c;
      c.on("wallet:signIn", (p) => !cancelled && setAccountId(p.accounts[0]?.accountId ?? null));
      c.on("wallet:signOut", () => !cancelled && setAccountId(null));
      try {
        const { accounts } = await c.getConnectedWallet();
        if (!cancelled) setAccountId(accounts[0]?.accountId ?? null);
      } catch {
        /* not connected yet */
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    const c = connector.current;
    if (!c) return;
    const w = await c.connect();
    const accounts = await w.getAccounts();
    setAccountId(accounts[0]?.accountId ?? null);
  }, []);

  const disconnect = useCallback(async () => {
    await connector.current?.disconnect();
    setAccountId(null);
  }, []);

  const call = useCallback(async (method: string, args: object, depositYocto = "0") => {
    const c = connector.current;
    if (!c) return null;
    const w = await c.wallet();
    const r = await w.signAndSendTransaction({
      receiverId: DEFAULT_CONTRACT,
      actions: [{ type: "FunctionCall", params: { methodName: method, args, gas: "30000000000000", deposit: depositYocto } }],
    });
    return r?.transaction?.hash ?? null;
  }, []);

  return <Ctx.Provider value={{ accountId, ready, connect, disconnect, call }}>{children}</Ctx.Provider>;
}

export const useWallet = () => useContext(Ctx);

export function WalletButton() {
  const { accountId, ready, connect, disconnect } = useWallet();
  if (!ready) return null;
  return accountId ? (
    <button className="wallet-btn" onClick={disconnect} title="Disconnect">
      {accountId.length > 22 ? `${accountId.slice(0, 10)}…${accountId.slice(-8)}` : accountId} ✕
    </button>
  ) : (
    <button className="wallet-btn" onClick={connect}>Connect wallet</button>
  );
}
