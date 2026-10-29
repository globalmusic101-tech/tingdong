import { passagesFor, passagesForAllBooks, sentencesFor, storyPassages, type BibleLanguage, type Division } from './model';
import { validWordIds } from './lessons';
import type { Gender, Tone } from '../prompter/lib/tts/voiceMap';

export const STUDY_KEY = 'tingdong.bible.v1';
export type LearningView = 'read' | 'words' | 'grammar';
export type WordReview = 'known' | 'again';
export type StudyFontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type StudySettings = { pinyin: boolean; meanings: boolean; rate: number; repeats: number; gapMs: number; engine: 'edge' | 'local'; gender: Gender; tone: Tone; primaryLanguage: BibleLanguage; secondaryLanguages: BibleLanguage[]; fontSize: StudyFontSize };
export type StudyData = { version: 1; mode: Division; passageId: string; sentenceId: string; completed: string[]; settings: StudySettings;
  learningView: LearningView; wordReviews: Record<string, WordReview> };
export const DEFAULT_STUDY: StudyData = {
  version: 1, mode: 'story', passageId: storyPassages[0].id, sentenceId: '1:0', completed: [],
  settings: { pinyin: true, meanings: true, rate: 0.85, repeats: 0, gapMs: 1000, engine: 'local', gender: 'female', tone: 'news', primaryLanguage: 'zh', secondaryLanguages: ['ko', 'en'], fontSize: 'medium' },
  learningView: 'read', wordReviews: {},
};
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const allIds = new Set(passagesForAllBooks('story').concat(passagesForAllBooks('five')).map(p => p.id));
export function validateStudy(value: unknown): StudyData {
  const v = record(value);
  if (v.version !== 1) return structuredClone(DEFAULT_STUDY);
  const mode = v.mode === 'five' ? 'five' : 'story';
  const passage = passagesFor(mode).find(p => p.id === v.passageId) ?? passagesFor(mode)[0];
  const lines = sentencesFor(passage);
  const s = record(v.settings);
  const primaryLanguage: BibleLanguage = s.primaryLanguage === 'ko' || s.primaryLanguage === 'en' ? s.primaryLanguage : 'zh';
  const secondaryLanguages = Array.isArray(s.secondaryLanguages)
    ? [...new Set(s.secondaryLanguages.filter((item): item is BibleLanguage => item === 'zh' || item === 'ko' || item === 'en'))].filter(item => item !== primaryLanguage)
    : (['ko', 'en'] as BibleLanguage[]).filter(item => item !== primaryLanguage);
  return {
    version: 1, mode, passageId: passage.id,
    sentenceId: lines.find(l => l.id === v.sentenceId)?.id ?? lines[0].id,
    completed: Array.isArray(v.completed) ? [...new Set(v.completed.filter((id): id is string => typeof id === 'string' && allIds.has(id)))] : [],
    learningView: v.learningView === 'words' || v.learningView === 'grammar' ? v.learningView : 'read',
    wordReviews: Object.fromEntries(Object.entries(record(v.wordReviews)).filter(([id, state]) => validWordIds.has(id) && (state === 'known' || state === 'again'))) as Record<string, WordReview>,
    settings: {
      pinyin: typeof s.pinyin === 'boolean' ? s.pinyin : true,
      meanings: typeof s.meanings === 'boolean' ? s.meanings : true,
      rate: typeof s.rate === 'number' && [0.5, 0.65, 0.75, 0.85, 1, 1.15, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3].includes(s.rate) ? s.rate : 0.85,
      repeats: typeof s.repeats === 'number' && [0, 1, 3, 5].includes(s.repeats) ? s.repeats : 0,
      gapMs: typeof s.gapMs === 'number' && [0, 500, 1000, 2000, 3000].includes(s.gapMs) ? s.gapMs : 1000,
      engine: s.engine === 'edge' || s.engine === 'google' ? 'edge' : 'local',
      gender: s.gender === 'male' ? 'male' : 'female',
      tone: s.tone === 'sermon' || s.tone === 'chat' ? s.tone : 'news',
      primaryLanguage, secondaryLanguages,
      fontSize: s.fontSize === 'small' || s.fontSize === 'large' || s.fontSize === 'xlarge' ? s.fontSize : 'medium',
    },
  };
}
export function loadStudy(): { data: StudyData; failed: boolean } {
  try {
    const raw = localStorage.getItem(STUDY_KEY);
    return { data: raw ? validateStudy(JSON.parse(raw)) : structuredClone(DEFAULT_STUDY), failed: false };
  } catch { return { data: structuredClone(DEFAULT_STUDY), failed: true }; }
}
export function saveStudy(data: StudyData): boolean {
  try { localStorage.setItem(STUDY_KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}
