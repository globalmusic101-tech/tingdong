import { splitSentences } from '../prompter/lib/splitSentences';
import raw from './mark1.json';

export type Division = 'story' | 'five';
export type Verse = { number: number; text: string };
export type Heading = { start: number; end: number; title: string; key: string };
export type Chapter = { version: string; book: string; chapter: number; source: string; verses: Verse[]; headings: Heading[] };
export type Passage = { id: string; start: number; end: number; heading?: Heading; verses: Verse[] };
export type StudySentence = { id: string; verse: number; text: string };
export const chapter: Chapter = raw;

/** 누락된 절을 정상 단락처럼 보여주지 않습니다. */
export function partition(data: Chapter, mode: Division): Passage[] {
  const { verses, headings } = data;
  if (!verses.length || verses.some((v, i) => v.number !== i + 1 || !v.text.trim())) {
    throw new Error('Invalid chapter verses');
  }
  let end = 0;
  for (const h of headings) {
    if (!Number.isInteger(h.start) || !Number.isInteger(h.end) || h.start <= end || h.end < h.start || h.end > verses.length) {
      throw new Error('Invalid chapter headings');
    }
    end = h.end;
  }
  const result: Passage[] = [];
  const add = (start: number, finish: number, heading?: Heading) => {
    result.push({ id: `${data.version}:${data.book}:${data.chapter}:${start}-${finish}`, start, end: finish,
      heading, verses: verses.slice(start - 1, finish) });
  };
  const fallback = (start: number, finish: number) => {
    for (let n = start; n <= finish; n += 5) add(n, Math.min(n + 4, finish));
  };
  let cursor = 1;
  if (mode === 'story') {
    for (const h of headings) {
      fallback(cursor, h.start - 1);
      add(h.start, h.end, h);
      cursor = h.end + 1;
    }
  }
  fallback(cursor, verses.length);
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
