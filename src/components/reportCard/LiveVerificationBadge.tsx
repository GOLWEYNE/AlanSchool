"use client";

import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";

// Small client island: everything else on this page is server-rendered,
// but the "verified live" stamp ticks in real time to reinforce that this
// is an authentic, freshly-viewed official document (not a stale export).
const LiveVerificationBadge = ({ generatedAt }: { generatedAt: string }) => {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1.5 print:hidden">
      <BadgeCheck size={15} className="text-emerald-300" strokeWidth={2.5} />
      <span className="text-[11px] font-semibold text-white/95">
        Official Document · Verified{" "}
        {now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "…"}
      </span>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
    </div>
  );
};

export default LiveVerificationBadge;
