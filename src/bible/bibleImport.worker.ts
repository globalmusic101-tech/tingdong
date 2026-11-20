import initSqlJs from 'sql.js/dist/sql-wasm-browser.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import books from '../../electron/bible-books.json';

self.onmessage = async (event: MessageEvent<{ bytes: ArrayBuffer; language: 'ko' | 'en'; name: string; id: string }>) => {
  try {
    const { bytes, language, name, id } = event.data;
    const sql = await initSqlJs({ locateFile: () => wasmUrl });
    const db = new sql.Database(new Uint8Array(bytes));
    try {
      const result = db.exec('SELECT book, chapter, verse, btext FROM Bible ORDER BY book, chapter, verse');
      const rows = result[0]?.values;
      if (!rows || rows.length > 40000) throw new Error('invalid');
      const data: Record<string, Record<string, Record<string, string>>> = {};
      const seen = new Set<string>();
      for (const [book, chapter, verse, raw] of rows) {
        if (!Number.isInteger(book) || typeof book !== 'number' || book < 1 || book > books.length || !Number.isInteger(chapter) || typeof chapter !== 'number' || chapter < 1 || chapter > books[book - 1].chapters || !Number.isInteger(verse) || typeof verse !== 'number' || verse < 1 || verse > 176 || typeof raw !== 'string') throw new Error('invalid');
        const key = `${book}:${chapter}:${verse}`;
        if (seen.has(key)) throw new Error('duplicate');
        seen.add(key);
        const text = raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        if (text.length > 10000) throw new Error('invalid');
        const bookId = books[book - 1].id;
        data[bookId] ??= {}; data[bookId][chapter] ??= {}; data[bookId][chapter][verse] = text;
      }
      if (books.some(book => !data[book.id] || Array.from({ length: book.chapters }, (_, i) => i + 1).some(ch => !data[book.id][ch]))) throw new Error('incomplete');
      self.postMessage({ ok: true, data: { version: 2, language, translation: id, name, books: data } });
    } finally { db.close(); }
  } catch { self.postMessage({ ok: false }); }
};
