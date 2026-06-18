import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";

const STATES = [
  { label: "focused", color: "bg-emerald-500", note: "eyes on screen, alert" },
  { label: "distracted", color: "bg-amber-500", note: "looking away" },
  { label: "phone", color: "bg-rose-500", note: "phone in hand" },
  { label: "away", color: "bg-neutral-500", note: "left the desk" },
  { label: "fading", color: "bg-violet-500", note: "head dropping, drowsy" },
];

export default function Home() {
  return (
    <div className="flex-1">
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-16 text-center">
        <p className="mb-4 inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-mono text-emerald-300">
          100% on-device · frames never leave your browser
        </p>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
          Your webcam is now a{" "}
          <span className="text-emerald-400">focus coach.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-400">
          Lockin watches your desk in real time — gaze, posture, phone, presence
          — and infers when you&apos;re locked in vs. drifting. At day&apos;s end an
          AI writes you a debrief. The video is processed entirely in this tab;
          only tiny state labels are ever saved.
        </p>
        <div className="mt-9 flex items-center justify-center gap-4">
          <Show when="signed-in">
            <Link
              href="/session"
              className="rounded-full bg-emerald-500 px-6 py-3 font-medium text-neutral-950 hover:bg-emerald-400"
            >
              Start a focus session
            </Link>
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="rounded-full bg-emerald-500 px-6 py-3 font-medium text-neutral-950 hover:bg-emerald-400">
                Get started
              </button>
            </SignInButton>
          </Show>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-6 text-center text-sm font-mono uppercase tracking-widest text-neutral-500">
          What it reads, on your device
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STATES.map((s) => (
            <li
              key={s.label}
              className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3"
            >
              <span className={`h-3 w-3 rounded-full ${s.color}`} />
              <span className="font-mono text-sm">{s.label}</span>
              <span className="ml-auto text-xs text-neutral-500">{s.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
