import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SentencePlayer } from '../player';
import { DEFAULT_SETTINGS } from '../../settings';
const mock = vi.hoisted(() => ({ synth: vi.fn(), local: vi.fn(), cancel: vi.fn() }));
vi.mock('../edgeTts', () => ({ synthEdge: mock.synth }));
vi.mock('../webSpeech', () => ({ speakLocal: mock.local, cancelLocal: mock.cancel }));
class FakeAudio {
  static latest: FakeAudio;
  src = ''; currentTime = 0; onended?: () => void; onerror?: () => void;
  preload = ''; load = vi.fn(); play = vi.fn().mockResolvedValue(undefined); pause = vi.fn();
  constructor() { FakeAudio.latest = this; }
}
const events = () => ({ onStatus: vi.fn(), onEnded: vi.fn(), onFallback: vi.fn(), onPace: vi.fn(), onError: vi.fn() });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('Audio', FakeAudio); vi.stubGlobal('window', { tts: {}, clearTimeout, setTimeout });
  mock.synth.mockResolvedValue('blob:test');
});
afterEach(() => vi.unstubAllGlobals());
describe('SentencePlayer cancellation and failure', () => {
  it('ignores a late online response after stop', async () => {
    let resolve!: (s: string) => void;
    mock.synth.mockReturnValue(new Promise<string>(r => { resolve = r; }));
    const e = events(), p = new SentencePlayer(e);
    const pending = p.play('你好', DEFAULT_SETTINGS); p.stop(); resolve('blob:late'); await pending;
    expect(FakeAudio.latest.play).not.toHaveBeenCalled(); expect(e.onEnded).not.toHaveBeenCalled();
  });
  it('ignores old local ended/error callbacks after switching sentences', async () => {
    const e=events(), p=new SentencePlayer(e), s={...DEFAULT_SETTINGS,engine:'local' as const};
    await p.play('你好',s); const old=mock.local.mock.calls[0]; await p.play('再见',s);
    old[3](); old[4]('stale');
    expect(e.onEnded).not.toHaveBeenCalled(); expect(e.onError).not.toHaveBeenCalled();
    mock.local.mock.calls[1][3](); expect(e.onEnded).toHaveBeenCalledOnce();
  });
  it('announces online fallback and propagates local failure without ending successfully', async () => {
    mock.synth.mockRejectedValue(new Error('offline'));
    mock.local.mockImplementation((_text, _rate, _pitch, _end, error) => error('chinese-voice-unavailable'));
    const e=events(), p=new SentencePlayer(e); await p.play('你好',DEFAULT_SETTINGS);
    expect(e.onFallback).toHaveBeenCalledWith('offline');
    expect(e.onError).toHaveBeenCalledWith('chinese-voice-unavailable'); expect(e.onEnded).not.toHaveBeenCalled();
  });
  it('routes legacy prompter failures to its existing warning callback', async () => {
    mock.local.mockImplementation((_text,_rate,_pitch,_end,error)=>error('synthesis-failed'));
    const e=events(), p=new SentencePlayer({...e,onError:undefined}); await p.play('你好',{...DEFAULT_SETTINGS,engine:'local'});
    expect(e.onFallback).toHaveBeenCalledWith('synthesis-failed'); expect(e.onEnded).not.toHaveBeenCalled();
  });
  it('handles media decoding errors without scheduling another sentence', async () => {
    const e=events(), p=new SentencePlayer(e); await p.play('你好',DEFAULT_SETTINGS); FakeAudio.latest.onerror?.();
    expect(e.onError).toHaveBeenCalledWith('audio-playback-error'); expect(e.onEnded).not.toHaveBeenCalled();
  });
  it('does not hammer a failing online endpoint during repeats, and retries after explicit reset', async () => {
    mock.synth.mockRejectedValue(new Error('403'));
    const e=events(), p=new SentencePlayer(e);
    await p.play('你好',DEFAULT_SETTINGS);
    await p.play('你好',DEFAULT_SETTINGS);
    p.prefetch('下一句',DEFAULT_SETTINGS);
    expect(mock.synth).toHaveBeenCalledOnce();
    expect(mock.local).toHaveBeenCalledTimes(2);
    expect(e.onFallback).toHaveBeenCalledTimes(2);
    p.resetFallback(); await p.play('你好',DEFAULT_SETTINGS);
    expect(mock.synth).toHaveBeenCalledTimes(2);
  });
  it('reuses a prefetched online voice for the next sentence', async () => {
    const e = events(), p = new SentencePlayer(e);
    p.prefetch('다음 문장', DEFAULT_SETTINGS);
    await p.play('다음 문장', DEFAULT_SETTINGS);
    expect(mock.synth).toHaveBeenCalledOnce();
    expect(FakeAudio.latest.load).toHaveBeenCalledOnce();
    expect(FakeAudio.latest.play).toHaveBeenCalledOnce();
  });
});
