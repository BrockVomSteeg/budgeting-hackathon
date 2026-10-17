"use client";

import { useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { agentVariables, checkAffordability, recordPurchase } from "@/lib/agent";
import { personas } from "@/lib/personas";
import type { AskResponse, Budget, PersonaId } from "@/lib/types";

interface Props {
  persona: PersonaId;
  /** The user's current budget (toBudget(ledger)); purchases logged mid-call show up in the next tool call. */
  budget: Budget;
  /** Every tool result. purchased: true means log it (addTxn), like an /api/ask answer. */
  onVerdict: (a: AskResponse) => void;
  onUnavailable: () => void;
}

export function LiveCall(props: Props) {
  return (
    <ConversationProvider>
      <Call {...props} />
    </ConversationProvider>
  );
}

function Call({ persona, budget, onVerdict, onUnavailable }: Props) {
  // Tools read the latest budget, not the one from when the call started.
  const budgetRef = useRef(budget);
  useEffect(() => {
    budgetRef.current = budget;
  }, [budget]);
  const [lines, setLines] = useState<{ who: "you" | "agent"; text: string }[]>([]);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const conv = useConversation({
    clientTools: {
      check_affordability: (params) => {
        const r = checkAffordability(budgetRef.current, params);
        if (r.answer) onVerdict(r.answer);
        return r.text;
      },
      record_purchase: (params) => {
        const r = recordPurchase(budgetRef.current, params);
        if (r.answer) onVerdict(r.answer);
        return r.text;
      },
    },
    onMessage: (m) =>
      setLines((l) => [...l, { who: m.source === "user" ? "you" : "agent", text: m.message } as const].slice(-4)),
    onError: (msg) => setError(String(msg)),
  });

  const live = conv.status === "connected";

  async function start() {
    setError("");
    setStarting(true);
    try {
      // Ask for the mic inside the tap so iOS shows the prompt.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      const r = await fetch("/api/agent-token", { cache: "no-store" });
      if (r.status !== 200) return onUnavailable();
      const { token, voiceOverride } = (await r.json()) as { token: string; voiceOverride: boolean };
      const p = personas[persona];
      setLines([]);
      conv.startSession({
        conversationToken: token,
        connectionType: "webrtc",
        dynamicVariables: agentVariables(budgetRef.current, p),
        ...(voiceOverride ? { overrides: { tts: { voiceId: p.voiceId } } } : {}),
      });
    } catch {
      setError("Mic blocked. Allow microphone access and try again.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="live">
      <button
        className={`mic ${live ? (conv.isSpeaking ? "mic-speaking" : "mic-listening") : ""}`}
        onClick={live ? () => conv.endSession() : start}
        disabled={starting || conv.status === "connecting"}
      >
        <span className="mic-icon">{live ? (conv.isSpeaking ? "🔊" : "👂") : "📞"}</span>
        <span className="mic-label">
          {live ? "Live · tap to hang up" : conv.status === "connecting" || starting ? "Connecting…" : "Start live call"}
        </span>
      </button>
      {error && <p className="error" role="alert">{error}</p>}
      {lines.length > 0 && (
        <ul className="transcript" aria-live="polite">
          {lines.map((l, i) => (
            <li key={i} className={`t-${l.who}`}>{l.text}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
