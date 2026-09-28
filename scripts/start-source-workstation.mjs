import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = path.join(root, '.runtime');
const logPath = path.join(runtimeDir, 'workstation.log');
await mkdir(runtimeDir, { recursive: true });
const log = async message => {
  try { await appendFile(logPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8'); }
  catch {}
};
const configPath = path.join(os.homedir(), '.agent-reach', 'zmt-import', 'collector-config.json');
let config = {};
try { config = JSON.parse(await readFile(configPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const env = { ...process.env, ZMT_LOCAL_CAPTURE_ENABLED: 'true' };
for (const [platform, profile] of Object.entries(config.profiles || {})) {
  if (!/^(default|x|xiaohongshu|weibo|wechat|douyin)$/.test(platform) || !/^[a-zA-Z0-9_-]+$/.test(profile)) continue;
  const key = platform === 'default' ? 'ZMT_OPENCLI_PROFILE' : `ZMT_OPENCLI_PROFILE_${platform.toUpperCase()}`;
  env[key] ||= profile;
}
const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-H', '0.0.0.0', '-p', '3002'], { cwd: root, env, stdio: 'ignore', windowsHide: true });
await log(`workstation started (pid ${child.pid ?? 'unknown'})`);
// Recover queued knowledge jobs; interrupted running jobs are marked for explicit retry.
const knowledgeWorker = spawn(process.execPath, [path.join(root, 'scripts/assistant/worker.mjs')], { cwd: root, env, detached: true, stdio: 'ignore', windowsHide: true });
knowledgeWorker.on('error', () => { console.error('知识工作台任务恢复失败，请在页面重试。'); });
knowledgeWorker.unref();
child.on('error', error => { void log(`workstation process error: ${error.message}`); process.exitCode = 1; });
child.on('exit', (code, signal) => { void log(`workstation stopped (code ${code ?? 'none'}, signal ${signal ?? 'none'})`); process.exitCode = code || 0; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
