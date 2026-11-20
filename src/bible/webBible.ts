import { validateLocalBible, type LocalBible, type BibleLanguage } from './localSource';
const DB_NAME = 'tingdong.personal-bibles';
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('bibles', { keyPath: 'translation' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
}
export async function readWebBibles(): Promise<{ ko: LocalBible[]; en: LocalBible[] }> {
  const db = await openDb();
  try {
    const entries = await new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction('bibles', 'readonly'); const request = tx.objectStore('bibles').getAll();
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const byLanguage = (language: BibleLanguage) => entries.flatMap(item => { const v = validateLocalBible(item, language); return v.ok ? [v.data] : []; });
    return { ko: byLanguage('ko'), en: byLanguage('en') };
  } finally { db.close(); }
}
export async function deleteWebBible(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('bibles', 'readwrite');
      tx.objectStore('bibles').delete(id);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function importWebBible(file: File, language: BibleLanguage): Promise<LocalBible> {
  if (!/\.(bdb|db|sqlite)$/i.test(file.name) || file.size === 0 || file.size > 30 * 1024 * 1024) throw new Error('invalid');
  const bytes = await file.arrayBuffer();
  const worker = new Worker(new URL('./bibleImport.worker.ts', import.meta.url), { type: 'module' });
  let data: unknown;
  try {
    data = await new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('timeout')), 20000);
      worker.onmessage = e => { clearTimeout(timer); e.data?.ok ? resolve(e.data.data) : reject(new Error('invalid')); };
      worker.onerror = () => { clearTimeout(timer); reject(new Error('invalid')); };
      worker.postMessage({ bytes, language, name: file.name.replace(/\.[^.]+$/, ''), id: `local-${crypto.randomUUID()}` }, [bytes]);
    });
  } finally { worker.terminate(); }
  const checked = validateLocalBible(data, language);
  if (!checked.ok) throw new Error('invalid');
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('bibles', 'readwrite');
      tx.objectStore('bibles').add(checked.data);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
  return checked.data;
}
