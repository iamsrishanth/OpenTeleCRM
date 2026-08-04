/**
 * Shared follow-up time math (A1.5 quick chips).
 * '1h' | '3h' | 'tomorrow_10am' | 'custom' — resolved against `now` so tests
 * stay deterministic. 'custom' requires an explicit ISO `customDueAt`.
 */

export type CallbackQuickChip = '1h' | '3h' | 'tomorrow_10am' | 'custom';

const MS_PER_HOUR = 3_600_000;

/** Tomorrow 10:00 in Asia/Kolkata (IST, UTC+5:30, no DST) = 04:30 UTC. */
export function tomorrowTenAmIst(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day') + 1, 4, 30, 0));
}

/**
 * Resolve a quick chip (+ optional customDueAt for 'custom') to a Date.
 * Returns null when the chip is unknown or custom is missing/invalid.
 */
export function resolveCallbackDue(
  quickChip: string | undefined,
  customDueAt?: string,
  now = new Date(),
): Date | null {
  switch (quickChip) {
    case '1h':
      return new Date(now.getTime() + MS_PER_HOUR);
    case '3h':
      return new Date(now.getTime() + 3 * MS_PER_HOUR);
    case 'tomorrow_10am':
      return tomorrowTenAmIst(now);
    case 'custom': {
      if (!customDueAt) return null;
      const d = new Date(customDueAt);
      if (Number.isNaN(d.getTime())) return null;
      return d;
    }
    default:
      return null;
  }
}
