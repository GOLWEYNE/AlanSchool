"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 64; // how far (px) the spinner must be pulled before it refreshes
const MAX_PULL = 100;

// Two iPhone touches for the page area, phones only (everything is skipped on
// tablets and desktops):
//  1. Pull down at the top of a page to refresh it, like Mail or Settings.
//  2. A small title bar that fades in when the big page title has scrolled away,
//     like the collapsing large titles in iOS.
// It sits inside the scrolling page container (it reads its parent) and draws its
// two floating pieces into <body> so no wrapper can clip or move them.
export default function PhoneScrollEffects() {
  const anchor = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState("");
  const [showTitle, setShowTitle] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pullRef = useRef(0);
  const startedAt = useRef(0);

  useEffect(() => setMounted(true), []);

  // Keep the spinner up for a moment so a very fast refresh still feels like something happened.
  useEffect(() => {
    if (!refreshing || isPending) return;
    const wait = Math.max(0, 700 - (Date.now() - startedAt.current));
    const id = window.setTimeout(() => setRefreshing(false), wait);
    return () => window.clearTimeout(id);
  }, [refreshing, isPending]);

  useEffect(() => {
    const scroller = anchor.current?.parentElement;
    if (!scroller) return;
    const phone = window.matchMedia("(max-width: 767px)");

    let startY = 0;
    let tracking = false;
    let pulling = false;
    let crossed = false;

    // Do not hijack a drag that belongs to something else: a form field, a
    // sheet, a swipeable row of chips, or any inner list that scrolls itself.
    const blocked = (target: EventTarget | null) => {
      if (document.querySelector(".form-overlay.fixed")) return true;
      let node = target as HTMLElement | null;
      while (node && node !== scroller) {
        if (node.matches?.("input, textarea, select, nav, [role=tablist]")) return true;
        const style = getComputedStyle(node);
        const scrollsY = style.overflowY === "auto" || style.overflowY === "scroll";
        const scrollsX = style.overflowX === "auto" || style.overflowX === "scroll";
        if (scrollsY && node.scrollHeight > node.clientHeight + 1) return true;
        if (scrollsX && node.scrollWidth > node.clientWidth + 1) return true;
        node = node.parentElement;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      tracking = false;
      pulling = false;
      crossed = false;
      if (!phone.matches || e.touches.length !== 1 || scroller.scrollTop > 0 || blocked(e.target)) return;
      startY = e.touches[0].clientY;
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || scroller.scrollTop > 0) {
        if (pulling) {
          pullRef.current = 0;
          setPull(0);
        }
        pulling = false;
        if (dy < -8) tracking = false;
        return;
      }
      pulling = true;
      const next = Math.min(MAX_PULL, dy * 0.6);
      pullRef.current = next;
      setPull(next);
      if (next >= THRESHOLD && !crossed) {
        crossed = true;
        navigator.vibrate?.(8);
      }
    };

    const onEnd = () => {
      if (pulling && pullRef.current >= THRESHOLD) {
        startedAt.current = Date.now();
        setRefreshing(true);
        startTransition(() => router.refresh());
      }
      tracking = false;
      pulling = false;
      pullRef.current = 0;
      setPull(0);
    };

    const onScroll = () => {
      if (!phone.matches) {
        setShowTitle(false);
        return;
      }
      const heading = Array.from(scroller.querySelectorAll("h1")).find((h) => (h as HTMLElement).offsetParent !== null);
      if (!heading) {
        setShowTitle(false);
        return;
      }
      setTitle(heading.textContent?.trim() ?? "");
      setShowTitle(heading.getBoundingClientRect().bottom < 40);
    };

    scroller.addEventListener("touchstart", onStart, { passive: true });
    scroller.addEventListener("touchmove", onMove, { passive: true });
    scroller.addEventListener("touchend", onEnd, { passive: true });
    scroller.addEventListener("touchcancel", onEnd, { passive: true });
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("touchstart", onStart);
      scroller.removeEventListener("touchmove", onMove);
      scroller.removeEventListener("touchend", onEnd);
      scroller.removeEventListener("touchcancel", onEnd);
      scroller.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new page: re-read its title once it has rendered.
  useEffect(() => {
    const scroller = anchor.current?.parentElement;
    if (!scroller) return;
    const id = window.setTimeout(() => scroller.dispatchEvent(new Event("scroll")), 350);
    return () => window.clearTimeout(id);
  }, [pathname]);

  const spinning = refreshing || isPending;
  const shown = spinning ? THRESHOLD : pull;

  return (
    <>
      <span ref={anchor} hidden />
      {mounted &&
        createPortal(
          <>
            <div className={`phone-title-bar${showTitle ? " is-on" : ""}`} aria-hidden={!showTitle}>
              <span>{title}</span>
            </div>
            <div
              className="phone-ptr"
              aria-hidden="true"
              style={{
                opacity: spinning ? 1 : Math.min(1, pull / THRESHOLD),
                transform: `translate(-50%, ${shown - 56}px) scale(${spinning ? 1 : 0.6 + Math.min(0.4, pull / (THRESHOLD * 2.5))})`,
                transition: pull === 0 ? "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s" : "none",
              }}
            >
              <RefreshCw
                size={20}
                className={spinning ? "animate-spin" : ""}
                style={spinning ? undefined : { transform: `rotate(${pull * 4}deg)` }}
              />
            </div>
          </>,
          document.body
        )}
    </>
  );
}
