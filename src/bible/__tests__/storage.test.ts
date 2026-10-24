import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STUDY, loadStudy, saveStudy, validateStudy, STUDY_KEY } from '../storage';
import { storyPassages, fivePassages, passagesForAllBooks } from '../model';
afterEach(() => vi.unstubAllGlobals());
describe('Bible progress storage', () => {
  it('round trips settings, position, mode and completion without touching legacy keys', () => {
    const memory = new Map([['prompter.script', '保留'], ['prompter.settings', '{"muted":true}']]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => memory.get(k), setItem: (k: string, v: string) => memory.set(k, v) });
    const data = { ...DEFAULT_STUDY, mode: 'five' as const, passageId: fivePassages[1].id, sentenceId: '7:0',
      completed: [storyPassages[0].id], settings: { pinyin: false, meanings: true, rate: 0.75, repeats: 5, gapMs: 2000, engine: 'edge' as const, gender: 'female' as const, tone: 'news' as const } };
    expect(saveStudy(data)).toBe(true);
    expect(loadStudy()).toEqual({ data, failed: false });
    expect(memory.get('prompter.script')).toBe('保留');
    expect(memory.get('prompter.settings')).toBe('{"muted":true}');
    expect(memory.size).toBe(3);
  });
  it('validates partial corruption and out of range values', () => {
    const data = validateStudy({ version: 1, mode: 'five', passageId: fivePassages[3].id, sentenceId: '999:9',
      settings: { rate: NaN, pinyin: 'yes', repeats: -1, gapMs: Infinity, engine: 'unknown' },
      completed: [null, 'x', storyPassages[0].id, storyPassages[0].id] });
    expect(data.sentenceId).toBe('16:0');
    expect(data.settings).toEqual(DEFAULT_STUDY.settings);
    expect(data.completed).toEqual([storyPassages[0].id]);
  });
  it('accepts the one-time repeat setting', () => {
    const data = validateStudy({ ...DEFAULT_STUDY, settings: { ...DEFAULT_STUDY.settings, repeats: 1 } });
    expect(data.settings.repeats).toBe(1);
  });
  it('preserves completion from a book outside Mark 1', () => {
    const external = passagesForAllBooks('story').find(item => item.id.includes(':JHN:'))!;
    const data = validateStudy({ ...DEFAULT_STUDY, completed: [external.id] });
    expect(data.completed).toEqual([external.id]);
  });
  it.each([null, [], 'wrong', { version: 99 }])('recovers invalid schema %j', value => {
    expect(validateStudy(value)).toEqual(DEFAULT_STUDY);
  });
  it('reports unavailable storage and malformed JSON', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{', setItem: () => { throw new Error('denied'); } });
    expect(loadStudy().failed).toBe(true);
    expect(saveStudy(DEFAULT_STUDY)).toBe(false);
    expect(STUDY_KEY).not.toMatch(/^prompter/);
  });
  it('migrates only a legacy Google engine while preserving Bible progress and study choices', () => {
    const old = {
      ...DEFAULT_STUDY,
      mode: 'five' as const,
      passageId: fivePassages[1].id,
      sentenceId: '7:0',
      completed: [storyPassages[0].id],
      learningView: 'words' as const,
      wordReviews: { 'cmn-cu89s:MRK:1:1:福音': 'again' as const },
      settings: { ...DEFAULT_STUDY.settings, pinyin: false, meanings: false, rate: 1.15, repeats: 5, gapMs: 3000, engine: 'google' },
    };
    const migrated = validateStudy(old);
    expect(migrated).toEqual({ ...old, settings: { ...old.settings, engine: 'edge' } });
  });
});

describe('Learning material migration and review state', () => {
  const id = 'cmn-cu89s:MRK:1:1:福音';
  it('loads pre-F13 progress while filling new fields without resetting old study settings', () => {
    const old = {version:1,mode:'story',passageId:storyPassages[1].id,sentenceId:'10:0',completed:[storyPassages[0].id],
      settings:{pinyin:false,rate:0.75,repeats:5,gapMs:2000,engine:'edge'}};
    const migrated = validateStudy(old);
    expect(migrated.passageId).toBe(old.passageId); expect(migrated.sentenceId).toBe('10:0');
    expect(migrated.completed).toEqual(old.completed);
    expect(migrated.settings).toEqual({...old.settings,meanings:true,gender:'female',tone:'news'});
    expect(migrated.learningView).toBe('read'); expect(migrated.wordReviews).toEqual({});
  });
  it('persists the study view, meaning visibility and self-assessed word status', () => {
    const memory = new Map<string,string>();
    vi.stubGlobal('localStorage',{getItem:(k:string)=>memory.get(k),setItem:(k:string,v:string)=>memory.set(k,v)});
    const data={...DEFAULT_STUDY,learningView:'words' as const,wordReviews:{[id]:'known' as const},settings:{...DEFAULT_STUDY.settings,meanings:false}};
    expect(saveStudy(data)).toBe(true); expect(loadStudy().data).toEqual(data);
  });
  it('drops corrupt card state without losing valid progress', () => {
    const value=validateStudy({...DEFAULT_STUDY,learningView:'invalid',wordReviews:{[id]:'again','fake':'known','cmn-cu89s:MRK:1:2:预备':'invalid'},settings:{...DEFAULT_STUDY.settings,meanings:'yes'}});
    expect(value.wordReviews).toEqual({[id]:'again'}); expect(value.learningView).toBe('read');
    expect(value.settings.meanings).toBe(true); expect(value.passageId).toBe(DEFAULT_STUDY.passageId);
  });
});
