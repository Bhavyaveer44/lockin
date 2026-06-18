// Shared domain types for the on-device vision pipeline.

export const WORK_STATES = [
  "focused",
  "distracted",
  "phone",
  "away",
  "fading",
] as const;

export type WorkState = (typeof WORK_STATES)[number];

// Raw per-tick metrics derived from MediaPipe entirely in the browser.
// These never leave the device; only the classified WorkState is persisted.
export interface VisionMetrics {
  // Is a face detected in frame at all?
  facePresent: boolean;
  // Horizontal head/eye deviation from screen-center, in degrees.
  // ~0 = looking at screen, large magnitude = looking away.
  gazeYawDeg: number;
  // Vertical head deviation, degrees. Large negative = head dropped (fading).
  gazePitchDeg: number;
  // Forward neck flexion angle, degrees. Higher = more slouch.
  neckAngleDeg: number;
  // A phone-like object detected near the hands/face.
  phonePresent: boolean;
  // Eye openness ratio 0..1 (1 = wide open). Low sustained = drowsy.
  eyeOpenness: number;
  // Frame timestamp (ms).
  ts: number;
}
