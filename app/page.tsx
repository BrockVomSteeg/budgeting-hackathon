"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChefAvatar, type Status } from "@/components/ChefAvatar";
import { BudgetMeters } from "@/components/BudgetMeters";
import { AddSheet, CategorySheet, ChatSheet, SettingsSheet, TxnSheet, type ChatMsg } from "@/components/Sheets";
import { Categories } from "@/components/tabs/Categories";
import { Dashboard } from "@/components/tabs/Dashboard";
import { Recurrings } from "@/components/tabs/Recurrings";
import { Transactions } from "@/components/tabs/Transactions";
import { TAB_LABEL, TABS, type Tab } from "@/components/tabs/types";
import { Icon } from "@/components/ui";
import { useLedger } from "@/components/useLedger";
import { demoLedger } from "@/data/budget";
import { addTxn, deleteTxn, logPurchase, markAllReviewed, nextLastItem, setLimit, toBudget, togglePaid, updateTxn } from "@/lib/ledger";
import { dbg, onDebug } from "@/lib/debug";
import { GORDON } from "@/lib/personas";
import { recorderSupported, startRecording, transcribe } from "@/lib/record";
import type { AskResponse, CategoryId, LastItem } from "@/lib/types";
import { LIMITS } from "@/lib/types";
import { listen, playFiller, preloadFillers, primeAudio, setSpeakerMode, speak, startAnswer, stopSpeaking, sttSupported, unlockAudio } from "@/lib/voice";

const GREETING = "Right. What are we buying? Tap me and ask, and it better not be RAW.";

// The ledger lives in localStorage, so render the app on the client only (no hydration mismatch).
const subscribe = () => () => {};
export default function Page() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? <App /> : <main className="app" />;
}

type Open =
  | { kind: "txn"; id: string }
  | { kind: "category"; id: CategoryId }
  | { kind: "add" }
  | { kind: "chat" }
  | { kind: "settings" }
  | null;

