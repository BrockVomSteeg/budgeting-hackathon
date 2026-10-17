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

/** Starts listening. Calls onText with the live transcript, onDone with the final text when speech ends. */
export function listen(onText: (t: string) => void, onDone: (t: string) => void, onError: (e: string) => void) {
  const SR = (window.SpeechRecognition || window.webkitSpeechRecognition) as Ctor | undefined;
  if (!SR) {
    onError("Voice not supported here. Type instead.");
    return () => {};
  }
  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  let text = "";
  rec.onresult = (e) => {
    text = Array.from(e.results).map((r) => r[0].transcript).join(" ");
    onText(text);
  };
  rec.onerror = (e) => {
    if (e.error !== "no-speech" && e.error !== "aborted") onError(`Mic error: ${e.error}`);
  };
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(watchdog);
    onDone(text.trim());
  };
  rec.onend = finish;
  const watchdog = setTimeout(() => {
    rec.stop();
    setTimeout(finish, 1000); // iOS sometimes never fires onend
  }, 12_000);
  try {
    rec.start();
  } catch {
    done = true;
    clearTimeout(watchdog);
    onError("Mic busy, try again.");
  }
  return () => rec.stop();
}

// One <audio> element, started inside a tap so iOS lets us play it again later without a gesture.
let player: HTMLAudioElement | null = null;
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

/** Call inside a tap handler so iOS lets us play audio later. */
export function unlockAudio() {
  player ??= new Audio();
  player.src = SILENCE;
  player.play().catch(() => {});
  // Play through the iOS silent switch (Safari 17+).
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) nav.audioSession.type = "playback";
  if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
}

/** Streams audio from url. Resolves true if anything played, false if it never started (204, error). */
function playStream(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const a = (player ??= new Audio());
    let started = false;
    const done = (ok: boolean) => {
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
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}

/** Fish Audio or ElevenLabs streamed via our server; falls back to the browser voice. */
export async function speak(text: string, p: Persona): Promise<void> {
  const url = `/api/speak?${new URLSearchParams({ text, persona: p.id })}`;
  if (await playStream(url)) return;
  await withTimeout(browserSpeak(text, p));
}

declare global {
  interface Window {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  }
}
