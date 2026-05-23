---
name: video-watcher
description: Watch a local video file or a video URL and turn it into a smart set of frames plus a timestamped transcript that Claude can read. Works on silent screen recordings as well as narrated videos. Use this when the user asks you to look at, analyze, summarize, or answer questions about a video. Runs ffmpeg with scene-change detection for frames, and optionally tesseract for on-screen text and whisper.cpp for audio.
---

# video-watcher

A pipeline that takes a video and produces a manifest of meaningful frames plus an on-disk `frames/` directory. Use it whenever the user wants you to understand a video.

## When to use this skill

- The user references a local video file (`.mp4`, `.mov`, `.webm`, `.mkv`) and asks you to watch, summarize, or answer questions about it.
- The user shares a video URL and asks you to look at the content (requires `yt-dlp`).
- The user asks something like "what happens in this demo?", "what error appears in the screen recording?", or "summarize this walkthrough".

Do not use this skill for audio-only content or for questions that don't require seeing the video.

## How to use it

1. Run the pipeline from the directory that contains the skill:

   ```bash
   node scripts/watch.mjs <path-to-video-or-url>
   ```

   URLs (e.g. YouTube links) are downloaded via `yt-dlp` into `out/source/` first, then processed.

   Useful flags:
   - `--out <dir>` output directory (default `./out`)
   - `--max-frames <n>` cap on frames (default 40)
   - `--scene <0..1>` scene-change threshold (default 0.3 — lower for slow UI videos, higher for action-heavy footage)
   - `--ocr` run tesseract on each frame and attach the recognized text to the manifest (skipped if tesseract is not installed)
   - `--transcribe` transcribe the audio track with whisper.cpp and add a `transcript` array of timestamped segments to the manifest (skipped if the video has no audio, or if whisper-cli / the model are not installed)

2. Read `out/manifest.json`. It lists every frame with its timestamp and relative path, plus a `transcript` array if `--transcribe` ran.

3. Read individual frames from `out/frames/NNN.png` using the image-capable Read tool. Do not load every frame at once — pick the ones whose timestamps are relevant to the user's question. The manifest is small; the frames are not.

4. If a transcript is present, pair it with frames by timestamp. The transcript tells you what is being said; the frames tell you what is on screen. Quote timestamps when you reference specific moments.

5. If the user pastes their own transcript or captions, treat that as authoritative over the auto-generated one.

## Tuning

- If the manifest comes back with too few frames, lower `--scene` (try `0.15`).
- If the manifest is at the cap of 40 and the video is long, raise `--max-frames` rather than `--scene`.
- For tutorial videos where the screen is mostly text, pass `--ocr` so on-screen text reaches you cheaply via the manifest rather than through vision.

## Dependencies

- `ffmpeg` must be on PATH.
- `tesseract` (optional, for `--ocr`): `brew install tesseract`.
- `yt-dlp` (optional, for URL inputs): `brew install yt-dlp`.
- `whisper-cpp` (optional, for `--transcribe`): `brew install whisper-cpp`, then download a ggml model and either place it at `~/.cache/whisper/ggml-base.en.bin` or point at it via `WHISPER_MODEL_PATH` or `--whisper-model`. Example:

  ```bash
  mkdir -p ~/.cache/whisper
  curl -L -o ~/.cache/whisper/ggml-base.en.bin \
    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
  ```
