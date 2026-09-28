import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from './collect-source.mjs';
import { queueLibraryExtraction } from './assistant/library.mjs';
import { updateState } from './assistant/store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [url, model] = process.argv.slice(2);
if (!url || !/^[a-z0-9.-]{1,80}$/.test(model || '')) throw new Error('快速入库参数无效');

const source = await collect(url);
let result;
try {
  result = await updateState(state => queueLibraryExtraction(state, [source], model));
} catch (error) {
  if (String(error?.message || '').includes('当前有提炼任务')) {
    console.warn('原文已采集；当前另有知识拆分任务，本条保留在来源资料中等待后续提炼。');
    process.exit(0);
  }
  throw error;
}

if (result.jobId) {
  const child = spawn(process.execPath, [path.join(root, 'scripts/assistant/worker.mjs')], {
    cwd: root, env: process.env, detached: true, windowsHide: true, stdio: 'ignore',
  });
  child.unref();
}
