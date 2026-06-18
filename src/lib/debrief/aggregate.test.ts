import { describe, it, expect } from "vitest";
import { aggregateDay, type IntervalLike } from "./aggregate";

function ev(
  state: IntervalLike["state"],
  hour: number,
  min: number,
): IntervalLike {
  return {
    state,
    startedAt: new Date(2026, 5, 18, hour, 0, 0),
    durationSec: min * 60,
  };
}

describe("aggregateDay", () => {
  it("computes a focus score over engaged (non-away) time", () => {
    const agg = aggregateDay([
      ev("focused", 9, 30),
      ev("phone", 9, 10),
      ev("away", 9, 60), // excluded from the denominator
    ]);
    // engaged = 40m, focused 30m -> 75
    expect(agg.focusScore).toBe(75);
    expect(agg.byState.away).toBe(3600);
  });

  it("picks the largest non-focused state as the top distraction", () => {
    const agg = aggregateDay([
      ev("focused", 10, 50),
      ev("phone", 10, 5),
      ev("distracted", 11, 20),
    ]);
    expect(agg.topDistraction).toBe("distracted");
  });

  it("returns zeroed score and null distraction for an empty day", () => {
    const agg = aggregateDay([]);
    expect(agg.focusScore).toBe(0);
    expect(agg.topDistraction).toBeNull();
    expect(agg.totalSec).toBe(0);
  });

  it("builds an hour-sorted timeline string", () => {
    const agg = aggregateDay([ev("focused", 14, 38), ev("phone", 14, 8)]);
    expect(agg.timeline).toContain("14:00");
    expect(agg.timeline).toContain("focused 38m");
  });
});
