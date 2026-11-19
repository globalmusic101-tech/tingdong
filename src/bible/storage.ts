import { passagesFor, passagesForAllBooks, sentencesFor, storyPassages, type BibleLanguage, type Division } from './model';
import { validWordIds } from './lessons';
import type { Gender, Tone } from '../prompter/lib/tts/voiceMap';

export const STUDY_KEY = 'tingdong.bible.v1';
export type LearningView = 'read' | 'words' | 'grammar';
export type WordReview = 'known' | 'again';
export type StudyFontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type StudySettings = { pinyin: boolean; meanings: boolean; rate: number; repeats: number; gapMs: number; engine: 'edge' | 'local'; gender: Gender; tone: Tone; primaryLanguage: BibleLanguage; secondaryLanguages: BibleLanguage[]; fontSize: StudyFontSize; deviceVoiceByLanguage?: Partial<Record<BibleLanguage, string>> };
export type StudyData = { version: 1; mode: Division; passageId: string; sentenceId: string; completed: string[]; settings: StudySettings;
  learningView: LearningView; wordReviews: Record<string, WordReview> };
export const DEFAULT_STUDY: StudyData = {
  version: 1, mode: 'story', passageId: storyPassages[0].id, sentenceId: '1:0', completed: [],
  settings: { pinyin: true, meanings: true, rate: 1, repeats: 1, gapMs: 0, engine: 'edge', gender: 'female', tone: 'news', primaryLanguage: 'zh', secondaryLanguages: ['ko', 'en'], fontSize: 'medium', deviceVoiceByLanguage: {} },
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
  const rawDeviceVoices = record(s.deviceVoiceByLanguage);
  const isVoiceURI = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 512
    && [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127);
  const deviceVoiceByLanguage = Object.fromEntries((['zh', 'ko', 'en'] as BibleLanguage[])
    .filter(language => isVoiceURI(rawDeviceVoices[language]))
    .map(language => [language, rawDeviceVoices[language]])) as Partial<Record<BibleLanguage, string>>;
  return {
    version: 1, mode, passageId: passage.id,
    sentenceId: lines.find(l => l.id === v.sentenceId)?.id ?? lines[0].id,
    completed: Array.isArray(v.completed) ? [...new Set(v.completed.filter((id): id is string => typeof id === 'string' && allIds.has(id)))] : [],
    learningView: v.learningView === 'words' || v.learningView === 'grammar' ? v.learningView : 'read',
    wordReviews: Object.fromEntries(Object.entries(record(v.wordReviews)).filter(([id, state]) => validWordIds.has(id) && (state === 'known' || state === 'again'))) as Record<string, WordReview>,
    settings: {
      pinyin: typeof s.pinyin === 'boolean' ? s.pinyin : true,
      meanings: typeof s.meanings === 'boolean' ? s.meanings : true,
      rate: typeof s.rate === 'number' && [0.5, 0.65, 0.75, 0.85, 1, 1.15, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3].includes(s.rate) ? s.rate : DEFAULT_STUDY.settings.rate,
      repeats: typeof s.repeats === 'number' && [0, 1, 3, 5].includes(s.repeats) ? s.repeats : DEFAULT_STUDY.settings.repeats,
      gapMs: typeof s.gapMs === 'number' && [0, 500, 1000, 2000, 3000].includes(s.gapMs) ? s.gapMs : 0,
      engine: s.engine === 'local' ? 'local' : DEFAULT_STUDY.settings.engine,
      gender: s.gender === 'male' ? 'male' : 'female',
      tone: s.tone === 'sermon' || s.tone === 'chat' ? s.tone : 'news',
      primaryLanguage, secondaryLanguages,
      fontSize: s.fontSize === 'small' || s.fontSize === 'large' || s.fontSize === 'xlarge' ? s.fontSize : 'medium',
      deviceVoiceByLanguage,
    },
  };
}
export function loadStudy(): { data: StudyData; failed: boolean } {
  try {
    const raw = localStorage.getItem(STUDY_KEY);
    const rawValue = raw ? record(JSON.parse(raw)) : {};
    const data = raw ? validateStudy(rawValue) : structuredClone(DEFAULT_STUDY);
    if (rawValue.gapDefaultMigrated !== true) {
      if (data.settings.gapMs === 1000) data.settings.gapMs = 0;
    }
    return { data, failed: false };
  } catch { return { data: structuredClone(DEFAULT_STUDY), failed: true }; }
}
export function saveStudy(data: StudyData): boolean {
  try {
    localStorage.setItem(STUDY_KEY, JSON.stringify({ ...data, gapDefaultMigrated: true }));
    return true;
  }
  catch { return false; }
}
