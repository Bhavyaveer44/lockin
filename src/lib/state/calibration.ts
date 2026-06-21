// Per-user calibration: instead of guessing universal thresholds, we measure the
// user's own neutral baselines in a few poses and derive personalized cutoffs.
// This is what finally lets us threshold pitch-down ("looking at phone") — its
// level baseline is face- and camera-dependent, so it only works once measured.
//
// The profile is stored ON-DEVICE (localStorage), never sent to a server, which
// is consistent with Lockin's privacy invariant.

import { THRESHOLDS } from "./classifier";

// Averaged metrics captured while the user holds a single pose.
export interface PoseSample {
  yaw: number;
  pitch: number;
  eye: number;
}

// The three guided poses we capture.
export interface CalibrationCapture {
  screen: PoseSample; // looking normally at the screen (the "focused" baseline)
  phone: PoseSample; // looking down at a phone (pitch reference for "down")
  closed: PoseSample; // eyes shut (the drowsy reference)
}

export interface CalibrationProfile {
  // User's neutral horizontal gaze; the "focused" band is centered here.
  yawCenter: number;
  // Half-width of the focused band around yawCenter (turn beyond = distracted).
  yawTolerance: number;
  // Pitch above this = head tilted down off-screen. PITCH_DISABLED = off (the
  // phone pose wasn't distinct enough from the screen pose to trust).
  pitchDownThreshold: number;
  // Eye-openness below this = fading/drowsy.
  eyeDrowsyThreshold: number;
}

const STORAGE_KEY = "lockin.calibration.v1";

// Finite sentinel for "pitch-down detection disabled" — a real pitchNorm never
// reaches this, and unlike Infinity it survives JSON round-tripping.
export const PITCH_DISABLED = 99;

// Minimum separation needed between two pose readings before we trust a derived
// threshold; below this the poses are indistinguishable (bad capture) and we
// fall back to the safe default rather than fire false positives.
const MIN_PITCH_SEP = 0.06;
const MIN_EYE_SEP = 0.12;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Derive personalized thresholds from the three captured poses. */
export function computeProfile(cap: CalibrationCapture): CalibrationProfile {
  const yawCenter = cap.screen.yaw;

  // Looking down should read a LARGER pitch than looking at the screen. Only
  // threshold it if the gap is real; otherwise disable (Infinity).
  const pitchGap = cap.phone.pitch - cap.screen.pitch;
  const pitchDownThreshold =
    pitchGap > MIN_PITCH_SEP
      ? (cap.screen.pitch + cap.phone.pitch) / 2
      : PITCH_DISABLED;

  // Drowsy cutoff sits midway between open and closed eyes — but only if the
  // two are clearly separable; else keep the default.
  const eyeGap = cap.screen.eye - cap.closed.eye;
  const eyeDrowsyThreshold =
    eyeGap > MIN_EYE_SEP
      ? clamp((cap.screen.eye + cap.closed.eye) / 2, 0.15, 0.6)
      : THRESHOLDS.drowsyEyeOpenness;

  return {
    yawCenter,
    yawTolerance: THRESHOLDS.gazeAwayNorm,
    pitchDownThreshold,
    eyeDrowsyThreshold,
  };
}

/** Average a buffer of raw samples into one PoseSample. */
export function averagePose(
  samples: { gazeYawNorm: number; gazePitchNorm: number; eyeOpenness: number }[],
): PoseSample {
  if (samples.length === 0) return { yaw: 0, pitch: 0, eye: 1 };
  const sum = samples.reduce(
    (a, s) => ({
      yaw: a.yaw + s.gazeYawNorm,
      pitch: a.pitch + s.gazePitchNorm,
      eye: a.eye + s.eyeOpenness,
    }),
    { yaw: 0, pitch: 0, eye: 0 },
  );
  const n = samples.length;
  return { yaw: sum.yaw / n, pitch: sum.pitch / n, eye: sum.eye / n };
}

export function saveProfile(p: CalibrationProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Storage may be unavailable (private mode); calibration just won't persist.
  }
}

export function loadProfile(): CalibrationProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<CalibrationProfile>;
    if (
      typeof p.yawCenter === "number" &&
      typeof p.yawTolerance === "number" &&
      typeof p.pitchDownThreshold === "number" &&
      typeof p.eyeDrowsyThreshold === "number"
    ) {
      return p as CalibrationProfile;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearProfile(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
