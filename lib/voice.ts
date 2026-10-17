"use client";

import type { Persona } from "./types";
import { dbg } from "./debug.ts";

// Minimal Web Speech API typings (not in lib.dom for all TS versions).
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onaudioend?: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Ctor = new () => SpeechRecognitionLike;

export function sttSupported(): boolean {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

const MIC_ERRORS: Record<string, string> = {
  "not-allowed": "Mic blocked. Allow microphone access, or type below.",
  "service-not-allowed": "Speech recognition is off on this device. Type below.",
  "audio-capture": "No microphone found. Type below.",
  network: "Speech service unreachable. Type below.",
};

let cancelListening: (() => void) | null = null;

/** Starts listening. Calls onText with the live transcript, then exactly one of onDone (final text) or onError. */
export function listen(onText: (t: string) => void, onDone: (t: string) => void, onError: (e: string) => void) {
  const SR = (window.SpeechRecognition || window.webkitSpeechRecognition) as Ctor | undefined;
  if (!SR) {
    onError("Voice not supported here. Type instead.");
    return () => {};
  }
  // Drop any earlier attempt. Don't touch audio here: changing it right as the mic starts can stop the mic starting.
  cancelListening?.();

  const rec = new SR();
  dbg(`recognizer: new (speaking=${"speechSynthesis" in window && window.speechSynthesis.speaking})`);
  for (const ev of ["start", "audiostart", "speechstart", "speechend", "audioend"] as const) {
    rec[`on${ev}`] = () => dbg(`recognizer: ${ev}`);
  }
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  let text = "";
  let failure = "";
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    clearTimeout(watchdog);
    dbg(`recognizer: done text="${text.trim()}"${failure ? ` failure="${failure}"` : ""}`);
    if (cancelListening === cancel) cancelListening = null;
    if (failure && !text.trim()) onError(failure);
    else onDone(text.trim());
  };
  // Drops this attempt without calling back, so it can't reset a newer one.
  const cancel = () => {
    settled = true;
    clearTimeout(watchdog);
    rec.abort();
  };
  rec.onresult = (e) => {
    text = Array.from(e.results).map((r) => r[0].transcript).join(" ");
    dbg(`recognizer: result "${text}"`);
    onText(text);
  };
  rec.onerror = (e) => {
    dbg(`recognizer: error ${e.error}`);
    if (e.error !== "no-speech" && e.error !== "aborted") failure = MIC_ERRORS[e.error] ?? `Mic error: ${e.error}. Try again.`;
    setTimeout(settle, 1000); // iOS sometimes never fires onend after an error
  };
  rec.onend = () => {
    dbg("recognizer: end");
    settle();
  };
  const watchdog = setTimeout(() => {
    dbg("recognizer: 12s watchdog");
    rec.stop();
    setTimeout(settle, 1000); // iOS sometimes never fires onend
  }, 12_000);
  cancelListening = cancel;
  try {
    rec.start();
  } catch (err) {
    dbg(`recognizer: start() threw ${err instanceof Error ? err.name : err}`);
    failure = "Mic busy, try again.";
    settle();
  }
  return () => {
    rec.stop();
    setTimeout(settle, 1500);
  };
}

// One <audio> element, started inside a tap so iOS lets us play it again later without a gesture.
let player: HTMLAudioElement | null = null;
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

function setAudioSession(type: "playback" | "auto") {
  // Safari 17+. "playback" plays through the silent switch but blocks the mic, so it's only on while talking.
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) nav.audioSession.type = type;
  dbg(`audio session -> ${type}${nav.audioSession ? "" : " (not supported)"}`);
}

let unlocked = false;

/** Call inside a tap handler so iOS lets us play audio later. Only the first tap needs it. */
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  player ??= new Audio();
  player.src = SILENCE;
  dbg("unlock audio");
  player.play().catch((err) => {
    dbg(`unlock: play() rejected ${err instanceof Error ? err.name : err}`);
    unlocked = false; // retry on the next tap
  });
  if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
}

let cancelSpeech: (() => void) | null = null;

/** Cuts off the current answer, if one is playing. */
export function stopSpeaking() {
  cancelSpeech?.();
}

/** Streams audio from url. Resolves true if anything played, false if it never started (204, error). */
function playStream(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const a = (player ??= new Audio());
    let started = false;
    const done = (ok: boolean) => {
      dbg(`voice audio: done played=${ok}`);
      cancelSpeech = null;
      a.onplaying = a.onended = a.onerror = null;
      clearTimeout(timer);
      resolve(ok);
    };
    // 8s to start (204 or stalled stream -> browser voice); once playing, a 60s safety cap.
    let timer = setTimeout(() => {
      dbg("voice audio: no start after 8s");
      a.pause();
      done(started);
    }, 8_000);
    a.onplaying = () => {
      dbg("voice audio: playing");
      started = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        a.pause();
        done(true);
      }, 60_000);
    };
    a.onended = () => {
      dbg("voice audio: ended");
      done(true);
    };
    a.onerror = () => {
      dbg(`voice audio: error code=${a.error?.code}`);
      done(started);
    };
    cancelSpeech = () => {
      dbg("voice audio: skipped");
      a.pause();
      done(true);
    };
    a.src = url;
    a.play().catch((err) => {
      dbg(`voice audio: play() rejected ${err instanceof Error ? err.name : err}`);
      done(started);
    });
  });
}

const withTimeout = (p: Promise<void>, ms = 20_000) =>
  Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);

function browserSpeak(text: string, p: Persona): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = p.browserVoice.pitch;
    u.rate = p.browserVoice.rate;
    const done = () => {
      cancelSpeech = null;
      resolve();
    };
    u.onstart = () => dbg("browser voice: start");
    u.onend = () => {
      dbg("browser voice: end");
      done();
    };
    u.onerror = (e) => {
      dbg(`browser voice: error ${e.error}`);
      done();
    };
    cancelSpeech = () => {
      window.speechSynthesis.cancel();
      done();
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}

/** Fish Audio or ElevenLabs streamed via our server; falls back to the browser voice. */
export async function speak(text: string, p: Persona, sig?: string): Promise<void> {
  setAudioSession("playback");
  try {
    const url = `/api/speak?${new URLSearchParams({ text, persona: p.id, sig: sig ?? "" })}`;
    if (await playStream(url)) return;
    dbg("browser voice: fallback");
    await withTimeout(browserSpeak(text, p));
  } finally {
    setAudioSession("auto"); // hand the mic back while idle, not at the next tap
  }
}

declare global {
  interface Window {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  }
}
