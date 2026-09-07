import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AnalyzeInput = z.object({
  imageDataUrl: z.string().min(32),
  latitude: z.number(),
  longitude: z.number(),
  locality: z.string().default(""),
});

export type AnalysisResult = {
  category: string;
  authentic: boolean;
  confidence: number;
  authenticity: number;
  severity: "low" | "medium" | "high";
  area: "urban" | "rural";
  notes: string;
};

const SYSTEM = `You are the verification engine of a civic issue reporting app used by municipal corporations.
Look at the photo and decide:
1. Is it a genuine, freshly-photographed civic infrastructure problem in a public place (original), or is it fake/irrelevant/a screenshot/a picture of a screen/AI-generated/an indoor or unrelated scene?
2. Which civic problem category it is.
3. How severe it is, and whether the surroundings look urban or rural.
Reply ONLY with JSON:
{"category":"pothole|drainage|streetlight|garbage|water_supply|road_damage|other","authentic":true,"confidence":0-100,"authenticity":0-100,"severity":"low|medium|high","area":"urban|rural","notes":"one short sentence"}`;

export const analyzePhoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data }): Promise<AnalysisResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this app.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Coordinates ${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}. Nearby locality: ${data.locality || "unknown"}.`,
              },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429)
        throw new Error("Too many scans right now. Wait a moment and try again.");
      if (res.status === 402)
        throw new Error("AI credits are exhausted. Ask the app owner to top up.");
      throw new Error(`Photo scan failed (${res.status}): ${body.slice(0, 180)}`);
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = payload.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("The scan returned an unreadable result.");
    const parsed = JSON.parse(match[0]) as Partial<AnalysisResult>;

    return {
      category: parsed.category ?? "other",
      authentic: parsed.authentic ?? false,
      confidence: Math.round(Number(parsed.confidence ?? 0)),
      authenticity: Math.round(Number(parsed.authenticity ?? parsed.confidence ?? 0)),
      severity: parsed.severity ?? "medium",
      area: parsed.area ?? "urban",
      notes: parsed.notes ?? "",
    };
  });
