import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyPlayback } from '../playback';
const lines = [{ id: '9:0', verse: 9, text: '你好。' }, { id: '10:0', verse: 10, text: '再见。' }];
function setup(repeats = 0, gap = 1000) {
  const audio = { play: vi.fn(), stop: vi.fn() };
  const p = new StudyPlayback(lines, audio, vi.fn(), repeats, gap);
  return { p, audio };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe('Study audio scheduling', () => {
  it.each([1,3,5])('reads each sentence exactly %i times before moving on', n => {
    const { p, audio } = setup(n);
    p.select(0);
    for (let i = 1; i < n; i++) { p.ended(); vi.advanceTimersByTime(1000); }
    p.ended();
    vi.advanceTimersByTime(1000);
    for (let i = 1; i < n; i++) { p.ended(); vi.advanceTimersByTime(1000); }
    p.ended();
    expect(audio.play).toHaveBeenCalledTimes(n * 2);
    expect(p.state.mode).toBeNull();
    expect(p.state.phase).toBe('idle');
  });
  it.each([500,1000,2000,3000])('respects %i ms gap', gap => {
    const { p, audio } = setup(0,gap); p.select(0); p.ended();
    vi.advanceTimersByTime(gap - 1); expect(audio.play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1); expect(audio.play).toHaveBeenCalledTimes(2);
  });
  it('keeps repeating until explicitly stopped, including during a gap', () => {
    const { p, audio } = setup(); p.select(0);
    for(let i=0;i<8;i++) { p.ended(); vi.advanceTimersByTime(1000); }
    expect(audio.play).toHaveBeenCalledTimes(9);
    p.ended(); p.stop(); vi.advanceTimersByTime(10000);
    expect(audio.play).toHaveBeenCalledTimes(9);
  });
  it('resets the repeat counter when finite repetition advances to the next sentence', () => {
    const { p, audio } = setup(1);
    p.select(0); p.ended(); vi.advanceTimersByTime(1000);
    expect(p.state.index).toBe(1);
    expect(p.state.count).toBe(1);
    expect(audio.play.mock.calls).toEqual([['你好。'], ['再见。']]);
  });
  it('moves immediately when the gap is continuous', () => {
    const { p, audio } = setup(1, 0);
    p.select(0); p.ended();
    expect(audio.play.mock.calls).toEqual([['你好。'], ['再见。']]);
  });
  it('same sentence toggles off; different sentence cancels the pending old sentence', () => {
    const { p, audio } = setup(); p.select(0); p.ended(); p.select(1);
    vi.advanceTimersByTime(10000);
    expect(audio.play.mock.calls).toEqual([['你好。'],['再见。']]);
    p.select(1); p.ended(); vi.advanceTimersByTime(10000);
    expect(audio.play).toHaveBeenCalledTimes(2);
  });
  it('reads each sentence exactly once in passage mode', () => {
    const { p, audio } = setup(); p.sequence(); p.ended(); vi.advanceTimersByTime(1000); p.ended();
    vi.advanceTimersByTime(10000);
    expect(audio.play.mock.calls).toEqual([['你好。'],['再见。']]); expect(p.state.mode).toBeNull();
  });
  it('notifies a completed passage only after the final sentence ends', () => {
    const done = vi.fn();
    const audio = { play: vi.fn(), stop: vi.fn() };
    const p = new StudyPlayback([lines[0]], audio, vi.fn(), 0, 0, 0, done);
    p.sequence(); p.ended();
    expect(done).toHaveBeenCalledOnce();
    p.select(0); p.stop();
    expect(done).toHaveBeenCalledOnce();
  });
  it('stops after failure and can retry without carrying old repeat counts', () => {
    const { p, audio } = setup(); p.select(0); p.fail('no voice'); p.ended(); vi.advanceTimersByTime(10000);
    expect(p.state.phase).toBe('error'); expect(audio.play).toHaveBeenCalledTimes(1);
    p.select(0); expect(p.state.count).toBe(1); expect(p.state.error).toBeUndefined();
  });
  it('settings changes cancel an outstanding wait', () => {
    const { p, audio } = setup(); p.select(0); p.ended(); p.configure(3,500);
    vi.advanceTimersByTime(10000); expect(audio.play).toHaveBeenCalledTimes(1);
  });
});
