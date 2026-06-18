"use client";

import type { WorkState } from "@/lib/types";

export const STATE_META: Record<
  WorkState,
  { color: string; ring: string; bar: string; label: string }
> = {
  focused: { color: "text-emerald-400", ring: "ring-emerald-500", bar: "bg-emerald-500", label: "Locked in" },
  distracted: { color: "text-amber-400", ring: "ring-amber-500", bar: "bg-amber-500", label: "Distracted" },
  phone: { color: "text-rose-400", ring: "ring-rose-500", bar: "bg-rose-500", label: "On your phone" },
  away: { color: "text-neutral-400", ring: "ring-neutral-500", bar: "bg-neutral-500", label: "Away" },
  fading: { color: "text-violet-400", ring: "ring-violet-500", bar: "bg-violet-500", label: "Fading" },
};

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Hud({
  state,
  focusedSec,
  nudge,
}: {
  state: WorkState;
  focusedSec: number;
  nudge: string | null;
}) {
  const meta = STATE_META[state];
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`flex flex-col items-center justify-center rounded-2xl bg-neutral-900 px-10 py-6 ring-2 ${meta.ring}`}
      >
        <span className={`text-2xl font-bold ${meta.color}`}>{meta.label}</span>
        <span className="mt-1 font-mono text-sm text-neutral-500">
          deep-work {fmt(focusedSec)}
        </span>
      </div>
      {nudge && (
        <div className="animate-pulse rounded-full bg-rose-500/15 px-4 py-2 text-sm text-rose-300">
          {nudge}
        </div>
      )}
    </div>
  );
}
