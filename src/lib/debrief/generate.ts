import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";
import type { DayAggregate } from "./aggregate";

// Lazy provider init so `next build` never needs GROQ_API_KEY.
function groqModel() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  // gpt-oss-20b supports `json_schema` structured output on Groq;
  // llama-3.3-70b-versatile does NOT and rejects generateObject.
  return createGroq({ apiKey })("openai/gpt-oss-20b");
}

export const debriefSchema = z.object({
  headline: z.string().describe("A short, punchy one-line summary of the day."),
  narrative: z
    .string()
    .describe("2-4 sentences: when they were locked in, when they faded, and why."),
  topFix: z
    .string()
    .describe("One concrete, specific change to try tomorrow."),
});

export type Debrief = z.infer<typeof debriefSchema> & {
  focusScore: number;
  topDistraction: string | null;
};

// Render seconds as a short, human phrase ("3 min 20 sec", "45 sec").
function human(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s} sec`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} sec`;
}

export async function generateDebrief(agg: DayAggregate): Promise<Debrief> {
  const totalSec = agg.totalSec;
  const byStateHuman = Object.fromEntries(
    Object.entries(agg.byState)
      .filter(([, s]) => s > 0)
      .map(([k, s]) => [k, human(s)]),
  );

  const { object } = await generateObject({
    model: groqModel(),
    prompt: `You are a focus coach reviewing a work session. You only have
derived, on-device signals (no video). Be specific, warm, and honest — not
generic. Avoid platitudes.

Total tracked time TODAY: ${human(totalSec)} (this is the ENTIRE period — do NOT
describe it as hours or imply it was longer than this).
Focus score: ${agg.focusScore}/100 (share of engaged time spent locked in).
Top distraction: ${agg.topDistraction ?? "none"}.
Time by state: ${JSON.stringify(byStateHuman)}.
Timeline by hour-of-day:
${agg.timeline || "(no activity tracked)"}

Use ONLY the durations given above — never invent or round up to hours. If the
total is a few minutes, talk in minutes. Reference a specific moment where focus
dipped and give one concrete fix tied to their biggest leak.`,
    schema: debriefSchema,
  });

  return {
    ...object,
    focusScore: agg.focusScore,
    topDistraction: agg.topDistraction,
  };
}
