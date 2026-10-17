// Helpers for speaking Gordon's reply while Claude is still writing it.
// The structured reply streams as JSON text with "line" as the last field, so the earlier fields
// (item, amount, category, verdict) are complete before the spoken line starts.

/** The fields before "line", once "line" has started. null until then (or if "line" isn't last). */
export function fieldsBeforeLine(json: string): Record<string, unknown> | null {
  const m = json.match(/,\s*"line"\s*:\s*"/);
  if (!m || m.index === undefined) return null;
  try {
    return JSON.parse(json.slice(0, m.index) + "}") as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The "line" text written so far, with JSON escapes decoded. done = its closing quote arrived. */
export function partialLine(json: string): { text: string; done: boolean } | null {
  const m = json.match(/"line"\s*:\s*"/);
  if (!m || m.index === undefined) return null;
  let out = "";
  for (let i = m.index + m[0].length; i < json.length; i++) {
    const c = json[i];
    if (c === '"') return { text: out, done: true };
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = json[i + 1];
    if (n === undefined) break; // escape cut off mid-stream: wait for more
    if (n === "u") {
      const hex = json.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else {
      out += ({ n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" } as Record<string, string>)[n] ?? n;
      i += 1;
    }
  }
  return { text: out, done: false };
}

/** Length of the first complete sentence in text (ends in . ! or ? and then a space), or 0. */
export function firstSentenceEnd(text: string): number {
  const m = text.match(/^.{8,}?[.!?]+["')]?(?=\s)/s);
  return m ? m[0].length : 0;
}

/** Splits a finished line into [first sentence, the rest] for two TTS requests. */
export function splitForSpeech(line: string): string[] {
  const t = line.trim();
  const end = firstSentenceEnd(t);
  const parts = end ? [t.slice(0, end), t.slice(end).trim()] : [t];
  return parts.filter(Boolean);
}
