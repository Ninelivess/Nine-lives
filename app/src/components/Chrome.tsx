"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { pixelCatSvg } from "@/engine/pixel";
import { useSnapshot } from "@/lib/snapshot";
import { WalletButton } from "@/lib/wallet";
import { Icon } from "./AlleyView";
import { PAGE_EVENT, goToPage } from "./Pager";
import type { IconName } from "@/lib/icons";

const logoCat = pixelCatSvg({ id: 0, personality: "gambler", alive: true, fish: 3, hunger: 0 }, 30);

export function Hud() {
  const snap = useSnapshot();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const w = snap?.world;
  const left = snap ? Math.max(0, Math.ceil((snap.nextTickMs - (now + snap.skew)) / 1000)) : null;
  return (
    <header className="hud">
      <Link href="/" className="logo pbox" aria-label="Nine Lives home">
        <span className="px-cat" style={{ width: 30, height: 30 }} dangerouslySetInnerHTML={{ __html: logoCat }} />
        Nine Lives
      </Link>
      <div className="hud-right">
        {w && (
          <div className="hud-stats pbox dark" role="status" aria-label="Alley status">
            <span className="hud-stat" title="Game day"><Icon name="moon" /> Day {w.day}</span>
            <span className="hud-stat" title="Next night">{left === 0 ? "night now" : `${Math.floor((left ?? 0) / 60)}:${String((left ?? 0) % 60).padStart(2, "0")}`}</span>
            <span className="hud-stat" title="Alive"><Icon name="heart" /> {w.cats.filter((c) => c.alive).length}</span>
            <span className="hud-stat" title="Ghosts"><Icon name="ghost" /> {w.cats.filter((c) => !c.alive).length}</span>
            {snap?.fans !== undefined && <span className="hud-stat hud-fans" title="Fan-club seats taken"><Icon name="paw" /> {snap.fans}/{snap.fanSeats ?? 3150}</span>}
          </div>
        )}
        <WalletButton />
      </div>
    </header>
  );
}

const SLOTS: { id: string; icon: IconName; label: string }[] = [
  { id: "alley", icon: "moon", label: "Live alley" },
  { id: "cats", icon: "cat", label: "The nine homes" },
  { id: "fans", icon: "heart", label: "Fan clubs" },
  { id: "family", icon: "ghost", label: "Nine lives" },
  { id: "gazette", icon: "paper", label: "Gazette" },
  { id: "graveyard", icon: "tomb", label: "Graveyard" },
  { id: "talk", icon: "bot", label: "Talk to a cat" },
  { id: "how", icon: "book", label: "How it works" },
  { id: "faq", icon: "key", label: "FAQ & roadmap" },
];

/** Game-style hotbar. On the home page it tracks the screen in view; keys 1-6 jump. */
export function Hotbar() {
  const path = usePathname();
  const [active, setActive] = useState(path === "/simulate" ? "ff" : "alley");

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            if (e.intersectionRatio > 0.45) setActive((e.target as HTMLElement).dataset.screen ?? "alley");
          }
        }
      },
      { threshold: [0.15, 0.45, 0.7] },
    );
    // Screens appear once chain data has loaded, so keep watching the page for new ones.
    const seen = new WeakSet<Element>();
    const scan = () =>
      document.querySelectorAll("[data-screen]").forEach((el) => {
        if (!seen.has(el)) {
          seen.add(el);
          io.observe(el);
        }
      });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [path]);

  const onHome = path === "/";

  // The home page is a stack of full-screen pages: follow and drive it.
  useEffect(() => {
    const onPage = (e: Event) => setActive((e as CustomEvent<string>).detail);
    window.addEventListener(PAGE_EVENT, onPage);
    return () => window.removeEventListener(PAGE_EVENT, onPage);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < SLOTS.length) {
        if (onHome) goToPage(SLOTS[i].id);
        else window.location.href = `/#${SLOTS[i].id}`;
      }
      if (e.key === "0") window.location.href = "/agents";
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onHome]);

  return (
    <nav className="hotbar pbox dark" aria-label="Sections">
      {SLOTS.map((s, i) => (
        <a
          key={s.id}
          href={`/#${s.id}`}
          onClick={(e) => {
            if (onHome) {
              e.preventDefault();
              goToPage(s.id);
            }
          }}
          className={`slot ${active === s.id && onHome ? "on" : ""}`}
          aria-label={s.label}
        >
          <span className="key">{i + 1}</span>
          <Icon name={s.icon} />
          <span className="tip pbox">{s.label}</span>
        </a>
      ))}
      <span className="slot-sep" aria-hidden />
      <Link href="/simulate" className={`slot slot-extra ${path === "/simulate" ? "on" : ""}`} aria-label="Fast-forward">
        <Icon name="ff" />
        <span className="tip pbox">Fast-forward</span>
      </Link>
      <Link href="/agents" className={`slot slot-extra ${path === "/agents" ? "on" : ""}`} aria-label="Buy with your AI">
        <span className="key">0</span>
        <Icon name="coin" />
        <span className="tip pbox">Buy with your AI</span>
      </Link>
    </nav>
  );
}
