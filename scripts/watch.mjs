#!/usr/bin/env node
import { writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { extractFrames, probeDuration } from './extract-frames.mjs';
import { ocrFrames, tesseractAvailable } from './ocr.mjs';
import { isUrl, ytDlpAvailable, downloadVideo } from './fetch-video.mjs';

function parseArgs(argv) {
  const args = { input: null, out: './out', maxFrames: 40, scene: 0.3, ocr: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--out') args.out = rest[++i];
    else if (a === '--max-frames') args.maxFrames = parseInt(rest[++i], 10);
    else if (a === '--scene') args.scene = parseFloat(rest[++i]);
    else if (a === '--ocr') args.ocr = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--')) throw new Error(`Unknown flag: ${a}`);
    else if (!args.input) args.input = a;
    else throw new Error(`Unexpected positional argument: ${a}`);
  }
  return args;
}

const HELP = `Usage: watch.mjs <video-or-url> [options]

Extract a smart set of frames from a video and write a manifest Claude can read.
Accepts a local file path or an http(s) URL (URLs require yt-dlp on PATH).

Options:
  --out <dir>         Output directory (default: ./out)
  --max-frames <n>    Cap on frames in the manifest (default: 40)
  --scene <0..1>      Scene-change threshold for ffmpeg (default: 0.3)
  --ocr               Run tesseract on each frame and attach text to manifest
  -h, --help          Show this help
`;

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    process.stdout.write(HELP);
    process.exit(args.help ? 0 : 1);
  }

  await mkdir(args.out, { recursive: true });

  if (isUrl(args.input)) {
    if (!(await ytDlpAvailable())) {
      throw new Error('yt-dlp not found on PATH; install with: brew install yt-dlp');
    }
    console.error(`Downloading ${args.input}`);
    args.input = await downloadVideo(args.input, path.join(args.out, 'source'));
    console.error(`Downloaded to ${args.input}`);
  }

  await stat(args.input);

  const duration = await probeDuration(args.input);
  console.error(`Probing: ${args.input} (${duration.toFixed(2)}s)`);

  let frames = await extractFrames(args.input, {
    outDir: args.out,
    sceneThreshold: args.scene,
    maxFrames: args.maxFrames,
  });

  let ocrRan = false;
  if (args.ocr) {
    if (await tesseractAvailable()) {
      console.error(`Running OCR over ${frames.length} frames`);
      frames = await ocrFrames(frames);
      ocrRan = true;
    } else {
      console.error('tesseract not found on PATH; skipping OCR (install with: brew install tesseract)');
    }
  }

  const manifest = {
    video: path.resolve(args.input),
    duration_sec: Number(duration.toFixed(3)),
    scene_threshold: args.scene,
    max_frames: args.maxFrames,
    frame_count: frames.length,
    frames: frames.map(f => {
      const entry = { timestamp: f.timestamp, path: f.path };
      if (ocrRan) entry.ocr = f.ocr;
      return entry;
    }),
  };

  const manifestPath = path.join(args.out, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.error(`Wrote ${frames.length} frames to ${args.out}/frames`);
  console.error(`Manifest: ${manifestPath}`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
