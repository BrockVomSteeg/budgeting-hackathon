"use client";

// On-screen voice diagnostics for phone testing. Shown when the URL has ?debug.
type Sink = (line: string) => void;
let sink: Sink | null = null;
const t0 = Date.now();

export function onDebug(fn: Sink | null) {
  sink = fn;
}

/** Adds a timestamped line, tagged with the iOS audio session type when there is one. */
export function dbg(msg: string) {
  if (!sink) return;
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  const session = nav.audioSession ? ` [session ${nav.audioSession.type}]` : "";
  sink(`${((Date.now() - t0) / 1000).toFixed(1)}s ${msg}${session}`);
}
