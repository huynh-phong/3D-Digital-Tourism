import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Lang } from "@/types";

/**
 * TTS adapter. Configure ONE provider via env (see .env.example).
 * Voice names are configurable because availability changes over time —
 * verify them against the provider's current voice list when deploying.
 */
export interface TtsProvider {
  name: string;
  synthesize(text: string, lang: Lang): Promise<ArrayBuffer>;
  /** progressive audio, when the provider can produce it */
  stream?(text: string, lang: Lang): Promise<ReadableStream<Uint8Array>>;
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

const voiceFor = (lang: Lang) => (lang === "vi" ? process.env.TTS_VOICE_VI || "vi-VN-HoaiMyNeural" : process.env.TTS_VOICE_EN || "en-US-JennyNeural");

/**
 * Free voices via the Python `edge-tts` library (Microsoft Edge Read Aloud, no
 * API key). Runs server/edge_tts_stdio.py: text in on stdin, MP3 out on
 * stdout — no temp files. Needs Python with `pip install -r requirements.txt`
 * and Internet access; on failure the route answers 502 and the browser falls
 * back to its own voice / subtitles.
 */
class EdgeTts implements TtsProvider {
  name = "edge";
  private static running = 0;
  private static cache = new Map<string, ArrayBuffer>(); // tour sentences repeat; keep a few in memory
  private python = resolvePython();
  private script = path.join(process.cwd(), "server", "edge_tts_stdio.py");

  async synthesize(text: string, lang: Lang) {
    const stream = await this.stream(text, lang);
    const buf = Buffer.from(await new Response(stream).arrayBuffer());
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }

  /**
   * MP3 as it is generated (the service speaks roughly in real time, so a
   * long sentence would otherwise make the visitor wait). Resolves once the
   * first audio bytes arrive — or rejects, so the route can answer 502 and the
   * browser falls back to its own voice.
   */
  stream(text: string, lang: Lang): Promise<ReadableStream<Uint8Array>> {
    const voice = voiceFor(lang);
    const key = `${voice}|${text}`;
    const hit = EdgeTts.cache.get(key);
    if (hit) return Promise.resolve(new Blob([hit]).stream());
    if (EdgeTts.running >= 4) return Promise.reject(new Error("edge busy")); // bound concurrent child processes
    EdgeTts.running++;

    return new Promise((resolve, reject) => {
      const child = spawn(this.python, [this.script], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
      const chunks: Buffer[] = [];
      let err = "";
      let started = false;
      let done = false;
      let ctrl: ReadableStreamDefaultController<Uint8Array> | null = null;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        EdgeTts.running--;
      };
      const timer = setTimeout(() => child.kill(), 45_000);
      const body = new ReadableStream<Uint8Array>({
        start: (c) => void (ctrl = c),
        cancel: () => void child.kill(), // the visitor skipped ahead: stop generating
      });
      child.stdout.on("data", (c: Buffer) => {
        chunks.push(c);
        ctrl?.enqueue(new Uint8Array(c));
        if (!started) {
          started = true;
          resolve(body);
        }
      });
      child.stderr.on("data", (c: Buffer) => {
        if (err.length < 300) err += c.toString();
      });
      child.on("error", (e) => {
        finish();
        if (!started) reject(new Error(`edge spawn: ${(e as NodeJS.ErrnoException).code ?? e.message}`));
      });
      child.on("close", (code) => {
        finish();
        if (code === 0 && chunks.length) {
          const all = Buffer.concat(chunks);
          EdgeTts.cache.set(key, all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) as ArrayBuffer);
          if (EdgeTts.cache.size > 80) EdgeTts.cache.delete(EdgeTts.cache.keys().next().value!);
        }
        if (!started) reject(new Error(`edge exit ${code}${err ? ": " + err.trim().slice(0, 120) : ""}`));
        else {
          try {
            ctrl?.close();
          } catch {
            /* already cancelled */
          }
        }
      });
      child.stdin.end(JSON.stringify({ text, voice }), "utf8");
    });
  }
}

/** EDGE_TTS_PYTHON, else the project's .venv, else python on PATH. */
function resolvePython() {
  if (process.env.EDGE_TTS_PYTHON) return process.env.EDGE_TTS_PYTHON;
  const venv = path.join(process.cwd(), ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (existsSync(venv)) return venv;
  return process.platform === "win32" ? "python" : "python3";
}

export function getTtsProvider(): TtsProvider | null {
  const which = (process.env.TTS_PROVIDER || "").toLowerCase();
  if (which === "edge") return new EdgeTts();
  if ((which === "azure" || !which) && process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
    return new AzureTts(process.env.AZURE_SPEECH_KEY, process.env.AZURE_SPEECH_REGION);
  }
  if ((which === "google" || !which) && process.env.GOOGLE_TTS_API_KEY) return new GoogleTts(process.env.GOOGLE_TTS_API_KEY);
  // no paid provider configured → free Edge voices
  if (!which) return new EdgeTts();
  return null;
}
