import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export function isUrl(input) {
  return /^https?:\/\//i.test(input);
}

export function ytDlpAvailable() {
  return new Promise(resolve => {
    const c = spawn('yt-dlp', ['--version']);
    c.on('error', () => resolve(false));
    c.on('close', code => resolve(code === 0));
  });
}

export async function downloadVideo(url, destDir) {
  await mkdir(destDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const child = spawn('yt-dlp', [
      '--no-playlist',
      '--restrict-filenames',
      '--print', 'after_move:filepath',
      '-o', path.join(destDir, '%(id)s.%(ext)s'),
      url,
    ]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => {
      stderr += d.toString();
      process.stderr.write(d);
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited ${code}\n${stderr}`));
        return;
      }
      const lines = stdout.split('\n').map(s => s.trim()).filter(Boolean);
      const filepath = lines[lines.length - 1];
      if (!filepath) reject(new Error('yt-dlp did not print a filepath'));
      else resolve(filepath);
    });
  });
}
