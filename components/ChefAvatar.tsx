"use client";

import { useEffect, useRef } from "react";
import { audioDebug, voiceLevel } from "@/lib/voice";

export type Status = "idle" | "listening" | "thinking" | "speaking";
type Frame = "idle" | "talk" | "smile" | "cheer";
const FRAMES: Frame[] = ["idle", "talk", "smile", "cheer"];

interface Props {
  src: string; // folder with idle/talk/smile/cheer.webp
  status: Status;
  mood: "angry" | "happy";
  label: string;
  onClick: () => void;
  disabled: boolean;
}

/** Talking-head mic button: opens the mouth a little while the voice is loud enough. */
export function ChefAvatar({ src, status, mood, label, onClick, disabled }: Props) {
  const face = useRef<HTMLDivElement>(null);
  const debug = useRef<HTMLSpanElement>(null);
  const rest: Frame = mood === "happy" ? "smile" : "idle";
  const open: Frame = mood === "happy" ? "cheer" : "talk";

  useEffect(() => {
    const el = face.current;
    if (!el) return;
    el.dataset.frame = rest;
    if (status !== "speaking") return;

    let raf = 0;
    let last = 0;
    let frame: Frame = rest;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 90) return; // ~11 mouth changes a second reads as speech without looking jittery
      last = t;
      let lvl = voiceLevel();
      if (debug.current) debug.current.textContent = `${audioDebug()} frame:${frame}`;
      if (lvl < 0) lvl = Math.random() < 0.45 ? 0 : 1; // can't measure: flap
      const next = lvl > 0.18 ? open : rest;
      if (next !== frame) el.dataset.frame = frame = next;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.dataset.frame = rest;
    };
  }, [status, rest, open]);

  return (
    <button className={`avatar avatar-${status} avatar-${mood}`} onClick={onClick} disabled={disabled} aria-label={label}>
      <div className="avatar-face" ref={face} data-frame={rest}>
        {FRAMES.map((f) => (
          // eslint-disable-next-line @next/next/no-img-element -- tiny stacked frames, swapped by opacity
          <img key={f} src={`${src}/${f}.webp`} alt="" data-f={f} draggable={false} />
        ))}
      </div>
      <span className="avatar-label">{label}</span>
      {typeof window !== "undefined" && window.location.search.includes("debug") && (
        <span className="avatar-debug" ref={debug} />
      )}
    </button>
  );
}
