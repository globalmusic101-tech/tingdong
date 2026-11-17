import { synthEdge } from './edgeTts';
import * as webSpeech from './webSpeech';
import { cacheKey, hasEdgeBridge, type SynthParams } from './types';
import { resolveVoice, toPitchString, toRateString } from './voiceMap';
import { hanCount } from '../extractChinese';
import { charsPerMinute } from './pace';
import type { PrompterSettings } from '../settings';

/**
 * 무음 모드에서 한 문장에 머무는 시간의 기준 (한자/분).
 * 소리가 없으면 문장이 끝나는 시점을 알 수 없으므로 글자 수로 어림한다.
 * 배속 슬라이더가 이 값을 그대로 늘리고 줄인다.
 */
const SILENT_BASE_CPM = 200;
const AUDIO_PLAY_TIMEOUT_MS = 4_000;

export function silentSeconds(chars: number, rate: number): number {
  const perMinute = SILENT_BASE_CPM * rate;
  return Math.max(0.6, (chars / perMinute) * 60);
}

export function buildParams(text: string, settings: PrompterSettings): SynthParams {
  const preset = resolveVoice(settings.gender, settings.tone, settings.language);
  return {
    text,
    voiceId: preset.voiceId,
    rate: toRateString(settings.rate, preset.ratePct),
    pitch: toPitchString(settings.pitchPct, preset.pitchPct),
  };
}

type PlayerEvents = {
  onStatus: (status: 'idle' | 'loading' | 'playing') => void;
  onEnded: () => void;
  /** Edge 합성이 실패해 기기 음성으로 넘어갔을 때 한 번 알린다 */
  onFallback: (reason: string) => void;
  /** 끝까지 재생된 문장의 실측 속도. 배속 숫자만으로는 빠른지 알 수 없다. */
  onPace: (charsPerMinute: number) => void;
  onError?: (reason: string) => void;
};

export class SentencePlayer {
  private audio = new Audio();
  /** 매 재생 요청마다 증가. 늦게 도착한 응답을 버리는 기준. */
  private requestId = 0;
  private edgeFailure: string | null = null;
  /** 다음 문장의 합성 요청을 문장·음성 설정별로 보관합니다. */
  private prefetched = new Map<string, Promise<HTMLAudioElement>>();

  /** 사용자가 음성 설정을 바꾼 뒤에만 실패한 온라인 엔진을 다시 시도합니다. */
  resetFallback(): void { this.edgeFailure = null; }

  /** 지금 재생 중인 문장의 한자 수와 소리가 나기 시작한 시각 */
  private spokenChars = 0;
  private startedAt = 0;
  /** 무음 모드에서 다음 문장으로 넘길 타이머 */
  private silentTimer: number | null = null;

  constructor(private events: PlayerEvents) {
  }

  private fail(reason: string, id: number): void {
    if (id !== this.requestId) return;
    this.stop();
    (this.events.onError ?? this.events.onFallback)(reason);
  }

  /** 끝까지 재생된 문장만 센다 — 중간에 끊긴 것은 속도가 아니다 */
  private reportPace(): void {
    if (!this.startedAt) return;

    const seconds = (performance.now() - this.startedAt) / 1000;
    this.startedAt = 0;

    const pace = charsPerMinute(this.spokenChars, seconds);
    if (pace !== null) this.events.onPace(pace);
  }

  private beginTiming(text: string): void {
    this.spokenChars = hanCount(text);
    this.startedAt = performance.now();
  }

  private useLocal(settings: PrompterSettings): boolean {
    return settings.engine === 'local' || (settings.engine === 'edge' && (!hasEdgeBridge() || this.edgeFailure !== null));
  }

  private prepareAudio(url: string): HTMLAudioElement {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    audio.load();
    return audio;
  }

  private edgeAudio(params: SynthParams): Promise<HTMLAudioElement> {
    const key = cacheKey(params);
    const pending = this.prefetched.get(key);
    if (pending) {
      this.prefetched.delete(key);
      return pending;
    }
    return synthEdge(params).then(url => this.prepareAudio(url));
  }

