import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { SCHOOL_NAME, SUPPORT_KNOWLEDGE, HUMAN_FALLBACK } from "@/lib/support-knowledge";

export const runtime = "nodejs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Keep the widget cheap and safe: cap history length and message size.
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 2000;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  // 1. Require a logged-in user. Remove this block only if you want the
  //    widget to also work on public, signed-out pages.
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Reuses the same role-resolution helper the rest of the app uses
  // (src/lib/auth.ts), so this stays in sync with admin/teacher/parent/student.
  const role = getUserRole(sessionClaims, "user");

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  if (incoming.length === 0) {
    return new Response("No messages provided", { status: 400 });
  }

  // Basic hygiene: trim to the last N turns, cap each message's length.
  const messages: ChatMessage[] = incoming
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, MAX_MESSAGE_CHARS),
    }));

  const systemPrompt = `You are the AI support assistant embedded in the ${SCHOOL_NAME} web app.
You are talking to a signed-in ${role}. Be warm, brief, and concrete — this
is a small chat bubble, not a document, so prefer 2-5 sentences and simple
steps over long explanations.

Only answer using the knowledge below. If the answer isn't in it, say so
plainly and add: "${HUMAN_FALLBACK}" Never invent policies, dates, or
grades. Never ask for or repeat passwords, ID numbers, or other
credentials.

${SUPPORT_KNOWLEDGE}`;

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        stream.on("text", (text) => {
          controller.enqueue(encoder.encode(text));
        });
        stream.on("end", () => controller.close());
        stream.on("error", (err) => {
          console.error("support-chat stream error", err);
          controller.error(err);
        });
        await stream.finalMessage().catch(() => {
          /* errors already handled by the "error" listener above */
        });
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("support-chat error", err);
    return new Response("The support assistant is temporarily unavailable.", {
      status: 502,
    });
  }
}
