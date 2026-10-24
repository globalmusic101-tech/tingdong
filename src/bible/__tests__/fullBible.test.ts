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
        expect(partition(chapter, 'story').length).toBeGreaterThan(0);
        expect(partition(chapter, 'five').flatMap(p => p.verses)).toHaveLength(chapter.verses.length);
      }
    }
  });
});
