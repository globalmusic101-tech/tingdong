import { splitSentences } from '../prompter/lib/splitSentences';
import type { Bilingual } from './lessons';
import raw from './mark1.json';
import fullRaw from './bible-full.json';
import contextRaw from './context-headings.json';

export type Division = 'story' | 'five';
export type BibleLanguage = 'zh' | 'ko' | 'en';
export type LanguageText = { ko: string; en: string };
export type Verse = { number: number; text: string };
export type Heading = { start: number; end: number; title: string; titleKo?: string; titleEn?: string; key: string };
export type Chapter = { version: string; book: string; chapter: number; source: string; verses: Verse[]; headings: Heading[] };
export type Passage = { id: string; start: number; end: number; heading?: Heading; verses: Verse[] };
export type StudySentence = { id: string; verse: number; text: string };
export const chapter: Chapter = raw;
type FullBible = { version: string; books: { id: string; name: string; chapters: { chapter: number; verses: { number: number; zh: string; ko: string; en: string }[] }[] }[] };
type ContextCatalog = { version: number; source: string; books: Record<string, Record<string, { start: number; end: number; title: string; key: string }[]>> };
export const bibleBooks = (fullRaw as FullBible).books;
const contextHeadings = contextRaw as ContextCatalog;
export function headingTitle(heading: Heading | undefined, language: BibleLanguage, fallback: string): string {
  if (!heading) return fallback;
  if (language === 'ko' && heading.titleKo?.trim()) return heading.titleKo;
  if (language === 'en' && heading.titleEn?.trim()) return heading.titleEn;
  return language === 'zh' ? heading.title : fallback;
}
export function selectionForPassageId(id: string): { book: string; chapter: number } {
  const [, bookId, chapterValue] = id.split(':');
  const chapter = Number(chapterValue);
  const book = bibleBooks.find(item => item.id === bookId);
  if (book && Number.isInteger(chapter) && book.chapters.some(item => item.chapter === chapter)) return { book: bookId, chapter };
  return { book: 'MRK', chapter: 1 };
}
export function chapterFor(bookId: string, number: number): Chapter {
  if (bookId === chapter.book && number === chapter.chapter) return chapter;
  const book = bibleBooks.find(item => item.id === bookId);
  const found = book?.chapters.find(item => item.chapter === number);
  if (!book || !found) return chapter;
  return { version: 'cmn-cu89s', book: book.id, chapter: found.chapter, source: `https://ebible.org/cmn-cu89s/${book.id}${String(found.chapter).padStart(2, '0')}.htm`,
    verses: found.verses.map(({ number: verse, zh }) => ({ number: verse, text: zh })), headings: contextHeadings.books[book.id]?.[String(found.chapter)] ?? [] };
}
export function meaningsFor(bookId: string, number: number): Record<number, Bilingual> {
  const book = bibleBooks.find(item => item.id === bookId);
  const found = book?.chapters.find(item => item.chapter === number);
  if (!found) return {};
  return Object.fromEntries(found.verses.map(verse => [verse.number, { ko: verse.ko, en: verse.en }]));
}

export function textForVerse(verse: Verse, language: BibleLanguage, meanings: Record<number, LanguageText>): string {
  if (language === 'zh') return verse.text;
  return meanings[verse.number]?.[language] ?? '';
}

export function sentencesForLanguage(passage: Passage, language: BibleLanguage, meanings: Record<number, LanguageText>): StudySentence[] {
  return passage.verses.flatMap(v => splitSentences(textForVerse(v, language, meanings), { readMode: 'raw' }).sentences.map((s, i) => ({ id: `${v.number}:${i}`, verse: v.number, text: s.text })));
}

/** 누락된 절을 정상 단락처럼 보여주지 않습니다. */
export function partition(data: Chapter, mode: Division): Passage[] {
  const { verses, headings } = data;
  if (!verses.length || verses.some((v, i) => (i > 0 && v.number <= verses[i - 1].number) || !v.text.trim())) {
    throw new Error('Invalid chapter verses');
  }
  let end = 0;
  for (const h of headings) {
    if (!Number.isInteger(h.start) || !Number.isInteger(h.end) || h.start <= end || h.end < h.start
      || !verses.some(verse => verse.number === h.start) || !verses.some(verse => verse.number === h.end)) {
      throw new Error('Invalid chapter headings');
    }
    end = h.end;
  }
  const result: Passage[] = [];
  const add = (startIndex: number, finishIndex: number, heading?: Heading) => {
    const start = verses[startIndex].number;
    const finish = verses[finishIndex].number;
    result.push({ id: `${data.version}:${data.book}:${data.chapter}:${start}-${finish}`, start, end: finish,
      heading, verses: verses.slice(startIndex, finishIndex + 1) });
  };
  const fallback = (startIndex: number, finishIndex: number) => {
    for (let n = startIndex; n <= finishIndex; n += 5) {
      const endIndex = Math.min(n + 4, finishIndex);
      const heading = mode === 'story'
        ? { start: verses[n].number, end: verses[endIndex].number, title: `${data.book} ${data.chapter}:${verses[n].number}–${verses[endIndex].number}`, key: '' }
        : undefined;
      add(n, endIndex, heading);
    }
  };
  let cursor = 0;
  if (mode === 'story') {
    for (const h of headings) {
      const startIndex = verses.findIndex(v => v.number >= h.start);
      const nextIndex = verses.findIndex(v => v.number > h.end);
      const endIndex = nextIndex === -1 ? verses.length - 1 : nextIndex - 1;
      if (startIndex < cursor || endIndex < startIndex) throw new Error('Invalid chapter headings');
      if (startIndex > cursor) fallback(cursor, startIndex - 1);
      add(startIndex, endIndex, h);
      cursor = endIndex + 1;
    }
  }
  if (cursor < verses.length) fallback(cursor, verses.length - 1);
  return result;
}

export function sentencesFor(passage: Passage): StudySentence[] {
  return passage.verses.flatMap(v => splitSentences(v.text, { readMode: 'raw' }).sentences.map((s, i) => ({
    id: `${v.number}:${i}`, verse: v.number, text: s.text,
  })));
}

export const storyPassages = partition(chapter, 'story');
export const fivePassages = partition(chapter, 'five');
export const passagesFor = (mode: Division) => mode === 'story' ? storyPassages : fivePassages;
export const passagesForAllBooks = (mode: Division) => bibleBooks.flatMap(book => book.chapters.flatMap(item =>
  partition(chapterFor(book.id, item.chapter), mode)));
