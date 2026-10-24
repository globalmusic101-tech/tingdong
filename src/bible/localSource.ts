import type { Bilingual } from './lessons';
import { verseMeanings } from './lessons';

export type LocalKoreanBible = {
  version: 1;
  translation: 'saehangul-2025';
  name: string;
  book: 'Mark';
  chapter: 1;
  sourceUrl?: string;
  verses: Record<string, string>;
};

export function validateLocalKoreanBible(value: unknown):
  | { ok: true; data: LocalKoreanBible }
  | { ok: false; error: string } {
  if (!value || typeof value !== 'object') return { ok: false, error: 'JSON object required' };
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || input.translation !== 'saehangul-2025') return { ok: false, error: 'Unsupported translation format' };
  if (input.book !== 'Mark' || input.chapter !== 1) return { ok: false, error: 'Only Mark chapter 1 is supported' };
  if (typeof input.name !== 'string' || !input.name.trim()) return { ok: false, error: 'Translation name is required' };
  if (input.sourceUrl !== undefined && (typeof input.sourceUrl !== 'string' || !/^https?:\/\//.test(input.sourceUrl))) {
    return { ok: false, error: 'sourceUrl must be an http(s) URL' };
  }
  if (!input.verses || typeof input.verses !== 'object' || Array.isArray(input.verses)) return { ok: false, error: 'verses object required' };
  const verses = input.verses as Record<string, unknown>;
  const expected = Array.from({ length: 45 }, (_, i) => String(i + 1));
  if (Object.keys(verses).sort().join(',') !== [...expected].sort().join(',')) return { ok: false, error: 'Mark 1 must contain exactly verses 1-45' };
  for (const key of expected) {
    if (typeof verses[key] !== 'string' || !verses[key].trim() || verses[key].length > 10000) return { ok: false, error: `Invalid verse ${key}` };
  }
  return { ok: true, data: input as LocalKoreanBible };
}

export function mergeLocalKoreanBible(local: LocalKoreanBible): Record<number, Bilingual> {
  return Object.fromEntries(Object.entries(verseMeanings).map(([number, meaning]) => [
    Number(number), { ko: local.verses[number], en: meaning.en },
  ]));
}
