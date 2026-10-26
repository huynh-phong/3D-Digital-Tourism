import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/server/rateLimit";
import { getTtsProvider, TtsError } from "@/lib/server/tts";

const Body = z.object({
  text: z.string().trim().min(1).max(600),
  lang: z.enum(["vi", "en"]),
});

/**
 * GET /api/tts?lang=vi&text=… streams MP3 so an <audio> element can start
 * playing while the rest is still being generated. POST returns the whole file.
 * Audio is never cached by the browser (no-store), so a voice change on the
 * server is heard immediately; repeated sentences are cached server-side.
 */
export async function GET(req: Request) {
  const provider = getTtsProvider();
  if (!provider) return Response.json({ error: "tts_not_configured" }, { status: 501 });
  if (!rateLimit("tts:" + clientKey(req), 40, 1)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const q = new URL(req.url).searchParams;
  const parsed = Body.safeParse({ text: q.get("text") ?? "", lang: q.get("lang") });
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const { text, lang } = parsed.data;
  try {
    const body = await provider.stream(text, lang);
    return new Response(body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (err) {
    return failure(err);
  }
}

/** Short reason for the client (no secrets, no upstream bodies). */
function failure(err: unknown) {
  const reason = err instanceof TtsError ? err.reason : "upstream";
  console.error("[tts] provider failed:", reason);
  const status = reason === "voice_not_configured" ? 501 : reason === "rate_limited" ? 429 : 502;
  return Response.json({ error: "tts_failed", reason }, { status });
}

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
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return failure(err);
  }
}
