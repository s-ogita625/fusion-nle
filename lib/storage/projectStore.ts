// ===========================================================================
// 永続化レイヤー
// - メディアバイナリ: OPFS (Origin Private File System)。大容量・高速。
// - プロジェクトJSON + メディアメタ: IndexedDB。
// ブラウザ内ローカル完結。サーバ送信なし。
// ===========================================================================

import { MediaAsset } from "@/lib/timeline/model";
import { Project } from "@/lib/timeline/model";

const DB_NAME = "fusion-nle";
const DB_VERSION = 1;
const PROJECT_STORE = "projects";
const MEDIA_META_STORE = "mediaMeta";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(MEDIA_META_STORE)) {
        db.createObjectStore(MEDIA_META_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      })
  );
}

// --- OPFS メディアバイナリ ---

async function opfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (!navigator.storage?.getDirectory) return null;
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle("media", { create: true });
  } catch {
    return null;
  }
}

/** メディアのバイナリを OPFS に保存し storageKey を返す */
export async function saveMediaBlob(id: string, blob: Blob): Promise<string | null> {
  const dir = await opfsRoot();
  if (!dir) return null;
  const key = `${id}`;
  const handle = await dir.getFileHandle(key, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return key;
}

/** OPFS からメディアバイナリを取得 */
export async function loadMediaBlob(storageKey: string): Promise<Blob | null> {
  const dir = await opfsRoot();
  if (!dir) return null;
  try {
    const handle = await dir.getFileHandle(storageKey);
    return await handle.getFile();
  } catch {
    return null;
  }
}

export async function deleteMediaBlob(storageKey: string): Promise<void> {
  const dir = await opfsRoot();
  if (!dir) return;
  try {
    await dir.removeEntry(storageKey);
  } catch {
    /* ignore */
  }
}

// --- プロジェクト ---

export async function saveProject(project: Project): Promise<void> {
  await tx(PROJECT_STORE, "readwrite", (s) => s.put(project));
}

export async function loadProject(id: string): Promise<Project | null> {
  const p = await tx<Project | undefined>(PROJECT_STORE, "readonly", (s) => s.get(id));
  return p ?? null;
}

export async function listProjects(): Promise<Project[]> {
  return tx<Project[]>(PROJECT_STORE, "readonly", (s) => s.getAll());
}

// --- メディアメタ (urlは保存しない。再ロード時に再生成) ---

type StoredMediaMeta = Omit<MediaAsset, "url">;

export async function saveMediaMeta(asset: MediaAsset): Promise<void> {
  const { url: _url, ...meta } = asset;
  void _url;
  await tx(MEDIA_META_STORE, "readwrite", (s) => s.put(meta));
}

export async function listMediaMeta(): Promise<StoredMediaMeta[]> {
  return tx<StoredMediaMeta[]>(MEDIA_META_STORE, "readonly", (s) => s.getAll());
}

export async function deleteMediaMeta(id: string): Promise<void> {
  await tx(MEDIA_META_STORE, "readwrite", (s) => s.delete(id));
}

/** 保存済みメディアを復元し object URL を再生成 */
export async function restoreMediaAssets(): Promise<MediaAsset[]> {
  const metas = await listMediaMeta();
  const assets: MediaAsset[] = [];
  for (const meta of metas) {
    if (!meta.storageKey) continue;
    const blob = await loadMediaBlob(meta.storageKey);
    if (!blob) continue;
    const url = URL.createObjectURL(blob);
    assets.push({ ...meta, url });
  }
  return assets;
}

export const LAST_PROJECT_KEY = "fusion-nle:lastProjectId";