  private playAudio(audio: HTMLAudioElement): Promise<void> {
    let timer: number | undefined;
    const timeout = new Promise<void>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error('음성 재생이 시작되지 않았습니다')), AUDIO_PLAY_TIMEOUT_MS);
    });
    return Promise.race([audio.play(), timeout]).finally(() => {
      if (timer !== undefined) window.clearTimeout(timer);
    });
  }

  private playLocal(text: string, settings: PrompterSettings, id: number): void {
    const preset = resolveVoice(settings.gender, settings.tone, settings.language);
    const rate = settings.rate * (1 + preset.ratePct / 100);
    const pitch = 1 + (settings.pitchPct + preset.pitchPct) / 100;

    this.events.onStatus('loading');
    webSpeech.speakLocal(text, rate, pitch, () => {
      if (id !== this.requestId) return;
      this.reportPace();
      this.events.onStatus('idle');
      this.events.onEnded();
    }, (reason) => this.fail(reason, id), () => {
      if (id !== this.requestId) return;
      this.beginTiming(text);
      this.events.onStatus('playing');
    }, settings.language, settings.browserVoiceURI);
  }

  async play(text: string, settings: PrompterSettings): Promise<void> {
    const id = ++this.requestId;
    this.halt();

    // 소리를 끈 상태 — 읽는 시간만큼 머물렀다가 넘어간다.
    // 이게 없으면 무음일 때 자동 진행과 구간 반복이 멈춘다.
    if (settings.muted) {
      this.events.onStatus('playing');
      const seconds = silentSeconds(hanCount(text), settings.rate);
      this.silentTimer = window.setTimeout(() => {
        if (id !== this.requestId) return;
        this.events.onStatus('idle');
        this.events.onEnded();
      }, seconds * 1000);
      return;
    }

    if (this.useLocal(settings)) {
      if (settings.engine === 'edge' && this.edgeFailure) this.events.onFallback(this.edgeFailure);
      try { this.playLocal(text, settings, id); }
      catch (error) { this.fail(String(error), id); }
      return;
    }

    this.events.onStatus('loading');
    try {
      const audio = await this.edgeAudio(buildParams(text, settings));
      if (id !== this.requestId) return; // 그 사이 다른 문장으로 넘어갔다

      this.audio = audio;
      audio.onended = () => {
        if (id !== this.requestId) return;
        this.reportPace();
        this.events.onStatus('idle');
        this.events.onEnded();
      };
      audio.onerror = () => this.fail('audio-playback-error', id);
      await this.playAudio(audio);
      if (id !== this.requestId) return;
      this.beginTiming(text);
      this.events.onStatus('playing');
    } catch (error) {
      if (id !== this.requestId) return;

      const reason = error instanceof Error ? error.message : String(error);
      this.edgeFailure = reason;
      this.events.onFallback(reason);
      try { this.playLocal(text, settings, id); }
      catch (localError) { this.fail(String(localError), id); }
    }
  }

  /** 다음 문장을 미리 합성해 둔다. 실패해도 조용히 넘어간다. */
  prefetch(text: string, settings: PrompterSettings): void {
    if (!text || settings.muted || settings.engine === 'local' || (settings.engine === 'edge' && this.useLocal(settings))) return;
    const params = buildParams(text, settings);
    const key = cacheKey(params);
    if (this.prefetched.has(key)) return;
    const pending = synthEdge(params).then(url => this.prepareAudio(url));
    this.prefetched.set(key, pending);
    void pending.catch(error => {
      if (settings.engine === 'edge') {
        this.edgeFailure = error instanceof Error ? error.message : String(error);
      }
      if (this.prefetched.get(key) === pending) this.prefetched.delete(key);
    });
  }

  /** 재생만 멈춘다 (requestId는 그대로) */
  private halt(): void {
    this.startedAt = 0;   // 끊긴 재생은 속도 계산에서 제외
    if (this.silentTimer !== null) {
      window.clearTimeout(this.silentTimer);
      this.silentTimer = null;
    }
    this.audio.pause();
    this.audio.currentTime = 0;
    webSpeech.cancelLocal();
  }

  stop(): void {
    this.requestId += 1; // 진행 중이던 요청의 결과를 무효화
    this.halt();
    this.events.onStatus('idle');
  }
}
