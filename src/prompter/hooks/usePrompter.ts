import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SentencePlayer } from '../lib/tts/player';
import type { Sentence } from '../lib/splitSentences';
import { SAMPLE_WINDOW, averagePace } from '../lib/tts/pace';
import type { PrompterSettings } from '../lib/settings';

export type PlayStatus = 'idle' | 'loading' | 'playing';

/** 구간 반복 — a번째부터 b번째 문장까지를 끝없이 돈다 */
export type Range = { a: number; b: number };

export function usePrompter(sentences: Sentence[], settings: PrompterSettings, startIndex = 0) {
  const [index, setIndex] = useState(startIndex);
  const [status, setStatus] = useState<PlayStatus>('idle');
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  /** B를 누르기 전까지 대기 중인 시작점 */
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  /** 실측 읽기 속도 (한자/분). 문장마다 들쭉날쭉해서 최근 몇 개를 평균낸다. */
  const [pace, setPace] = useState<number | null>(null);
  const paceSamples = useRef<number[]>([]);

  // 플레이어 콜백은 한 번만 묶이므로, 최신 값은 ref로 읽는다
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // 배속이나 목소리가 바뀌면 이전 표본은 다른 조건의 값이라 버린다
  useEffect(() => {
    paceSamples.current = [];
    setPace(null);
  }, [settings.rate, settings.gender, settings.tone, settings.pitchPct]);
  const sentencesRef = useRef(sentences);
  sentencesRef.current = sentences;
  const indexRef = useRef(index);
  indexRef.current = index;
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const onEndedRef = useRef<() => void>(() => {});
  const autoTimer = useRef<number | null>(null);

  const player = useMemo(
    () =>
      new SentencePlayer({
        onStatus: setStatus,
        onEnded: () => onEndedRef.current(),
        onFallback: setFallbackReason,
        onError: setPlaybackError,
        onPace: (measured) => {
          const samples = paceSamples.current;
          samples.push(measured);
          if (samples.length > SAMPLE_WINDOW) samples.shift();
          setPace(averagePace(samples));
        },
      }),
    [],
  );

  const clearAutoTimer = useCallback(() => {
    if (autoTimer.current !== null) {
      window.clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
  }, []);

  useEffect(() => { player.resetFallback(); }, [player, settings.engine, settings.gender, settings.tone]);

  const speak = useCallback(
    (i: number) => {
      const list = sentencesRef.current;
      if (i < 0 || i >= list.length) return;

      setPlaybackError(null);
      void player.play(list[i].text, settingsRef.current);

      // 다음 문장 하나를 미리 받아 절 사이의 대기 시간을 줄인다.
      player.prefetch(list[i + 1]?.text ?? '', settingsRef.current);
    },
    [player],
  );

  const goto = useCallback(
    (i: number, options: { speak?: boolean } = {}) => {
      const list = sentencesRef.current;
      if (list.length === 0) return;

      const clamped = Math.max(0, Math.min(list.length - 1, i));
      clearAutoTimer();
      setIndex(clamped);
      indexRef.current = clamped;

      if (options.speak === false) player.stop();
      else speak(clamped);
    },
    [clearAutoTimer, player, speak],
  );

  // 문장이 끝났을 때 — 구간 반복이 자동 진행보다 우선한다
  useEffect(() => {
    onEndedRef.current = () => {
      const { gapMs, autoAdvance } = settingsRef.current;
      const here = indexRef.current;
      const loop = rangeRef.current;

      const schedule = (target: number, delay: number) => {
        clearAutoTimer();
        autoTimer.current = window.setTimeout(() => goto(target), delay);
      };

      // 구간 안에 있으면 끝까지 갔다가 처음으로 돌아온다.
      // 구간 반복은 손을 떼고 듣는 기능이므로 자동 진행 설정과 무관하게 돈다.
      if (loop && here >= loop.a && here <= loop.b) {
        const wrapping = here >= loop.b;
        // 되돌아가는 지점은 조금 더 쉬어야 다시 시작한 게 귀에 들린다
        schedule(wrapping ? loop.a : here + 1, wrapping ? gapMs + 500 : gapMs);
        return;
      }

      if (!autoAdvance) return;
      if (here >= sentencesRef.current.length - 1) return;
      schedule(here + 1, gapMs);
    };
  }, [clearAutoTimer, goto]);

  const next = useCallback((withSpeak = true) => goto(indexRef.current + 1, { speak: withSpeak }), [goto]);
  const prev = useCallback((withSpeak = true) => goto(indexRef.current - 1, { speak: withSpeak }), [goto]);
  const repeat = useCallback(() => speak(indexRef.current), [speak]);

  const stop = useCallback(() => {
    clearAutoTimer();
    player.stop();
  }, [clearAutoTimer, player]);

  /** A — 현재 문장을 구간 시작점으로 잡는다 */
  const markStart = useCallback(() => {
    setRange(null);
    setPendingStart(indexRef.current);
  }, []);

  /** B — 현재 문장을 끝점으로 잡고 바로 구간 처음부터 돌린다 */
  const markEnd = useCallback(() => {
    const start = pendingStart ?? range?.a;
    if (start === null || start === undefined) return;

    // 거꾸로 찍었으면 뒤집는다
    const [a, b] = start <= indexRef.current
      ? [start, indexRef.current]
      : [indexRef.current, start];

    setRange({ a, b });
    setPendingStart(null);
    goto(a);
  }, [goto, pendingStart, range]);

  const clearRange = useCallback(() => {
    clearAutoTimer();
    setRange(null);
    setPendingStart(null);
  }, [clearAutoTimer]);

  // 원고가 짧아지면 범위 밖으로 나간 구간은 버린다
  useEffect(() => {
    if (range && range.b > sentences.length - 1) setRange(null);
  }, [range, sentences.length]);

  // 원고가 바뀌면 범위 밖 커서를 되돌린다
  useEffect(() => {
    if (index > sentences.length - 1) setIndex(Math.max(0, sentences.length - 1));
  }, [index, sentences.length]);

  useEffect(() => () => {
    clearAutoTimer();
    player.stop();
  }, [clearAutoTimer, player]);

  return {
    index, status, fallbackReason, playbackError, range, pendingStart, pace,
    goto, next, prev, repeat, stop,
    markStart, markEnd, clearRange,
  };
}
