"""Text-to-speech with the `edge-tts` library (Microsoft Edge Read Aloud voices, no API key).

Called by lib/server/tts.ts: reads one JSON request from stdin and writes the MP3
bytes to stdout. Nothing is written to disk.

    {"text": "...", "voice": "vi-VN-HoaiMyNeural", "rate": "+0%"}

Exit codes: 0 ok, 2 bad request, 3 service returned no audio, 4 network/service error.
"""

import asyncio
import json
import re
import sys

import edge_tts

VOICE_RE = re.compile(r"^[a-z]{2,3}-[A-Z]{2}-[A-Za-z]+Neural$")
RATE_RE = re.compile(r"^[+-]\d{1,2}%$")


async def main() -> int:
    try:
        req = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        text = str(req["text"]).strip()
        voice = str(req["voice"])
        rate = str(req.get("rate", "+0%"))
    except (ValueError, KeyError, TypeError):
        return 2
    if not text or len(text) > 1000 or not VOICE_RE.match(voice) or not RATE_RE.match(rate):
        return 2

    out = sys.stdout.buffer
    wrote = 0
    try:
        async for chunk in edge_tts.Communicate(text, voice, rate=rate).stream():
            if chunk["type"] == "audio":
                out.write(chunk["data"])
                out.flush()  # hand each piece to the server right away (streaming playback)
                wrote += len(chunk["data"])
    except edge_tts.exceptions.NoAudioReceived:
        return 3
    except Exception as exc:  # network down, service changed, timeout…
        print(f"edge-tts failed: {type(exc).__name__}", file=sys.stderr)
        return 4
    out.flush()
    return 0 if wrote else 3


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
