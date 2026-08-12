"use client";

import { useMobileSidebar } from "@/context/MobileSidebarContext";

export default function MobileMenuButton() {
  const { toggle } = useMobileSidebar();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Open menu"
      className="md:hidden circle-icon-btn"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
      </svg>
    </button>
  );
}
