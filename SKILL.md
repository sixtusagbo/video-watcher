---
name: video-watcher
description: Watch a video file (especially silent screen recordings, UI walkthroughs, or tutorials with no narration) and turn it into a smart set of frames plus timestamps that Claude can read. Use this when the user asks you to look at, analyze, summarize, or answer questions about a local video file or a video URL. Runs ffmpeg with scene-change detection so it only keeps frames where something visually changes.
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
   node scripts/watch.mjs <path-to-video>
   ```

   Useful flags:
   - `--out <dir>` output directory (default `./out`)
   - `--max-frames <n>` cap on frames (default 40)
   - `--scene <0..1>` scene-change threshold (default 0.3 — lower for slow UI videos, higher for action-heavy footage)

2. Read `out/manifest.json`. It lists every frame with its timestamp and relative path.

3. Read individual frames from `out/frames/NNN.png` using the image-capable Read tool. Do not load every frame at once — pick the ones whose timestamps are relevant to the user's question. The manifest is small; the frames are not.

4. Reason about the video using the frames and the timestamps. Quote timestamps when you reference specific moments.

## Tuning

- If the manifest comes back with too few frames, lower `--scene` (try `0.15`).
- If the manifest is at the cap of 40 and the video is long, raise `--max-frames` rather than `--scene`.
- For tutorial videos where the screen is mostly text, raise `--max-frames` and consider whether OCR would help (planned).

## Dependencies

- `ffmpeg` must be on PATH.
- `tesseract` and `yt-dlp` are optional; skill works without them for local video paths.
