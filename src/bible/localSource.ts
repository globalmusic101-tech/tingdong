import type { Bilingual } from './lessons';
import { verseMeanings } from './lessons';
import { bibleBooks } from './model';

export type BibleLanguage = 'ko' | 'en';
type LegacyBible = { version: 1; language: BibleLanguage; translation: string; name: string; book: 'Mark'; chapter: 1; sourceUrl?: string; verses: Record<string, string> };
type FullBible = { version: 2; language: BibleLanguage; translation: string; name: string; books: Record<string, Record<string, Record<string, string>>> };
export type LocalBible = LegacyBible | FullBible;

export function validateLocalBible(value: unknown, language: BibleLanguage): { ok: true; data: LocalBible } | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'Invalid Bible data' };
  const input = value as Record<string, unknown>;
  if (input.language !== language || typeof input.translation !== 'string' || typeof input.name !== 'string' || !input.name.trim()) return { ok: false, error: 'Invalid metadata' };
  if (input.version === 1) {
    if (input.book !== 'Mark' || input.chapter !== 1 || !input.verses || typeof input.verses !== 'object' || Array.isArray(input.verses)) return { ok: false, error: 'Invalid Mark 1 data' };
    const verses = input.verses as Record<string, unknown>;
    const keys = Array.from({ length: 45 }, (_, i) => String(i + 1));
    if (Object.keys(verses).length !== 45 || keys.some(k => typeof verses[k] !== 'string' || !(verses[k] as string).trim())) return { ok: false, error: 'Invalid Mark 1 verses' };
  } else if (input.version === 2) {
    if (!input.books || typeof input.books !== 'object' || Array.isArray(input.books)) return { ok: false, error: 'Invalid books' };
    let count = 0;
    for (const [id, chapters] of Object.entries(input.books)) {
      const book = bibleBooks.find(item => item.id === id);
      if (!book || !chapters || typeof chapters !== 'object' || Array.isArray(chapters)) return { ok: false, error: 'Invalid book' };
      for (const [ch, verses] of Object.entries(chapters)) {
        if (!book.chapters.some(item => item.chapter === Number(ch)) || !verses || typeof verses !== 'object' || Array.isArray(verses)) return { ok: false, error: 'Invalid chapter' };
        for (const [n, text] of Object.entries(verses)) if (!/^[1-9]\d*$/.test(n) || Number(n) > 176 || typeof text !== 'string' || !text.trim() || text.length > 10000 || ++count > 40000) return { ok: false, error: 'Invalid verse' };
      }
    }
    if (!count) return { ok: false, error: 'Empty Bible' };
  } else return { ok: false, error: 'Unsupported format' };
  return { ok: true, data: input as LocalBible };
}
export function localVerse(bible: LocalBible | undefined, book: string, chapter: number, verse: number): string | undefined {
  if (!bible) return undefined;
  return bible.version === 1 ? (book === 'MRK' && chapter === 1 ? bible.verses[String(verse)] : undefined) : bible.books[book]?.[String(chapter)]?.[String(verse)];
}
export function mergeLocalBibles(ko: LocalBible | undefined, en: LocalBible | undefined, base = verseMeanings, book = 'MRK', chapter = 1): Record<number, Bilingual> {
  return Object.fromEntries(Object.entries(base).map(([number, meaning]) => [Number(number), { ko: localVerse(ko, book, chapter, Number(number)) ?? meaning.ko, en: localVerse(en, book, chapter, Number(number)) ?? meaning.en }]));
}
