"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Coords = { top: number; left?: number; right?: number };

type Props = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  align?: "left" | "right";
  className?: string;
  children: React.ReactNode;
};

// Navbar popovers (notifications, language switcher, ...) live inside a row
// that has `overflow-x-auto` so the icon cluster can scroll on narrow
// screens. Per the CSS spec, once one axis is non-"visible" the browser
// forces the other axis to compute as "auto" too — so that row's
// overflow-y becomes "auto" as well, and it silently clips any
// `position: absolute` dropdown that extends past its own ~37px height.
// That's why the bell/language icons looked fine and clicked fine, but
// their panels were invisible.
//
// Rendering the panel into a portal on <body>, positioned with
// `position: fixed` coordinates computed from the trigger's own
// bounding rect, sidesteps every ancestor's overflow/stacking context
// entirely — the same trick DailyRoutineButton already uses.
const DropdownPortal = ({ open, onClose, anchorRef, align = "right", className = "", children }: Props) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const reposition = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (align === "right") {
        setCoords({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
      } else {
        setCoords({ top: rect.bottom + 8, left: rect.left });
      }
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, anchorRef, align]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, anchorRef, onClose]);

  if (!open || !mounted || !coords) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={className}
      style={{ position: "fixed", top: coords.top, left: coords.left, right: coords.right, zIndex: 9999 }}
    >
      {children}
    </div>,
    document.body
  );
};

export default DropdownPortal;
