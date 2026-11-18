import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SentencePlayer } from '../player';
import { DEFAULT_SETTINGS } from '../../settings';

const mocks = vi.hoisted(() => ({ synth: vi.fn(), local: vi.fn() }));
vi.mock('../edgeTts', () => ({ synthEdge: mocks.synth }));
vi.mock('../webSpeech', () => ({ speakLocal: mocks.local, cancelLocal: vi.fn() }));
class FakeAudio {
  src = ''; currentTime = 0; preload = '';
  load() {} pause() {} play() { return Promise.resolve(); }
}
const events = () => ({ onStatus: vi.fn(), onEnded: vi.fn(), onFallback: vi.fn(), onPace: vi.fn(), onError: vi.fn() });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  vi.stubGlobal('Audio', FakeAudio);
});
afterEach(() => vi.unstubAllGlobals());
describe('web online speech', () => {
  it('reports failure without changing voices and retries on the next request', async () => {
    mocks.synth.mockRejectedValueOnce(new Error('speech-unavailable')).mockResolvedValueOnce('blob:test');
    const callbacks = events();
    const player = new SentencePlayer(callbacks);
    await player.play('你好', DEFAULT_SETTINGS);
    expect(callbacks.onError).toHaveBeenCalledWith('speech-unavailable');
    expect(mocks.local).not.toHaveBeenCalled();
    await player.play('你好', DEFAULT_SETTINGS);
    expect(mocks.synth).toHaveBeenCalledTimes(2);
  });
});
