/**
 * Smart dialer scoring (A1.1) — pure functions, no I/O, no DB.
 *
 * Priority formula (highest score dials first):
 *   1. follow-up overdue            +1000 (flat)
 *   2. follow-up due within 4h      +500  (flat)
 *   3. SLA breach risk              +0..200 (scaled by how far past slaHours a
 *      lead with NO follow-up scheduled is; caps at the weight)
 *   4. lead score                   +score * 0.5
 *   5. freshness                    +0..50 (exponential decay, 48h half-life)
 *   6. round-robin fairness         -20 per call dialed today
 *
 * All weights/horizons are overridable via DialerScoringConfig. Time-dependent
 * components read `now` from config so tests stay deterministic.
 */

export interface DialerInput {
  leadId: string
  identifier: string
  phone: string
  score: number
  createdAt: string
  lastDialedAt: string | null
  callsToday: number
  pendingFollowUpDueAt: string | null
}

export interface DialerScoringConfig {
  /** Flat points for a follow-up that is already overdue (default 1000). */
  followUpOverdueWeight?: number
  /** Flat points for a follow-up due within the next 4 hours (default 500). */
  followUpDueSoonWeight?: number
  /** Max SLA-breach points, scaled by overdue fraction (default 200). */
  slaBreachWeight?: number
  /** Multiplier applied to the lead score (default 0.5). */
  leadScoreWeight?: number
  /** Max freshness points, decayed exponentially (default 50). */
  freshnessWeight?: number
  /** Points subtracted per call dialed today — fairness (default 20). */
  roundRobinWeight?: number
  /** SLA window in hours; leads older than this with no follow-up breach (default 24). */
  slaHours?: number
  /** Freshness half-life in hours (default 48). */
  freshnessHalfLifeHours?: number
  /** TRAI calling window start, 'HH:mm' 24h, in `timezone` (default '09:00'). */
  callingWindowStart?: string
  /** TRAI calling window end, 'HH:mm' 24h, in `timezone` (default '21:00'). */
  callingWindowEnd?: string
  /** IANA timezone for the calling window (default 'Asia/Kolkata' — TRAI). */
  timezone?: string
  /** Reference "now"; defaults to new Date(). Tests inject a fixed instant. */
  now?: Date
  /** Skip the calling-window filter in sortDialerCandidates (tests). */
  ignoreCallingWindow?: boolean
}

export interface ScoreResult {
  score: number
  reasons: string[]
}

const MS_PER_HOUR = 3_600_000
const FOLLOW_UP_DUE_SOON_HOURS = 4
const DEFAULT_TIMEZONE = 'Asia/Kolkata'

/** Pure A1.1 scoring — returns a total + a human-readable breakdown. */
export function scoreDialerCandidate(
  input: DialerInput,
  config: DialerScoringConfig = {},
): ScoreResult {
  const now = config.now ?? new Date()
  const followUpOverdueWeight = config.followUpOverdueWeight ?? 1000
  const followUpDueSoonWeight = config.followUpDueSoonWeight ?? 500
  const slaBreachWeight = config.slaBreachWeight ?? 200
  const leadScoreWeight = config.leadScoreWeight ?? 0.5
  const freshnessWeight = config.freshnessWeight ?? 50
  const roundRobinWeight = config.roundRobinWeight ?? 20
  const slaHours = config.slaHours ?? 24
  const halfLifeHours = config.freshnessHalfLifeHours ?? 48

  let score = 0
  const reasons: string[] = []

  // 1+2. Follow-up: overdue beats everything; due-soon is a strong second.
  if (input.pendingFollowUpDueAt) {
    const msUntilDue = new Date(input.pendingFollowUpDueAt).getTime() - now.getTime()
    if (msUntilDue < 0) {
      score += followUpOverdueWeight
      reasons.push(`follow-up-due +${followUpOverdueWeight}`)
    } else if (msUntilDue <= FOLLOW_UP_DUE_SOON_HOURS * MS_PER_HOUR) {
      score += followUpDueSoonWeight
      reasons.push(`follow-up-due +${followUpDueSoonWeight}`)
    }
  }

  // 3. SLA breach: no follow-up scheduled and lead older than slaHours.
  const ageHours = Math.max(0, (now.getTime() - new Date(input.createdAt).getTime()) / MS_PER_HOUR)
  const hasFollowUp = input.pendingFollowUpDueAt !== null
  if (!hasFollowUp && ageHours > slaHours) {
    const overdueFraction = Math.min(1, (ageHours - slaHours) / slaHours)
    const points = Math.round(slaBreachWeight * overdueFraction)
    score += points
    reasons.push(`sla-breach +${points}`)
  }

  // 4. Lead score.
  const leadPoints = Math.round(input.score * leadScoreWeight)
  score += leadPoints
  reasons.push(`lead-score +${leadPoints}`)

  // 5. Freshness — exponential decay: half the points every half-life.
  const decay = Math.pow(2, -ageHours / halfLifeHours)
  const freshnessPoints = Math.round(freshnessWeight * decay)
  score += freshnessPoints
  reasons.push(`freshness +${freshnessPoints}`)

  // 6. Round-robin fairness: penalize leads dialed a lot today.
  const rrPenalty = Math.round(input.callsToday * roundRobinWeight)
  if (rrPenalty !== 0) {
    score -= rrPenalty
    reasons.push(`round-robin -${rrPenalty}`)
  }

  return { score, reasons }
}

/**
 * TRAI compliance: is `due` inside the configured calling window (default
 * 09:00–21:00 in Asia/Kolkata)? Minutes resolved via Intl.DateTimeFormat —
 * no TZ database dependency.
 */
export function callingWindowAllowed(
  due: Date,
  config: DialerScoringConfig = {},
): boolean {
  const timezone = config.timezone ?? DEFAULT_TIMEZONE
  const start = config.callingWindowStart ?? '09:00'
  const end = config.callingWindowEnd ?? '21:00'

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(due)
    .split(':')
  const minutes = (Number(parts[0] ?? 0)) * 60 + Number(parts[1] ?? 0)

  const [sh, sm] = start.split(':').map((p) => Number(p))
  const [eh, em] = end.split(':').map((p) => Number(p))
  const startMinutes = (sh ?? 0) * 60 + (sm ?? 0)
  const endMinutes = (eh ?? 0) * 60 + (em ?? 0)

  if (startMinutes <= endMinutes) {
    return minutes >= startMinutes && minutes < endMinutes
  }
  // Window crosses midnight (e.g. 22:00-02:00).
  return minutes >= startMinutes || minutes < endMinutes
}

/**
 * Rank dialer candidates: drop any outside the calling window (unless
 * ignoreCallingWindow) and sort by A1.1 score descending. Stable — ties keep
 * input order.
 */
export function sortDialerCandidates(
  inputs: DialerInput[],
  config: DialerScoringConfig = {},
): DialerInput[] {
  const now = config.now ?? new Date()
  return inputs
    .filter(
      (input) => config.ignoreCallingWindow === true || callingWindowAllowed(now, config),
    )
    .map((input) => ({ input, result: scoreDialerCandidate(input, { ...config, now }) }))
    .sort((a, b) => b.result.score - a.result.score)
    .map((s) => s.input)
}
