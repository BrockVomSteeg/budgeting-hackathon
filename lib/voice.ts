"use client";

import type { Persona } from "./types";

// Minimal Web Speech API typings (not in lib.dom for all TS versions).
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
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
  // Release the mic and speakers from the last attempt and answer, or the phone won't hear the next question.
  cancelListening?.();
  stopSpeaking();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  player?.pause();
  setAudioSession("play-and-record");

  const rec = new SR();
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
    onText(text);
  };
  rec.onerror = (e) => {
    if (e.error !== "no-speech" && e.error !== "aborted") failure = MIC_ERRORS[e.error] ?? `Mic error: ${e.error}. Try again.`;
    setTimeout(settle, 1000); // iOS sometimes never fires onend after an error
  };
  rec.onend = settle;
  const watchdog = setTimeout(() => {
    rec.stop();
    setTimeout(settle, 1000); // iOS sometimes never fires onend
  }, 12_000);
  cancelListening = cancel;
  try {
    rec.start();
  } catch {
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

function setAudioSession(type: "playback" | "play-and-record") {
  // Safari 17+. "playback" plays through the silent switch but blocks the mic, so flip it per phase.
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) nav.audioSession.type = type;
}

let unlocked = false;

/** Call inside a tap handler so iOS lets us play audio later. Only the first tap needs it. */
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  player ??= new Audio();
  player.src = SILENCE;
  player.play().catch(() => {});
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
      cancelSpeech = null;
      a.onplaying = a.onended = a.onerror = null;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => {
      a.pause();
      done(started);
    }, 25_000);
    a.onplaying = () => (started = true);
    a.onended = () => done(true);
    a.onerror = () => done(started);
    cancelSpeech = () => {
      a.pause();
      done(true);
    };
    a.src = url;
    a.play().catch(() => done(started));
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
    u.onend = done;
    u.onerror = done;
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
  const url = `/api/speak?${new URLSearchParams({ text, persona: p.id, sig: sig ?? "" })}`;
  if (await playStream(url)) return;
  await withTimeout(browserSpeak(text, p));
}

declare global {
  interface Window {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  }
}
