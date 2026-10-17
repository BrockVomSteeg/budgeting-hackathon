// Best-effort per-instance limiter. Stops casual abuse of a public demo URL.
const hits = new Map<string, number[]>();

export function rateLimited(req: Request, max = 60, windowMs = 60_000): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${new URL(req.url).pathname}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}
