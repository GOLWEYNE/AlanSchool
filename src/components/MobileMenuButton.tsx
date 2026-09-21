"use client";

import { useMobileSidebar } from "@/context/MobileSidebarContext";
import { useTranslations } from "next-intl";

export default function MobileMenuButton() {
  const { toggle } = useMobileSidebar();
  const t = useTranslations("Navbar");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("openMenu")}
      className="md:hidden circle-icon-btn"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
      </svg>
    </button>
  );
}
