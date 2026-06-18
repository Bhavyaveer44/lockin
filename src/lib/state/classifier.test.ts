import { describe, it, expect } from "vitest";
import {
  rawState,
  step,
  initialClassifierState,
  classifySequence,
} from "./classifier";
import type { VisionMetrics, WorkState } from "@/lib/types";

// A "focused" baseline sample; override fields per-test.
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

describe("rawState", () => {
  it("returns focused for a centered, alert face", () => {
    expect(rawState(metrics())).toBe("focused");
  });

  it("returns away when no face is present", () => {
    expect(rawState(metrics({ facePresent: false }))).toBe("away");
  });

  it("prioritizes phone over everything else when present", () => {
    expect(
      rawState(metrics({ phonePresent: true, gazeYawNorm: 0.9 })),
    ).toBe("phone");
  });

  it("returns distracted when looking far off-screen (left/right)", () => {
    expect(rawState(metrics({ gazeYawNorm: 0.5 }))).toBe("distracted");
  });

  it("does not flag focus on pitch alone (pitch is not yet thresholded)", () => {
    expect(rawState(metrics({ gazePitchNorm: 0.9 }))).toBe("focused");
  });

  it("returns fading when eyes are mostly closed", () => {
    expect(rawState(metrics({ eyeOpenness: 0.2 }))).toBe("fading");
  });

  it("away takes precedence over phone (no face = nothing to trust)", () => {
    expect(
      rawState(metrics({ facePresent: false, phonePresent: true })),
    ).toBe("away");
  });
});

describe("step hysteresis", () => {
  it("does not switch on a single off sample", () => {
    let s = initialClassifierState("focused");
    const r = step(s, metrics({ gazeYawNorm: 0.5 }));
    expect(r.committed).toBe("focused");
  });

  it("switches only after 3 consecutive agreeing samples", () => {
    let s = initialClassifierState("focused");
    const away = metrics({ gazeYawNorm: 0.5 });
    const seq: WorkState[] = [];
    for (let i = 0; i < 3; i++) {
      const r = step(s, away);
      s = r.state;
      seq.push(r.committed);
    }
    expect(seq).toEqual(["focused", "focused", "distracted"]);
  });

  it("resets the candidate run when an interrupting sample arrives", () => {
    let s = initialClassifierState("focused");
    s = step(s, metrics({ gazeYawNorm: 0.5 })).state; // distracted candidate (1)
    s = step(s, metrics({ gazeYawNorm: 0.5 })).state; // distracted candidate (2)
    // A focused sample interrupts and clears the pending switch.
    const back = step(s, metrics());
    expect(back.committed).toBe("focused");
    s = back.state;
    // One more distracted sample should NOT immediately commit (run restarted).
    expect(step(s, metrics({ gazeYawNorm: 0.5 })).committed).toBe("focused");
  });
});

describe("classifySequence", () => {
  it("ignores a brief glance away (flicker rejection)", () => {
    const samples = [
      metrics(),
      metrics({ gazeYawNorm: 0.5 }), // single glance
      metrics(),
      metrics(),
    ];
    expect(classifySequence(samples)).toEqual([
      "focused",
      "focused",
      "focused",
      "focused",
    ]);
  });

  it("commits to phone after sustained detection", () => {
    const samples = Array.from({ length: 4 }, () =>
      metrics({ phonePresent: true }),
    );
    expect(classifySequence(samples)).toEqual([
      "focused",
      "focused",
      "phone",
      "phone",
    ]);
  });
});
