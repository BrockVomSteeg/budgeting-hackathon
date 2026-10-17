"use client";

// Records the question ourselves and transcribes it on the server (Fish Audio).
// More reliable than Safari's built-in speech recognition, which often hears nothing.

export const recorderSupported = () =>
  typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;

/** Starts recording. Returns finish(), which stops and resolves the audio. Calls onCap after maxMs. */
export async function startRecording(onCap: () => void, maxMs = 10_000): Promise<() => Promise<Blob>> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<Blob>((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: rec.mimeType || mime || "audio/mp4" }));
    };
  });
  rec.start();
  const cap = setTimeout(onCap, maxMs);
  return () => {
    clearTimeout(cap);
    if (rec.state !== "inactive") rec.stop();
    return stopped;
  };
}

/** Text from the server, "" if nothing was heard, null if server speech-to-text isn't configured. */
export async function transcribe(blob: Blob): Promise<string | null> {
  const r = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "content-type": blob.type || "audio/mp4" },
    body: blob,
    signal: AbortSignal.timeout(15_000),
  });
  if (r.status === 501) return null;
  if (!r.ok) return "";
  const { text } = (await r.json()) as { text?: unknown };
  return typeof text === "string" ? text.trim() : "";
}
