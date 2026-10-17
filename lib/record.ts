"use client";

// Records the question ourselves and transcribes it on the server (Fish Audio).
// More reliable than Safari's built-in speech recognition, which often hears nothing.
import { dbg } from "./debug.ts";
import { audioContext } from "./voice.ts";

export const recorderSupported = () =>
  typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;

/**
 * Calls onDone ~0.8s after the speaker stops talking (or after 6s of nothing), so nobody has to tap
 * "send". Uses the tap-unlocked audio context; if there isn't one running, it does nothing and the
 * tap / time cap still work. Returns a cleanup function.
 */
function endOfSpeech(stream: MediaStream, onDone: () => void): () => void {
  const ctx = audioContext();
  if (!ctx || ctx.state !== "running") {
    dbg("recorder: no running audio context, auto-send off");
    return () => {};
  }
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  src.connect(an); // not to the speakers
  const buf = new Uint8Array(an.fftSize);
  const t0 = performance.now();
  let floor = 0.01;
  let heard = false;
  let lastLoud = t0;
  const timer = setInterval(() => {
    an.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += ((v - 128) / 128) ** 2;
    const rms = Math.sqrt(sum / buf.length);
    const now = performance.now();
    if (now - t0 < 300) floor = Math.min(0.05, Math.max(floor, rms)); // capped: talking right after the tap isn't "room noise" // room noise while the mic settles
    const loud = rms > Math.max(0.02, floor * 2.5);
    if (loud) {
      if (!heard) dbg("recorder: speech started");
      heard = true;
      lastLoud = now;
    }
    if ((heard && now - lastLoud > 1200) || (!heard && now - t0 > 6000)) {
      dbg(heard ? "recorder: speech ended, sending" : "recorder: no speech, sending");
      stop();
      onDone();
    }
  }, 50);
  const stop = () => {
    clearInterval(timer);
    src.disconnect();
  };
  return stop;
}

/** Starts recording. Returns finish(), which stops and resolves the audio. Calls onCap after maxMs or when speech ends. */
export async function startRecording(onCap: () => void, maxMs = 10_000): Promise<() => Promise<Blob>> {
  dbg("recorder: asking for mic");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  for (const t of stream.getAudioTracks()) {
    dbg(`recorder: mic track ${t.readyState} muted=${t.muted} enabled=${t.enabled}`);
    t.onmute = () => dbg("recorder: mic track MUTED");
    t.onunmute = () => dbg("recorder: mic track unmuted");
    t.onended = () => dbg("recorder: mic track ended");
  }
  const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    dbg(`recorder: chunk ${e.data.size} bytes`);
    if (e.data.size) chunks.push(e.data);
  };
  rec.onerror = () => dbg("recorder: error");
  const stopped = new Promise<Blob>((resolve) => {
    rec.onstop = () => {
      dbg(`recorder: stopped, ${chunks.length} chunks`);
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: rec.mimeType || mime || "audio/mp4" }));
    };
  });
  rec.start();
  dbg(`recorder: started ${rec.mimeType || mime || "default type"}`);
  const cap = setTimeout(onCap, maxMs);
  const stopVad = endOfSpeech(stream, onCap);
  return () => {
    clearTimeout(cap);
    stopVad();
    if (rec.state !== "inactive") rec.stop();
    return stopped;
  };
}

/** Text from the server, "" if nothing was heard, null if server speech-to-text isn't configured. */
/** 16 kHz mono 16-bit WAV. Browsers record mp4/webm variants the speech service may reject; WAV always works. */
async function toWav(blob: Blob): Promise<Blob> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const rate = 16_000;
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const pcm = (await off.startRendering()).getChannelData(0);
    const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const str = (o: number, t: string) => [...t].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    str(0, "RIFF");
    out.setUint32(4, 36 + pcm.length * 2, true);
    str(8, "WAVEfmt ");
    out.setUint32(16, 16, true);
    out.setUint16(20, 1, true); // PCM
    out.setUint16(22, 1, true); // mono
    out.setUint32(24, rate, true);
    out.setUint32(28, rate * 2, true);
    out.setUint16(32, 2, true);
    out.setUint16(34, 16, true);
    str(36, "data");
    out.setUint32(40, pcm.length * 2, true);
    pcm.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
    return new Blob([out.buffer], { type: "audio/wav" });
  } finally {
    ctx.close().catch(() => {});
  }
}

export async function transcribe(recorded: Blob): Promise<string | null> {
  const blob = await toWav(recorded).catch((err) => {
    dbg(`transcribe: wav convert failed ${err instanceof Error ? err.name : err}, sending original`);
    return recorded;
  });
  dbg(`transcribe: sending ${blob.size} bytes ${blob.type}`);
  const r = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "content-type": blob.type || "audio/mp4" },
    body: blob,
    signal: AbortSignal.timeout(15_000),
  });
  dbg(`transcribe: HTTP ${r.status}`);
  if (r.status === 501) return null;
  if (!r.ok) return "";
  const { text } = (await r.json()) as { text?: unknown };
  dbg(`transcribe: text "${typeof text === "string" ? text : ""}"`);
  return typeof text === "string" ? text.trim() : "";
}
