import { describe, expect, it } from 'vitest'
import {
  callingWindowAllowed,
  scoreDialerCandidate,
  sortDialerCandidates,
  type DialerInput,
} from './scoring.js'

const NOW = new Date('2026-08-04T10:00:00Z')
const HOUR = 3_600_000

function candidate(overrides: Partial<DialerInput> = {}): DialerInput {
  return {
    leadId: 'lead-1',
    identifier: 'lead-1',
    phone: '+919000000001',
    score: 0,
    createdAt: NOW.toISOString(),
    lastDialedAt: null,
    callsToday: 0,
    pendingFollowUpDueAt: null,
    ...overrides,
  }
}

describe('scoreDialerCandidate', () => {
  it('adds +1000 for an overdue follow-up', () => {
    const { score, reasons } = scoreDialerCandidate(
      candidate({ pendingFollowUpDueAt: new Date(NOW.getTime() - HOUR).toISOString() }),
      { now: NOW },
    )
    expect(reasons).toContain('follow-up-due +1000')
    expect(score).toBeGreaterThan(1000)
  })

  it('adds +500 for a follow-up due within 4 hours', () => {
    const { score, reasons } = scoreDialerCandidate(
      candidate({ pendingFollowUpDueAt: new Date(NOW.getTime() + 2 * HOUR).toISOString() }),
      { now: NOW },
    )
    expect(reasons).toContain('follow-up-due +500')
    expect(score).toBeGreaterThan(500)
  })

  it('gives no follow-up bonus beyond the 4h due-soon window', () => {
    const { reasons } = scoreDialerCandidate(
      candidate({ pendingFollowUpDueAt: new Date(NOW.getTime() + 8 * HOUR).toISOString() }),
      { now: NOW },
    )
    expect(reasons.some((r) => r.startsWith('follow-up-due'))).toBe(false)
  })

  it('scales SLA breach points with the overdue fraction and caps at the weight', () => {
    const at36h = scoreDialerCandidate(
      candidate({ createdAt: new Date(NOW.getTime() - 36 * HOUR).toISOString() }),
      { now: NOW },
    )
    const at72h = scoreDialerCandidate(
      candidate({ createdAt: new Date(NOW.getTime() - 72 * HOUR).toISOString() }),
      { now: NOW },
    )
    // (36-24)/24 = 0.5 -> 200 * 0.5; (72-24)/24 = 2 -> capped at 1.0
    expect(at36h.reasons).toContain('sla-breach +100')
    expect(at72h.reasons).toContain('sla-breach +200')
    expect(at72h.score).toBeGreaterThan(at36h.score)
  })

  it('decays freshness exponentially with the 48h half-life', () => {
    const young = scoreDialerCandidate(candidate({ createdAt: NOW.toISOString() }), { now: NOW })
    const old = scoreDialerCandidate(
      candidate({ createdAt: new Date(NOW.getTime() - 96 * HOUR).toISOString() }),
      { now: NOW },
    )
    expect(young.reasons.find((r) => r.startsWith('freshness'))).toBe('freshness +50')
    // 50 * 2^(-96/48) = 12.5 -> 13
    expect(old.reasons.find((r) => r.startsWith('freshness'))).toBe('freshness +13')
  })

  it('reports the round-robin penalty in reasons', () => {
    const { score, reasons } = scoreDialerCandidate(
      candidate({ score: 100, callsToday: 2 }),
      { now: NOW },
    )
    expect(reasons).toContain('round-robin -40')
    expect(score).toBeLessThan(scoreDialerCandidate(candidate({ score: 100 }), { now: NOW }).score)
  })
})

describe('sortDialerCandidates', () => {
  it('ranks an overdue follow-up first even against a hot lead', () => {
    const overdue = candidate({
      leadId: 'overdue',
      score: 10,
      pendingFollowUpDueAt: new Date(NOW.getTime() - HOUR).toISOString(),
    })
    const hot = candidate({ leadId: 'hot', score: 100 })
    expect(sortDialerCandidates([hot, overdue], { now: NOW }).map((c) => c.leadId)).toEqual([
      'overdue',
      'hot',
    ])
  })

  it('breaks ties on lead score when follow-ups and age match', () => {
    const low = candidate({ leadId: 'low', score: 40 })
    const high = candidate({ leadId: 'high', score: 90 })
    expect(sortDialerCandidates([low, high], { now: NOW }).map((c) => c.leadId)).toEqual([
      'high',
      'low',
    ])
  })

  it('ranks a lead with fewer calls today higher on equal score (round-robin fairness)', () => {
    const dialed = candidate({ leadId: 'dialed', score: 50, callsToday: 5 })
    const fresh = candidate({ leadId: 'fresh', score: 50 })
    expect(sortDialerCandidates([dialed, fresh], { now: NOW }).map((c) => c.leadId)).toEqual([
      'fresh',
      'dialed',
    ])
  })

  it('filters out-of-window candidates unless ignoreCallingWindow is set', () => {
    const night = new Date('2026-08-04T02:00:00+05:30') // 02:00 IST — outside 09:00-21:00
    const config = { now: night, timezone: 'Asia/Kolkata' }
    expect(sortDialerCandidates([candidate()], config)).toEqual([])
    expect(
      sortDialerCandidates([candidate()], { ...config, ignoreCallingWindow: true }),
    ).toHaveLength(1)
  })
})

describe('callingWindowAllowed', () => {
  it('blocks 02:00 and allows 14:00 in the TRAI window', () => {
    const config = { timezone: 'Asia/Kolkata' }
    expect(callingWindowAllowed(new Date('2026-08-04T02:00:00+05:30'), config)).toBe(false)
    expect(callingWindowAllowed(new Date('2026-08-04T14:00:00+05:30'), config)).toBe(true)
  })
})
