import type { Phrase } from './core';

export type PracticeSession = {
  id: string;
  name: string;
  updatedAt: number;
  sourceKey: string;
  title: string;
  meta: string;
  fileName: string;
  audio: Blob;
  phrases: Phrase[];
  state: { start: number; end: number; speed: number; gap: number; looping: boolean; volume: number; position: number; viewStart: number; viewEnd: number };
};

let database: Promise<IDBDatabase> | null = null;
function openDatabase() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('omigjen', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sessions', { keyPath: 'id' });
    request.onerror = () => { database = null; reject(request.error); };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = null; };
      resolve(request.result);
    };
  });
  return database;
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('sessions', mode);
    const request = action(tx.objectStore('sessions'));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error || request.error || new Error('Økten kunne ikke lagres.'));
    tx.onerror = () => reject(tx.error || request.error);
  });
}
export const saveSession = (session: PracticeSession) => transaction('readwrite', store => store.put(session));
export const getSession = (id: string): Promise<PracticeSession | undefined> => transaction('readonly', store => store.get(id));
export const deleteSession = (id: string) => transaction('readwrite', store => store.delete(id));
export async function listSessions(): Promise<PracticeSession[]> {
  return (await transaction<PracticeSession[]>('readonly', store => store.getAll())).sort((a, b) => b.updatedAt - a.updatedAt);
}
