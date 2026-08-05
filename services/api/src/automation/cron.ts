/**
 * Tiny 5-field cron evaluator (minute, hour, day-of-month, month, day-of-week).
 * NO external dep — mirrors the subset TeleCRM uses for A4.4.
 *
 * Supported syntax (per field):
 * Supported syntax (per field). STAR = wildcard, STEP = step value:
 *   STAR              any
 *   N                 exact
 *   N-M               range
 *   N,M,...           list
 *   STAR\/STEP        step across the field's domain
 *   N-M\/STEP         step inside a range
 *
 * Returns true when `now` matches the cron expression in the server's local
 * timezone. (For the contract tests local TZ is whatever the runner is on;
 * the schedule's `* * * * *` is TZ-agnostic enough to tick every minute.)
 */
export type CronField = number; // resolved per-call

const FIELDS: ReadonlyArray<{ name: string; min: number; max: number }> = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'dayOfMonth', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'dayOfWeek', min: 0, max: 6 }, // 0 = Sunday
];

function parseField(raw: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  const parts = raw.split(',');
  for (const part of parts) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    const step = stepMatch ? Number(stepMatch[2]) : 1;
    let base = (stepMatch ? stepMatch[1] : part) as string;
    if (base === '*') {
      for (let i = min; i <= max; i += step) out.add(i);
      continue;
    }
    if (base.includes('-')) {
      const [loS, hiS] = base.split('-');
      const lo = Number(loS);
      const hi = Number(hiS);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        throw new Error(`bad cron range: ${part}`);
      }
      for (let i = lo; i <= hi; i += step) out.add(i);
      continue;
    }
    const n = Number(base);
    if (!Number.isFinite(n)) throw new Error(`bad cron value: ${part}`);
    out.add(n);
  }
  // clip to field range (so e.g. 0 step from 0 is fine)
  for (const v of out) {
    if (v < min || v > max) throw new Error(`cron value ${v} out of [${min},${max}]`);
  }
  return out;
}

export function parseCron(expr: string): ReadonlyArray<Set<number>> {
  const trimmed = expr.trim().replace(/\s+/g, ' ');
  const parts = trimmed.split(' ');
  if (parts.length !== 5) {
    throw new Error(`cron expression must have 5 fields, got ${parts.length}: ${expr}`);
  }
  return parts.map((p, i) => parseField(p, FIELDS[i]!.min, FIELDS[i]!.max));
}

/** Test whether `now` matches a parsed 5-field cron expression. */
export function cronMatches(parsed: ReadonlyArray<Set<number>>, now: Date): boolean {
  const minute = now.getMinutes();
  const hour = now.getHours();
  const dom = now.getDate();
  const month = now.getMonth() + 1;
  const dow = now.getDay();
  return (
    parsed[0]!.has(minute) &&
    parsed[1]!.has(hour) &&
    parsed[2]!.has(dom) &&
    parsed[3]!.has(month) &&
    parsed[4]!.has(dow)
  );
}

/** Convenience: parse and match. Returns false on invalid expressions. */
export function isCronMatch(expr: string, now: Date): boolean {
  try {
    return cronMatches(parseCron(expr), now);
  } catch {
    return false;
  }
}

/**
 * Compute the next future time (>= `from`) that matches the cron expression.
 * Minute resolution. Returns null if the next tick is more than ~7 days away
 * (the caller should re-arm from there). For '* * * * *' this is always
 * within ~60s of `from`.
 */
export function nextCronTick(expr: string, from: Date = new Date()): Date | null {
  let parsed: ReadonlyArray<Set<number>>;
  try {
    parsed = parseCron(expr);
  } catch {
    return null;
  }
  // Round up to the next whole minute.
  const start = new Date(from.getTime());
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);
  const max = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  let cur = new Date(start.getTime());
  while (cur.getTime() <= max.getTime()) {
    if (cronMatches(parsed, cur)) return cur;
    cur = new Date(cur.getTime() + 60_000);
  }
  return null;
}
