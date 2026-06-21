"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useVisionSignals } from "@/lib/vision/useVisionSignals";
import { SignalRecorder } from "@/lib/recorder";
import { Beeper } from "@/lib/sound";
import { Hud } from "@/components/Hud";
import type { WorkState } from "@/lib/types";

const NUDGES: Partial<Record<WorkState, string>> = {
  phone: "📵 Phone spotted — put it down and get back in.",
  fading: "😴 You're fading. Stretch, water, or take a real break.",
  distracted: "👀 Drifting off-screen — refocus.",
};

// States that should trigger the audible alarm when first entered.
const ALARM_STATES: ReadonlySet<WorkState> = new Set([
  "distracted",
  "phone",
  "fading",
]);

export default function SessionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<SignalRecorder | null>(null);
  const beeperRef = useRef<Beeper | null>(null);
  const stateRef = useRef<WorkState>("focused");
  const soundRef = useRef(true);
  const [active, setActive] = useState(false);
  const [focusedSec, setFocusedSec] = useState(0);
  const [nudge, setNudge] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  const { status, error, state, metrics, start, stop } = useVisionSignals(
    videoRef,
    (committed, ts) => {
      recorderRef.current?.mark(committed, ts);
      // Keep ringing the whole time focus is broken; silence on return to focus.
      if (soundRef.current && ALARM_STATES.has(committed)) {
        beeperRef.current?.start();
      } else {
        beeperRef.current?.stop();
      }
    },
  );

  // Mirror committed state into refs + drive nudges.
  useEffect(() => {
    stateRef.current = state;
    setNudge(NUDGES[state] ?? null);
  }, [state]);

  useEffect(() => {
    soundRef.current = soundOn;
    // React immediately to the toggle without waiting for the next sample.
    if (!soundOn) beeperRef.current?.stop();
    else if (ALARM_STATES.has(stateRef.current)) beeperRef.current?.start();
  }, [soundOn]);

  // 1s ticker: accumulate deep-work time + periodic flush.
  useEffect(() => {
    if (!active) return;
    let tick = 0;
    const id = setInterval(() => {
      if (stateRef.current === "focused") setFocusedSec((s) => s + 1);
      if (++tick % 15 === 0) recorderRef.current?.flush();
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  async function handleStart() {
    const res = await fetch("/api/sessions", { method: "POST" });
    if (!res.ok) return;
    const { sessionId } = (await res.json()) as { sessionId: string };
    recorderRef.current = new SignalRecorder(sessionId);
    // Created here so the AudioContext is unlocked by this click gesture.
    beeperRef.current = new Beeper();
    setFocusedSec(0);
    setActive(true);
    start();
  }

  async function handleStop() {
    stop();
    setActive(false);
    beeperRef.current?.close();
    beeperRef.current = null;
    const rec = recorderRef.current;
    if (rec) {
      rec.closeCurrent(Date.now());
      await rec.flush();
      // best-effort end marker
      await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: rec.sessionId }),
      }).catch(() => {});
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-6 py-10">
      <div className="grid w-full gap-8 md:grid-cols-2 md:items-center">
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-neutral-800 bg-black">
          {/* Mirror the preview; this stream stays in the browser. */}
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full -scale-x-100 object-cover"
          />
          {!active && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
              camera off
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-mono text-emerald-300">
            on-device · not uploaded
          </span>
        </div>

        <div className="flex flex-col items-center gap-6">
          {active ? (
            <Hud state={state} focusedSec={focusedSec} nudge={nudge} />
          ) : (
            <p className="text-center text-neutral-400">
              Start a session and Lockin will read your focus on-device.
            </p>
          )}

          {status === "loading" && (
            <p className="text-sm text-neutral-500">loading vision models…</p>
          )}
          {error && <p className="text-sm text-rose-400">{error}</p>}

          {!active ? (
            <button
              onClick={handleStart}
              className="rounded-full bg-emerald-500 px-6 py-3 font-medium text-neutral-950 hover:bg-emerald-400"
            >
              Start session
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleStop}
                className="rounded-full border border-neutral-700 px-6 py-3 font-medium hover:bg-neutral-900"
              >
                End session
              </button>
              <button
                onClick={() => setSoundOn((s) => !s)}
                title={soundOn ? "Mute alarm" : "Unmute alarm"}
                className="rounded-full border border-neutral-700 px-4 py-3 hover:bg-neutral-900"
              >
                {soundOn ? "🔔" : "🔕"}
              </button>
            </div>
          )}

          {!active && focusedSec > 0 && (
            <Link href="/today" className="text-sm text-emerald-400 underline">
              See today&apos;s debrief →
            </Link>
          )}

          {metrics && active && (
            <details className="w-full text-xs text-neutral-600">
              <summary className="cursor-pointer">raw signals (debug)</summary>
              <pre className="mt-2 overflow-x-auto">
                {JSON.stringify(
                  {
                    face: metrics.facePresent,
                    yaw: metrics.gazeYawNorm.toFixed(2),
                    pitch: metrics.gazePitchNorm.toFixed(2),
                    neck: metrics.neckAngleDeg.toFixed(1),
                    eye: metrics.eyeOpenness.toFixed(2),
                    phone: metrics.phonePresent,
                  },
                  null,
                  1,
                )}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
