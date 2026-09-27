"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

type Message = { role: "user" | "assistant"; content: string };

const BRAND_COLOR = "#16a34a"; // swap for your school's brand color
const GREETING =
  "Hi! I'm the Alan International School support assistant. Ask me about schedules, assignments, exams, or how the platform works.";

export default function SupportChatWidget() {
  const { isSignedIn } = useUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  // Only show the widget to logged-in users (the API route requires auth too).
  if (!isSignedIn) return null;

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    // Placeholder assistant message we'll stream text into.
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (err) {
      console.error(err);
      setError("Sorry, the support assistant is unavailable right now. Please try again shortly.");
      setMessages((m) => m.slice(0, -1)); // drop the empty placeholder
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, fontFamily: "system-ui, sans-serif" }}>
      {open && (
        <div
          style={{
            width: 340,
            height: 460,
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              background: BRAND_COLOR,
              color: "#fff",
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Alan International School</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>AI Support &middot; usually replies instantly</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close support chat"
              style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}
            >
              &times;
            </button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 12, background: "#f7f8fa" }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "8px 12px",
                    borderRadius: 12,
                    fontSize: 14,
                    lineHeight: 1.4,
                    whiteSpace: "pre-wrap",
                    background: m.role === "user" ? BRAND_COLOR : "#fff",
                    color: m.role === "user" ? "#fff" : "#1f2937",
                    border: m.role === "user" ? "none" : "1px solid #e5e7eb",
                  }}
                >
                  {m.content || (sending && i === messages.length - 1 ? "…" : "")}
                </div>
              </div>
            ))}
            {error && (
              <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 4 }}>{error}</div>
            )}
          </div>

          <div style={{ display: "flex", borderTop: "1px solid #e5e7eb", padding: 8, gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your question…"
              disabled={sending}
              style={{
                flex: 1,
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              style={{
                background: BRAND_COLOR,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0 14px",
                fontSize: 14,
                cursor: sending ? "default" : "pointer",
                opacity: sending || !input.trim() ? 0.6 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI support chat"
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: BRAND_COLOR,
          color: "#fff",
          border: "none",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          fontSize: 24,
          cursor: "pointer",
          float: "right",
        }}
      >
        {open ? "×" : "💬"}
      </button>
    </div>
  );
}
