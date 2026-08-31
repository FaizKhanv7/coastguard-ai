/**
 * ============================================================================
 * Client side of the chatbot proxy
 * ============================================================================
 * The key itself lives only in `.env.local`, read by `app/api/chat/route.ts`.
 * Nothing here ever sees it — this module just knows how to ask that route a
 * question and how to shrug when the answer is "no key configured".
 *
 * The contract with the UI is deliberately narrow: `enhance()` takes the
 * answer the local flood model already produced and asks the LLM to say the
 * same thing more naturally. It never asks the model for facts, because the
 * model does not have the town's elevation grid and would invent one.
 * ============================================================================
 */

export interface ChatConfig {
  configured: boolean;
  models: { chat: string; vision: string };
}

let configPromise: Promise<ChatConfig> | null = null;

/**
 * Asks the server once whether a key is present, and remembers the answer.
 * Cheap enough to call from render; the network hit happens at most once.
 */
export function chatConfig(): Promise<ChatConfig> {
  if (!configPromise) {
    configPromise = fetch("/api/chat")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (j): ChatConfig =>
          j ?? { configured: false, models: { chat: "", vision: "" } },
      )
      .catch(() => ({
        configured: false,
        models: { chat: "", vision: "" },
      }));
  }
  return configPromise;
}

const SYSTEM = `You are the CoastGuard AI assistant for Miami-Dade County, Florida.

A local flood model and route solver have ALREADY answered the user's question.
Their answer is the only source of truth you have. Your job is to deliver it as
clear, calm, operational prose — the way an emergency coordinator would say it
on the radio.

Rules, without exception:
- Never add a fact that is not in the model answer. No new roads, place names,
  distances, depths, times, or agencies.
- Never contradict or soften a number. Copy them exactly.
- If the model answer says something is unreachable, say so plainly. Do not
  offer false hope.
- Two or three short sentences. No headings, no bullet lists, no markdown, no
  sign-off.
- If the model answer is a prompt for clarification, just ask for that
  clarification naturally.`;

/**
 * Rephrases a grounded answer. Resolves to `null` whenever the LLM is not
 * available for any reason — no key, network down, timeout, bad response —
 * which the caller reads as "keep showing the grounded text".
 */
export async function enhance(
  question: string,
  groundedAnswer: string,
  situation: string,
): Promise<string | null> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose: "chat",
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content:
              `Current situation: ${situation}\n\n` +
              `Question asked: ${question}\n\n` +
              `Model answer to deliver: ${groundedAnswer}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: unknown = data?.text;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}