function App() {
  const [ledger, setLedger] = useLedger();
  const [tab, setTabState] = useState<Tab>(() => {
    const h = window.location.hash.slice(1) as Tab;
    return TABS.includes(h) ? h : "dashboard";
  });
  const [status, setStatus] = useState<Status>("idle");
  const [heard, setHeard] = useState("");
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  // What Gordon has said of the answer being streamed, shown until the full answer arrives.
  const [live, setLive] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [last, setLast] = useState<LastItem | null>(null); // what "ok, go for it" refers to
  const [open, setOpen] = useState<Open>(null);
  const [compact, setCompact] = useState(false);
  const [speaker, setSpeaker] = useState(() => localStorage.getItem("ciai-speaker") !== "off");
  const stop = useRef<() => void>(() => {});
  const serverStt = useRef(true); // flips off if /api/transcribe says it isn't configured
  const [debugLines, setDebugLines] = useState<string[]>([]);

  // ?debug in the URL shows a live log of mic and audio events.
  // Safety net for the stage: if Gordon is stuck listening, thinking or talking, reset so the next tap works.
  useEffect(() => {
    if (status === "idle") return;
    const limit = { listening: 15_000, thinking: 35_000, speaking: 45_000 }[status];
    const t = setTimeout(() => {
      dbg(`watchdog: stuck in ${status} for ${limit / 1000}s, resetting`);
      stopSpeaking();
      if (status === "listening") stop.current();
      setStatus("idle");
      setError("Sorry, that got stuck. Tap Gordon to ask again.");
    }, limit);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    onDebug((line) => setDebugLines((l) => [...l, line].slice(-25)));
    dbg(`debug on: ${navigator.userAgent}`);
    return () => onDebug(null);
  }, []);

  useEffect(() => {
    setSpeakerMode(speaker);
    localStorage.setItem("ciai-speaker", speaker ? "on" : "off");
  }, [speaker]);

  // Warm the server so the first question doesn't wait for a cold start.
  useEffect(() => {
    for (const path of ["/api/ask", "/api/transcribe", "/api/speak"]) fetch(path, { cache: "no-store" }).catch(() => {});
    // Free mode (paid APIs off): skip server speech-to-text so the first tap uses the phone's own recognizer.
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((h: { paidApis?: boolean; fishKey?: boolean }) => {
        if (!h.paidApis || !h.fishKey) serverStt.current = false;
      })
      .catch(() => {});
    preloadFillers();
  }, []);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const setTab = (t: Tab) => {
    setTabState(t);
    history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0 });
  };
  const close = useCallback(() => setOpen(null), []);

  async function ask(text: string) {
    dbg(`ask: "${text}"`);
    if (!text) {
      setError("Didn't catch that. Try again.");
      return setStatus("idle");
    }
    setError("");
    setHeard(text);
    setStatus("thinking");
    setAnswer(null); // the bubble mustn't show the previous answer while he speaks this one
    setLive("");
    playFiller(); // "Right, let me have a look…" while Claude thinks
    const prior = messages.slice(-LIMITS.historyMax).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text }]);
    const voice = startAnswer(GORDON);
    try {
      // Streamed: "say" chunks arrive as soon as each part of the line is written, then "done".
      const r = await fetch("/api/ask?stream=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, persona: GORDON.id, history: prior, budget: toBudget(ledger), last }),
        signal: AbortSignal.timeout(30_000),
      });
      dbg(`ask: HTTP ${r.status}`);
      if (!r.ok || !r.body) throw new Error(r.status === 429 ? "Too fast. Breathe." : "Something broke.");
      let a: AskResponse | null = null;
      const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const ev = JSON.parse(buf.slice(0, nl)) as { t: "say"; text: string; sig: string } | ({ t: "done" } & AskResponse);
          buf = buf.slice(nl + 1);
          if (ev.t === "say") {
            dbg(`ask: say "${ev.text}"`);
            voice.say(ev.text, ev.sig);
            setLive((l) => (l ? `${l} ${ev.text}` : ev.text));
            setStatus("speaking");
          } else {
            a = ev; // the full answer (the extra "t" field is harmless)
          }
        }
      }
      if (!a) throw new Error("Something broke.");
      const done = a;
      setAnswer(done);
      setLedger((l) => logPurchase(l, done)); // "go for it": the purchase lands in the budget, and in every later answer
      setLast((prev) => nextLastItem(prev, done));
      setHeard("");
      setMessages((m) => [...m, { role: "assistant", text: done.line, verdict: done.verdict }]);
      setStatus("speaking");
      await voice.end();
    } catch (e) {
      voice.cancel();
      dbg(`ask: failed ${e instanceof Error ? e.message : e}`);
      setError(e instanceof Error ? e.message : "Something broke.");
    }
    dbg("ask: back to idle");
    setStatus("idle");
  }

  async function replay() {
    if (!answer?.line || status !== "idle") return;
    unlockAudio();
    setStatus("speaking");
    await speak(answer.line, GORDON, answer.sig);
    setStatus("idle");
  }

  function onGordon() {
    dbg(`tap: status=${status}`);
    unlockAudio();
    if (status === "listening") {
      primeAudio(); // this tap is the gesture that lets the answer play out loud
      return stop.current();
    }
    if (status === "speaking") return stopSpeaking();
    if (status !== "idle") return;
    setHeard("");
    setError("");
    if (serverStt.current && recorderSupported()) return void recordQuestion();
    dbg(`using built-in recognizer (supported=${sttSupported()})`);
    if (!sttSupported()) return setOpen({ kind: "chat" });
    setStatus("listening");
    stop.current = listen(setHeard, ask, (e) => {
      setError(e);
      setStatus("idle");
    });
  }

  // Record -> server speech-to-text -> ask. Sends by itself when you stop talking (or tap, or 10s).
  async function recordQuestion() {
    setStatus("listening");
    let sent = false;
    let finish: (() => Promise<Blob>) | null = null;
    const done = async () => {
      if (sent || !finish) return;
      sent = true;
      setStatus("thinking");
      try {
        const text = await transcribe(await finish());
        if (text === null) {
          dbg("server speech-to-text not configured, switching to built-in recognizer");
          serverStt.current = false;
          setError("Tap Gordon again.");
          return setStatus("idle");
        }
        await ask(text);
      } catch (e) {
        dbg(`record: failed ${e instanceof Error ? `${e.name} ${e.message}` : e}`);
        setError("Didn't catch that. Try again, or type in the chat.");
        setStatus("idle");
      }
    };
    stop.current = () => void done();
    try {
      finish = await startRecording(() => void done());
    } catch (e) {
      dbg(`recorder: mic failed ${e instanceof Error ? `${e.name} ${e.message}` : e}`);
      const denied = e instanceof Error && e.name === "NotAllowedError";
      setError(denied ? "Mic blocked. iPhone: Settings › Safari › Microphone › Allow, then reload." : "Mic was busy. Tap Gordon again.");
      setStatus("idle");
    }
  }

  function send(text: string) {
    unlockAudio();
    if (status !== "idle") return;
    ask(text);
  }

  const label = { idle: "Tap to ask Gordon", listening: "Listening… just stop talking", thinking: "Thinking…", speaking: "Tap to skip" }[status];
  const mood = status !== "listening" && status !== "thinking" && answer?.verdict === "yes" ? "happy" : "angry";
  const bubble =
    status === "listening" ? heard || "I'm listening…" : status === "thinking" ? "…" : error || answer?.line || live || GREETING;
  const showBubble = !compact || status !== "idle";

  return (
    <main className="app">
      <header className={`top ${compact ? "compact" : ""}`}>
        <div className="top-row">
          <button className="icon-btn" onClick={() => setOpen({ kind: "settings" })} aria-label="Settings">
            {Icon.gear}
          </button>
          <ChefAvatar src={GORDON.avatar!} status={status} mood={mood} label={label} onClick={onGordon} disabled={status === "thinking"} />
          <button className="icon-btn" onClick={() => setOpen({ kind: "chat" })} aria-label="Chat with Gordon">
            {Icon.chat}
          </button>
        </div>
        {showBubble && (
          <button className={`bubble ${error ? "err" : ""} ${status === "thinking" ? "typing" : ""}`} onClick={() => setOpen({ kind: "chat" })} aria-live="polite">
            {answer && status === "idle" && !error && answer.verdict !== "info" && (
              <span className={`verdict v-${answer.verdict}`}>{answer.purchased ? "LOGGED" : { yes: "YES", no: "NOPE", tight: "TIGHT" }[answer.verdict]}
                {(answer.purchased || answer.priceEstimated) && answer.amount !== null &&
                  ` · $${answer.amount.toLocaleString("en-US")}${answer.priceEstimated ? " (est.)" : ""}`}
              </span>
            )}
            <span className="bubble-text">{status === "listening" && heard ? `“${bubble}”` : bubble}</span>
          </button>
        )}
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t} className={t === tab ? "tab on" : "tab"} onClick={() => setTab(t)} aria-current={t === tab ? "page" : undefined}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </nav>
      </header>

      <div className="content">
        {debugLines.length > 0 && <pre className="debug-log">{debugLines.join("\n")}</pre>}
        {tab === "dashboard" && (
          <Dashboard
            ledger={ledger}
            go={setTab}
            onReviewAll={() => setLedger(markAllReviewed)}
            onOpenTxn={(id) => setOpen({ kind: "txn", id })}
          />
        )}
        {tab === "categories" && <Categories ledger={ledger} onOpen={(id) => setOpen({ kind: "category", id })} />}
        {tab === "transactions" && (
          <Transactions ledger={ledger} onOpen={(id) => setOpen({ kind: "txn", id })} onAdd={() => setOpen({ kind: "add" })} />
        )}
        {tab === "recurrings" && <Recurrings ledger={ledger} onToggle={(id) => setLedger((l) => togglePaid(l, id))} />}
        {tab === "plan" && <BudgetMeters budget={toBudget(ledger)} />}
      </div>

      {open?.kind === "txn" && (
        <TxnSheet
          ledger={ledger}
          id={open.id}
          onClose={close}
          onCategory={(category) => setLedger((l) => updateTxn(l, open.id, { category }))}
          onReviewed={(reviewed) => setLedger((l) => updateTxn(l, open.id, { reviewed }))}
          onDelete={() => {
            setLedger((l) => deleteTxn(l, open.id));
            close();
          }}
        />
      )}
      {open?.kind === "category" && (
        <CategorySheet
          key={open.id}
          ledger={ledger}
          id={open.id}
          onClose={close}
          onLimit={(n) => setLedger((l) => setLimit(l, open.id, n))}
          onOpenTxn={(id) => setOpen({ kind: "txn", id })}
        />
      )}
      {open?.kind === "add" && (
        <AddSheet
          ledger={ledger}
          onClose={close}
          onAdd={(t) => {
            setLedger((l) => addTxn(l, t));
            close();
          }}
          onAsk={(q) => {
            close();
            send(q);
          }}
        />
      )}
      {open?.kind === "chat" && (
        <ChatSheet messages={messages} busy={status !== "idle"} onClose={close} onSend={send} onReplay={answer?.line ? replay : undefined} />
      )}
      {open?.kind === "settings" && (
        <SettingsSheet
          speaker={speaker}
          onSpeaker={setSpeaker}
          onReset={() => {
            setLedger(demoLedger);
            setMessages([]);
            setAnswer(null);
            setLast(null);
            close();
          }}
          onClose={close}
        />
      )}
    </main>
  );
}
