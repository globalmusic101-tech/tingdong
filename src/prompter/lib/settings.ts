import type { ReadMode } from './extractChinese';
import type { Gender, Tone } from './tts/voiceMap';

/**
 * 기본값을 손볼 때마다 올린다.
 * 저장된 설정이 기본값을 영원히 덮는 문제를 막는다 — 예전 버전에서 저장된 값은
 * 새 기본값으로 한 번 초기화된다.
 */
export const SETTINGS_VERSION = 2;

export type PrompterSettings = {
  /** 이 설정이 어느 기본값 세대에서 저장됐는가 */
  version: number;
  engine: 'edge' | 'local';
  /** 소리 없이 프롬프터로만 쓴다 */
  muted: boolean;
  gender: Gender;
  tone: Tone;
  /** 0.5 ~ 1.5 */
  rate: number;
  /** -20 ~ 20 (%) */
  pitchPct: number;
  /** 병음 표시 — 끔 / 문장 아래 한 줄 / 한자 위 (글자별) */
  pinyinMode: 'off' | 'below' | 'above';
  autoAdvance: boolean;
  gapMs: number;
  contextBefore: number;
  contextAfter: number;
  fontSize: number;
  splitLongSentences: boolean;
  maxChars: number;
  /** 원고에서 무엇을 읽을지 */
  readMode: ReadMode;
  /** 한자 서체 — 고딕(黑体) / 명조(宋体) */
  fontStyle: 'sans' | 'serif';
};

export const DEFAULT_SETTINGS: PrompterSettings = {
  version: SETTINGS_VERSION,
  engine: 'edge',
  muted: false,
  gender: 'male',
  tone: 'sermon',
  rate: 0.95,
  pitchPct: 0,
  pinyinMode: 'above',
  autoAdvance: false,
  gapMs: 0,
  contextBefore: 2,
  contextAfter: 3,
  fontSize: 44,
  splitLongSentences: false,
  maxChars: 45,
  readMode: 'chinese-english',
  fontStyle: 'sans',
};

const SETTINGS_KEY = 'prompter.settings';
const SCRIPT_KEY = 'prompter.script';
const INDEX_KEY = 'prompter.lastIndex';

export function loadSettings(): PrompterSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    // 저장된 뒤에 필드가 늘어났을 수 있으므로 기본값 위에 덮어쓴다
    const stored = JSON.parse(raw) as Partial<PrompterSettings> & {
      showPinyin?: boolean;
      chineseOnly?: boolean;
    };

    // 기본값이 바뀌었다면 저장된 값이 그것을 덮지 않게 한 번 새로 시작한다
    if (stored.version !== SETTINGS_VERSION) {
      saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    const merged = { ...DEFAULT_SETTINGS, ...stored };

    // 예전에는 병음이 켬/끔뿐이었다 — 켜져 있었다면 아래 한 줄로 옮긴다
    if (stored.pinyinMode === undefined && stored.showPinyin) merged.pinyinMode = 'below';

    // '강의'는 '뉴스'와 음성·음높이가 같고 속도만 달랐다 — 같은 음성 쪽으로 옮긴다
    if ((stored.tone as string) === 'lecture') merged.tone = 'news';

    // 예전에는 중국어만 읽기가 켬/끔뿐이었다
    const legacy = stored as { chineseOnly?: boolean };
    if (stored.readMode === undefined && legacy.chineseOnly !== undefined) {
      merged.readMode = legacy.chineseOnly ? 'chinese' : 'raw';
    }
    delete (merged as { chineseOnly?: boolean }).chineseOnly;
    delete (merged as { showPinyin?: boolean }).showPinyin;

    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: PrompterSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 저장 실패는 연습을 막을 이유가 아니다
  }
}

export function loadScript(): { text: string; index: number } {
  try {
    return {
      text: localStorage.getItem(SCRIPT_KEY) ?? '',
      index: Number(localStorage.getItem(INDEX_KEY) ?? 0) || 0,
    };
  } catch {
    return { text: '', index: 0 };
  }
}

export function saveScript(text: string): void {
  try {
    localStorage.setItem(SCRIPT_KEY, text);
  } catch { /* 무시 */ }
}

export function saveIndex(index: number): void {
  try {
    localStorage.setItem(INDEX_KEY, String(index));
  } catch { /* 무시 */ }
}
