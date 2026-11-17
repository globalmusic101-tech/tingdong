import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { speakLocal, voicesForLanguage } from '../webSpeech';

let spoken: { onend: () => void; onerror: (event: { error: string }) => void; voice?: unknown };
let voices: SpeechSynthesisVoice[];
const makeVoice = (voiceURI: string, lang: string, localService = true) => ({ voiceURI, lang, localService, name: voiceURI } as SpeechSynthesisVoice);

beforeEach(() => {
  voices = [makeVoice('zh-default', 'zh-CN')];
  vi.stubGlobal('window', { speechSynthesis: { cancel: vi.fn(), getVoices: () => voices,
    speak: (u: typeof spoken) => { spoken = u; } } });
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
});
afterEach(() => vi.unstubAllGlobals());

describe('local voice failures are not completions', () => {
  it('sends native errors only to the error callback', () => {
    const ended = vi.fn(), failed = vi.fn(); speakLocal('你好',1,1,ended,failed);
    spoken.onerror({ error: 'synthesis-failed' });
    expect(ended).not.toHaveBeenCalled(); expect(failed).toHaveBeenCalledWith('synthesis-failed');
  });
  it('reports missing Chinese voices and never silently picks a different language', () => {
    voices = [makeVoice('en-default', 'en-US')];
    const ended = vi.fn(), failed = vi.fn(); speakLocal('你好',1,1,ended,failed);
    expect(failed).toHaveBeenCalledWith('chinese-voice-unavailable'); expect(ended).not.toHaveBeenCalled();
  });
  it('does not use remote voices in on-device mode', () => {
    voices = [makeVoice('zh-remote', 'zh-CN', false)];
    const failed = vi.fn(); speakLocal('你好',1,1,vi.fn(),failed);
    expect(failed).toHaveBeenCalledWith('chinese-voice-unavailable');
  });
  it('reads the fresh voice list when it arrives after startup', () => {
    voices=[]; const failed=vi.fn(); speakLocal('你好',1,1,vi.fn(),failed);
    voices=[makeVoice('zh-default', 'zh-CN')]; const ended=vi.fn();
    speakLocal('你好',1,1,ended,failed); spoken.onend();
    expect(ended).toHaveBeenCalledOnce(); expect(spoken.voice).toEqual(voices[0]);
  });
  it('starts immediately when the platform omits onstart', () => {
    const started = vi.fn();
    speakLocal('你好', 1, 1, vi.fn(), vi.fn(), started);
    expect(started).toHaveBeenCalledOnce();
  });
  it('filters language, remote, Cantonese, and ambiguous duplicate voice identifiers', () => {
    const candidates = [makeVoice('zh-cn', 'zh-CN'), makeVoice('zh-tw', 'zh-TW'), makeVoice('cmn', 'cmn-Hans-CN'),
      makeVoice('yue', 'yue-HK'), makeVoice('hk', 'zh-HK'), makeVoice('remote', 'zh-CN', false),
      makeVoice('duplicate', 'zh-CN'), makeVoice('duplicate', 'zh-SG')];
    expect(voicesForLanguage('zh-CN', candidates).map(voice => voice.voiceURI)).toEqual(['zh-cn', 'zh-tw', 'cmn']);
  });
  it('filters Korean and English voices by language and requires the browser local flag', () => {
    const unspecified = { voiceURI: 'ko-unknown', lang: 'ko-KR', name: 'unknown' } as SpeechSynthesisVoice;
    expect(voicesForLanguage('ko-KR', [makeVoice('ko-local', 'ko-KR'), unspecified]).map(voice => voice.voiceURI)).toEqual(['ko-local']);
    expect(voicesForLanguage('en-US', [makeVoice('en-gb', 'en-GB'), makeVoice('fr', 'fr-FR')]).map(voice => voice.voiceURI)).toEqual(['en-gb']);
  });
  it('uses only the selected browser voice in the utterance', () => {
    const chosen = makeVoice('zh-selected', 'zh-CN');
    voices = [chosen];
    const failed = vi.fn();
    speakLocal('你好', 1, 1, vi.fn(), failed, undefined, 'zh-CN', 'zh-selected');
    expect(spoken.voice).toBe(chosen);
    expect(failed).not.toHaveBeenCalled();
  });
});
