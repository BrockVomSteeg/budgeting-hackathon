import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { Persona } from "./types.ts";

// Browser fakes: just enough of Web Speech, <audio>, and Safari's audioSession for lib/voice.ts.
type Handler<T = void> = ((e: T) => void) | null;
class FakeRecognition {
  static all: FakeRecognition[] = [];
  lang = "";
  interimResults = false;
  continuous = false;
  onresult: Handler<{ results: unknown }> = null;
  onerror: Handler<{ error: string }> = null;
  onend: Handler = null;
  started = false;
  aborted = false;
  constructor() {
    FakeRecognition.all.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.aborted = true;
    this.onerror?.({ error: "aborted" });
    this.onend?.();
  }
  say(text: string) {
    this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] });
    this.onend?.();
  }
}
class FakeAudio {
  static autoEnd = true;
  src = "";
  paused = true;
  onplaying: Handler = null;
  onended: Handler = null;
  onerror: Handler = null;
  play() {
    this.paused = false;
    if (this.src.startsWith("/api/speak")) {
      queueMicrotask(() => {
        this.onplaying?.();
        if (FakeAudio.autoEnd) this.onended?.();
      });
    }
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}
const synth = { spoken: 0, cancelled: 0, speak() { synth.spoken++; }, cancel() { synth.cancelled++; } };
const session = { type: "auto" };

Object.assign(globalThis, {
  window: globalThis,
  SpeechRecognition: FakeRecognition,
  Audio: FakeAudio,
  speechSynthesis: synth,
  SpeechSynthesisUtterance: class {},
});
Object.defineProperty(globalThis.navigator, "audioSession", { value: session, configurable: true });

const { listen, speak, stopSpeaking, unlockAudio } = await import("./voice.ts");
const persona = { id: "chef", browserVoice: { pitch: 1, rate: 1 } } as Persona;
const latest = () => FakeRecognition.all[FakeRecognition.all.length - 1];

function ask() {
  const calls = { done: [] as string[], errors: [] as string[] };
  const stop = listen(() => {}, (t) => calls.done.push(t), (e) => calls.errors.push(e));
  return { calls, stop, rec: latest() };
}

test("a second question works after a spoken answer", async () => {
  unlockAudio();
  const first = ask();
  assert.equal(synth.cancelled, 0, "starting the mic doesn't cut off the first tap's unlock");
  first.rec.say("can I afford a $5 coffee");
  assert.deepEqual(first.calls.done, ["can I afford a $5 coffee"]);

  const talking = speak("Permission granted, recruit!", persona);
  assert.equal(session.type, "playback");
  await talking;
  assert.equal(session.type, "auto", "the mic is usable again once the answer ends");

  unlockAudio(); // second tap
  const second = ask();
  assert.equal(synth.spoken, 1, "the silent unlock utterance only plays on the first tap");
  assert.equal(session.type, "auto", "listening doesn't flip the audio session");
  assert.ok(second.rec.started);
  second.rec.say("what about a $400 jacket");
  assert.deepEqual(second.calls.done, ["what about a $400 jacket"]);
  assert.deepEqual(second.calls.errors, []);
});

test("a mic error reports once and leaves no stale timer", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, rec } = ask();
  rec.onerror?.({ error: "not-allowed" });
  rec.onend?.();
  t.mock.timers.tick(15_000);
  assert.deepEqual(calls.errors, ["Mic blocked. Allow microphone access, or type below."]);
  assert.deepEqual(calls.done, [], "no follow-up 'didn't catch that'");
});

test("an error without onend still resets", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, rec } = ask();
  rec.onerror?.({ error: "audio-capture" });
  assert.deepEqual(calls.errors, []);
  t.mock.timers.tick(1000);
  assert.deepEqual(calls.errors, ["No microphone found. Type below."]);
});

test("a new question silently drops a stuck earlier one", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stuck = ask();
  const fresh = ask();
  assert.ok(stuck.rec.aborted);
  t.mock.timers.tick(5_000);
  assert.deepEqual(stuck.calls, { done: [], errors: [] });
  fresh.rec.say("can I afford a $5 coffee");
  assert.deepEqual(fresh.calls.done, ["can I afford a $5 coffee"]);
});

test("tapping during an answer skips it", async () => {
  FakeAudio.autoEnd = false;
  const playing = speak("A very long roast", persona);
  await new Promise((r) => setTimeout(r, 0));
  stopSpeaking();
  const tooSlow = new Promise((r) => setTimeout(() => r("still talking"), 500));
  assert.equal(await Promise.race([playing.then(() => "stopped"), tooSlow]), "stopped");
  FakeAudio.autoEnd = true;
  mock.reset();
});
