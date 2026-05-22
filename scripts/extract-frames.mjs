import { spawn } from 'node:child_process';
import { mkdir, rename, unlink, readdir } from 'node:fs/promises';
import path from 'node:path';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) reject(new Error(`${cmd} exited ${code}\n${stderr}`));
      else resolve({ stdout, stderr });
    });
  });
}

export async function probeDuration(videoPath) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    videoPath,
  ]);
  return parseFloat(stdout.trim());
}

export function formatTimestamp(seconds) {
  const s = Math.max(0, seconds);
  const ms = Math.round((s % 1) * 1000);
  const total = Math.floor(s);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const pad = n => String(n).padStart(2, '0');
  const msStr = String(ms).padStart(3, '0');
  return hh > 0
    ? `${pad(hh)}:${pad(mm)}:${pad(ss)}.${msStr}`
    : `${pad(mm)}:${pad(ss)}.${msStr}`;
}

function pickEvenly(total, target) {
  if (target >= total) return [...Array(total).keys()];
  const result = new Set();
  for (let i = 0; i < target; i++) {
    result.add(Math.round((i * (total - 1)) / (target - 1)));
  }
  return [...result].sort((a, b) => a - b);
}

export async function extractFrames(videoPath, {
  outDir,
  sceneThreshold = 0.3,
  maxFrames = 40,
} = {}) {
  const framesDir = path.join(outDir, 'frames');
  await mkdir(framesDir, { recursive: true });

  // Scene-change selection + showinfo so we recover timestamps from stderr.
  // Backslash-escape the comma inside gt() so ffmpeg doesn't read it as a
  // filterchain separator.
  const filter = `select=gt(scene\\,${sceneThreshold}),showinfo`;
  const { stderr } = await run('ffmpeg', [
    '-hide_banner',
    '-i', videoPath,
    '-vf', filter,
    '-fps_mode', 'vfr',
    '-y',
    path.join(framesDir, 'raw_%05d.png'),
  ]);

  const times = [];
  const re = /pts_time:([\d.]+)/g;
  let m;
  while ((m = re.exec(stderr)) !== null) {
    times.push(parseFloat(m[1]));
  }

  if (times.length === 0) {
    // Static video: keep the first frame so Claude has something to look at.
    await run('ffmpeg', [
      '-hide_banner',
      '-i', videoPath,
      '-frames:v', '1',
      '-y',
      path.join(framesDir, 'raw_00001.png'),
    ]);
    times.push(0);
  }

  const allRaw = (await readdir(framesDir))
    .filter(f => f.startsWith('raw_'))
    .sort();

  if (allRaw.length !== times.length) {
    throw new Error(
      `Frame/timestamp mismatch: ${allRaw.length} files vs ${times.length} timestamps`,
    );
  }

  const keep = times.length > maxFrames
    ? pickEvenly(times.length, maxFrames)
    : times.map((_, i) => i);

  const kept = [];
  for (let outIdx = 0; outIdx < keep.length; outIdx++) {
    const srcIdx = keep[outIdx];
    const dstName = `${String(outIdx).padStart(3, '0')}.png`;
    await rename(
      path.join(framesDir, allRaw[srcIdx]),
      path.join(framesDir, dstName),
    );
    kept.push({
      time: times[srcIdx],
      timestamp: formatTimestamp(times[srcIdx]),
      path: path.join('frames', dstName),
      absPath: path.join(framesDir, dstName),
    });
  }

  const keepSet = new Set(keep);
  for (let i = 0; i < allRaw.length; i++) {
    if (!keepSet.has(i)) {
      await unlink(path.join(framesDir, allRaw[i])).catch(() => {});
    }
  }

  return kept;
}
