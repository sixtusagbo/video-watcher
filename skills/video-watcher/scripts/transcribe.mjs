import { spawn } from 'node:child_process';
import { readFile, mkdir, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function whisperAvailable() {
  return new Promise(resolve => {
    const c = spawn('whisper-cli', ['--help']);
    c.on('error', () => resolve(false));
    c.on('close', code => resolve(code === 0 || code === 1));
  });
}

async function resolveModelPath(explicit) {
  const candidates = [
    explicit,
    process.env.WHISPER_MODEL_PATH,
    path.join(os.homedir(), '.cache/whisper/ggml-base.en.bin'),
    path.join(os.homedir(), '.cache/whisper/ggml-base.bin'),
    path.join(os.homedir(), '.cache/whisper/ggml-small.en.bin'),
    '/opt/homebrew/share/whisper-cpp/ggml-base.en.bin',
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      await access(p, fsConstants.R_OK);
      return p;
    } catch {}
  }
  return null;
}

function videoHasAudio(videoPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a',
      '-show_entries', 'stream=codec_type',
      '-of', 'csv=p=0',
      videoPath,
    ]);
    let stdout = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.on('error', reject);
    child.on('close', () => resolve(stdout.trim().length > 0));
  });
}

function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-i', videoPath,
      '-vn',
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '-y',
      audioPath,
    ]);
    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) reject(new Error(`ffmpeg exited ${code}\n${stderr}`));
      else resolve();
    });
  });
}

function runWhisper(audioPath, modelPath, outBase) {
  return new Promise((resolve, reject) => {
    const child = spawn('whisper-cli', [
      '-m', modelPath,
      '-f', audioPath,
      '-oj',
      '-of', outBase,
      '--no-prints',
    ]);
    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) reject(new Error(`whisper-cli exited ${code}\n${stderr}`));
      else resolve();
    });
  });
}

function formatTimestamp(ms) {
  const total = Math.max(0, ms) / 1000;
  const msPart = Math.round((total % 1) * 1000);
  const s = Math.floor(total);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = n => String(n).padStart(2, '0');
  const msStr = String(msPart).padStart(3, '0');
  return hh > 0
    ? `${pad(hh)}:${pad(mm)}:${pad(ss)}.${msStr}`
    : `${pad(mm)}:${pad(ss)}.${msStr}`;
}

export async function transcribe(videoPath, { outDir, modelPath: explicit } = {}) {
  if (!(await whisperAvailable())) {
    return { skipped: 'whisper-cli not found (install with: brew install whisper-cpp)', segments: [] };
  }
  if (!(await videoHasAudio(videoPath))) {
    return { skipped: 'video has no audio stream', segments: [] };
  }
  const modelPath = await resolveModelPath(explicit);
  if (!modelPath) {
    return {
      skipped: 'no whisper model found (set WHISPER_MODEL_PATH or download a ggml model into ~/.cache/whisper/)',
      segments: [],
    };
  }

  const audioDir = path.join(outDir, 'audio');
  await mkdir(audioDir, { recursive: true });
  const audioPath = path.join(audioDir, 'track.wav');
  const outBase = path.join(audioDir, 'transcript');

  await extractAudio(videoPath, audioPath);
  await runWhisper(audioPath, modelPath, outBase);

  const raw = JSON.parse(await readFile(`${outBase}.json`, 'utf8'));
  const segments = (raw.transcription || []).map(seg => ({
    start: seg.offsets.from / 1000,
    end: seg.offsets.to / 1000,
    timestamp: formatTimestamp(seg.offsets.from),
    text: (seg.text || '').trim(),
  }));
  return { skipped: null, segments, modelPath };
}
