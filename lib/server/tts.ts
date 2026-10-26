import "server-only";
import type { Lang } from "@/types";

/**
 * Text-to-speech for Minh Anh: Azure AI Speech only, one fixed native voice
 * per language — Vietnamese vi-VN-HoaiMyNeural, English en-US-JennyNeural.
 *
 * The key is sent only in a request header from the server. Upstream requests
 * are queued (few in flight), rate-limit / overload answers retried with
 * backoff, audio streamed through as it arrives and repeated sentences cached
 * in memory.
 */
const DEFAULT_VOICES: Record<Lang, string> = { vi: "vi-VN-HoaiMyNeural", en: "en-US-JennyNeural" };

/** Error with a short, non-secret reason the route can report. */
export class TtsError extends Error {
  constructor(public reason: "voice_not_configured" | "invalid_key" | "quota" | "rate_limited" | "timeout" | "network" | "upstream") {
    super(reason);
  }
}

export interface TtsProvider {
  name: string;
  /** voice per language, for /api/status (public voice names, not secrets) */
  voices: Record<Lang, string>;
  synthesize(text: string, lang: Lang): Promise<ArrayBuffer>;
  /** audio as it is generated */
  stream(text: string, lang: Lang): Promise<ReadableStream<Uint8Array>>;
}

/* ------------------------------------------------ upstream handling */
const MAX_PARALLEL = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cache = new Map<string, ArrayBuffer>(); // repeated tour sentences
let running = 0;
const waiting: (() => void)[] = [];

/** Wait for a free upstream slot (released when the audio has been fully read). */
async function slot() {
  if (running < MAX_PARALLEL) {
    running++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
}
function release() {
  const next = waiting.shift();
  if (next) next();
  else running--;
}

/** Fetch with retry on network errors, 429 and 5xx; returns an audio stream that also fills the cache. */
async function upstreamAudio(cacheKey: string, request: () => Promise<Response>): Promise<ReadableStream<Uint8Array>> {
  const hit = cache.get(cacheKey);
  if (hit) return new Blob([hit]).stream();

  await slot();
  let res: Response | null = null;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        res = await request();
      } catch (e) {
        if (attempt < 2) {
          await sleep(500 * (attempt + 1));
          continue;
        }
        throw new TtsError((e as Error).name === "TimeoutError" ? "timeout" : "network");
      }
      // busy / overloaded: wait and try again rather than giving up
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await sleep(700 * (attempt + 1));
        continue;
      }
      break;
    }
    if (!res!.ok || !res!.body) {
      const s = res!.status;
      throw new TtsError(s === 401 || s === 403 ? "invalid_key" : s === 402 ? "quota" : s === 429 ? "rate_limited" : "upstream");
    }
  } catch (e) {
    release();
    throw e;
  }

  // pass audio through as it arrives, keeping a copy for the cache
  const chunks: Uint8Array[] = [];
  const reader = res!.body!.getReader();
  let released = false;
  const done = () => {
    if (!released) {
      released = true;
      release();
    }
  };
  return new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      try {
        const { value, done: end } = await reader.read();
        if (end) {
          done();
          const all = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
          let o = 0;
          for (const c of chunks) {
            all.set(c, o);
            o += c.length;
          }
          if (all.length) {
            cache.set(cacheKey, all.buffer);
            if (cache.size > 120) cache.delete(cache.keys().next().value!);
          }
          ctrl.close();
          return;
        }
        chunks.push(value);
        ctrl.enqueue(value);
      } catch (e) {
        done();
        ctrl.error(e);
      }
    },
    cancel() {
      done();
      void reader.cancel(); // the player skipped ahead: stop downloading
    },
  });
}

/* ---------------------------------------------------------------- Azure */
const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

class AzureTts implements TtsProvider {
  name = "azure";
  private key = (process.env.AZURE_SPEECH_KEY ?? "").trim();
  private region = (process.env.AZURE_SPEECH_REGION ?? "").trim();
  voices: Record<Lang, string> = {
    vi: (process.env.AZURE_VOICE_VI || DEFAULT_VOICES.vi).trim(),
    en: (process.env.AZURE_VOICE_EN || DEFAULT_VOICES.en).trim(),
  };

  async synthesize(text: string, lang: Lang) {
    return new Response(await this.stream(text, lang)).arrayBuffer();
  }

  async stream(text: string, lang: Lang): Promise<ReadableStream<Uint8Array>> {
    const voice = this.voices[lang];
    if (!/^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9]+Neural$/.test(voice) || !/^[a-z0-9]+$/.test(this.region)) throw new TtsError("voice_not_configured");
    const locale = voice.slice(0, 5);
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
    return upstreamAudio(`${voice}|${ssml}`, () =>
      fetch(`https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": this.key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "saigon3d",
        },
        body: ssml,
        signal: AbortSignal.timeout(20_000),
      }),
    );
  }
}

export function getTtsProvider(): TtsProvider | null {
  return process.env.AZURE_SPEECH_KEY?.trim() && process.env.AZURE_SPEECH_REGION?.trim() ? new AzureTts() : null;
}
