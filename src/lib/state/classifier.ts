import type { VisionMetrics, WorkState } from "@/lib/types";
import type { CalibrationProfile } from "./calibration";

// Thresholds tuned for a typical laptop webcam at desk distance. Gaze values
// are normalized (~[-1,1]), not degrees, so they're independent of head size.
// These are the fallback defaults; a CalibrationProfile overrides them per-user.
export const THRESHOLDS = {
  gazeAwayNorm: 0.35, // |yaw| beyond this = looking left/right off-screen
  slouchNeckDeg: 45, // neck flexion beyond this = slouching
  drowsyEyeOpenness: 0.4, // sustained below this = eyes closing / fading
};

// Raw, per-tick verdict from a single metrics sample (no smoothing). When a
// calibration profile is supplied, gaze/pitch/eye cutoffs are personalized —
// notably pitch-down ("looking at phone"), which is only trustworthy once the
// user's neutral baseline has actually been measured.
export function rawState(
  m: VisionMetrics,
  profile?: CalibrationProfile | null,
): WorkState {
  if (!m.facePresent) return "away";
  if (m.phonePresent) return "phone";

  const eyeCut = profile?.eyeDrowsyThreshold ?? THRESHOLDS.drowsyEyeOpenness;
  // Eyes mostly closed = fading/drowsy.
  if (m.eyeOpenness < eyeCut) return "fading";

  // Head tilted down off-screen (e.g. at a phone/notes) — calibrated only.
  if (profile && m.gazePitchNorm > profile.pitchDownThreshold) return "distracted";

  // Looking away: head turned left/right off the screen, relative to the user's
  // own neutral center when calibrated.
  const yawCenter = profile?.yawCenter ?? 0;
  const yawTol = profile?.yawTolerance ?? THRESHOLDS.gazeAwayNorm;
  if (Math.abs(m.gazeYawNorm - yawCenter) > yawTol) return "distracted";

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
  profile?: CalibrationProfile | null,
): { state: ClassifierState; committed: WorkState } {
  const raw = rawState(m, profile);

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
export function classifySequence(
  samples: VisionMetrics[],
  profile?: CalibrationProfile | null,
): WorkState[] {
  let s = initialClassifierState();
  return samples.map((m) => {
    const r = step(s, m, profile);
    s = r.state;
    return r.committed;
  });
}
