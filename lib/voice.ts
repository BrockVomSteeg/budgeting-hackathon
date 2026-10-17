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
  rec.onend = () => onDone(text.trim());
  rec.start();
  return () => rec.stop();
}

let ctx: AudioContext | null = null;

/** Call inside a tap handler so iOS lets us play audio later. */
export function unlockAudio() {
  ctx ??= new AudioContext();
  ctx.resume().catch(() => {});
  if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
}

async function playMp3(buf: ArrayBuffer): Promise<void> {
  ctx ??= new AudioContext();
  await ctx.resume();
  const audioBuf = await ctx.decodeAudioData(buf);
  const src = ctx.createBufferSource();
  src.buffer = audioBuf;
  src.connect(ctx.destination);
  await new Promise<void>((res) => {
    src.onended = () => res();
    src.start();
  });
}

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

/** ElevenLabs via our server; falls back to the browser voice. */
export async function speak(text: string, p: Persona): Promise<void> {
  try {
    const r = await fetch("/api/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, persona: p.id }),
    });
    if (r.status === 200) {
      await playMp3(await r.arrayBuffer());
      return;
    }
  } catch {
    // fall through to the browser voice
  }
  await browserSpeak(text, p);
}

declare global {
  interface Window {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  }
}
