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

// Loudness meter for the talking head. Once the player is routed through Web Audio it only makes
// sound while the context runs, so we route it only when the context is running.
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let boost: GainNode | null = null;
const samples = new Uint8Array(512);

// Speaker mode: louder playback (gain behind a compressor so it doesn't clip) and the iOS
// "playback" audio session, which uses the loudspeaker instead of the quiet call-style route.
let speakerMode = true;
const BOOST = 1.8;

export function setSpeakerMode(on: boolean) {
  speakerMode = on;
  if (boost) boost.gain.value = on ? BOOST : 1;
}

let input: GainNode | null = null;

/** Everything Gordon says goes in here: metered for the mouth, then boosted and limited to the speaker. */
function bus(c: AudioContext): AudioNode {
  if (input) return input;
  input = c.createGain();
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.ratio.value = 12;
  boost = c.createGain();
  boost.gain.value = speakerMode ? BOOST : 1;
  analyser = c.createAnalyser();
  analyser.fftSize = samples.length;
  input.connect(analyser); // meter the raw voice, before the boost
  input.connect(boost);
  boost.connect(limiter);
  limiter.connect(c.destination);
  return input;
}

let elementRouted = false;
function meter(a: HTMLAudioElement) {
  if (elementRouted || !ctx || ctx.state !== "running") return;
  try {
    ctx.createMediaElementSource(a).connect(bus(ctx));
    elementRouted = true;
  } catch {
    // can't route it: the mouth flaps instead
  }
}

// Clips played straight through Web Audio (thinking noises and streamed answer chunks). Once the
// context is running these need no tap, unlike the <audio> element after the mic has been open.
let sources: AudioBufferSourceNode[] = [];
let scheduledUntil = 0;
let lastClip: Promise<void> = Promise.resolve();
const webAudioReady = () => !!ctx && ctx.state === "running";

function playBuffer(buf: AudioBuffer): Promise<void> {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(bus(c));
  const at = Math.max(c.currentTime + 0.03, scheduledUntil); // back to back, no gaps
  src.start(at);
  scheduledUntil = at + buf.duration;
  sources.push(src);
  clipStart = performance.now();
  clipPeak = 0;
  lastClip = new Promise((resolve) => {
    src.onended = () => {
      sources = sources.filter((x) => x !== src);
      resolve();
    };
  });
  return lastClip;
}

function stopClips() {
  for (const s of sources) {
    try {
      s.stop();
    } catch {
      // already stopped
    }
  }
  sources = [];
  scheduledUntil = 0;
}

// "Thinking" noises, played the moment a question is sent so the wait sounds like Gordon reacting.
const FILLERS = [1, 2, 3, 4, 5, 6].map((n) => `/gordon/fillers/${n}.mp3`);
let fillerBytes: Promise<ArrayBuffer[]> | null = null;
let fillers: AudioBuffer[] = [];

/** Downloads the thinking noises (call once when the app opens). */
export function preloadFillers() {
  fillerBytes ??= Promise.all(FILLERS.map((u) => fetch(u).then((r) => r.arrayBuffer()))).catch(() => []);
}

async function decodeFillers() {
  if (!ctx || fillers.length || !fillerBytes) return;
  const c = ctx;
  const bytes = await fillerBytes;
  fillers = (await Promise.all(bytes.map((b) => c.decodeAudioData(b.slice(0)).catch(() => null)))).filter((b): b is AudioBuffer => !!b);
}

/** Plays a random short "hmm, right…" right away. Does nothing if audio isn't ready. */
export function playFiller() {
  if (!webAudioReady() || !fillers.length) return;
  if (speakerMode) setAudioSession("playback");
  dbg("filler: playing");
  void playBuffer(fillers[Math.floor(Math.random() * fillers.length)]);
}

// Some browsers (iOS Safari) play the audio but feed the analyser silence. If a clip has played for
// a while and the meter never moved, treat it as unmeasurable so the mouth flaps instead of freezing.
let clipStart = 0;
let clipPeak = 0;
let lastLevel = 0;

/** Loudness of the voice playing now, 0..1. -1 means something is talking but we can't measure it. */
export function voiceLevel(): number {
  const playing =
    (!!player && !player.paused && player.currentTime > 0) || (sources.length > 0 && !!ctx && ctx.currentTime < scheduledUntil);
  let level = 0;
  if (playing && analyser) {
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const v of samples) sum += ((v - 128) / 128) ** 2;
    level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
    clipPeak = Math.max(clipPeak, level);
    if (clipPeak < 0.02 && performance.now() - clipStart > 600) level = -1;
  } else if (playing || (typeof window !== "undefined" && window.speechSynthesis?.speaking)) {
    level = -1;
  }
  lastLevel = level;
  return level;
}

/** The app's audio context, resumed on every tap (so it's usable right after one). */
export const audioContext = () => ctx;

/** For ?debug=1: what the meter sees. */
export function audioDebug(): string {
  const playing = !!player && !player.paused;
  return `ctx:${ctx?.state ?? "none"} meter:${analyser ? "on" : "off"} clips:${sources.length} playing:${playing} t:${player?.currentTime.toFixed(1) ?? "-"} level:${lastLevel.toFixed(2)} peak:${clipPeak.toFixed(2)}`;
}

