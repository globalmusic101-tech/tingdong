import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { pinyin } from 'pinyin-pro';
import type { Sentence } from './lib/splitSentences';
import type { PrompterSettings } from './lib/settings';
import type { PlayStatus, Range } from './hooks/usePrompter';
import { chunkPinyin, toWordChunks, type WordChunk } from './lib/wordChunks';
import { lookupCached, lookupSentenceCached, peekSentence, peekWord, switchToFreeDictionary } from './lib/wordLookup';
import type { LookupOutcome } from '../lib/translate';

type Props = {
  sentences: Sentence[];
  index: number;
  status: PlayStatus;
  settings: PrompterSettings;
  range: Range | null;
  pendingStart: number | null;
  onSelect: (index: number) => void;
};

/** 현재 문장이 머무는 높이 — 화면 위에서 42% 지점 */
const ANCHOR_RATIO = 0.42;

/**
 * 마우스가 단어 위에 이만큼 머물러야 사전을 찾는다.
 * 글자 위를 스쳐 지나갈 때마다 요청하면 무료 번역이 곧바로 막힌다.
 */
const HOVER_DELAY_MS = 250;

/** 읽는 줄과 사전 카드 사이에 남겨두는 간격 */
const CARD_GAP = 24;

type WordCard = {
  word: string;
  pinyin: string;
  state: 'loading' | 'done' | 'error';
  outcome?: LookupOutcome;
  error?: string;
};

