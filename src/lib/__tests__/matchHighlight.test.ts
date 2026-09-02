import { describe, expect, it } from 'vitest';
import { highlightTerms, matchesHighlight } from '../matchHighlight';

/** 뜻 하나를 짚었을 때 그 낱말이 강조되는가 */
const hits = (literal: string, word: string, lang: 'ko' | 'en') =>
  matchesHighlight(word, highlightTerms(literal, lang), lang);

describe('한국어 매칭 (F11-3)', () => {
  it('조사가 붙은 낱말에도 걸린다', () => {
    expect(hits('기적', '기적도', 'ko')).toBe(true);
    expect(hits('기적', '기적을', 'ko')).toBe(true);
  });

  it('한 글자 뜻으로는 아무것도 강조하지 않는다 — 문장 절반이 물든다', () => {
    expect(highlightTerms('의', 'ko')).toEqual([]);
    expect(hits('의', '의자', 'ko')).toBe(false);
  });

  it('상관없는 낱말에는 걸리지 않는다', () => {
    expect(hits('기적', '사랑은', 'ko')).toBe(false);
  });

  it('사전 표기의 물결·대괄호는 벗겨낸다', () => {
    expect(highlightTerms('~[축복]', 'ko')).toEqual(['축복']);
  });
});

describe('영어 매칭 (F11-3)', () => {
  it('대소문자와 구두점을 무시하고 낱말로 맞춘다', () => {
    expect(hits('miracle', 'Miracle,', 'en')).toBe(true);
    expect(hits('Miracle', 'miracle.', 'en')).toBe(true);
  });

  it('부분 문자열로는 걸리지 않는다 — on이 only를 물들이지 않는다', () => {
    expect(matchesHighlight('only', ['onl'], 'en')).toBe(false);
    expect(hits('love', 'lovely', 'en')).toBe(false);
  });

  it('기능어는 강조어가 되지 않는다', () => {
    expect(highlightTerms('the', 'en')).toEqual([]);
    expect(highlightTerms('that', 'en')).toEqual([]);
    expect(hits('the', 'the', 'en')).toBe(false);
  });

  it('세 글자 미만은 길이로 걸러진다', () => {
    expect(highlightTerms('of', 'en')).toEqual([]);
    expect(highlightTerms('to', 'en')).toEqual([]);
  });

  it('여러 낱말짜리 뜻은 알맹이 낱말만 남긴다', () => {
    expect(highlightTerms('to look forward to', 'en')).toEqual(['look', 'forward']);
    expect(hits('to look forward to', 'forward', 'en')).toBe(true);
    expect(hits('to look forward to', 'to', 'en')).toBe(false);
  });

  it('같은 낱말이 겹쳐 와도 한 번만 담는다', () => {
    expect(highlightTerms('bless and bless', 'en')).toEqual(['bless']);
  });

  it('강조어가 없으면 어떤 낱말도 걸리지 않는다', () => {
    expect(matchesHighlight('anything', [], 'en')).toBe(false);
  });
});
