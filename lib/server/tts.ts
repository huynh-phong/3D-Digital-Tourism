import "server-only";
import type { Lang } from "@/types";
import { directSpeech, stripTags } from "./expressive";

/**
 * Text-to-speech: ElevenLabs only, one fixed voice for everything Minh Anh
 * says (Sarah by default), so the guide never changes voice.
 *
 * Consistency first: Vietnamese and English use the same model
 * (eleven_flash_v2_5 by default), the same fixed voice settings and seed, and
 * every sentence is sent with its neighbours as previous_text / next_text
 * (request stitching), so separate sentence requests sound like one speaker.
 * Setting ELEVENLABS_MODEL=eleven_v3 switches to expressive audio tags for
 * Vietnamese instead (v3 varies more between sentences and has no stitching).
 * The key is sent only in the `xi-api-key` header from the server.
 * Rate-limit / overload answers are retried with backoff and requests are
 * queued (the Free plan allows few concurrent requests) instead of failing.
 */
export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah

/** Error with a short, non-secret reason the route can report. */
export class TtsError extends Error {
  constructor(public reason: "voice_not_configured" | "invalid_key" | "quota" | "rate_limited" | "timeout" | "network" | "upstream") {
    super(reason);
  }
}

/** Neighbouring sentences, for continuous prosody across separate requests. */
export interface SpeechContext {
  prev?: string;
  next?: string;
}

export interface TtsProvider {
  name: string;
  voiceId: string;
  synthesize(text: string, lang: Lang, ctx?: SpeechContext): Promise<ArrayBuffer>;
  /** audio as it is generated */
  stream(text: string, lang: Lang, ctx?: SpeechContext): Promise<ReadableStream<Uint8Array>>;
}

/** Fixed delivery so every sentence sounds like the same speaker. */
const VOICE_SETTINGS = { stability: 0.8, similarity_boost: 0.9, style: 0, use_speaker_boost: true };
const SEED = 7;

const MAX_PARALLEL = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class ElevenLabsTts implements TtsProvider {
  name = "elevenlabs";
  private static cache = new Map<string, ArrayBuffer>(); // repeated tour sentences
  private static running = 0;
  private static queue: (() => void)[] = [];
  private key = (process.env.ELEVENLABS_API_KEY ?? "").trim();
  voiceId = (process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID).trim();

  private model = (process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5").trim();

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

  /** Wait for a free upstream slot (released when the audio has been fully read). */
  private static async slot() {
    if (ElevenLabsTts.running < MAX_PARALLEL) {
      ElevenLabsTts.running++;
      return;
    }
    await new Promise<void>((resolve) => ElevenLabsTts.queue.push(resolve));
  }
  private static release() {
    const next = ElevenLabsTts.queue.shift();
    if (next) next();
    else ElevenLabsTts.running--;
  }

  async stream(text: string, lang: Lang, ctx: SpeechContext = {}): Promise<ReadableStream<Uint8Array>> {
    if (!/^[A-Za-z0-9]{10,40}$/.test(this.voiceId)) throw new TtsError("voice_not_configured");
    // what is spoken may carry tags (v3 only); what is shown is never changed
    const payload = JSON.stringify(this.body(text, lang, ctx));
    const key = `${this.voiceId}|${payload}`;
    const hit = ElevenLabsTts.cache.get(key);
    if (hit) return new Blob([hit]).stream();

    await ElevenLabsTts.slot();
    let res: Response | null = null;
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream?output_format=mp3_44100_64`, {
            method: "POST",
            headers: { "xi-api-key": this.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
            body: payload,
            signal: AbortSignal.timeout(20_000),
          });
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
      ElevenLabsTts.release();
      throw e;
    }

    // pass audio through as it arrives, keeping a copy for the cache
    const chunks: Uint8Array[] = [];
    const reader = res!.body!.getReader();
    let released = false;
    const done = () => {
      if (!released) {
        released = true;
        ElevenLabsTts.release();
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
              ElevenLabsTts.cache.set(key, all.buffer);
              if (ElevenLabsTts.cache.size > 120) ElevenLabsTts.cache.delete(ElevenLabsTts.cache.keys().next().value!);
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
}

export function getTtsProvider(): TtsProvider | null {
  return process.env.ELEVENLABS_API_KEY?.trim() ? new ElevenLabsTts() : null;
}
