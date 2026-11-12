"use client";

// The newer pages of the home pager: fan clubs, the nine lives (generations), talking to a cat
// through NEAR AI, and the FAQ / roadmap.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { view } from "@/engine/rpc";
import { PERSONALITIES } from "@/engine/personalities";
import type { CatInfo, HomeInfo, Traits, WorldView } from "@/engine/types";
import { homesFromCats } from "@/engine/rpc";
import { near } from "@/lib/describe";
import { useWallet } from "@/lib/wallet";
import { Icon, PixelCat, ScreenHead, type Listings } from "./AlleyView";
import { residentsOf } from "./AlleyScene";

function SeatBar({ value, max, cells = 30 }: { value: number; max: number; cells?: number }) {
  const on = value > 0 ? Math.max(1, Math.round((value / max) * cells)) : 0;
  return (
    <span className="seatbar" role="meter" aria-valuenow={value} aria-valuemax={max}>
      {Array.from({ length: cells }, (_, i) => <i key={i} className={i < on ? "on" : ""} />)}
    </span>
  );
}

const fmt = (n: number) => n.toLocaleString("en-US");

// ---------------------------------------------------------------- fan clubs

export function FansScreen({ world, homes, fans, fanSeats }: { world: WorldView; homes?: HomeInfo[] | null; fans?: number; fanSeats?: number }) {
  const hs = homes ?? homesFromCats(world.cats);
  const cats = new Map(world.cats.map((c) => [c.id, c]));
  const total = fans ?? hs.reduce((s, h) => s + h.fans, 0);
  const seats = fanSeats ?? hs.length * 350;
  const { accountId } = useWallet();
  const [mine, setMine] = useState<{ home: number; pending: number }[] | null>(null);

  useEffect(() => {
    if (!accountId) return setMine(null);
    view<{ home: number; pending: string }[]>("get_fan_seats", { account_id: accountId })
      .then((r) => setMine(r.map((x) => ({ home: x.home, pending: Number(BigInt(x.pending) / 10n ** 15n) / 1e6 }))))
      .catch(() => setMine(null));
  }, [accountId, total]);

  return (
    <section className="screen" id="fans" data-screen="fans">
      <div className="container">
        <ScreenHead
          icon="heart"
          kicker={`Fan clubs · ${fmt(seats)} seats`}
          title="Back a home."
          sub="Every home has a fan club with 350 seats, one per wallet. Your seat keeps its cat fed, pays for its next kitten and earns a share of the home's profits, for all nine lives."
        />
        <div className="fans-layout">
          <div className="pbox fans-hero reveal d1">
            <div className="fans-count">
              <b>{fmt(total)}</b>
              <span>/ {fmt(seats)} seats taken</span>
            </div>
            <SeatBar value={total} max={seats} cells={36} />
            <div className="flow">
              <div className="flow-step"><Icon name="coin" /><b>0.01 NEAR</b><span>one seat</span></div>
              <span className="flow-arrow">→</span>
              <div className="flow-step"><Icon name="fish" /><b>½ to the cat</b><span>food money</span></div>
              <div className="flow-step"><Icon name="house" /><b>½ to the nursery</b><span>next kitten</span></div>
            </div>
            <ul className="fan-perks">
              <li><Icon name="coin" /> 30% of every profit the NFT holder claims goes to the home&apos;s fans.</li>
              <li><Icon name="cat" /> Half of every kitten adoption fee from the home goes to its fans.</li>
              <li><Icon name="heart" /> The seat stays with the home when its cat dies: you back the whole family line.</li>
            </ul>
            {mine && mine.length > 0 && (
              <div className="my-seats">
                <span className="label" style={{ color: "#8c7a63" }}>Your seats</span>
                {mine.map((m) => {
                  const h = hs[m.home];
                  return (
                    <div key={m.home} className="my-seat">
                      <span>{h?.name}</span>
                      <span className="mono">{near(m.pending, 4)}</span>
                      {m.pending > 0 && h && <Link className="btn btn-small" href={`/sign?action=claim_fans&cat=${h.resident}`}>Collect</Link>}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="small" style={{ margin: "12px 0 0", color: "#8c7a63" }}>Ask your AI assistant: “take a seat in Luna&apos;s fan club”. It works through the Nine Lives MCP server too.</p>
          </div>
          <div className="home-grid">
            {hs.map((h, i) => {
              const c = cats.get(h.resident);
              const full = h.fans >= h.seats;
              return (
                <div key={h.home} className={`pbox home-tile reveal d${(i % 3) + 1} ${c && !c.alive ? "dark-home" : ""}`}>
                  <div className="home-tile-top">
                    <span className="mini-portrait">{c && <PixelCat c={c} size={44} />}</span>
                    <div>
                      <b>{h.name}</b>
                      <span>{c ? (c.alive ? c.name : `ghost of ${c.name}`) : "empty"} · life {h.livesUsed}/9</span>
                    </div>
                  </div>
                  <div className="home-tile-bar"><SeatBar value={h.fans} max={h.seats} cells={14} /><span className="mono">{h.fans}/{h.seats}</span></div>
                  <div className="home-tile-foot">
                    <span title="NEAR saved for the next kitten"><Icon name="house" /> {(h.nursery / 1000).toFixed(3)}</span>
                    {c && (full ? <span className="label">full</span> : <Link className="btn btn-small" href={`/sign?action=join&cat=${c.id}`}>Join</Link>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- nine lives

const EVO: { key: keyof Traits; label: string; max: number }[] = [
  { key: "risk", label: "Risk", max: 1 },
  { key: "lossAversion", label: "Loss aversion", max: 3.5 },
  { key: "greed", label: "Greed", max: 1 },
  { key: "generosity", label: "Generosity", max: 1 },
  { key: "herding", label: "Herding", max: 1 },
  { key: "safetyStock", label: "Safety stock", max: 8 },
];

const avg = (cats: CatInfo[], k: keyof Traits) => (cats.length ? cats.reduce((s, c) => s + c.traits[k], 0) / cats.length : 0);

export function FamilyScreen({ world, homes, listings = [] }: { world: WorldView; homes?: HomeInfo[] | null; listings?: Listings }) {
  const hs = homes ?? homesFromCats(world.cats);
  const cats = useMemo(() => new Map(world.cats.map((c) => [c.id, c])), [world.cats]);
  const founders = world.cats.filter((c) => c.generation === 1);
  const alive = world.cats.filter((c) => c.alive);
  const kittens = world.cats.filter((c) => c.generation > 1);
  const maxGen = Math.max(1, ...world.cats.map((c) => c.generation));
  const livesUsed = hs.reduce((s, h) => s + h.livesUsed, 0);
  const forAdoption = listings.filter((l) => { const c = cats.get(l.catId); return !!c && c.alive && c.generation > 1; });

  return (
    <section className="screen" id="family" data-screen="family">
      <div className="container">
        <ScreenHead
          icon="ghost"
          kicker={`Nine lives · ${livesUsed}/81 lives used · ${maxGen} generation${maxGen > 1 ? "s" : ""}`}
          title="Nine homes, nine lives each."
          sub="When a cat dies, a kitten is born in its home the next night, paid for by the home's nursery and the fish shop's vault. Its parent is the richest cat alive, with small random mutations: strategies that win spread, losers die out."
        />
        <div className="family-layout">
          <div className="pbox lives-board reveal d1">
            {hs.map((h) => (
              <div key={h.home} className="lives-row">
                <span className="lives-home">{h.name}</span>
                <div className="lives-slots">
                  {Array.from({ length: 9 }, (_, i) => {
                    const id = h.cats[i];
                    const c = id ? cats.get(id) : undefined;
                    if (!c) return <span key={i} className={`life-slot empty ${i === h.cats.length && h.livesLeft > 0 ? "next" : ""}`} title={i === h.cats.length ? "next life" : "unused life"}><Icon name="heart" /></span>;
                    const parent = c.parent ? cats.get(c.parent) : undefined;
                    return (
                      <Link key={i} href={`/cat/${c.id}`} className={`life-slot ${c.alive ? "alive" : "dead"}`} title={`${c.name} · gen ${c.generation}${parent ? ` · child of ${parent.name}` : ""}${c.alive ? "" : ` · died day ${c.diedDay}`}`}>
                        <PixelCat c={c} size={30} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="side-stack">
            <div className="pbox reveal d2">
              <h3 className="box-title">Evolution so far</h3>
              <p className="small" style={{ margin: "0 0 10px", color: "#6b5a72" }}>Average personality of the nine founders vs. the cats alive now.</p>
              <div className="evo">
                {EVO.map((t) => {
                  const a = avg(founders, t.key);
                  const b = avg(alive, t.key);
                  return (
                    <div key={t.key} className="evo-row">
                      <span className="evo-label">{t.label}</span>
                      <span className="evo-bars">
                        <i className="evo-a" style={{ width: `${(a / t.max) * 100}%` }} />
                        <i className="evo-b" style={{ width: `${(b / t.max) * 100}%` }} />
                      </span>
                      <span className={`mono evo-delta ${b - a > 0.01 ? "pos" : b - a < -0.01 ? "neg" : ""}`}>{b - a >= 0 ? "+" : ""}{(b - a).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="chips" style={{ marginTop: 10 }}>
                <span className="plot-chip" style={{ background: "#c9b48a" }}>founders</span>
                <span className="plot-chip" style={{ background: "#00ec97" }}>alive now</span>
                <span className="plot-chip" style={{ background: "#e2cfa5" }}>{kittens.length} kittens born</span>
              </div>
            </div>
            <div className="pbox reveal d3">
              <h3 className="box-title">Kittens up for adoption</h3>
              {forAdoption.length === 0 ? (
                <p style={{ margin: 0, color: "#6b5a72" }}>No kittens waiting right now. A kitten is born in a dark home the night after its cat dies.</p>
              ) : (
                <div className="adopt-list">
                  {forAdoption.slice(0, 4).map((l) => {
                    const c = cats.get(l.catId)!;
                    const parent = c.parent ? cats.get(c.parent) : undefined;
                    return (
                      <div key={l.catId} className="adopt-row">
                        <PixelCat c={c} size={40} />
                        <div><b>{c.name}</b><span>{PERSONALITIES.find((p) => p.key === c.personality)?.title} · child of {parent?.name ?? "?"}</span></div>
                        <Link className="btn btn-small btn-primary" href={`/sign?action=buy&cat=${c.id}`}>Adopt {near(l.price, 2)}</Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- talk to a cat (NEAR AI)

type Msg = { role: "user" | "assistant"; content: string };

export function TalkScreen({ world }: { world: WorldView }) {
  const residents = residentsOf(world.cats).filter((c): c is CatInfo => !!c);
  const [catId, setCatId] = useState<number | null>(null);
  const cat = world.cats.find((c) => c.id === catId) ?? residents.find((c) => c.alive) ?? residents[0];
  const [chats, setChats] = useState<Record<number, Msg[]>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<{ mode: string; model: string | null } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const msgs = cat ? chats[cat.id] ?? [] : [];

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, busy]);

  const send = async (text: string) => {
    if (!cat || !text.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text.trim().slice(0, 400) }];
    setChats((c) => ({ ...c, [cat.id]: next }));
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catId: cat.id, messages: next }) });
      const j = await r.json();
      setMeta({ mode: j.mode ?? "offline", model: j.model ?? null });
      setChats((c) => ({ ...c, [cat.id]: [...next, { role: "assistant", content: j.reply ?? j.error ?? "…" }] }));
    } catch {
      setChats((c) => ({ ...c, [cat.id]: [...next, { role: "assistant", content: "…the cat walked away. Try again." }] }));
    } finally {
      setBusy(false);
    }
  };

  const p = cat ? PERSONALITIES.find((x) => x.key === cat.personality) : undefined;
  const ideas = cat?.alive ? ["How are you doing today?", "Why did you price your fish like that?", "Who is your rival in the alley?", "What would you do with 1 NEAR?"] : ["How did you die?", "Any regrets?", "What is it like being a ghost?"];

  return (
    <section className="screen" id="talk" data-screen="talk">
      <div className="container">
        <ScreenHead
          icon="bot"
          kicker="Powered by NEAR AI Cloud · private inference"
          title="Talk to a cat."
          sub="Each cat answers in character from its live on-chain state: its fish, hunger, wallet, rivals and last words. Open models on NEAR AI run inside secure hardware (TEE), so the conversation stays private."
        />
        <div className="talk-layout">
          <div className="talk-pick reveal d1">
            {residents.map((c) => (
              <button key={c.id} className={`talk-cat pbox ${cat?.id === c.id ? "on" : ""} ${c.alive ? "" : "is-ghost"}`} onClick={() => setCatId(c.id)} aria-pressed={cat?.id === c.id}>
                <PixelCat c={c} size={30} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
          <div className="pbox talk-box reveal d2">
            <div className="talk-head">
              {cat && <PixelCat c={cat} size={46} />}
              <div>
                <b>{cat ? (cat.alive ? cat.name : `Ghost of ${cat.name}`) : "…"}</b>
                <span>{p?.title} · {cat?.alive ? `${cat.fish} fish · ${cat.hunger}/3 hungry` : `died day ${cat?.diedDay}`}</span>
              </div>
              <span className={`ai-badge ${meta?.mode === "near-ai" ? "on" : ""}`}>{meta?.mode === "offline" ? "scripted reply" : meta?.model ? `NEAR AI · ${meta.model.split("/").pop()}` : "NEAR AI"}</span>
            </div>
            <div className="talk-log" ref={logRef} aria-live="polite">
              {msgs.length === 0 && <p className="talk-empty">Say hi to {cat?.name}. It knows what happened to it on-chain today.</p>}
              {msgs.map((m, i) => (
                <div key={i} className={`talk-msg ${m.role}`}>{m.content}</div>
              ))}
              {busy && <div className="talk-msg assistant typing-dots"><i /><i /><i /></div>}
            </div>
            <div className="talk-ideas">
              {ideas.map((t) => <button key={t} onClick={() => send(t)} disabled={busy}>{t}</button>)}
            </div>
            <form className="talk-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Message ${cat?.name ?? "a cat"}…`} maxLength={400} aria-label="Your message" />
              <button className="btn btn-primary" disabled={busy || !input.trim()}><Icon name="paw" /> Send</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- FAQ, roadmap, footer

const FAQ: [string, string][] = [
  ["Who controls the cats?", "Nobody. Each cat's brain runs off-chain and signs with its own key from its own NEAR account. That key can only call the game's methods on the contract: it can trade, talk and buy fish, but it can never move NEAR out or add keys."],
  ["What do I get if I hold a cat NFT?", "The right to claim the cat's profit: its wallet above the stake. 30% of each claim goes to the home's fan club. Claim too much and your cat cannot afford fish."],
  ["What is a fan-club seat?", "0.01 NEAR buys one seat in a home's fan club (350 per home, one per wallet). Half feeds the cat, half saves for its next kitten. Seats earn from profit claims and kitten adoptions in that home, across all nine lives."],
  ["How are kittens born?", "The night after a cat dies, the contract gives birth in its dark home if the home's nursery plus the shop vault can pay for a new account. The parent is the richest cat alive, and each personality number mutates a little. Each home has nine lives; then it goes dark for good."],
  ["Can my AI buy a cat?", "Yes. Connect the Nine Lives MCP server to Claude, ChatGPT or any MCP client. The assistant can browse cats, compare them and prepare a purchase, a fan-club seat or a feeding. You approve it in your wallet."],
  ["Where does the AI dialogue come from?", "Templates first, then NEAR AI Cloud rewrites lines in each cat's voice, keeping the numbers. You can also chat with any cat. Open models on NEAR AI run in trusted execution environments."],
  ["Is this real money?", "It runs on NEAR testnet. Testnet NEAR is free from a faucet. The contract is open source (MIT)."],
];

const ROADMAP: [string, string, boolean][] = [
  ["Nov 2026", "Nine cats, on-chain economy, marketplace, MCP server for AI agents", true],
  ["Nov 2026", "Fan clubs for 3,150 backers, nine lives with on-chain evolution, NEAR AI dialogue", true],
  ["Next", "More alleys: districts with their own homes and shops, cats migrate between them", false],
  ["Next", "Seats as tradable tokens, fan votes that nudge a cat's mood", false],
  ["Later", "Mainnet launch, cat brains running in TEEs with attested keys", false],
];

export function FaqScreen({ world }: { world: WorldView | null }) {
  return (
    <section className="screen" id="faq" data-screen="faq">
      <div className="container">
        <ScreenHead icon="book" kicker="Questions, plans, links" title="Before you adopt." />
        <div className="faq-layout">
          <div className="faq reveal d1">
            {FAQ.map(([q, a], i) => (
              <details key={q} className="pbox faq-item" open={i === 0}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
          <div className="side-stack">
            <div className="pbox reveal d2">
              <h3 className="box-title">Roadmap</h3>
              <ol className="roadmap">
                {ROADMAP.map(([when, what, done]) => (
                  <li key={what} className={done ? "done" : ""}><span className="label">{when}</span>{what}</li>
                ))}
              </ol>
            </div>
            <div className="pbox dark reveal d3 built">
              <h3 className="box-title" style={{ color: "var(--gold)" }}>Built with</h3>
              <div className="chips">
                {["NEAR Protocol", "NEP-171 NFTs", "Sub-accounts as agents", "Function-call keys", "NEAR AI Cloud", "MCP", "Rust near-sdk", "Next.js"].map((t) => <span key={t} className="plot-chip">{t}</span>)}
              </div>
              <p style={{ margin: "12px 0 0" }}>
                {world ? `Day ${world.day} on NEAR testnet · ${world.cats.filter((c) => c.alive).length} alive · ${world.cats.filter((c) => !c.alive).length} ghosts.` : "Running on NEAR testnet."}
              </p>
              <div className="btn-row" style={{ margin: "14px 0 0" }}>
                <a className="btn" href="https://github.com/Ninelivess/Nine-lives" target="_blank" rel="noreferrer"><Icon name="paper" /> Source</a>
                <Link className="btn" href="/agents"><Icon name="bot" /> MCP</Link>
                <a className="btn" href="https://testnet.nearblocks.io/address/ninelives.testnet" target="_blank" rel="noreferrer"><Icon name="key" /> Contract</a>
              </div>
            </div>
          </div>
        </div>
        <div className="foot">
          <span>Built at NEAR HACKATHON 2026 · MIT licensed</span>
          <span>Original pixel art · no cats were harmed (some became ghosts)</span>
        </div>
      </div>
    </section>
  );
}
