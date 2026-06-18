import type { WorkState } from "@/lib/types";

export interface IntervalEvent {
  state: WorkState;
  startedAt: string; // ISO
  durationSec: number;
}

/**
 * Turns a stream of state changes into completed intervals and flushes them to
 * the server in batches. Only labels + timestamps are sent — never frames.
 */
export class SignalRecorder {
  readonly sessionId: string;
  private buffer: IntervalEvent[] = [];
  private current: { state: WorkState; startMs: number } | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  // Call on every committed state (including the first). Closes the prior
  // interval and opens a new one.
  mark(state: WorkState, atMs: number): void {
    if (this.current) {
      const dur = Math.round((atMs - this.current.startMs) / 1000);
      if (dur > 0) {
        this.buffer.push({
          state: this.current.state,
          startedAt: new Date(this.current.startMs).toISOString(),
          durationSec: dur,
        });
      }
    }
    this.current = { state, startMs: atMs };
  }

  // Close the open interval at `atMs` without starting a new one.
  closeCurrent(atMs: number): void {
    if (!this.current) return;
    const dur = Math.round((atMs - this.current.startMs) / 1000);
    if (dur > 0) {
      this.buffer.push({
        state: this.current.state,
        startedAt: new Date(this.current.startMs).toISOString(),
        durationSec: dur,
      });
    }
    this.current = null;
  }

  // Send buffered intervals. Safe to call repeatedly; clears on success.
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const events = this.buffer;
    this.buffer = [];
    try {
      const res = await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.sessionId, events }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      // Re-queue on failure so we retry on the next flush.
      this.buffer = events.concat(this.buffer);
    }
  }
}
