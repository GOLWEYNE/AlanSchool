"use client";

import { useEffect, useRef } from "react";

// Drops in at the end of a scrolling chat and keeps the newest message in view,
// like iMessage: opens at the bottom, and follows again when `count` grows.
export default function ScrollToEnd({ count }: { count: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = ref.current?.parentElement;
    if (box) box.scrollTop = box.scrollHeight;
  }, [count]);

  return <div ref={ref} aria-hidden="true" />;
}
