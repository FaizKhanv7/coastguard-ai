"use client";

/**
 * The assistant, grounded in the live model.
 *
 * Every answer names what it came from, because an operations tool that says
 * something confident with no provenance is worse than one that says nothing.
 *
 * The flood model and the router answer first, always. If a Groq key is
 * configured in `.env.local`, that grounded answer is then handed to the LLM
 * to be said more naturally — the model rephrases, it never sources. With no
 * key, no network, or a slow provider, the grounded text is simply what you
 * see, so the page works identically in a blackout.
 */

import { useEffect, useRef, useState } from "react";
import { useCoastguard } from "@/lib/store";
import { ask, SUGGESTIONS, type Answer } from "@/lib/assistant";
import { chatConfig, enhance } from "@/lib/chat";
import { formatClock } from "@/lib/engine";
import { Card, Pill, SectionTitle } from "@/components/ui";

interface Turn {
  id: number;
  question: string;
  answer: Answer;
  /** Set once the LLM has rephrased the grounded text above. */
  phrased?: string;
  pending?: boolean;
}

export default function AssistantPage() {
  const s = useCoastguard();
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [llmReady, setLlmReady] = useState(false);
  const nextId = useRef(1);

  // One probe on mount tells us whether a key is configured, so the badge and
  // the per-turn loading state are honest rather than optimistic.
  useEffect(() => {
    let alive = true;
    chatConfig().then((c) => {
      if (alive) setLlmReady(c.configured);
    });
    return () => {
      alive = false;
    };
  }, []);

  const send = (question: string) => {
    const q = question.trim();
    if (!q) return;

    const answer = ask(q, {
      step: s.step,
      horizonH: s.horizon,
      mode: s.mode,
      originNodeId: s.originNodeId,
    });
    const id = nextId.current++;
    setTurns((prev) => [...prev, { id, question: q, answer, pending: llmReady }]);
    setInput("");

    if (!llmReady) return;

    const situation =
      `${formatClock(s.step)}${s.horizon > 0 ? `, forecast +${s.horizon} h` : ""}, ` +
      `water ${s.status.waterLevelM.toFixed(2)} m, ` +
      `${s.status.blockedCount} of ${s.status.totalSegments} road segments impassable, ` +
      `routing in ${s.mode} mode.`;

    enhance(q, answer.text, situation).then((phrased) => {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, phrased: phrased ?? undefined, pending: false }
            : t,
        ),
      );
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="flex min-h-[60vh] flex-col">
        <SectionTitle
          action={
            <Pill tone={llmReady ? "blue" : "teal"}>
              {llmReady ? "Model connected" : "Offline capable"}
            </Pill>
          }
        >
          Disaster assistant
        </SectionTitle>

        <div
          className="flex-1 space-y-3 overflow-y-auto py-2"
          aria-live="polite"
          aria-atomic="false"
        >
          {turns.length === 0 && (
            <div className="rounded-[16px] bg-sand p-4">
              <p className="text-[13px] leading-relaxed text-ink">
                I answer from the flood model and the router that are running
                right now — not from general advice. Ask me about this town at{" "}
                <strong>{formatClock(s.step)}</strong>.
              </p>
            </div>
          )}

          {turns.map((t) => (
            <div key={t.id} className="space-y-2">
              <div className="ml-auto max-w-[80%] rounded-[16px] rounded-br-[4px] bg-navy px-3.5 py-2.5 text-[13px] font-medium text-white">
                {t.question}
              </div>
              <div className="max-w-[88%] rounded-[16px] rounded-bl-[4px] bg-sand px-3.5 py-2.5">
                <p className="text-[13px] leading-relaxed text-ink">
                  {t.phrased ?? t.answer.text}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 border-t border-sand-dim pt-1.5 text-[10.5px] font-semibold text-ink-soft">
                  <span>Source: {t.answer.basis}</span>
                  {t.pending && <span className="opacity-70">· phrasing…</span>}
                  {t.phrased && (
                    <span className="opacity-70">· phrased by Groq</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="no-scrollbar mb-2.5 flex gap-2 overflow-x-auto pt-2">
          {SUGGESTIONS.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => send(sug)}
              className="flex-shrink-0 rounded-chip border border-sand-dim bg-card px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft hover:text-navy"
            >
              {sug}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <label className="sr-only" htmlFor="assistant-input">
            Ask the assistant
          </label>
          <input
            id="assistant-input"
            className="flex-1 rounded-[14px] border border-sand-dim bg-sand px-3.5 py-3 text-[13px] font-medium text-navy"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Can I still reach the hospital?"
          />
          <button
            type="submit"
            className="rounded-[14px] bg-navy px-5 py-3 text-[13px] font-bold text-white hover:opacity-90"
          >
            Ask
          </button>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <SectionTitle>Where the answer comes from</SectionTitle>
          <p className="text-[12px] leading-relaxed text-ink-soft">
            The facts are never the language model&rsquo;s. Questions are
            matched to what the engine can actually answer — a route, a water
            depth, a shelter recommendation — and the numbers come out of that
            result. It cannot invent a road that does not exist.
          </p>
          <p className="mt-2.5 text-[12px] leading-relaxed text-ink-soft">
            {llmReady ? (
              <>
                A hosted model is connected, so it takes that grounded answer
                and delivers it in plain language. Strip the network away and
                the engine&rsquo;s own wording is what you read — the same
                facts, more clipped.
              </>
            ) : (
              <>
                No model key is configured, so you are reading the
                engine&rsquo;s own wording. Add{" "}
                <code className="rounded bg-sand px-1 py-0.5 text-[11px] text-navy">
                  GROQ_API_KEY
                </code>{" "}
                to <code className="text-[11px] text-navy">.env.local</code> and
                restart to have answers phrased conversationally. Every number
                stays the engine&rsquo;s either way.
              </>
            )}
          </p>
        </Card>

        <Card>
          <SectionTitle>It answers about this moment</SectionTitle>
          <p className="text-[12px] leading-relaxed text-ink-soft">
            Answers are computed against the timeline position shared across
            the whole app — currently{" "}
            <strong className="text-navy">{formatClock(s.step)}</strong>
            {s.horizon > 0 ? `, forecast +${s.horizon} h` : ""}. Scrub the
            timeline on the map and ask again; the answer changes.
          </p>
        </Card>
      </div>
    </div>
  );
}
