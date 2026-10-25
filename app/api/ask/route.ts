import { z } from "zod";
import { TOUR_STOPS } from "@/data/dinh/tour";
import { composeOfflineAnswer, detectIntent, retrieve } from "@/lib/knowledge/retrieve";
import { getAiProvider } from "@/lib/server/ai";
import { clientKey, rateLimit } from "@/lib/server/rateLimit";

const stopIds = TOUR_STOPS.map((s) => s.id) as [string, ...string[]];

const Body = z.object({
  question: z.string().trim().min(1).max(400),
  lang: z.enum(["vi", "en"]),
  currentStopId: z.enum(stopIds).nullable().optional(),
  nextStopId: z.enum(stopIds).nullable().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1200) }))
    .max(8)
    .default([]),
});

export async function POST(req: Request) {
  if (!rateLimit("ask:" + clientKey(req), 6, 0.2)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const ctx = { currentStopId: body.currentStopId, nextStopId: body.nextStopId };
  const offline = composeOfflineAnswer(body.question, body.lang, ctx);
  const intent = detectIntent(body.question);
  const provider = getAiProvider();

  // Navigation intents and demo mode are answered deterministically.
  if (!provider || intent === "next_stop" || intent === "free_explore") {
    return Response.json({
      answer: offline.answer,
      mode: provider ? "ai" : "demo",
      sources: offline.entries.flatMap((e) => e.source_urls),
      entries: offline.entries.map((e) => e.id),
    });
  }

  const hits = retrieve(body.question, body.currentStopId);
  const entries = hits.map((h) => h.entry);
  try {
    const answer = await provider.answer({ ...body, ...ctx, entries });
    return Response.json({
      answer,
      mode: "ai",
      sources: [...new Set(entries.flatMap((e) => e.source_urls))],
      entries: entries.map((e) => e.id),
    });
  } catch (err) {
    console.error("[ask] provider failed:", err instanceof Error ? err.message : err);
    // Honest fallback: say we used the archive, not the AI.
    return Response.json({
      answer: offline.answer,
      mode: "fallback",
      sources: offline.entries.flatMap((e) => e.source_urls),
      entries: offline.entries.map((e) => e.id),
    });
  }
}
