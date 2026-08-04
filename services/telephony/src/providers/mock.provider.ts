/**
 * Mock telephony provider — in-memory, for tests and demos.
 * Implements the exact TelephonyProvider contract. dial() always "connects":
 * callState reports completed, recordings get synthetic ids. No PBX involved.
 */
import type { CallStatus, TelephonyProvider } from '@opentelecrm/contracts'

export class MockTelephonyProvider implements TelephonyProvider {
  readonly kind = 'mock' as const

  private seq = 0
  private recordings = new Map<string, string>() // callId -> recordingId

  async dial(
    _to: string,
    _from?: string,
    _context?: Record<string, unknown>,
  ): Promise<{ callId: string }> {
    return { callId: `mock-call-${++this.seq}` }
  }

  async hangup(_callId: string): Promise<void> {
    // Mock has no live calls to tear down.
  }

  async callState(_callId: string): Promise<{ status: CallStatus; durationSec: number }> {
    return { status: 'completed', durationSec: 0 }
  }

  async startRecording(callId: string): Promise<{ recordingId: string }> {
    const recordingId = `mock-rec-${++this.seq}`
    this.recordings.set(callId, recordingId)
    return { recordingId }
  }

  async stopRecording(callId: string): Promise<{ recordingId: string }> {
    const existing = this.recordings.get(callId)
    const recordingId = existing ?? `mock-rec-${++this.seq}`
    this.recordings.set(callId, recordingId)
    return { recordingId }
  }

  on(_event: 'call' | 'status', _cb: (arg: unknown) => void): () => void {
    return () => {}
  }
}
