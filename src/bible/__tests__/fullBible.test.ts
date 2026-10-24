import { describe, expect, it } from 'vitest';
import { bibleBooks, chapterFor, partition } from '../model';

describe('full public-domain Bible catalog', () => {
  it('contains all 66 books and every chapter can be divided', () => {
    expect(bibleBooks).toHaveLength(66);
    for (const book of bibleBooks) {
      expect(book.chapters.length).toBeGreaterThan(0);
      for (const item of book.chapters) {
        const chapter = chapterFor(book.id, item.chapter);
        expect(chapter.verses.length).toBeGreaterThan(0);
        const story = partition(chapter, 'story');
        expect(story.length).toBeGreaterThan(0);
        expect(story.every(p => p.heading?.title)).toBe(true);
        expect(story.flatMap(p => p.verses).map(v => v.number)).toEqual(chapter.verses.map(v => v.number));
        expect(partition(chapter, 'five').flatMap(p => p.verses)).toHaveLength(chapter.verses.length);
      }
    }
  });
});
