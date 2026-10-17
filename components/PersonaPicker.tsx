"use client";

import { personaList } from "@/lib/personas";
import type { PersonaId } from "@/lib/types";

export function PersonaPicker({ value, onChange }: { value: PersonaId; onChange: (id: PersonaId) => void }) {
  return (
    <div className="personas" role="radiogroup" aria-label="Roast voice">
      {personaList.map((p) => (
        <button
          key={p.id}
          role="radio"
          aria-checked={value === p.id}
          className={value === p.id ? "persona active" : "persona"}
          onClick={() => onChange(p.id)}
        >
          <span className="persona-emoji">{p.emoji}</span>
          <span>{p.name}</span>
        </button>
      ))}
    </div>
  );
}
