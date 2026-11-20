import { describe, expect, it } from 'vitest';
import { localVerse, mergeLocalBibles, validateLocalBible } from '../localSource';

describe('personal Bible versions', () => {
  const full = { version: 2, language: 'ko', translation: 'local-test', name: 'Test', books: { GEN: { '1': { '1': 'personal' } }, JHN: { '3': { '16': 'john' } } } };
  it('selects the matching book, chapter and verse without shifting', () => {
    const parsed = validateLocalBible(full, 'ko');
    if (!parsed.ok) throw new Error(parsed.error);
    expect(localVerse(parsed.data, 'JHN', 3, 16)).toBe('john');
    expect(localVerse(parsed.data, 'JHN', 3, 17)).toBeUndefined();
    expect(mergeLocalBibles(parsed.data, undefined, { 1: { ko: 'default', en: 'english' }, 2: { ko: 'fallback', en: 'english' } }, 'GEN', 1)).toEqual({ 1: { ko: 'personal', en: 'english' }, 2: { ko: 'fallback', en: 'english' } });
  });
  it('rejects unsupported books and wrong language', () => {
    expect(validateLocalBible(full, 'en').ok).toBe(false);
    expect(validateLocalBible({ ...full, books: { OTHER: { 1: { 1: 'x' } } } }, 'ko').ok).toBe(false);
  });
  it('keeps legacy Mark chapter 1 data usable', () => {
    const old = { version: 1, language: 'ko', translation: 'old', name: 'Old', book: 'Mark', chapter: 1, verses: Object.fromEntries(Array.from({ length: 45 }, (_, i) => [String(i + 1), `v${i + 1}`])) };
    const parsed = validateLocalBible(old, 'ko');
    if (!parsed.ok) throw new Error(parsed.error);
    expect(localVerse(parsed.data, 'MRK', 1, 1)).toBe('v1');
    expect(localVerse(parsed.data, 'GEN', 1, 1)).toBeUndefined();
  });
});
