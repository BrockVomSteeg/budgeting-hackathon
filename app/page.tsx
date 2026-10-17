"use client";

import { useRef, useState } from "react";
import { BudgetMeters } from "@/components/BudgetMeters";
import { LiveCall } from "@/components/LiveCall";
import { PersonaPicker } from "@/components/PersonaPicker";
import { VerdictCard } from "@/components/VerdictCard";
import { demoBudget } from "@/data/budget";
import { personas } from "@/lib/personas";
import type { AskResponse, PersonaId, Turn } from "@/lib/types";
import { LIMITS } from "@/lib/types";
import { listen, speak, stopSpeaking, sttSupported, unlockAudio } from "@/lib/voice";

type Status = "idle" | "listening" | "thinking" | "speaking";

export default function Home() {
  const [persona, setPersona] = useState<PersonaId>("sergeant");
  const [status, setStatus] = useState<Status>("idle");
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [spokenBy, setSpokenBy] = useState<PersonaId>("sergeant");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"live" | "tap">("tap");
  const history = useRef<Turn[]>([]);
  const stop = useRef<() => void>(() => {});

  async function ask(text: string) {
    if (!text) {
      setError("Didn't catch that. Try again.");
      return setStatus("idle");
    }
    setError("");
    setHeard(text);
    setStatus("thinking");
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, persona, history: history.current }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!r.ok) throw new Error(r.status === 429 ? "Too fast. Breathe." : "Something broke.");
      const a: AskResponse = await r.json();
      setAnswer(a);
      setSpokenBy(persona);
      history.current = [
        ...history.current,
        { role: "user" as const, text },
        { role: "assistant" as const, text: a.line },
      ].slice(-LIMITS.historyMax);
      setStatus("speaking");
      await speak(a.line, personas[persona], a.sig);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something broke.");
    }
    setStatus("idle");
  }

  async function onReplay() {
    if (!answer?.line || status !== "idle") return;
    unlockAudio();
    setStatus("speaking");
    await speak(answer.line, personas[spokenBy], answer.sig);
    setStatus("idle");
  }

  function onMic() {
    unlockAudio();
    if (status === "listening") return stop.current();
    if (status === "speaking") return stopSpeaking();
    if (status !== "idle") return;
    if (!sttSupported()) return setError("Voice not supported here. Type below.");
    setHeard("");
    setStatus("listening");
    stop.current = listen(setHeard, ask, (e) => {
      setError(e);
      setStatus("idle");
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    unlockAudio();
    const t = typed.trim().slice(0, LIMITS.textMax);
    if (status !== "idle") return;
    setTyped("");
    ask(t);
  }

  // The live ElevenLabs agent can only speak ElevenLabs voices, so Fish personas run in tap mode.
  const tapOnly = Boolean(personas[persona].fishVoiceId);
  const view = tapOnly ? "tap" : mode;
  const micLabel = { idle: "Tap & ask", listening: "Listening… tap to send", thinking: "Thinking…", speaking: "Talking… tap to skip" }[status];

  return (
    <main className="app">
      <header>
        <h1>Can I Afford It? 💸</h1>
        <p className="sub">Ask out loud. Get the truth. Maybe get roasted.</p>
      </header>

      <PersonaPicker
        value={persona}
        onChange={(p) => {
          // Fresh history per character, so one persona's style (or swearing) doesn't leak into another.
          history.current = [];
          setPersona(p);
        }}
      />

      {view === "live" ? (
        <LiveCall
          persona={persona}
          onVerdict={setAnswer}
          onUnavailable={() => {
            setMode("tap");
            setError("Live call isn't set up yet. Using tap-to-ask.");
          }}
        />
      ) : (
      <button
        className={`mic mic-${status}`}
        onClick={onMic}
        disabled={status === "thinking"}
        aria-label={micLabel}
      >
        <span className="mic-icon">{status === "listening" ? "👂" : status === "thinking" ? "🧠" : status === "speaking" ? "🔊" : "🎙️"}</span>
        <span className="mic-label">{micLabel}</span>
      </button>
      )}

      {heard && <p className="heard">“{heard}”</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {answer && (
        <VerdictCard
          answer={answer}
          onReplay={view === "tap" && answer.line ? onReplay : undefined}
          replayDisabled={status !== "idle"}
        />
      )}

      <BudgetMeters budget={demoBudget} />

      <form className="type" onSubmit={onSubmit}>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          maxLength={LIMITS.textMax}
          placeholder="Or type: can I afford a $400 jacket?"
          aria-label="Type your question"
        />
        <button type="submit" disabled={!typed.trim() || status !== "idle"}>Ask</button>
      </form>

      {tapOnly ? (
        <p className="source">🎙️ {personas[persona].name} talks in tap-to-ask mode</p>
      ) : (
        <button className="mode-switch" onClick={() => setMode(mode === "live" ? "tap" : "live")}>
          {mode === "live" ? "Back to tap-to-ask" : "Try live call (beta)"}
        </button>
      )}

      {answer && view === "tap" && <p className="source">{answer.source === "claude" ? "⚡ live AI" : "🧪 mock mode"}</p>}
    </main>
  );
}
