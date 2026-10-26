import "server-only";
import type { Lang } from "@/types";
import { directSpeech, stripTags } from "./expressive";

/**
 * Text-to-speech for Minh Anh, with one fixed voice per language.
 *
 * Default — Azure AI Speech (native voices, natural pronunciation):
 *   Vietnamese vi-VN-HoaiMyNeural, English en-US-JennyNeural.
 * Alternative — ElevenLabs (TTS_PROVIDER=elevenlabs): one voice for both
 *   languages, stable settings + request stitching.
 *
 * Keys are sent only in request headers from the server. Upstream requests are
 * queued (few in flight), rate-limit / overload answers retried with backoff,
 * audio streamed through as it arrives and repeated sentences cached.
 */
export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // ElevenLabs Sarah
const AZURE_VOICES: Record<Lang, string> = { vi: "vi-VN-HoaiMyNeural", en: "en-US-JennyNeural" };

/** Error with a short, non-secret reason the route can report. */
export class TtsError extends Error {
  constructor(public reason: "voice_not_configured" | "invalid_key" | "quota" | "rate_limited" | "timeout" | "network" | "upstream") {
    super(reason);
  }
}

/** Neighbouring sentences, for continuous prosody across separate requests (ElevenLabs). */
export interface SpeechContext {
  prev?: string;
  next?: string;
}

export interface TtsProvider {
  name: string;
  /** voice(s) used, for /api/status (public voice names / IDs, not secrets) */
  voices: Record<Lang, string>;
  synthesize(text: string, lang: Lang, ctx?: SpeechContext): Promise<ArrayBuffer>;
  /** audio as it is generated */
  stream(text: string, lang: Lang, ctx?: SpeechContext): Promise<ReadableStream<Uint8Array>>;
}

/* ------------------------------------------------ shared upstream handling */
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

/** Azure AI Speech REST: native Vietnamese / English neural voices. */
class AzureTts implements TtsProvider {
  name = "azure";
  private key = (process.env.AZURE_SPEECH_KEY ?? "").trim();
  private region = (process.env.AZURE_SPEECH_REGION ?? "").trim();
  voices: Record<Lang, string> = {
    vi: (process.env.AZURE_VOICE_VI || AZURE_VOICES.vi).trim(),
    en: (process.env.AZURE_VOICE_EN || AZURE_VOICES.en).trim(),
  };

  async synthesize(text: string, lang: Lang) {
    return new Response(await this.stream(text, lang)).arrayBuffer();
  }

  async stream(text: string, lang: Lang): Promise<ReadableStream<Uint8Array>> {
    const voice = this.voices[lang];
    if (!/^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9]+Neural$/.test(voice) || !/^[a-z0-9]+$/.test(this.region)) throw new TtsError("voice_not_configured");
    const locale = voice.slice(0, 5);
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}"><voice name="${voice}">${escapeXml(stripTags(text))}</voice></speak>`;
    return upstreamAudio(`azure|${voice}|${ssml}`, () =>
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

/* ----------------------------------------------------------- ElevenLabs */
/** Fixed delivery so every sentence sounds like the same speaker. */
const VOICE_SETTINGS = { stability: 0.8, similarity_boost: 0.9, style: 0, use_speaker_boost: true };
const SEED = 7;

class ElevenLabsTts implements TtsProvider {
  name = "elevenlabs";
  private key = (process.env.ELEVENLABS_API_KEY ?? "").trim();
  private voiceId = (process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID).trim();
  private model = (process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5").trim();
  voices: Record<Lang, string> = { vi: this.voiceId, en: this.voiceId };

  async synthesize(text: string, lang: Lang, ctx: SpeechContext = {}) {
    return new Response(await this.stream(text, lang, ctx)).arrayBuffer();
  }

  /** Request body: stable settings + stitching, or (eleven_v3) tags for Vietnamese. */
  private body(text: string, lang: Lang, ctx: SpeechContext) {
    if (this.model === "eleven_v3") {
      return { text: lang === "vi" ? directSpeech(text) : stripTags(text), model_id: this.model, seed: SEED };
    }
    return {
      text: stripTags(text),
      model_id: this.model,
      language_code: lang,
      voice_settings: VOICE_SETTINGS,
      seed: SEED,
      ...(ctx.prev ? { previous_text: stripTags(ctx.prev) } : {}),
      ...(ctx.next ? { next_text: stripTags(ctx.next) } : {}),
    };
  }

  async stream(text: string, lang: Lang, ctx: SpeechContext = {}): Promise<ReadableStream<Uint8Array>> {
    if (!/^[A-Za-z0-9]{10,40}$/.test(this.voiceId)) throw new TtsError("voice_not_configured");
    const payload = JSON.stringify(this.body(text, lang, ctx));
    return upstreamAudio(`eleven|${this.voiceId}|${payload}`, () =>
      fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream?output_format=mp3_44100_64`, {
        method: "POST",
        headers: { "xi-api-key": this.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: payload,
        signal: AbortSignal.timeout(20_000),
      }),
    );
  }
}

/** TTS_PROVIDER=azure|elevenlabs; unset → Azure when its key is set, else ElevenLabs. */
export function getTtsProvider(): TtsProvider | null {
  const which = (process.env.TTS_PROVIDER || "").toLowerCase();
  const azure = !!process.env.AZURE_SPEECH_KEY?.trim() && !!process.env.AZURE_SPEECH_REGION?.trim();
  const eleven = !!process.env.ELEVENLABS_API_KEY?.trim();
  if ((which === "azure" || !which) && azure) return new AzureTts();
  if ((which === "elevenlabs" || !which) && eleven) return new ElevenLabsTts();
  return null;
}
