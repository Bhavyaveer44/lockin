import type { VisionMetrics, WorkState } from "@/lib/types";

// Thresholds tuned for a typical laptop webcam at desk distance. Gaze values
// are normalized (~[-1,1]), not degrees, so they're independent of head size.
export const THRESHOLDS = {
  gazeAwayNorm: 0.35, // |yaw| beyond this = looking left/right off-screen
  slouchNeckDeg: 45, // neck flexion beyond this = slouching
  drowsyEyeOpenness: 0.4, // sustained below this = eyes closing / fading
};

// Raw, per-tick verdict from a single metrics sample (no smoothing).
// pitch is intentionally NOT thresholded yet — its level baseline is face-
// dependent and needs field calibration; we surface it in the debug panel.
export function rawState(m: VisionMetrics): WorkState {
  if (!m.facePresent) return "away";
  if (m.phonePresent) return "phone";
  // Eyes mostly closed = fading/drowsy.
  if (m.eyeOpenness < THRESHOLDS.drowsyEyeOpenness) return "fading";
  // Looking away: head turned left/right off the screen.
  if (Math.abs(m.gazeYawNorm) > THRESHOLDS.gazeAwayNorm) return "distracted";
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
