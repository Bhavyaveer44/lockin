# Lockin — on-device deep-work camera companion

https://lockin-sooty.vercel.app/

Your webcam becomes a focus coach. Real-time computer vision runs **entirely in
the browser** (MediaPipe Tasks Vision) — the camera feed never touches a server.
Only derived state labels + timestamps are saved. At day's end, Groq turns that
timeline into an AI focus debrief.

## How it works

```
Webcam → MediaPipe (in-browser)
  • FaceLandmarker → gaze yaw/pitch + eye openness
  • PoseLandmarker → neck/slouch angle, presence
  • ObjectDetector → phone-in-hand
→ state classifier (hysteresis): focused | distracted | phone | away | fading
→ live HUD + nudges
→ batched {state, startedAt, durationSec} → Neon   (frames discarded)
→ /today: Groq reads the day's timeline → headline, narrative, one fix
```

## Stack

Next 16 (App Router) · Clerk v7 · Neon + Drizzle · Groq (AI SDK v6) ·
MediaPipe Tasks Vision · Tailwind v4 · Vercel.

## Setup

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in Clerk, Neon, Groq keys.
3. `npm run db:push` to create the `sessions` / `signal_events` tables.
4. `npm run dev` and open http://localhost:3000

## Privacy invariant

No image or video bytes are ever sent anywhere. The `/api/signals` endpoint
accepts only the `WorkState` enum + timestamps (validated with zod). Verify in
DevTools → Network: you'll see small JSON label batches, never image payloads.

## Tests

`npm test` — covers the state classifier (hysteresis/flicker), head-pose
geometry, and day aggregation. 20 tests.
