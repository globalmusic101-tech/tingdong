import { describe, expect, it } from 'vitest';
import { chapter, fivePassages, storyPassages } from '../model';
import { grammarPoints, lessonFor, romansGrammarPoints, romansVocabulary, vocabulary, verseMeaningSources, verseMeanings } from '../lessons';

const bilingual = (text: {ko: string; en: string}) => {
  expect(text.ko.trim().length).toBeGreaterThan(1);
  expect(text.en.trim().length).toBeGreaterThan(1);
  expect(text.ko).toMatch(/[가-힣]/);
  expect(text.en).not.toMatch(/[가-힣]/);
};
describe('Bilingual study material coverage and source alignment', () => {
  it('identifies the existing public-domain translation sources', () => {
    expect(verseMeaningSources.ko.name).toBe('한국어 성경 1910');
    expect(verseMeaningSources.en.name).toBe('World English Bible Classic');
    expect(verseMeaningSources.ko.url).toMatch(/ebible\.org\/kor\/MRK01\.htm$/);
    expect(verseMeaningSources.en.url).toMatch(/ebible\.org\/eng-web\/MRK01\.htm$/);
  });
  it('provides both learning meanings for all 45 source verses', () => {
    expect(Object.keys(verseMeanings).map(Number)).toEqual(chapter.verses.map(v => v.number));
    chapter.verses.forEach(v => bilingual(verseMeanings[v.number]));
  });
  it('uses unique stable vocabulary IDs, bilingual meanings and actual source quotes', () => {
    expect(vocabulary).toHaveLength(45);
    expect(new Set(vocabulary.map(w => w.id)).size).toBe(vocabulary.length);
    for (const word of vocabulary) {
      const source = chapter.verses[word.verse - 1];
      expect(source.text).toContain(word.quote);
      expect(word.pinyin).toMatch(/[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/);
      bilingual(word.meaning);
      // 受洗는 9절에서 受了约翰的洗로 분리되어 쓰이는 이합 표현입니다.
      if (word.word === '受洗') expect(word.quote).toMatch(/受.*洗/);
      else expect(word.quote).toContain(word.word);
    }
  });
  it('anchors every grammar example in the source and separates authored practice examples', () => {
    expect(grammarPoints).toHaveLength(19);
    expect(new Set(grammarPoints.map(g => g.id)).size).toBe(grammarPoints.length);
    for (const point of grammarPoints) {
      expect(chapter.verses[point.verse - 1].text).toContain(point.quote);
      expect(point.pattern.trim()).not.toBe('');
      expect(point.breakdown.trim()).not.toBe('');
      expect(point.practice).toMatch(/[\u4e00-\u9fff]/);
      bilingual(point.explanation); bilingual(point.practiceMeaning);
    }
  });
  it('filters by exact verse range for both story and five-verse groupings', () => {
    for (const passage of [...storyPassages, ...fivePassages]) {
      const material = lessonFor(passage);
      expect(material.words.length).toBeGreaterThan(0);
      expect(material.grammar.length).toBeGreaterThan(0);
      for (const item of [...material.words, ...material.grammar]) {
        expect(item.verse).toBeGreaterThanOrEqual(passage.start);
        expect(item.verse).toBeLessThanOrEqual(passage.end);
      }
    }
    expect(lessonFor({start: 9, end: 11}).words.map(w=>w.word)).toEqual(['受洗','裂开','仿佛','降','喜悦']);
    expect(lessonFor({start: 41, end: 45}).words.map(w=>w.word)).toEqual(['慈心','谨慎']);
  });
  it('does not invent materials for a range without notes', () => {
    expect(lessonFor({start: 46,end:50})).toEqual({words:[],grammar:[]});
  });
  it('provides Romans vocabulary and grammar from matching source verses', () => {
    expect(romansVocabulary.length).toBeGreaterThan(100);
    expect(romansGrammarPoints.length).toBeGreaterThan(10);
    const material = lessonFor({ start: 1, end: 7 }, 'ROM');
    expect(material.words.length).toBeGreaterThan(0);
    expect(material.grammar.length).toBeGreaterThan(0);
    for (const item of [...romansVocabulary, ...romansGrammarPoints]) {
      expect(item.id).toContain(':ROM:');
      expect(item.quote.trim()).not.toBe('');
    }
  });
});
