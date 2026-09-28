import type { SourceDocument } from "@/types/source";

const DB_NAME = "zmt-research-v1";
const STORE_NAME = "sources";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE_NAME, { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error("素材保存事务已中止")); };
    transaction.oncomplete = () => { db.close(); resolve(result); };
  });
}

export async function listSources(): Promise<SourceDocument[]> {
  const items = await transact("readonly", (store) => store.getAll()) as SourceDocument[];
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveSource(source: SourceDocument): Promise<void> {
  await transact("readwrite", (store) => store.put(source));
}

export async function saveSources(sources: SourceDocument[]): Promise<void> {
  if (!sources.length) return;
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    for (const source of sources) store.put(source);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error("素材批量保存事务已中止")); };
  });
}

export async function removeSource(id: string): Promise<void> {
  await transact("readwrite", (store) => store.delete(id));
}
