"use client";

import { useEffect, useRef } from "react";
import { audioDebug, voiceLevel } from "@/lib/voice";

export type Status = "idle" | "listening" | "thinking" | "speaking";
type Mood = "angry" | "happy";

// Each expression is a [mouth closed, mouth open] pair of frames (files in `src`).
const EXPRESSIONS: Record<Mood, [string, string][]> = {
  angry: [
    ["idle", "talk"],
    ["skeptic", "sneer"],
  ],
  happy: [
    ["smile", "cheer"],
    ["wink", "winktalk"],
  ],
};
const FRAMES = [...new Set(Object.values(EXPRESSIONS).flat(2))];

interface Props {
  src: string;
  status: Status;
  mood: Mood;
  label: string;
  onClick: () => void;
  disabled: boolean;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Talking-head mic button. While he speaks: the mouth follows the voice's loudness, he switches
 * between expressions every couple of seconds, tilts his head and leans into loud words.
 * While idle he now and then pulls a face.
 */
export function ChefAvatar({ src, status, mood, label, onClick, disabled }: Props) {
  const face = useRef<HTMLDivElement>(null);
  const pose = useRef<HTMLDivElement>(null);
  const debug = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = face.current;
    const body = pose.current;
    if (!el || !body) return;
    const show = (f: string) => {
      if (el.dataset.frame === f) return;
      el.dataset.frame = f;
      for (const img of el.querySelectorAll("img")) img.classList.toggle("on", img.dataset.f === f);
    };
    const exprs = EXPRESSIONS[mood];
    show(exprs[0][0]);
    body.style.transform = "";

    if (status === "idle" || status === "listening") {
      // Idle life: every 5-9s a quick glance with the second expression.
      if (status !== "idle") return;
      let t: ReturnType<typeof setTimeout>;
      const glance = () => {
        t = setTimeout(() => {
          show(exprs[1][0]);
          t = setTimeout(() => {
            show(exprs[0][0]);
            glance();
          }, 1100);
        }, rand(5000, 9000));
      };
      glance();
      return () => clearTimeout(t);
    }
    if (status !== "speaking" && status !== "thinking") return; // thinking: the "hmm…" clip moves his mouth too

    let raf = 0;
    let last = 0;
    let expr = 0;
    let nextSwap = performance.now() + rand(1200, 2200);
    let tilt = 0;
    let tiltTarget = rand(-4, 4);
    let lean = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 90) return; // ~11 changes a second reads as speech without jitter
      last = t;
      let lvl = voiceLevel();
      if (debug.current) debug.current.textContent = `${audioDebug()} frame:${el.dataset.frame}`;
      if (lvl < 0) lvl = Math.random() < 0.45 ? 0 : 0.6; // can't measure: flap
      if (t > nextSwap) {
        expr = (expr + 1) % exprs.length;
        nextSwap = t + rand(1200, 2600);
        tiltTarget = rand(-5, 5);
      }
      show(exprs[expr][lvl > 0.12 ? 1 : 0]);
      tilt += (tiltTarget - tilt) * 0.25;
      lean += (Math.min(1, lvl) - lean) * 0.5;
      body.style.transform = `rotate(${tilt.toFixed(2)}deg) translateY(${(-lean * 5).toFixed(1)}px) scale(${(1 + lean * 0.05).toFixed(3)})`;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      show(exprs[0][0]);
      body.style.transform = "";
    };
  }, [status, mood]);

  const rest = EXPRESSIONS[mood][0][0];
  return (
    <button className={`avatar avatar-${status} avatar-${mood}`} onClick={onClick} disabled={disabled} aria-label={label}>
      <div className="avatar-face" ref={face} data-frame={rest}>
        <div className="avatar-pose" ref={pose}>
          {FRAMES.map((f) => (
            // eslint-disable-next-line @next/next/no-img-element -- tiny stacked frames, swapped by opacity
            <img key={f} src={`${src}/${f}.webp`} alt="" data-f={f} className={f === rest ? "on" : undefined} draggable={false} />
          ))}
        </div>
      </div>
      <span className="avatar-label">{label}</span>
      {typeof window !== "undefined" && window.location.search.includes("debug") && (
        <span className="avatar-debug" ref={debug} />
      )}
    </button>
  );
}
