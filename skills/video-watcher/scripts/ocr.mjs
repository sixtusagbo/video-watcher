import { spawn } from 'node:child_process';

export function tesseractAvailable() {
  return new Promise(resolve => {
    const c = spawn('tesseract', ['--version']);
    c.on('error', () => resolve(false));
    c.on('close', code => resolve(code === 0));
  });
}

function runTesseract(framePath) {
  return new Promise((resolve, reject) => {
    const child = spawn('tesseract', [framePath, 'stdout', '-l', 'eng']);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) reject(new Error(`tesseract exited ${code}: ${stderr.trim()}`));
      else resolve(stdout.trim());
    });
  });
}

export async function ocrFrames(frames, { concurrency = 4 } = {}) {
  const text = new Array(frames.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= frames.length) return;
      try {
        text[i] = await runTesseract(frames[i].absPath);
      } catch (err) {
        text[i] = '';
        console.error(`OCR failed for ${frames[i].path}: ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return frames.map((f, i) => ({ ...f, ocr: text[i] }));
}
