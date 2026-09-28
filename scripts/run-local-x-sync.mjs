import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
nextEnv.loadEnvConfig(root);

const encryptionKey = process.env.X_CREDENTIAL_ENCRYPTION_KEY;
const secret = process.env.CRON_SECRET || (encryptionKey
  ? createHash('sha256').update(`zmt-automation:${encryptionKey}`, 'utf8').digest('hex')
  : '');
if (!secret) throw new Error('X 自动读取密钥尚未配置');

const endpoint = 'http://127.0.0.1:3002/api/cron/x-sync';
async function workstationReady() {
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(2_000), cache: 'no-store' });
    return response.status === 401;
  } catch { return false; }
}

if (!await workstationReady()) throw new Error('本机工作站没有运行，X 自动读取未执行');
  let syncError;
  try {
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(70_000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`X 自动读取失败：HTTP ${response.status}`);
    const result = await response.json();
    console.log(result.skipped
      ? `X 自动读取已跳过：${result.ageMinutes ?? 0} 分钟前已有同步（检查时间 ${result.checkedAt}，上次 ${result.lastSyncedAt}）`
      : `X 自动读取完成：${result.imported ?? 0} 条帖子；上次同步距今 ${result.previousSyncAgeMinutes ?? '未知'} 分钟（检查时间 ${result.checkedAt}，上次 ${result.lastSyncedAt}）`);
    if (result.publishError) console.warn(result.publishError);
  } catch (cause) {
    syncError = cause;
    console.error(cause instanceof Error ? cause.message : 'X 自动读取失败');
  }
  const publishResponse = await fetch('http://127.0.0.1:3002/api/cron/weibo-publish', {
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(70_000),
    cache: 'no-store',
  });
  if (!publishResponse.ok) throw new Error(`微博自动发布检查失败：HTTP ${publishResponse.status}`);
  const publishResult = await publishResponse.json();
  console.log(`微博发布队列检查完成：${publishResult.processed ?? 0} 条`);
if (syncError) throw syncError;
