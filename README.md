# video-watcher

A Claude Skill that lets Claude reason about what's happening in a video — silent or narrated.

Most "let Claude watch a video" workflows mean running ffmpeg by hand, extracting a wall of frames at a fixed interval, and dragging them into the chat. That wastes tokens on stretches of identical screens and skips the moments that actually matter. This Skill does the picking for you: scene-change detection plus a hard cap on frame count, with optional OCR for on-screen text and optional whisper.cpp transcription for the audio track. Frames and transcript share timestamps, so Claude can pair "what's on screen" with "what's being said".

## How it works

1. ffmpeg's `select='gt(scene,X)'` filter emits a frame only when the visual delta crosses a threshold. For UI walkthroughs and screen recordings that drops the frame count by an order of magnitude versus naive sampling.
2. If a long video still produces hundreds of scene changes, frames are sampled evenly across them so the output stays under a cap (default 40).
3. Optional tesseract pass writes OCR text for each frame into the manifest, so Claude can read on-screen text cheaply.
4. Optional whisper.cpp pass extracts the audio, transcribes it, and writes timestamped segments alongside the frames.
5. A `manifest.json` lists every frame with its timestamp, path, and OCR text, plus a `transcript` array when transcription ran. Claude reads the manifest first and pulls individual frames on demand.

## Install

```
git clone https://github.com/<user>/video-watcher
```

Drop the folder into a place your Claude tool looks for Skills (e.g. `~/.claude/skills/` for Claude Code).

Dependencies:

- `ffmpeg` (required) — `brew install ffmpeg`
- `tesseract` (optional, OCR) — `brew install tesseract`
- `yt-dlp` (optional, URL inputs) — `brew install yt-dlp`
- `whisper-cpp` (optional, audio transcription) — `brew install whisper-cpp`, plus a ggml model (see below)

No npm runtime dependencies.

### Whisper model

`--transcribe` looks for a model at `$WHISPER_MODEL_PATH`, then `~/.cache/whisper/ggml-base.en.bin`. To grab the default:

```bash
mkdir -p ~/.cache/whisper
curl -L -o ~/.cache/whisper/ggml-base.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
```

You can also point at any other ggml model with `--whisper-model <path>`.

## Usage

From a Claude session:

> Watch ./demo.mp4 and tell me what error appears.

The Skill runs the pipeline and produces a manifest plus a `frames/` directory. Claude reads them from there.

Direct CLI use:

```
node scripts/watch.mjs ./demo.mp4
node scripts/watch.mjs ./demo.mp4 --max-frames 20 --scene 0.2 --ocr --transcribe
```

Flags:

- `--out <dir>` output directory (default `./out`)
- `--max-frames <n>` cap on frames in the manifest (default 40)
- `--scene <0..1>` scene-change threshold (default 0.3)
- `--ocr` run tesseract over each frame and attach text to the manifest
- `--transcribe` transcribe audio with whisper.cpp and attach a timestamped transcript to the manifest
- `--whisper-model <path>` explicit ggml model path (overrides `WHISPER_MODEL_PATH` and the default location)

## Output

```
out/
  frames/
    000.png
    001.png
    ...
  manifest.json
```

`manifest.json`:

```json
{
  "video": "demo.mp4",
  "duration_sec": 87.4,
  "frame_count": 12,
  "frames": [
    { "timestamp": "00:00.000", "path": "frames/000.png", "ocr": "Welcome screen\nGet started" },
    { "timestamp": "00:04.512", "path": "frames/001.png", "ocr": "..." }
  ],
  "transcript": [
    { "timestamp": "00:00.000", "start": 0.0, "end": 4.5, "text": "Welcome. Let me show you the dashboard." },
    { "timestamp": "00:04.500", "start": 4.5, "end": 9.2, "text": "First, click the gear icon..." }
  ]
}
```

## Status

Early.

## License

MIT.
