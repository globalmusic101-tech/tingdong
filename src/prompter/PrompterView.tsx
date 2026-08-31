import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { pinyin } from 'pinyin-pro';
import type { Sentence } from './lib/splitSentences';
import type { PrompterSettings } from './lib/settings';
import type { PlayStatus, Range } from './hooks/usePrompter';

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

export function PrompterView({ sentences, index, status, settings, range, pendingStart, onSelect }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [offset, setOffset] = useState(0);

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
  const rubyChars = useMemo(() => {
    if (settings.pinyinMode === 'off') return null;

    const text = sentences[index]?.text ?? '';
    const readings = pinyin(text, { type: 'array', toneType: 'symbol' });

    return [...text].map((char, i) => ({
      char,
      // 구두점은 읽을 게 없으므로 주석을 달지 않는다
      reading: readings[i] !== char ? readings[i] : '',
    }));
  }, [sentences, index, settings.pinyinMode]);

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

    const anchor = viewport.clientHeight * ANCHOR_RATIO;
    setOffset(anchor - line.offsetTop - line.offsetHeight / 2);
  }, [index]);

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
                {distance === 0 && rubyChars
                  ? rubyChars.map((item, k) =>
                      item.reading ? (
                        <ruby key={k}>
                          {item.char}
                          <rt>{item.reading}</rt>
                        </ruby>
                      ) : (
                        <span key={k}>{item.char}</span>
                      ),
                    )
                  : sentence.text}
              </div>

            </div>
          );
        })}
      </div>

      {browsing && (
        <button className="pr-back-to-current" onClick={() => setBrowseDelta(0)}>
          현재 문장으로 ↩
        </button>
      )}
    </div>
  );
}
