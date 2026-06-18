import type { WorkState } from "@/lib/types";

export interface IntervalLike {
  state: WorkState;
  startedAt: Date;
  durationSec: number;
}

export interface DayAggregate {
  totalSec: number;
  byState: Record<WorkState, number>;
  focusScore: number; // 0..100, share of tracked time spent focused
  topDistraction: WorkState | null; // most time-consuming non-focused state
  // Compact per-hour breakdown the LLM can narrate, e.g. "14:00 mostly focused (38m), 8m phone".
  timeline: string;
}

const EMPTY = (): Record<WorkState, number> => ({
  focused: 0,
  distracted: 0,
  phone: 0,
  away: 0,
  fading: 0,
});

function fmtMin(sec: number): string {
  return `${Math.round(sec / 60)}m`;
}

export function aggregateDay(events: IntervalLike[]): DayAggregate {
  const byState = EMPTY();
  const byHour = new Map<number, Record<WorkState, number>>();

  for (const e of events) {
    byState[e.state] += e.durationSec;
    const hour = e.startedAt.getHours();
    const slot = byHour.get(hour) ?? EMPTY();
    slot[e.state] += e.durationSec;
    byHour.set(hour, slot);
  }

  const totalSec = Object.values(byState).reduce((a, b) => a + b, 0);
  // Score over "engaged" time (exclude away — being gone isn't a focus failure).
  const engaged = totalSec - byState.away;
  const focusScore =
    engaged > 0 ? Math.round((byState.focused / engaged) * 100) : 0;

  const distractions: WorkState[] = ["phone", "distracted", "fading"];
  let topDistraction: WorkState | null = null;
  let topSec = 0;
  for (const d of distractions) {
    if (byState[d] > topSec) {
      topSec = byState[d];
      topDistraction = d;
    }
  }

  const timeline = [...byHour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, slot]) => {
      const parts = (Object.keys(slot) as WorkState[])
        .filter((s) => slot[s] > 0)
        .sort((a, b) => slot[b] - slot[a])
        .map((s) => `${s} ${fmtMin(slot[s])}`);
      return `${hour.toString().padStart(2, "0")}:00 — ${parts.join(", ")}`;
    })
    .join("\n");

  return { totalSec, byState, focusScore, topDistraction, timeline };
}
