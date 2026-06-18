import type { VisionMetrics, WorkState } from "@/lib/types";

// Thresholds tuned for a typical laptop webcam at desk distance.
export const THRESHOLDS = {
  gazeAwayDeg: 25, // |yaw| beyond this = looking away from screen
  headDropPitchDeg: -20, // pitch below this = head dropped / nodding off
  slouchNeckDeg: 45, // neck flexion beyond this = slouching
  drowsyEyeOpenness: 0.45, // sustained below this = fading
};

// Raw, per-tick verdict from a single metrics sample (no smoothing).
export function rawState(m: VisionMetrics): WorkState {
  if (!m.facePresent) return "away";
  if (m.phonePresent) return "phone";
  // Drowsy/fading: head dropped or eyes mostly closed.
  if (m.gazePitchDeg < THRESHOLDS.headDropPitchDeg) return "fading";
  if (m.eyeOpenness < THRESHOLDS.drowsyEyeOpenness) return "fading";
  // Looking away from the screen (but still present, no phone).
  if (Math.abs(m.gazeYawDeg) > THRESHOLDS.gazeAwayDeg) return "distracted";
  return "focused";
}

// Number of consecutive agreeing samples required before we commit to a new
// state. Prevents flicker from a single glance or a momentary detection miss.
const COMMIT_SAMPLES = 3;

export interface ClassifierState {
  current: WorkState;
  // The candidate we're considering switching to, and how many ticks it has held.
  candidate: WorkState | null;
  candidateCount: number;
}

export function initialClassifierState(
  start: WorkState = "focused",
): ClassifierState {
  return { current: start, candidate: null, candidateCount: 0 };
}

// Feed one metrics sample; returns the (possibly unchanged) committed state.
// Hysteresis: a new raw verdict must persist for COMMIT_SAMPLES ticks to win.
export function step(
  state: ClassifierState,
  m: VisionMetrics,
): { state: ClassifierState; committed: WorkState } {
  const raw = rawState(m);

  if (raw === state.current) {
    // Reinforces the status quo; clear any pending switch.
    return {
      state: { current: state.current, candidate: null, candidateCount: 0 },
      committed: state.current,
    };
  }

  if (raw === state.candidate) {
    const count = state.candidateCount + 1;
    if (count >= COMMIT_SAMPLES) {
      return {
        state: { current: raw, candidate: null, candidateCount: 0 },
        committed: raw,
      };
    }
    return {
      state: { ...state, candidateCount: count },
      committed: state.current,
    };
  }

  // New candidate, starts its run at 1.
  return {
    state: { current: state.current, candidate: raw, candidateCount: 1 },
    committed: state.current,
  };
}

// Convenience: run a whole sequence (used in tests / replay).
export function classifySequence(samples: VisionMetrics[]): WorkState[] {
  let s = initialClassifierState();
  return samples.map((m) => {
    const r = step(s, m);
    s = r.state;
    return r.committed;
  });
}
