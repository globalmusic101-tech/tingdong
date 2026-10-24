import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { speakLocal } from '../webSpeech';
let spoken: { onend: () => void; onerror: (event: { error: string }) => void; voice?: unknown };
let voices: {lang: string; localService: boolean}[];
beforeEach(() => {
  voices = [{ lang: 'zh-CN', localService: true }];
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
    voices = [{ lang:'en-US', localService:true }];
    const ended = vi.fn(), failed = vi.fn(); speakLocal('你好',1,1,ended,failed);
    expect(failed).toHaveBeenCalledWith('chinese-voice-unavailable'); expect(ended).not.toHaveBeenCalled();
  });
  it('does not use remote voices in on-device mode', () => {
    voices = [{ lang:'zh-CN', localService:false }];
    const failed = vi.fn(); speakLocal('你好',1,1,vi.fn(),failed);
    expect(failed).toHaveBeenCalledWith('chinese-voice-unavailable');
  });
  it('reads the fresh voice list when it arrives after startup', () => {
    voices=[]; const failed=vi.fn(); speakLocal('你好',1,1,vi.fn(),failed);
    voices=[{lang:'zh-CN',localService:true}]; const ended=vi.fn();
    speakLocal('你好',1,1,ended,failed); spoken.onend();
    expect(ended).toHaveBeenCalledOnce(); expect(spoken.voice).toEqual(voices[0]);
  });

  it('starts immediately when the platform omits onstart', () => {
    const started = vi.fn();
    speakLocal('你好', 1, 1, vi.fn(), vi.fn(), started);
    expect(started).toHaveBeenCalledOnce();
  });
});
