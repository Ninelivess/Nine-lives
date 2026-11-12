"use client";

// Full-screen pages. One wheel gesture, swipe or arrow key = one page. Going forward, the next
// page drops in from above; going back, the previous one rises from below. A page whose content
// is taller than the screen scrolls inside first, and only flips at its edge on a new gesture.

import { useCallback, useEffect, useRef, useState } from "react";

export const GOTO_EVENT = "nl:goto";
export const PAGE_EVENT = "nl:page";

export function goToPage(id: string) {
  window.dispatchEvent(new CustomEvent(GOTO_EVENT, { detail: id }));
}

export interface PagerPage {
  id: string;
  node: React.ReactNode;
}

/** Can some scrollable element between `el` and the page still scroll in direction `dir`? */
function innerCanScroll(el: Element | null, stop: Element | null, dir: 1 | -1): boolean {
  let n: Element | null = el;
  while (n && n !== stop?.parentElement) {
    if (n instanceof HTMLElement) {
      const st = getComputedStyle(n).overflowY;
      // A page that is only a few pixels too tall should still flip, not creep.
      const slack = n === stop ? 48 : 2;
      if ((st === "auto" || st === "scroll") && n.scrollHeight > n.clientHeight + slack) {
        if (dir > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 2) return true;
        if (dir < 0 && n.scrollTop > 2) return true;
      }
    }
    n = n.parentElement;
  }
  return false;
}

export function Pager({ pages }: { pages: PagerPage[] }) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const busyUntil = useRef(0);
  const lastWheel = useRef(0);
  const gestureNative = useRef(false);
  const slides = useRef<(HTMLDivElement | null)[]>([]);
  const indexRef = useRef(0);

  const go = useCallback(
    (to: number) => {
      const from = indexRef.current;
      if (to < 0 || to >= pages.length || to === from) return;
      if (Date.now() < busyUntil.current) return;
      busyUntil.current = Date.now() + 800;
      setDir(to > from ? 1 : -1);
      setLeaving(from);
      setIndex(to);
      indexRef.current = to;
      const el = slides.current[to];
      if (el) el.scrollTop = 0;
      history.replaceState(null, "", `#${pages[to].id}`);
      window.dispatchEvent(new CustomEvent(PAGE_EVENT, { detail: pages[to].id }));
      setTimeout(() => setLeaving(null), 780);
    },
    [pages],
  );

  useEffect(() => {
    document.documentElement.classList.add("paged");
    const start = pages.findIndex((p) => `#${p.id}` === location.hash);
    if (start > 0) {
      indexRef.current = start;
      setIndex(start);
    }
    window.dispatchEvent(new CustomEvent(PAGE_EVENT, { detail: pages[Math.max(0, start)].id }));

    const onWheel = (e: WheelEvent) => {
      const now = Date.now();
      const newGesture = now - lastWheel.current > 220;
      lastWheel.current = now;
      if (Math.abs(e.deltaY) < 3 || document.documentElement.classList.contains("intro-lock")) return;
      const d: 1 | -1 = e.deltaY > 0 ? 1 : -1;
      const slide = slides.current[indexRef.current];
      if (newGesture) gestureNative.current = innerCanScroll(e.target as Element, slide, d);
      if (gestureNative.current) return; // let the page's own content scroll
      e.preventDefault();
      if (newGesture) go(indexRef.current + d);
    };

    let touchY = 0;
    let touchNative = false;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
      touchNative = false;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const dy = touchY - e.changedTouches[0].clientY;
      if (Math.abs(dy) < 60) return;
      const d: 1 | -1 = dy > 0 ? 1 : -1;
      const slide = slides.current[indexRef.current];
      touchNative = innerCanScroll(e.target as Element, slide, d);
      if (!touchNative) go(indexRef.current + d);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (["ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        go(indexRef.current + 1);
      } else if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(indexRef.current - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(pages.length - 1);
    };

    const onGoto = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const i = pages.findIndex((p) => p.id === id);
      if (i >= 0) {
        busyUntil.current = 0;
        go(i);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener(GOTO_EVENT, onGoto);
    return () => {
      document.documentElement.classList.remove("paged");
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(GOTO_EVENT, onGoto);
    };
  }, [go, pages]);

  return (
    <div className="pager">
      {pages.map((p, i) => {
        const cls =
          i === index ? `slide active ${leaving !== null ? (dir > 0 ? "enter-from-top" : "enter-from-bottom") : ""}` : i === leaving ? `slide leaving ${dir > 0 ? "exit-down" : "exit-up"}` : "slide";
        return (
          <div key={p.id} className={cls} ref={(el) => { slides.current[i] = el; }} aria-hidden={i !== index}>
            {p.node}
          </div>
        );
      })}
    </div>
  );
}
