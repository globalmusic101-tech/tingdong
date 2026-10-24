import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const runFile = promisify(execFile);
const expectedVerses = Array.from({ length: 45 }, (_, i) => String(i + 1));
export function validateLocalBible(value, language) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'JSON object required' };
  if (value.version !== 1 || value.language !== language || typeof value.translation !== 'string') return { ok: false, error: 'Unsupported translation format' };
  if (value.book !== 'Mark' || value.chapter !== 1) return { ok: false, error: 'Only Mark chapter 1 is supported' };
  if (typeof value.name !== 'string' || !value.name.trim()) return { ok: false, error: 'Translation name is required' };
  if (!value.verses || typeof value.verses !== 'object' || Array.isArray(value.verses)) return { ok: false, error: 'verses object required' };
  if (Object.keys(value.verses).sort().join(',') !== [...expectedVerses].sort().join(',')) return { ok: false, error: 'Mark 1 must contain exactly verses 1-45' };
  for (const key of expectedVerses) if (typeof value.verses[key] !== 'string' || !value.verses[key].trim() || value.verses[key].length > 10000) return { ok: false, error: `Invalid verse ${key}` };
  return { ok: true, data: value };
}
function safeName(name) { return name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'translation'; }
export async function convertBibleFile(filePath, language) {
  const ext = path.extname(filePath).toLowerCase();
  let value;
  if (['.bdb', '.db', '.sqlite'].includes(ext)) {
    const { stdout } = await runFile('/usr/bin/sqlite3', ['-json', filePath, 'select verse,btext from Bible where book=41 and chapter=1 order by verse'], { maxBuffer: 2 * 1024 * 1024 });
    const rows = JSON.parse(stdout);
    const base = path.basename(filePath, ext);
    value = { version: 1, language, translation: `local-${language}-${safeName(base)}`, name: base, book: 'Mark', chapter: 1,
      verses: Object.fromEntries(rows.map(row => [String(row.verse), String(row.btext).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()])) };
  } else { value = { ...JSON.parse(fs.readFileSync(filePath, 'utf8')), language }; }
  return validateLocalBible(value, language);
}
