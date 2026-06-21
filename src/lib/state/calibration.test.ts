import { describe, it, expect } from "vitest";
import {
  averagePose,
  computeProfile,
  PITCH_DISABLED,
  type CalibrationCapture,
} from "./calibration";
import { rawState, THRESHOLDS } from "./classifier";
import type { VisionMetrics } from "@/lib/types";

function metrics(over: Partial<VisionMetrics> = {}): VisionMetrics {
  return {
    facePresent: true,
    gazeYawNorm: 0,
    gazePitchNorm: 0,
    neckAngleDeg: 10,
    phonePresent: false,
    eyeOpenness: 0.9,
    ts: 0,
    ...over,
  };
}

describe("averagePose", () => {
  it("averages a buffer of raw samples", () => {
    const p = averagePose([
      { gazeYawNorm: 0, gazePitchNorm: 0.2, eyeOpenness: 1 },
      { gazeYawNorm: 0.2, gazePitchNorm: 0.4, eyeOpenness: 0.8 },
    ]);
    expect(p.yaw).toBeCloseTo(0.1);
    expect(p.pitch).toBeCloseTo(0.3);
    expect(p.eye).toBeCloseTo(0.9);
  });

  it("returns a safe neutral pose for an empty buffer", () => {
    expect(averagePose([])).toEqual({ yaw: 0, pitch: 0, eye: 1 });
  });
});

describe("computeProfile", () => {
  it("derives a pitch-down threshold between screen and phone poses", () => {
    const cap: CalibrationCapture = {
      screen: { yaw: 0.05, pitch: 0.3, eye: 0.9 },
      phone: { yaw: 0.05, pitch: 0.6, eye: 0.9 },
      closed: { yaw: 0.05, pitch: 0.3, eye: 0.1 },
    };
    const p = computeProfile(cap);
    expect(p.yawCenter).toBeCloseTo(0.05);
    expect(p.pitchDownThreshold).toBeCloseTo(0.45);
    expect(p.eyeDrowsyThreshold).toBeCloseTo(0.5);
  });

  it("disables pitch detection when the phone pose isn't distinct enough", () => {
    const cap: CalibrationCapture = {
      screen: { yaw: 0, pitch: 0.3, eye: 0.9 },
      phone: { yaw: 0, pitch: 0.31, eye: 0.9 }, // barely different
      closed: { yaw: 0, pitch: 0.3, eye: 0.1 },
    };
    expect(computeProfile(cap).pitchDownThreshold).toBe(PITCH_DISABLED);
  });

  it("falls back to the default eye threshold when eyes aren't separable", () => {
    const cap: CalibrationCapture = {
      screen: { yaw: 0, pitch: 0.3, eye: 0.9 },
      phone: { yaw: 0, pitch: 0.6, eye: 0.9 },
      closed: { yaw: 0, pitch: 0.3, eye: 0.85 }, // closed barely lower
    };
    expect(computeProfile(cap).eyeDrowsyThreshold).toBe(
      THRESHOLDS.drowsyEyeOpenness,
    );
  });
});

describe("rawState with a calibration profile", () => {
  const cap: CalibrationCapture = {
    screen: { yaw: 0.2, pitch: 0.3, eye: 0.9 }, // user's neutral is yaw 0.2
    phone: { yaw: 0.2, pitch: 0.6, eye: 0.9 },
    closed: { yaw: 0.2, pitch: 0.3, eye: 0.1 },
  };
  const profile = computeProfile(cap);

  it("treats the user's measured center as focused (not distracted)", () => {
    // Raw yaw 0.2 would trip the default 0.35? no — but their center is 0.2, so
    // a reading right at center must be focused.
    expect(rawState(metrics({ gazeYawNorm: 0.2 }), profile)).toBe("focused");
  });

  it("flags distracted relative to the calibrated center", () => {
    // 0.2 center + 0.35 tolerance = 0.55 boundary.
    expect(rawState(metrics({ gazeYawNorm: 0.6 }), profile)).toBe("distracted");
  });

  it("now flags looking-down as distracted once pitch is calibrated", () => {
    expect(rawState(metrics({ gazePitchNorm: 0.7 }), profile)).toBe(
      "distracted",
    );
  });

  it("uses the calibrated drowsy cutoff", () => {
    // midpoint(0.9, 0.1) = 0.5; eye 0.45 < 0.5 → fading.
    expect(rawState(metrics({ eyeOpenness: 0.45 }), profile)).toBe("fading");
  });
});
