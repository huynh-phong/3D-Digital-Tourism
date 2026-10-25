import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/server/rateLimit";
import { getTtsProvider } from "@/lib/server/tts";

const Body = z.object({
  text: z.string().trim().min(1).max(600),
  lang: z.enum(["vi", "en"]),
});

export async function POST(req: Request) {
  const provider = getTtsProvider();
  if (!provider) return Response.json({ error: "tts_not_configured" }, { status: 501 });
  if (!rateLimit("tts:" + clientKey(req), 40, 1)) return Response.json({ error: "rate_limited" }, { status: 429 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    const audio = await provider.synthesize(body.text, body.lang);
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" },
    });
  } catch (err) {
    console.error("[tts] provider failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "tts_failed" }, { status: 502 });
  }
}
