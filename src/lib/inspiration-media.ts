const DB_NAME = "zmt-inspiration-media";
const DB_VERSION = 1;
const STORE_NAME = "images";

interface StoredImage {
  id: string;
  blob: Blob;
  name: string;
  createdAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("图片空间打开失败"));
  });
}

async function optimizeImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("只能添加图片文件");
  if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} 超过 15MB，请先压缩`);
  if (typeof createImageBitmap !== "function") return file;

  const bitmap = await createImageBitmap(file);
  const maxEdge = 1800;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); return file; }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const optimized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
  return optimized ?? file;
}

export async function saveInspirationImages(files: File[]): Promise<string[]> {
  if (!files.length) return [];
  const database = await openDatabase();
  const records: StoredImage[] = [];
  for (const file of files) {
    records.push({ id: crypto.randomUUID(), blob: await optimizeImage(file), name: file.name, createdAt: new Date().toISOString() });
  }
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    records.forEach((record) => store.put(record));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("图片保存失败"));
  });
  database.close();
  return records.map((record) => record.id);
}

export async function loadInspirationImage(id: string): Promise<string | null> {
  const database = await openDatabase();
  const record = await new Promise<StoredImage | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as StoredImage | undefined);
    request.onerror = () => reject(request.error ?? new Error("图片读取失败"));
  });
  database.close();
  return record?.blob ? URL.createObjectURL(record.blob) : null;
}
