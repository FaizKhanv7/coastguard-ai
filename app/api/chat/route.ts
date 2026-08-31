/**
 * ============================================================================
 * Chatbot proxy
 * ============================================================================
 * One server-side route so the Groq key lives in exactly one place — the
 * `GROQ_API_KEY` line in `.env.local` — and never reaches a browser.
 *
 * Both surfaces post here:
 *   • the website assistant  (`app/assistant/page.tsx`)
 *   • the field app          (`coastguard-ai.html`, served as `/mobile.html`)
 *
 * Both are built to work without it. If the key is absent this route answers
 * 503 with `{ error: "no_key" }` rather than throwing, and each caller falls
 * back to what it can compute locally — the grounded flood-model answer on the
 * website, canned safety advice in the field app. A missing key degrades the
 * assistant; it never breaks the page.
 * ============================================================================
 */

import { NextResponse } from "next/server";

/** Node runtime: `process.env` secrets are not available to the edge bundle. */
export const runtime = "nodejs";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";
const VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b";

/**
 * The route is reachable by anything on the origin, including the static field
 * app, so callers pick a *purpose* rather than an arbitrary model string. That
 * keeps it from becoming an open proxy to any model on the account.
 */
const MODELS: Record<string, string> = {
  chat: CHAT_MODEL,
  vision: VISION_MODEL,
};

interface ChatRequest {
  messages?: unknown;
  purpose?: string;
  /** Passed through for the vision call, which needs strict JSON back. */
  jsonMode?: boolean;
  temperature?: number;
}

/** Cheap capability probe — lets a client decide whether to bother asking. */
export function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.GROQ_API_KEY),
    models: { chat: CHAT_MODEL, vision: VISION_MODEL },
  });
}

export async function POST(request: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "no_key",
        message:
          "No GROQ_API_KEY is set. Add it to .env.local and restart the dev server.",
      },
      { status: 503 },
    );
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Body must be JSON." },
      { status: 400 },
    );
  }

  const { messages, purpose = "chat", jsonMode, temperature } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "bad_request", message: "`messages` must be a non-empty array." },
      { status: 400 },
    );
  }

  const model = MODELS[purpose];
  if (!model) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: `Unknown purpose "${purpose}". Use "chat" or "vision".`,
      },
      { status: 400 },
    );
  }

  // A flood response cannot sit on a hung socket. Better a fast fallback to
  // the grounded answer than a spinner nobody can cancel.
  const abort = AbortSignal.timeout(20_000);

  try {
    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        ...(typeof temperature === "number" ? { temperature } : {}),
      }),
      signal: abort,
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      // Surface the status but not the upstream error body, which can echo
      // request headers back.
      return NextResponse.json(
        {
          error: "upstream",
          status: upstream.status,
          message: `The model provider returned ${upstream.status}.`,
        },
        { status: 502 },
      );
    }

    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) {
      return NextResponse.json(
        { error: "empty", message: "The model returned no content." },
        { status: 502 },
      );
    }

    return NextResponse.json({ text, model });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json(
      {
        error: timedOut ? "timeout" : "network",
        message: timedOut
          ? "The model did not answer within 20 seconds."
          : "Could not reach the model provider.",
      },
      { status: 504 },
    );
  }
}
