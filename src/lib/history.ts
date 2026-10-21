// Finished figures, kept in this browser's IndexedDB.
import type { JobOptions } from "../agent/prompt";
import type { Usage } from "../llm/types";
import type { FileData } from "../runtime/vfs";

export interface HistoryEntry {
  id: string;
  createdAt: number;
  job: JobOptions;
  title: string;
  summary: string;
  page: string;
  html: string;
  files: Record<string, FileData>;
  thumbnail: string | null;
  usage: Usage;
  turns: number;
  model: string;
  durationMs?: number;
}

const DB = "anatomy-studio";
const STORE = "runs";

function open(): Promise<IDBDatabase> {
  return new Promise((done, fail) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => done(request.result);
    request.onerror = () => fail(request.error);
  });
}

/** Resolves when the transaction commits, so a quota failure at commit time is seen too. */
async function tx<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((done, fail) => {
    const transaction = db.transaction(STORE, mode);
    const request = work(transaction.objectStore(STORE));
    transaction.oncomplete = () => done(request.result);
    transaction.onabort = () => fail(transaction.error ?? request.error);
    transaction.onerror = () => fail(transaction.error ?? request.error);
  }).finally(() => db.close());
}

export const saveEntry = (entry: HistoryEntry) => tx("readwrite", (s) => s.put(entry));
export const deleteEntry = (id: string) => tx("readwrite", (s) => s.delete(id));
export const listEntries = async () => ((await tx("readonly", (s) => s.getAll())) as HistoryEntry[]).sort((a, b) => b.createdAt - a.createdAt);
