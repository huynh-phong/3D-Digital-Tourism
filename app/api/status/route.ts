import { connection } from "next/server";
import { getAiProvider } from "@/lib/server/ai";
import { getTtsProvider } from "@/lib/server/tts";

/** Lets the client show demo-mode state honestly. Never exposes keys. */
export async function GET() {
  await connection(); // read env at request time, not build time
  const tts = getTtsProvider();
  return Response.json({
    ai: getAiProvider()?.name ?? null,
    tts: tts?.name ?? null,
    // the voice per language (public voice names / IDs, not secrets)
    voices: tts?.voices ?? null,
  });
}
