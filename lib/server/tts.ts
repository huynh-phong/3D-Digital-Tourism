import "server-only";
import type { Lang } from "@/types";

/**
 * TTS adapter. Configure ONE provider via env (see .env.example).
 * Voice names are configurable because availability changes over time —
 * verify them against the provider's current voice list when deploying.
 */
export interface TtsProvider {
  name: string;
  synthesize(text: string, lang: Lang): Promise<ArrayBuffer>;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

class AzureTts implements TtsProvider {
  name = "azure";
  constructor(private key: string, private region: string) {}
  async synthesize(text: string, lang: Lang) {
    const voice = lang === "vi" ? process.env.TTS_VOICE_VI || "vi-VN-HoaiMyNeural" : process.env.TTS_VOICE_EN || "en-US-JennyNeural";
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

export function getTtsProvider(): TtsProvider | null {
  const which = (process.env.TTS_PROVIDER || "").toLowerCase();
  if ((which === "azure" || !which) && process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
    return new AzureTts(process.env.AZURE_SPEECH_KEY, process.env.AZURE_SPEECH_REGION);
  }
  if ((which === "google" || !which) && process.env.GOOGLE_TTS_API_KEY) return new GoogleTts(process.env.GOOGLE_TTS_API_KEY);
  return null;
}
