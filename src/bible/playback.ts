import type { StudySentence } from './model';

export type Playback = { phase: 'idle' | 'loading' | 'playing' | 'waiting' | 'error'; index: number; count: number; mode: 'repeat' | 'sequence' | null; error?: string };
export type AudioPort = { play: (text: string) => void; stop: () => void; prefetch?: (text: string) => void };
/** 타이머와 재생 의도를 한곳에서 관리합니다. 음성 성공 종료만 다음 반복으로 이어집니다. */
export class StudyPlayback {
  state: Playback;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  constructor(private lines: StudySentence[], private audio: AudioPort, private notify: (s: Playback) => void,
    private repeats = 0, private gapMs = 1000, index = 0, private onComplete?: () => void) {
    this.state = { phase: 'idle', index, count: 0, mode: null };
  }
  private publish(patch: Partial<Playback>) { this.state = { ...this.state, ...patch }; this.notify(this.state); }
  stop() {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.audio.stop();
    this.publish({ phase: 'idle', mode: null, error: undefined });
  }
  configure(repeats: number, gapMs: number) { this.stop(); this.repeats = repeats; this.gapMs = gapMs; }
  select(index: number) {
    if (!this.lines[index]) return;
    if (this.state.mode === 'repeat' && this.state.index === index) { this.stop(); return; }
    this.start(index, 'repeat');
  }
  sequence() { this.start(0, 'sequence'); }
  private start(index: number, mode: 'repeat' | 'sequence') {
    this.stop();
    this.publish({ index, count: 0, mode });
    this.speak();
  }
  private speak() {
    this.publish({ phase: 'loading', count: this.state.mode === 'repeat' ? this.state.count + 1 : 1 });
    this.audio.play(this.lines[this.state.index].text);
    const next = this.nextIndex();
    if (next < this.lines.length) this.audio.prefetch?.(this.lines[next].text);
  }
  private nextIndex() {
    const finiteRepeatDone = this.state.mode === 'repeat' && this.repeats > 0 && this.state.count >= this.repeats;
    return this.state.mode === 'sequence' || finiteRepeatDone ? this.state.index + 1 : this.state.index;
  }
  status(status: 'idle' | 'loading' | 'playing') {
    if (this.state.mode && status !== 'idle') this.publish({ phase: status });
  }
  fail(reason: string) { this.stop(); this.publish({ phase: 'error', error: reason }); }
  ended() {
    if (!this.state.mode || this.state.phase === 'waiting') return;
    const next = this.nextIndex();
    if (next >= this.lines.length) {
      this.stop(); this.onComplete?.(); return;
    }
    this.publish({ phase: 'waiting' });
    const generation = this.generation;
    const advance = () => {
      if (generation !== this.generation || !this.state.mode) return;
      // 유한 반복이 끝나 다음 문장으로 넘어갈 때는 새 문장의 횟수를 1부터 센다.
      this.publish({ index: next, count: next === this.state.index ? this.state.count : 0 });
      this.speak();
    };
    if (this.gapMs <= 0) advance();
    else this.timer = setTimeout(advance, this.gapMs);
  }
}