export function PrompterView({ sentences, index, status, settings, range, pendingStart, onSelect }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [offset, setOffset] = useState(0);
  /** 사전 카드가 실제로 차지한 높이 — 그만큼 문장을 위로 올려 자리를 비운다 */
  const [cardHeight, setCardHeight] = useState(0);
  /** 카드가 넘어서면 안 되는 높이 — 읽는 문장을 덮는 것보다는 카드가 접히는 편이 낫다 */
  const [cardMax, setCardMax] = useState<number | undefined>(undefined);

  /**
   * 훑어보기 — 마우스 휠로 원고를 위아래로 넘겨 시작할 곳을 찾는 상태.
   * 이 동안에는 현재 문장으로 자동 복귀하지 않고, 가려둔 문장도 전부 보여준다.
   */
  const [browseDelta, setBrowseDelta] = useState(0);
  const browsing = browseDelta !== 0;

  /**
   * 글자마다 성조를 붙인다. 위·아래 어느 쪽이든 글자별로 다는 건 같고,
   * 놓이는 자리만 CSS(ruby-position)로 갈린다.
   * pinyin-pro의 배열 결과는 원문 글자와 1:1로 맞고, 구두점은 글자를 그대로 돌려준다.
   */
  const wordChunks = useMemo(() => {
    const text = sentences[index]?.text ?? '';
    if (!text) return [];

    // 병음을 끈 상태에서도 단어 칸은 있어야 마우스로 뜻을 볼 수 있다
    const readings = settings.pinyinMode === 'off'
      ? null
      : pinyin(text, { type: 'array', toneType: 'symbol' });

    const chars = [...text].map((char, i) => ({
      char,
      // 구두점은 읽을 게 없으므로 주석을 달지 않는다
      reading: readings && readings[i] !== char ? readings[i] : '',
    }));

    return toWordChunks(chars, text);
  }, [sentences, index, settings.pinyinMode]);

  /** 마우스를 올린 단어의 사전 카드. 마우스를 떼도 남겨 둔다 — 읽는 동안 사라지면 못 본다. */
  const [card, setCard] = useState<WordCard | null>(null);
  /** 지금 읽고 있는 문장의 뜻. 단어와 상관없이 늘 띄워둔다. */
  const [context, setContext] = useState<{ zh: string; ko: string | null; failed?: boolean } | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const lookupId = useRef(0);

  const cancelPendingLookup = useCallback(() => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  // 문장이 바뀌면 그 문장의 뜻을 바로 띄우고, 다음 문장 것도 미리 받아둔다.
  // 미리 받아두지 않으면 자동 진행으로 넘어갈 때마다 뜻이 한 박자 늦게 뜬다.
  useEffect(() => {
    const zh = sentences[index]?.text ?? '';
    if (!zh) {
      setContext(null);
      return;
    }

    const cached = peekSentence(zh);
    if (cached !== undefined) {
      setContext({ zh, ko: cached });
    } else {
      setContext({ zh, ko: null });
      lookupSentenceCached(zh).then(
        (ko) => setContext((now) => (now?.zh === zh ? { zh, ko } : now)),
        () => setContext((now) => (now?.zh === zh ? { zh, ko: null, failed: true } : now)),
      );
    }

    const nextZh = sentences[index + 1]?.text;
    if (nextZh && peekSentence(nextZh) === undefined) {
      lookupSentenceCached(nextZh).catch(() => { /* 미리 받는 것뿐이라 실패해도 그만 */ });
    }
  }, [sentences, index]);

  const onWordEnter = useCallback((chunk: WordChunk) => {
    if (!chunk.isWord) return;
    cancelPendingLookup();

    // 병음을 꺼둔 상태여도 사전 카드에는 읽는 법이 있어야 한다
    const reading = chunkPinyin(chunk) || pinyin(chunk.text, { toneType: 'symbol' });

    // 이미 찾아둔 단어는 기다릴 이유가 없다
    const cached = peekWord(chunk.text);
    if (cached) {
      lookupId.current += 1;
      setCard({ word: chunk.text, pinyin: reading, state: 'done', outcome: cached });
      return;
    }

    hoverTimer.current = window.setTimeout(() => {
      hoverTimer.current = null;
      const id = ++lookupId.current;
      setCard({ word: chunk.text, pinyin: reading, state: 'loading' });

      lookupCached(chunk.text).then(
        (outcome) => {
          if (id === lookupId.current) setCard({ word: chunk.text, pinyin: reading, state: 'done', outcome });
        },
        (err: unknown) => {
          if (id !== lookupId.current) return;
          setCard({
            word: chunk.text,
            pinyin: reading,
            state: 'error',
            error: (err as Error)?.message ?? String(err),
          });
        },
      );
    }, HOVER_DELAY_MS);
  }, [cancelPendingLookup]);

  // 문장이 바뀌면 앞 문장에서 짚어둔 단어는 치운다
  useEffect(() => { setCard(null); }, [index]);
  useEffect(() => cancelPendingLookup, [cancelPendingLookup]);

  // 현재 문장이 항상 같은 높이에 오도록 스택 전체를 밀어 올린다
  // 화살표·스페이스로 문장을 옮기면 훑어보기를 끝내고 제자리로 돌아온다
  useEffect(() => { setBrowseDelta(0); }, [index]);

  // 원고가 바뀌면 예전 문장의 참조를 버린다 — 남아 있으면 스크롤 범위가 어긋난다
  useEffect(() => { lineRefs.current.length = sentences.length; }, [sentences]);

  /**
   * 첫 문장과 마지막 문장이 기준선에 올 수 있는 범위까지만 스크롤을 허용한다.
   * 참조가 하나라도 비어 있다고 스크롤을 막으면 안 된다 — 못 재면 그냥 통과시킨다.
   */
  const clampDelta = useCallback((next: number) => {
    const viewport = viewportRef.current;
    const lines = lineRefs.current;
    // 배열에는 예전 원고의 잔여 항목이 남을 수 있으므로 지금 문장 수까지만 본다
    const first = lines[0];
    const last = lines[sentences.length - 1];
    const here = lines[index];
    if (!viewport || !first || !last || !here) return next;

    const anchor = viewport.clientHeight * ANCHOR_RATIO;
    const base = anchor - here.offsetTop - here.offsetHeight / 2;
    const top = anchor - first.offsetTop - first.offsetHeight / 2;
    const bottom = anchor - last.offsetTop - last.offsetHeight / 2;

    return Math.max(bottom - base, Math.min(top - base, next));
  }, [index, sentences.length]);

  /**
   * 휠은 직접 등록한다. React 합성 이벤트는 수동(passive) 리스너로 붙어
   * preventDefault를 못 하고, 그러면 상위 요소가 스크롤을 가져가 버린다.
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setBrowseDelta((d) => clampDelta(d - event.deltaY));
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [clampDelta]);

  const measure = useCallback(() => {
    const line = lineRefs.current[index];
    const viewport = viewportRef.current;
    if (!line || !viewport) return;

    // 카드가 차지한 만큼을 뺀 나머지 안에서 기준선을 잡는다.
    // 이래야 카드를 잘라내지 않고도 읽는 줄이 카드에 가리지 않는다 —
    // 창을 반만 쓰면 한국어가 두세 줄로 늘어나는데, 그때 문장이 위로 올라간다.
    // 카드가 아무리 커도 읽고 있는 문장까지 밀어내진 못하게 상한을 둔다.
    // (이 값은 카드 높이와 무관해서 서로 물고 늘어지지 않는다)
    const limit = Math.max(120, viewport.clientHeight - line.offsetHeight - CARD_GAP);
    setCardMax(limit);

    const usable = Math.max(160, viewport.clientHeight - Math.min(cardHeight, limit) - CARD_GAP);

    // 문장 자체가 여러 줄로 길어지면 42% 자리에 놓아도 아래가 카드를 파고든다.
    // 그래서 문장의 '아랫변'이 카드 위에 머무는 선까지 끌어올린다.
    const half = line.offsetHeight / 2;
    const anchor = Math.max(half, Math.min(usable * ANCHOR_RATIO, usable - half));
    setOffset(anchor - line.offsetTop - half);
  }, [index, cardHeight]);

  /** 카드 높이가 바뀌면(문장이 길어져 줄이 늘거나, 단어를 짚거나) 다시 재야 한다 */
  const cardObserver = useRef<ResizeObserver | null>(null);
  const attachCard = useCallback((el: HTMLDivElement | null) => {
    cardObserver.current?.disconnect();
    cardObserver.current = null;

    if (!el) {
      setCardHeight(0);
      return;
    }
    setCardHeight(el.offsetHeight);
    if (typeof ResizeObserver !== 'undefined') {
      cardObserver.current = new ResizeObserver(() => setCardHeight(el.offsetHeight));
      cardObserver.current.observe(el);
    }
  }, []);

  useEffect(() => () => cardObserver.current?.disconnect(), []);

  useLayoutEffect(measure, [
    measure, sentences, settings.fontSize, settings.pinyinMode,
    settings.contextBefore, settings.contextAfter,
  ]);

  // 창 크기·전체화면·설정 패널 여닫기로 뷰포트가 바뀌면 기준 높이도 달라진다.
  // 다시 재지 않으면 현재 문장이 화면 밖으로 밀려난다.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      className={`pr-viewport pr-font-${settings.fontStyle}`}
      ref={viewportRef}
    >
      <div
        className={`pr-stack${browsing ? ' is-browsing' : ''}`}
        style={{ transform: `translateY(${offset + browseDelta}px)` }}
      >
        {sentences.map((sentence, i) => {
          const distance = i - index;
          const hidden =
            !browsing &&
            (distance < -settings.contextBefore || distance > settings.contextAfter);
          const inRange = !!range && i >= range.a && i <= range.b;
          const classes = [
            'pr-line',
            inRange ? 'is-in-range' : '',
            inRange && i === range!.a ? 'is-range-start' : '',
            inRange && i === range!.b ? 'is-range-end' : '',
            i === pendingStart ? 'is-pending-start' : '',
            distance === 0 ? 'is-current' : '',
            distance === 0 && status === 'playing' ? 'is-playing' : '',
            distance === 0 && status === 'loading' ? 'is-loading' : '',
            hidden ? 'is-hidden' : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={i}
              ref={(el) => { lineRefs.current[i] = el; }}
              className={classes}
              style={{
                fontSize: distance === 0 ? settings.fontSize : settings.fontSize * 0.62,
                // 멀어질수록 흐리게. 숨긴 줄도 레이아웃에는 남겨 위치 계산을 안정시킨다
                opacity: hidden
                  ? 0
                  : distance === 0
                    ? 1
                    : browsing
                      ? 0.5
                      : Math.max(0.18, 0.5 - Math.abs(distance) * 0.1),
              }}
              onClick={() => onSelect(i)}
            >
              {/* 간체 중국어임을 알려야 한·일과 자형이 다른 글자가 올바로 그려진다 */}
              <div className={`pr-line-text pr-ruby-${settings.pinyinMode}`} lang="zh-CN">
                {distance === 0
                  ? wordChunks.map((chunk, w) => (
                      <span
                        key={w}
                        className={`pr-word${chunk.isWord ? ' is-lookup' : ''}${
                          card?.word === chunk.text && chunk.isWord ? ' is-looked-up' : ''
                        }`}
                        onMouseEnter={() => onWordEnter(chunk)}
                        onMouseLeave={cancelPendingLookup}
                      >
                        {chunk.chars.map((item, k) =>
                          item.reading ? (
                            <ruby key={k}>
                              {item.char}
                              <rt>{item.reading}</rt>
                            </ruby>
                          ) : (
                            <span key={k}>{item.char}</span>
                          ),
                        )}
                      </span>
                    ))
                  : sentence.text}
              </div>

            </div>
          );
        })}
      </div>

      {context && context.zh === (sentences[index]?.text ?? '') && (
        <div className="pr-word-card" ref={attachCard} style={{ maxHeight: cardMax }}>
          {card && (
            <div className="pr-word-card-word">
              <div className="pr-word-card-head">
                <span className="pr-word-card-zh" lang="zh-CN">{card.word}</span>
                {card.pinyin && <span className="pr-word-card-py">{card.pinyin}</span>}
                {card.state === 'done' && card.outcome?.result.partOfSpeech && (
                  <span className="pr-word-card-pos">{card.outcome.result.partOfSpeech}</span>
                )}
                <span className="pr-word-card-body">
                  {card.state === 'loading'
                    ? '찾는 중…'
                    : card.state === 'error'
                      ? `뜻을 가져오지 못했습니다 — ${card.error}`
                      : card.outcome?.result.translation || '뜻을 찾지 못했습니다'}
                </span>
              </div>

              {/* 사전 엔진이 실패해 무료 뜻만 온 것이면 그렇다고 말한다.
                  말하지 않으면 품사·예문이 왜 안 나오는지 알 길이 없다. */}
              {card.state === 'done' && card.outcome?.usedFallback && (
                <div className="pr-word-card-warn">
                  ⚠️ {card.outcome.engine} 실패 — 무료 뜻만 (품사·예문 없음)
                  <button
                    className="pr-word-card-switch"
                    onClick={() => { switchToFreeDictionary(); setCard(null); }}
                    title="사전 엔진을 무료로 바꿉니다. 설정에서 언제든 되돌릴 수 있습니다."
                  >
                    무료 사전으로 바꾸기
                  </button>
                  {card.outcome.fallbackReason && (
                    <div className="pr-word-card-why">{card.outcome.fallbackReason}</div>
                  )}
                </div>
              )}

              {card.state === 'done'
                && card.outcome?.result.exampleChinese
                && card.outcome?.result.exampleKorean && (
                <div className="pr-word-card-eg">
                  <span className="pr-word-card-eg-label">예문</span>
                  <span lang="zh-CN">{card.outcome.result.exampleChinese}</span>
                  <span className="pr-word-card-eg-ko">{card.outcome.result.exampleKorean}</span>
                </div>
              )}
            </div>
          )}

          {/* 문장 뜻은 늘 맨 아래 같은 자리에 — 단어를 짚어도 이 줄은 움직이지 않는다 */}
          <div className="pr-word-card-sentence">
            {context.ko
              ? context.ko
              : context.failed
                ? <span className="pr-word-card-dim">이 문장의 뜻을 가져오지 못했습니다</span>
                : <span className="pr-word-card-dim">번역 중…</span>}
          </div>
        </div>
      )}

      {browsing && (
        <button className="pr-back-to-current" onClick={() => setBrowseDelta(0)}>
          현재 문장으로 ↩
        </button>
      )}
    </div>
  );
}
