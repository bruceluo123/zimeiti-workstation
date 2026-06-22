// 多设备数据同步 — 浏览器直连 Upstash KV。
// 复用招聘系统同一个 KV 实例，但用独立的 `zmt:` 命名空间，键不重叠 → 数据互不干扰。
// 策略：按 id 合并（merge）而非整数组覆盖，确保「添加永不丢失」；
// 删除通过墓碑（tombstone）传播，确保删除仍能在多端生效。

// 优先读独立 KV（NEXT_PUBLIC_ZMT_KV_URL / TOKEN）；未配置则回退到与招聘系统共享同一 KV
// 建议: 在 Upstash 控制台创建独立数据库后填入下方 env，实现完全隔离
const KV_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_ZMT_KV_URL
    ? process.env.NEXT_PUBLIC_ZMT_KV_URL
    : "https://positive-mongrel-70521.upstash.io";
const KV_TOKEN =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_ZMT_KV_TOKEN
    ? process.env.NEXT_PUBLIC_ZMT_KV_TOKEN
    : "gQAAAAAAARN5AAIgcDE5NDM2NzliZjdjOWY0MjBmYTA0NjhjODhjNTNjZjM3Zg";

export type DataType = "thoughts" | "topics";
type ChangeHandler = (type: DataType, data: unknown[], version: number) => void;

interface Item {
  id?: string;
}
/** 墓碑：{ [type]: { [id]: 删除时间戳ms } } */
type Tombstones = Record<string, Record<string, number>>;

const KV_KEYS: Record<DataType, string> = {
  thoughts: "zmt:thoughts",
  topics: "zmt:topics",
};
const VERSION_KEY = "zmt:version";
const TOMB_KEY = "zmt:tombstones";
const TOMB_TTL = 60 * 24 * 60 * 60 * 1000; // 墓碑保留 60 天后清理

const ALL_TYPES: DataType[] = ["thoughts", "topics"];

let remoteVersion = 0;
let tombstones: Tombstones = {};
let onChange: ChangeHandler | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let pushTimers: Partial<Record<DataType, ReturnType<typeof setTimeout>>> = {};

async function kvCmd(cmd: string, key: string, body?: string): Promise<string | null> {
  try {
    const url = `${KV_URL}/${cmd}/${encodeURIComponent(key)}`;
    const opts: RequestInit = { headers: { Authorization: `Bearer ${KV_TOKEN}` } };
    if (body !== undefined) {
      opts.method = "POST";
      opts.headers = { ...opts.headers, "Content-Type": "text/plain" };
      opts.body = body;
    }
    const res = await fetch(url, opts);
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch {
    return null;
  }
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 按 id 合并：incoming 在 id 冲突时获胜；保留只存在于 base 的项（添加不丢失） */
function mergeById(base: unknown[], incoming: unknown[]): unknown[] {
  const map = new Map<string, unknown>();
  const noId: unknown[] = [];
  for (const it of base) {
    const id = (it as Item)?.id;
    if (id) map.set(id, it);
    else noId.push(it);
  }
  for (const it of incoming) {
    const id = (it as Item)?.id;
    if (id) map.set(id, it);
    else noId.push(it);
  }
  return [...Array.from(map.values()), ...noId];
}

/** 过滤掉被墓碑标记删除的项 */
function applyTombstones(type: DataType, items: unknown[]): unknown[] {
  const t = tombstones[type];
  if (!t) return items;
  return items.filter((it) => {
    const id = (it as Item)?.id;
    return !(id && t[id]);
  });
}

async function fetchTombstones(): Promise<Tombstones> {
  const raw = await kvCmd("get", TOMB_KEY);
  return (safeParse(raw) as Tombstones) || {};
}

async function fetchRemote(): Promise<{ data: Record<DataType, unknown[]>; version: number } | null> {
  try {
    const [rawThoughts, rawTopics, rawVer, rawTomb] = await Promise.all([
      kvCmd("get", KV_KEYS.thoughts),
      kvCmd("get", KV_KEYS.topics),
      kvCmd("get", VERSION_KEY),
      kvCmd("get", TOMB_KEY),
    ]);
    if (!rawThoughts && !rawTopics) return null;
    tombstones = (safeParse(rawTomb) as Tombstones) || {};
    return {
      data: {
        thoughts: (safeParse(rawThoughts) as unknown[]) || [],
        topics: (safeParse(rawTopics) as unknown[]) || [],
      },
      version: parseInt(rawVer || "0") || 0,
    };
  } catch {
    return null;
  }
}

/**
 * 推送：读-改-写合并。
 * 1) 拉当前远端 + 最新墓碑；2) 与本地按 id 合并（本地获胜）；
 * 3) 过滤墓碑；4) 写回。即使本地是旧快照也不会抹掉别人的新增。
 */
async function pushData(type: DataType, local: unknown[]): Promise<number | null> {
  tombstones = await fetchTombstones();
  const remoteRaw = await kvCmd("get", KV_KEYS[type]);
  const remote = (safeParse(remoteRaw) as unknown[]) || [];
  const merged = applyTombstones(type, mergeById(remote, local));
  const ok = await kvCmd("set", KV_KEYS[type], JSON.stringify(merged));
  if (!ok) return null;
  const rawV = await kvCmd("get", VERSION_KEY);
  const v = (parseInt(rawV || "0") || 0) + 1;
  await kvCmd("set", VERSION_KEY, String(v));
  return v;
}

/** 删除：把 id 写入墓碑（含 TTL 清理），随后由 pushData 把对应项剔除并传播 */
export async function syncDelete(type: DataType, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const now = Date.now();
  tombstones = await fetchTombstones();
  const t: Record<string, number> = { ...(tombstones[type] || {}) };
  for (const id of ids) t[id] = now;
  for (const id of Object.keys(t)) if (now - t[id] > TOMB_TTL) delete t[id];
  tombstones = { ...tombstones, [type]: t };
  await kvCmd("set", TOMB_KEY, JSON.stringify(tombstones));
}

async function poll(): Promise<void> {
  const remote = await fetchRemote();
  if (!remote) return;
  if (remote.version > remoteVersion) {
    remoteVersion = remote.version;
    emitAll(remote.data, remote.version);
  }
}

function emitAll(data: Record<DataType, unknown[]>, version: number): void {
  if (!onChange) return;
  for (const type of ALL_TYPES) {
    onChange(type, applyTombstones(type, data[type]), version);
  }
}

export function startSync(handler: ChangeHandler): void {
  onChange = handler;
  fetchRemote().then((remote) => {
    if (!remote) return;
    remoteVersion = remote.version;
    emitAll(remote.data, remote.version);
  });
  timer = setInterval(poll, 10000);
}

export function stopSync(): void {
  onChange = null;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  Object.values(pushTimers).forEach(clearTimeout);
  pushTimers = {};
}

function schedulePush(type: DataType, getData: () => unknown[]): void {
  if (pushTimers[type]) clearTimeout(pushTimers[type]);
  pushTimers[type] = setTimeout(async () => {
    const v = await pushData(type, getData());
    if (v != null) remoteVersion = v;
  }, 1000);
}

export function syncPush(type: DataType, data: unknown[]): void {
  schedulePush(type, () => data);
}
