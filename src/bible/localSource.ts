import type { Bilingual } from './lessons';
import { verseMeanings } from './lessons';

export type BibleLanguage = 'ko' | 'en';
export type LocalBible = { version: 1; language: BibleLanguage; translation: string; name: string; book: 'Mark'; chapter: 1; sourceUrl?: string; verses: Record<string, string> };

export function validateLocalBible(value: unknown, language: BibleLanguage): { ok: true; data: LocalBible } | { ok: false; error: string } {
  if (!value || typeof value !== 'object') return { ok: false, error: 'JSON object required' };
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || input.language !== language || typeof input.translation !== 'string') return { ok: false, error: 'Unsupported translation format' };
  if (input.book !== 'Mark' || input.chapter !== 1) return { ok: false, error: 'Only Mark chapter 1 is supported' };
  if (typeof input.name !== 'string' || !input.name.trim()) return { ok: false, error: 'Translation name is required' };
  if (!input.verses || typeof input.verses !== 'object' || Array.isArray(input.verses)) return { ok: false, error: 'verses object required' };
  const verses = input.verses as Record<string, unknown>;
  const expected = Array.from({ length: 45 }, (_, i) => String(i + 1));
  if (Object.keys(verses).sort().join(',') !== [...expected].sort().join(',')) return { ok: false, error: 'Mark 1 must contain exactly verses 1-45' };
  for (const key of expected) if (typeof verses[key] !== 'string' || !verses[key].trim() || verses[key].length > 10000) return { ok: false, error: `Invalid verse ${key}` };
  return { ok: true, data: input as LocalBible };
}

export function mergeLocalBibles(ko: LocalBible | undefined, en: LocalBible | undefined, base = verseMeanings): Record<number, Bilingual> {
  return Object.fromEntries(Object.entries(base).map(([number, meaning]) => [Number(number), { ko: ko?.verses[number] ?? meaning.ko, en: en?.verses[number] ?? meaning.en }]));
}