let unlocked = false;

/** Call inside a tap handler so iOS lets us play audio later. Only the first tap needs it. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    ctx.resume().catch(() => {}); // every tap: iOS can suspend it between answers
    void decodeFillers();
  } catch {
    // no Web Audio: the talking head just flaps
  }
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

/**
 * Re-arms the <audio> element inside a tap. iOS only lets an element play later without a gesture
 * if a gesture played it after the mic was last opened, so call this on the "send" tap.
 */
export function primeAudio() {
  player ??= new Audio();
  player.src = SILENCE;
  dbg("prime audio (send tap)");
  player.play().catch((err) => dbg(`prime: play() rejected ${err instanceof Error ? err.name : err}`));
}

let cancelSpeech: (() => void) | null = null;
// The streamed answer in progress (startAnswer). Separate from cancelSpeech, which each speak() resets.
let cancelAnswer: (() => void) | null = null;

/** Cuts off the current answer, if one is playing. */
export function stopSpeaking() {
  cancelAnswer?.();
  cancelSpeech?.();
}

/** Streams audio from url. Resolves true if anything played, false if it never started (204, error). */
function playStream(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const a = (player ??= new Audio());
    // Routed through a suspended context = silent. Let the browser voice take it instead.
    if (elementRouted && ctx?.state !== "running") return resolve(false);
    meter(a);
    clipStart = performance.now();
    clipPeak = 0;
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
  // Speaker mode off = leave the session alone (after the mic, iOS stays on the quieter call-style route).
  if (speakerMode) setAudioSession("playback");
  try {
    const url = `/api/speak?${new URLSearchParams({ text, persona: p.id, sig: sig ?? "" })}`;
    if (await playStream(url)) return;
    dbg("browser voice: fallback");
    await withTimeout(browserSpeak(text, p));
  } finally {
    if (speakerMode) setAudioSession("auto"); // hand the mic back while idle, not at the next tap
  }
}

declare global {
  interface Window {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  }
}

/**
 * Speaks an answer that arrives in chunks: each chunk is fetched, decoded and played back to back
 * through Web Audio as soon as it's ready. If Web Audio isn't running or a chunk fails, the chunks
 * not yet played go through speak() (the <audio> element, then the browser voice) at the end.
 */
export function startAnswer(p: Persona) {
  ctx?.resume().catch(() => {});
  // Decided per chunk: after auto-send there's no tap, and the context may need a moment to resume.
  let fallback = !ctx;
  let cancelled = false;
  const chunks: { text: string; sig: string; played: boolean }[] = [];
  let chain: Promise<void> = Promise.resolve();
  if (speakerMode) setAudioSession("playback");
  const cancel = () => {
    cancelled = true;
    stopClips();
  };
  cancelAnswer = cancel;
  const release = () => {
    if (cancelAnswer === cancel) cancelAnswer = null;
    if (speakerMode) setAudioSession("auto"); // hand the mic back
  };
  dbg(`answer: ${fallback ? "element fallback" : "web audio"}`);

  return {
    say(text: string, sig: string) {
      const chunk = { text, sig, played: false };
      chunks.push(chunk);
      if (fallback) return;
      const c = ctx!;
      const audio = fetch(`/api/speak?${new URLSearchParams({ text, persona: p.id, sig })}`)
        .then((r) => (r.status === 200 ? r.arrayBuffer() : Promise.reject(new Error(`speak ${r.status}`))))
        .then((b) => c.decodeAudioData(b));
      chain = chain.then(async () => {
        if (fallback || cancelled) return;
        if (c.state !== "running") {
          await Promise.race([c.resume(), new Promise((r) => setTimeout(r, 600))]).catch(() => {});
          if ((c.state as string) !== "running") { // re-read after the await
            dbg(`answer: audio context ${c.state}, using element fallback`);
            fallback = true;
            return;
          }
        }
        try {
          const buf = await audio;
          if (cancelled) return;
          chunk.played = true;
          void playBuffer(buf);
        } catch (err) {
          dbg(`answer: chunk failed ${err instanceof Error ? err.message : err}`);
          fallback = true;
        }
      });
    },
    /** Plays out whatever is left, then hands the audio session back. */
    async end() {
      try {
        await chain;
        // Never hang on a clip whose onended won't fire (iOS can suspend the context mid-answer).
        if (!cancelled) {
          let iv: ReturnType<typeof setInterval> | undefined;
          await Promise.race([
            lastClip,
            new Promise<void>((resolve) => {
              const t0 = Date.now();
              iv = setInterval(() => {
                if (cancelled || !ctx || ctx.state !== "running" || Date.now() - t0 > 30_000) resolve();
              }, 250);
            }),
          ]);
          clearInterval(iv); // also when the clip ended first
        }
        for (const c of chunks) if (!c.played && !cancelled) await speak(c.text, p, c.sig);
      } finally {
        if (cancelled) stopClips();
        release();
      }
    },
    /** Gives up on the answer (request failed): stops anything playing and hands the audio session back. */
    cancel() {
      cancel();
      release();
    },
  };
}
