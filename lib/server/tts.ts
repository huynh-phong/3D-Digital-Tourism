import "server-only";
import type { Lang } from "@/types";
import { directSpeech, stripTags } from "./expressive";

/**
 * TTS adapter. ElevenLabs is the default when ELEVENLABS_API_KEY is set;
 * Azure / Google remain available via TTS_PROVIDER.
 * Voice names are configurable because availability changes over time —
 * verify them against the provider's current voice list when deploying.
 */
/** Error with a short, non-secret reason the route can report. */
export class TtsError extends Error {
  constructor(public reason: "voice_not_configured" | "invalid_key" | "quota" | "rate_limited" | "timeout" | "network" | "upstream" | "busy") {
    super(reason);
  }
}

export interface TtsProvider {
  name: string;
  synthesize(text: string, lang: Lang): Promise<ArrayBuffer>;
  /** progressive audio, when the provider can produce it */
  stream?(text: string, lang: Lang): Promise<ReadableStream<Uint8Array>>;
  /** whether a voice is configured for this language (default: yes) */
  hasVoice?(lang: Lang): boolean;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

class AzureTts implements TtsProvider {
  name = "azure";
  constructor(private key: string, private region: string) {}
  async synthesize(text: string, lang: Lang) {
    const voice = voiceFor(lang);
    const locale = lang === "vi" ? "vi-VN" : "en-US";
    const ssml = `<speak version="1.0" xml:lang="${locale}"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
    const res = await fetch(`https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": this.key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "saigon3d",
      },
      body: ssml,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`azure ${res.status}`);
    return res.arrayBuffer();
  }
}

class GoogleTts implements TtsProvider {
  name = "google";
  constructor(private key: string) {}
  async synthesize(text: string, lang: Lang) {
    const languageCode = lang === "vi" ? "vi-VN" : "en-US";
    const name = lang === "vi" ? process.env.TTS_VOICE_VI : process.env.TTS_VOICE_EN;
    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(this.key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        // Without a name, Google picks a voice matching language + gender.
        voice: name ? { languageCode, name } : { languageCode, ssmlGender: "FEMALE" },
        audioConfig: { audioEncoding: "MP3" },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`google ${res.status}`);
    const json = (await res.json()) as { audioContent?: string };
    if (!json.audioContent) throw new Error("google empty");
    const buf = Buffer.from(json.audioContent, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }
}

/** Azure / Google voice names (ElevenLabs uses its own voice IDs). */
const voiceFor = (lang: Lang) => (lang === "vi" ? process.env.TTS_VOICE_VI || "vi-VN-HoaiMyNeural" : process.env.TTS_VOICE_EN || "en-US-JennyNeural");

/**
 * ElevenLabs (official REST API, streaming endpoint). The key is sent only in
 * the `xi-api-key` header from the server.
 *
 * - Vietnamese: voice ELEVENLABS_VOICE_ID_VI ("Trang"), model eleven_v3 with
 *   selective audio tags (see expressive.ts) for natural emphasis.
 * - English: voice ELEVENLABS_VOICE_ID_EN, eleven_flash_v2_5 (lowest latency),
 *   plain text — no expressive tags.
 * A missing voice ID is an error, never a silent substitute voice.
 */
class ElevenLabsTts implements TtsProvider {
  name = "elevenlabs";
  private static cache = new Map<string, ArrayBuffer>(); // repeated tour sentences
  private static running = 0;
  private key = (process.env.ELEVENLABS_API_KEY ?? "").trim();

  private cfg(lang: Lang) {
    return lang === "vi"
      ? { voice: process.env.ELEVENLABS_VOICE_ID_VI?.trim(), model: process.env.ELEVENLABS_MODEL_VI || "eleven_v3", tags: true }
      : { voice: process.env.ELEVENLABS_VOICE_ID_EN?.trim(), model: process.env.ELEVENLABS_MODEL_EN || "eleven_flash_v2_5", tags: false };
  }

  hasVoice(lang: Lang) {
    return !!this.cfg(lang).voice;
  }

  async synthesize(text: string, lang: Lang) {
    return new Response(await this.stream(text, lang)).arrayBuffer();
  }

  async stream(text: string, lang: Lang): Promise<ReadableStream<Uint8Array>> {
    const { voice, model, tags } = this.cfg(lang);
    if (!voice || !/^[A-Za-z0-9]{10,40}$/.test(voice)) throw new TtsError("voice_not_configured");
    // what is spoken: tags only for models that support them; what is shown is never changed
    const spoken = tags && model === "eleven_v3" ? directSpeech(text) : stripTags(text);
    const key = `${voice}|${model}|${spoken}`;
    const hit = ElevenLabsTts.cache.get(key);
    if (hit) return new Blob([hit]).stream();
    if (ElevenLabsTts.running >= 6) throw new TtsError("busy");

    let res: Response;
    try {
      res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=mp3_44100_64`, {
        method: "POST",
        headers: { "xi-api-key": this.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: spoken, model_id: model, ...(model === "eleven_v3" ? {} : { language_code: lang }) }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      throw new TtsError((e as Error).name === "TimeoutError" ? "timeout" : "network");
    }
    if (!res.ok || !res.body) {
      throw new TtsError(res.status === 401 || res.status === 403 ? "invalid_key" : res.status === 402 ? "quota" : res.status === 429 ? "rate_limited" : "upstream");
    }
    // pass audio through as it arrives, keeping a copy for the cache
    ElevenLabsTts.running++;
    const chunks: Uint8Array[] = [];
    const reader = res.body.getReader();
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        ElevenLabsTts.running--;
      }
    };
    return new ReadableStream<Uint8Array>({
      async pull(ctrl) {
        try {
          const { value, done: end } = await reader.read();
          if (end) {
            finish();
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
          finish();
          ctrl.error(e);
        }
      },
      cancel() {
        finish();
        void reader.cancel(); // the player skipped ahead: stop downloading
      },
    });
  }
}

export function getTtsProvider(): TtsProvider | null {
  const which = (process.env.TTS_PROVIDER || "").toLowerCase();
  if ((which === "elevenlabs" || !which) && process.env.ELEVENLABS_API_KEY?.trim()) return new ElevenLabsTts();
  if (which === "azure" && process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
    return new AzureTts(process.env.AZURE_SPEECH_KEY, process.env.AZURE_SPEECH_REGION);
  }
  if (which === "google" && process.env.GOOGLE_TTS_API_KEY) return new GoogleTts(process.env.GOOGLE_TTS_API_KEY);
  return null;
}
