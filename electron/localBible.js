import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';

const runFile = promisify(execFile);
const books = JSON.parse(fs.readFileSync(new URL('./bible-books.json', import.meta.url), 'utf8'));
const expectedVerses = Array.from({ length: 45 }, (_, i) => String(i + 1));
export function validateLocalBible(value, language) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'Invalid Bible data' };
  if (value.language !== language || typeof value.translation !== 'string' || typeof value.name !== 'string' || !value.name.trim()) return { ok: false, error: 'Invalid Bible metadata' };
  if (value.version === 1) {
    if (value.book !== 'Mark' || value.chapter !== 1 || !value.verses || typeof value.verses !== 'object' || Array.isArray(value.verses)) return { ok: false, error: 'Invalid Mark 1 data' };
    if (Object.keys(value.verses).sort().join(',') !== [...expectedVerses].sort().join(',')) return { ok: false, error: 'Mark 1 must contain verses 1-45' };
    if (expectedVerses.some(k => typeof value.verses[k] !== 'string' || !value.verses[k].trim() || value.verses[k].length > 10000)) return { ok: false, error: 'Invalid verse' };
    return { ok: true, data: value };
  }
  if (value.version !== 2 || !value.books || typeof value.books !== 'object' || Array.isArray(value.books)) return { ok: false, error: 'Unsupported Bible format' };
  let count = 0;
  for (const [book, chapters] of Object.entries(value.books)) {
    const info = books.find(x => x.id === book);
    if (!info || !chapters || typeof chapters !== 'object' || Array.isArray(chapters)) return { ok: false, error: 'Invalid book' };
    for (const [chapter, verses] of Object.entries(chapters)) {
      if (!/^[1-9]\d*$/.test(chapter) || Number(chapter) > info.chapters || !verses || typeof verses !== 'object' || Array.isArray(verses)) return { ok: false, error: 'Invalid chapter' };
      for (const [verse, text] of Object.entries(verses)) {
        if (!/^[1-9]\d*$/.test(verse) || Number(verse) > 176 || typeof text !== 'string' || !text.trim() || text.length > 10000 || ++count > 40000) return { ok: false, error: 'Invalid verse' };
      }
    }
  }
  return count ? { ok: true, data: value } : { ok: false, error: 'Empty Bible' };
}
export async function convertBibleFile(filePath, language) {
  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size > 30 * 1024 * 1024) return { ok: false, error: 'File is too large or invalid' };
  let value;
  if (['.bdb', '.db', '.sqlite'].includes(ext)) {
    const { stdout } = await runFile('/usr/bin/sqlite3', ['-readonly', '-json', filePath, 'select book,chapter,verse,btext from Bible order by book,chapter,verse'], { maxBuffer: 40 * 1024 * 1024, timeout: 20000 });
    const rows = JSON.parse(stdout);
    if (!Array.isArray(rows) || rows.length > 40000) return { ok: false, error: 'Unsupported Bible database' };
    const data = {};
    const seen = new Set();
    for (const row of rows) {
      if (!Number.isInteger(row.book) || row.book < 1 || row.book > books.length || !Number.isInteger(row.chapter) || row.chapter < 1 || row.chapter > books[row.book - 1].chapters || !Number.isInteger(row.verse) || row.verse < 1 || row.verse > 176 || typeof row.btext !== 'string') return { ok: false, error: 'Unsupported book, chapter or verse' };
      const key = `${row.book}:${row.chapter}:${row.verse}`;
      if (seen.has(key)) return { ok: false, error: 'Duplicate verse' };
      seen.add(key);
      const text = row.btext.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const book = books[row.book - 1].id;
      data[book] ??= {};
      data[book][row.chapter] ??= {};
      data[book][row.chapter][row.verse] = text;
    }
    if (books.some(book => !data[book.id] || Object.keys(data[book.id]).length !== book.chapters || !Array.from({ length: book.chapters }, (_, i) => String(i + 1)).every(ch => data[book.id][ch]))) {
      return { ok: false, error: 'Unsupported or incomplete 66-book database' };
    }
    value = { version: 2, language, translation: `local-${randomUUID()}`, name: path.basename(filePath, ext), books: data };
  } else if (ext === '.json') { value = { ...JSON.parse(fs.readFileSync(filePath, 'utf8')), language, translation: `local-${randomUUID()}` }; }
  else return { ok: false, error: 'Unsupported file type' };
  return validateLocalBible(value, language);
}
