import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  loadScript,
  loadSettings,
} from '../settings';

afterEach(() => vi.unstubAllGlobals());

const storage = (values: Record<string, string>) => {
  const memory = new Map(Object.entries(values));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  });
  return memory;
};

describe('prompter settings v3 voice migration', () => {
  it('changes only Google to Edge and preserves the other settings, script and position', () => {
    const old = {
      ...DEFAULT_SETTINGS,
      version: 3,
      engine: 'google',
      googleVoiceId: 'cmn-CN-Wavenet-D',
      muted: true,
      gender: 'female',
      tone: 'chat',
      rate: 0.65,
      pitchPct: 12,
      pinyinMode: 'below',
      autoAdvance: true,
      gapMs: 2300,
      contextBefore: 4,
      contextAfter: 6,
      fontSize: 100,
      splitLongSentences: true,
      maxChars: 38,
      readMode: 'raw',
      fontStyle: 'serif',
    };
    const memory = storage({
      'prompter.settings': JSON.stringify(old),
      'prompter.script': '保留这篇讲章',
      'prompter.lastIndex': '17',
    });
    const migrated = loadSettings();
    expect(migrated).toEqual({
      ...old,
      version: SETTINGS_VERSION,
      engine: 'edge',
      googleVoiceId: undefined,
    });
    expect(Object.hasOwn(migrated, 'googleVoiceId')).toBe(false);
    expect(loadScript()).toEqual({ text: '保留这篇讲章', index: 17 });
    expect(JSON.parse(memory.get('prompter.settings') ?? '{}')).toEqual(migrated);
  });

  it.each(['edge', 'local'] as const)('preserves an existing %s engine and all valid choices', (engine) => {
    const old = { ...DEFAULT_SETTINGS, version: 3, engine, rate: 1.25, fontSize: 72, pinyinMode: 'off' as const };
    storage({ 'prompter.settings': JSON.stringify(old) });
    expect(loadSettings()).toEqual({ ...old, version: SETTINGS_VERSION });
  });
});
