"use client";

import { useRef, useState } from "react";
import { PersonaPicker } from "@/components/PersonaPicker";
import { VerdictCard } from "@/components/VerdictCard";
import { personas } from "@/lib/personas";
import type { AskResponse, PersonaId, Turn } from "@/lib/types";
import { LIMITS } from "@/lib/types";
import { listen, speak, sttSupported, unlockAudio } from "@/lib/voice";

type Status = "idle" | "listening" | "thinking" | "speaking";

export default function Home() {
  const [persona, setPersona] = useState<PersonaId>("sergeant");
  const [status, setStatus] = useState<Status>("idle");
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [error, setError] = useState("");
  const history = useRef<Turn[]>([]);
  const stop = useRef<() => void>(() => {});

  async function ask(text: string) {
    if (!text) return setStatus("idle");
    setError("");
    setHeard(text);
    setStatus("thinking");
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, persona, history: history.current }),
      });
      if (!r.ok) throw new Error(r.status === 429 ? "Too fast. Breathe." : "Something broke.");
      const a: AskResponse = await r.json();
      setAnswer(a);
      history.current = [
        ...history.current,
        { role: "user" as const, text },
        { role: "assistant" as const, text: a.line },
      ].slice(-LIMITS.historyMax);
      setStatus("speaking");
      await speak(a.line, personas[persona]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something broke.");
    }
    setStatus("idle");
  }

  function onMic() {
    unlockAudio();
    if (status === "listening") return stop.current();
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
    setTyped("");
    if (status === "idle") ask(t);
  }

  const micLabel = { idle: "Tap & ask", listening: "Listening… tap to send", thinking: "Thinking…", speaking: "Talking…" }[status];

  return (
    <main className="app">
      <header>
        <h1>Can I Afford It? 💸</h1>
        <p className="sub">Ask out loud. Get the truth. Maybe get roasted.</p>
      </header>

      <PersonaPicker value={persona} onChange={setPersona} />

      <button
        className={`mic mic-${status}`}
        onClick={onMic}
        disabled={status === "thinking" || status === "speaking"}
        aria-label={micLabel}
      >
        <span className="mic-icon">{status === "listening" ? "👂" : status === "thinking" ? "🧠" : status === "speaking" ? "🔊" : "🎙️"}</span>
        <span className="mic-label">{micLabel}</span>
      </button>

      {heard && <p className="heard">“{heard}”</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {answer && <VerdictCard answer={answer} />}

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

      {answer && <p className="source">{answer.source === "claude" ? "⚡ live AI" : "🧪 mock mode"}</p>}
    </main>
  );
}
