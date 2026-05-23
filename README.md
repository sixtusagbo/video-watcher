# video-watcher

A Claude Skill that lets Claude reason about what's happening in a video, even when the video has no audio.

Most "let Claude watch a video" workflows mean running ffmpeg by hand, extracting a wall of frames at a fixed interval, and dragging them into the chat. That wastes tokens on stretches of identical screens and skips the moments that actually matter. This Skill does the picking for you: scene-change detection plus a hard cap on frame count, with optional OCR so on-screen text reaches Claude without burning vision tokens.

## How it works

1. ffmpeg's `select='gt(scene,X)'` filter emits a frame only when the visual delta crosses a threshold. For UI walkthroughs and screen recordings that drops the frame count by an order of magnitude versus naive sampling.
2. If a long video still produces hundreds of scene changes, frames are sampled evenly across them so the output stays under a cap (default 40).
3. Optional tesseract pass writes OCR text for each frame into the manifest, so Claude can read on-screen text cheaply.
4. A `manifest.json` lists every frame with its timestamp, path, and OCR text. Claude reads the manifest first and pulls individual frames on demand.

## Install

```
git clone https://github.com/<user>/video-watcher
```

Drop the folder into a place your Claude tool looks for Skills (e.g. `~/.claude/skills/` for Claude Code).

Dependencies:

- `ffmpeg` (required) — `brew install ffmpeg`
- `tesseract` (optional, OCR) — `brew install tesseract`
- `yt-dlp` (optional, URL inputs) — `brew install yt-dlp`

No npm runtime dependencies.

## Usage

From a Claude session:

> Watch ./demo.mp4 and tell me what error appears.

The Skill runs the pipeline and produces a manifest plus a `frames/` directory. Claude reads them from there.

Direct CLI use:

```
node scripts/watch.mjs ./demo.mp4
node scripts/watch.mjs ./demo.mp4 --max-frames 20 --scene 0.2 --ocr
```

Flags:

- `--out <dir>` output directory (default `./out`)
- `--max-frames <n>` cap on frames in the manifest (default 40)
- `--scene <0..1>` scene-change threshold (default 0.3)
- `--ocr` run tesseract over each frame and attach text to the manifest

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
  ]
}
```

## Status

Early.

## License

MIT.
