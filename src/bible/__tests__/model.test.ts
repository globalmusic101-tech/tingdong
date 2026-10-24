import { describe, expect, it } from 'vitest';
import { chapter, partition, passagesForAllBooks, sentencesFor, type Chapter } from '../model';

const numbered = (n: number): Chapter => ({ ...chapter, verses: Array.from({ length: n }, (_, i) => ({ number: i + 1, text: '你好。' })), headings: [] });
describe('Bible passage boundaries and source integrity', () => {
  it('covers the source 45 verses exactly once using the nine source headings', () => {
    const p = partition(chapter, 'story');
    expect(p.map(s => [s.start,s.end])).toEqual([[1,8],[9,11],[12,13],[14,15],[16,20],[21,28],[29,34],[35,39],[40,45]]);
    expect(p.flatMap(s => s.verses)).toEqual(chapter.verses);
    expect(new Set(p.map(s => s.id)).size).toBe(9);
  });
  it('falls back to five verses and preserves the short final group', () => {
    const p = partition(numbered(12), 'story');
    expect(p.map(s => [s.start,s.end])).toEqual([[1,5],[6,10],[11,12]]);
    expect(partition(chapter, 'five').every(s => s.verses.length <= 5)).toBe(true);
  });
  it('fills partial heading gaps without swallowing or duplicating verses', () => {
    const data = numbered(17);
    data.headings = [{ start: 7, end: 9, key: 'test', title: '例' }];
    const p = partition(data, 'story');
    expect(p.map(s => [s.start,s.end])).toEqual([[1,5],[6,6],[7,9],[10,14],[15,17]]);
    expect(p.flatMap(s => s.verses)).toEqual(data.verses);
  });
  it.each([
    [{ start: 0, end: 3 }], [{ start: 3, end: 2 }], [{ start: 1, end: 46 }],
    [{ start: 1.5, end: 3 }], [{ start: 1, end: 5 }, { start: 5, end: 7 }],
    [{ start: 5, end: 7 }, { start: 1, end: 2 }],
  ])('rejects invalid heading boundaries %j', (...hs) => {
    const headings = hs.map(h => ({ ...h, key: '', title: '' }));
    expect(() => partition({ ...chapter, headings }, 'story')).toThrow('Invalid chapter headings');
  });
  it('rejects missing and blank verses rather than treating them as success', () => {
    expect(() => partition({ ...chapter, verses: chapter.verses.slice(1) }, 'story')).toThrow();
    expect(() => partition({ ...chapter, verses: chapter.verses.map(v => v.number === 8 ? { ...v, text: '' } : v) }, 'story')).toThrow();
  });
  it('retains verse identity across sentences and preserves every character', () => {
    for (const passage of partition(chapter, 'story')) {
      const sentences = sentencesFor(passage);
      expect(new Set(sentences.map(s => s.id)).size).toBe(sentences.length);
      for (const verse of passage.verses) {
        expect(sentences.filter(s => s.verse === verse.number).map(s => s.text).join('')).toBe(verse.text);
      }
    }
    expect(sentencesFor(partition(chapter, 'story')[3]).filter(s => s.verse === 15).length).toBe(2);
  });
  it('builds complete passage catalogs for both study modes', () => {
    const story = passagesForAllBooks('story');
    const five = passagesForAllBooks('five');
    expect(story.length).toBeGreaterThan(2000);
    expect(five.length).toBeGreaterThan(story.length);
    expect(new Set(story.map(item => item.id)).size).toBe(story.length);
    expect(story.some(item => item.id.includes(':MAT:1:'))).toBe(true);
  });
});
