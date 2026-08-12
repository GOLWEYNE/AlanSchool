"use client";

import { useMobileSidebar } from "@/context/MobileSidebarContext";

export default function SidebarShell({ children }: { children: React.ReactNode }) {
  const { isOpen, close } = useMobileSidebar();

  return (
    <>
      {/* Mobile-only backdrop. md:hidden guarantees zero effect on desktop. */}
      <div
        onClick={close}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/*
        Mobile: fixed off-canvas panel that slides in/out via translate-x.
        md and up: md:static / md:translate-x-0 restore the ORIGINAL
        non-fixed, always-visible layout - width classes (w-[8%] lg:w-[16%]
        xl:w-[14%]) and p-4 are untouched from the original.
      */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[80%] p-4 transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:static md:z-auto md:translate-x-0 md:w-[8%] lg:w-[16%] xl:w-[14%] md:p-4`}
      >
        <div className="panel-card shine-hover h-full p-3 lg:p-4 flex flex-col overflow-hidden">
          {/* Close (X) button - only rendered visually below md */}
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="md:hidden self-end mb-2 circle-icon-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>

          {children}
        </div>
      </div>
    </>
  );
}
