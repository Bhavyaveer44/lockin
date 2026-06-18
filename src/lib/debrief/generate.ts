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

export async function generateDebrief(agg: DayAggregate): Promise<Debrief> {
  const { object } = await generateObject({
    model: groqModel(),
    schema: debriefSchema,
    prompt: `You are a focus coach reviewing a knowledge worker's day. You only
have derived, on-device signals (no video). Be specific, warm, and honest — not
generic. Avoid platitudes.

Focus score: ${agg.focusScore}/100 (share of engaged time spent locked in).
Top distraction: ${agg.topDistraction ?? "none"}.
Time by state (seconds): ${JSON.stringify(agg.byState)}.
Hourly timeline:
${agg.timeline || "(no activity tracked)"}

Write a debrief that references the actual timeline (e.g. a specific hour where
focus dipped) and gives one concrete fix tied to their biggest leak.`,
  });

  return {
    ...object,
    focusScore: agg.focusScore,
    topDistraction: agg.topDistraction,
  };
}
