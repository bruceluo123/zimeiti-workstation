import { spawn, execFile } from 'node:child_process';
import path from 'node:path';
export { localAssistantAllowed as assistantAllowed } from '@/lib/sources/local-access';

export async function startWorker() {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts/assistant/worker.mjs')], { cwd: process.cwd(), env: process.env, detached: true, windowsHide: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

export async function extractPdf(file: string): Promise<{ pages: { locator: string; text: string }[]; emptyPages: number[] }> {
  return new Promise((resolve, reject) => {
    execFile(process.env.ZMT_PYTHON || 'py', [path.join(process.cwd(), 'scripts/assistant/extract-pdf.py'), file], { timeout: 90000, maxBuffer: 16000000, windowsHide: true }, (error, stdout) => {
      let parsed;
      try { parsed = JSON.parse(stdout); } catch { reject(new Error('PDF 解析器不可用或超时，请确认本机 Python 和 pypdf 已安装。')); return; }
      if (error || parsed.error) reject(new Error(parsed.error || 'PDF 解析失败'));
      else resolve(parsed);
    });
  });
}
