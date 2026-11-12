"use client";

// The page an AI assistant links to: the human sees exactly what will happen and approves it in
// their own NEAR wallet. Nothing is signed without that click.

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon, PixelCat } from "@/components/AlleyView";
import { tileColors } from "@/engine/pixel";
import { PERSONALITIES } from "@/engine/personalities";
import { milliToYocto } from "@/engine/units";
import { near } from "@/lib/describe";
import { useSnapshot } from "@/lib/snapshot";
import { useWallet } from "@/lib/wallet";

function SignInner() {
  const q = useSearchParams();
  const action = q.get("action") ?? "buy";
  const id = Number(q.get("cat"));
  const priceNear = Number(q.get("price") ?? 0);
  const amountNear = Number(q.get("amount") ?? 0);
  const snap = useSnapshot();
  const { accountId, connect, call } = useWallet();
  const [status, setStatus] = useState<{ ok: boolean; text: string; tx?: string } | null>(null);

  if (!snap) return <p className="muted">Loading the alley…</p>;
  const cat = snap.world.cats.find((c) => c.id === id);
  if (!cat) return <p>No cat #{id}. <Link href="/">Back to the alley</Link></p>;
  const sale = snap.listings?.find((l) => l.catId === id);
  const p = PERSONALITIES.find((x) => x.key === cat.personality);
  const [t1, t2] = tileColors(cat.personality, cat.alive, cat.id, cat.generation);

  let title = "";
  let detail = "";
  let method = "";
  let args: Record<string, unknown> = { token_id: String(id) };
  let deposit = "0";
  let blocked = "";
  if (action === "buy") {
    title = `Adopt ${cat.alive ? cat.name : `the ghost of ${cat.name}`}`;
    method = "buy_cat";
    if (!sale) blocked = "This cat is not for sale right now.";
    else {
      deposit = sale.priceYocto;
      detail = `You pay ${near(sale.price)} to ${sale.seller}. The NFT moves to your account in the same transaction. As the holder you can claim the cat's profit.`;
      if (accountId && accountId === sale.seller) blocked = "You already own this cat.";
    }
  } else if (action === "sell") {
    title = `Put ${cat.name} up for sale`;
    method = "list_cat";
    args = { token_id: String(id), price: milliToYocto(priceNear * 1000) };
    detail = `Asking price ${near(priceNear * 1000)}. Anyone, a person or an AI agent, can buy it at that price until you delist it.`;
    if (!(priceNear >= 0.01)) blocked = "Price must be at least 0.01 NEAR.";
    if (accountId && cat.ownerId !== accountId) blocked = `Only the holder (${cat.ownerId}) can list this cat.`;
  } else if (action === "delist") {
    title = `Take ${cat.name} off the market`;
    method = "delist_cat";
    detail = "The cat stays yours and is no longer for sale.";
    if (!sale) blocked = "This cat is not for sale.";
    if (accountId && cat.ownerId !== accountId) blocked = `Only the holder (${cat.ownerId}) can delist this cat.`;
  } else if (action === "feed") {
    title = `Feed ${cat.name}`;
    method = "feed";
    deposit = milliToYocto(amountNear * 1000);
    detail = `${near(amountNear * 1000)} goes into ${cat.name}'s game wallet so it can buy fish. This is a gift: it raises the cat's stake.`;
    if (!cat.alive) blocked = "Ghosts cannot eat.";
    if (!(amountNear >= 0.001)) blocked = "Amount must be at least 0.001 NEAR.";
  } else if (action === "join") {
    const h = snap.homes?.find((x) => x.home === cat.home);
    title = `Take a seat in the ${h?.name ?? "home"} fan club`;
    method = "join_fan_club";
    args = { home: cat.home };
    deposit = milliToYocto(10);
    detail = `One seat costs 0.01 NEAR (${h?.fans ?? 0} of ${h?.seats ?? 350} taken). Half goes into ${cat.alive ? `${cat.name}'s wallet so it can eat` : "the nursery"}, half saves up for this home's next kitten. Fans share 30% of every profit claim and half of every kitten adoption from this home, for all nine lives.`;
    if (h && h.fans >= h.seats) blocked = "This fan club is full.";
  } else if (action === "claim_fans") {
    const h = snap.homes?.find((x) => x.home === cat.home);
    title = `Collect your ${h?.name ?? "fan club"} rewards`;
    method = "claim_fan_rewards";
    args = { home: cat.home };
    detail = "Sends the rewards paid into your seat since you joined (or last collected) to your wallet.";
  } else blocked = `Unknown action "${action}".`;

  const go = async () => {
    try {
      setStatus({ ok: true, text: "Waiting for your wallet…" });
      const tx = await call(method, args, deposit);
      setStatus({ ok: true, text: "Done. It is on-chain.", tx: tx ?? undefined });
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : "Cancelled." });
    }
  };

  return (
    <div className="sign-wrap">
      <div className="pbox sign-card">
        <div className="portrait-big sign-portrait" style={{ ["--t1" as string]: t1, ["--t2" as string]: t2 }}>
          <PixelCat c={cat} size={170} />
        </div>
        <div>
          <p className="screen-kicker"><Icon name="bot" /> Requested by you or your AI assistant</p>
          <h1 className="page-title" style={{ color: "var(--ink)", fontSize: "clamp(30px, 4vw, 44px)" }}>{title}</h1>
          <p style={{ margin: "0 0 4px", color: "#5c4a63" }}>{p?.title} · {cat.alive ? "alive" : `ghost since day ${cat.diedDay}`} · NFT #{cat.id}</p>
          <p style={{ color: "#3a2d40" }}>{detail}</p>
          <pre className="code">{`${snap.contractId}.${method}(${JSON.stringify(args)})${deposit !== "0" ? `  deposit ${deposit} yocto` : ""}  · ${snap.network}`}</pre>
          {blocked ? (
            <p style={{ color: "#b23a4c", fontWeight: 800 }}>{blocked}</p>
          ) : !accountId ? (
            <div className="btn-row"><button className="btn btn-primary" onClick={connect}><Icon name="key" /> Connect a NEAR wallet</button></div>
          ) : (
            <div className="btn-row"><button className="btn btn-near" onClick={go}><Icon name="paw" /> Approve as {accountId.length > 24 ? accountId.slice(0, 20) + "…" : accountId}</button></div>
          )}
          {status && (
            <p style={{ color: status.ok ? "#1f6e46" : "#b23a4c", fontWeight: 800 }}>
              {status.text}{" "}
              {status.tx && <a href={`https://${snap.network === "mainnet" ? "" : "testnet."}nearblocks.io/txns/${status.tx}`} target="_blank" rel="noreferrer">View transaction</a>}
            </p>
          )}
          <p className="small" style={{ color: "#8c7a63", margin: "10px 0 0" }}>Nine Lives never holds your keys. Your wallet shows the same call before you approve. Testnet NEAR only.</p>
        </div>
      </div>
      <p style={{ marginTop: 22 }}><Link href={`/cat/${cat.id}`}>← {cat.name}&apos;s page</Link> · <Link href="/agents">How AI assistants use this</Link></p>
    </div>
  );
}

export default function SignPage() {
  return (
    <div className="page">
      <div className="container">
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <SignInner />
        </Suspense>
      </div>
    </div>
  );
}
