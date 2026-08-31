import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScriptInput } from './ScriptInput';
import { PrompterView } from './PrompterView';
import { MenuBar } from './MenuBar';
import { splitSentences } from './lib/splitSentences';
import { usePrompter } from './hooks/usePrompter';
import { useHotkeys } from './hooks/useHotkeys';
import { hasEdgeBridge } from './lib/tts/types';
import {
  loadScript, loadSettings, saveIndex, saveScript, saveSettings,
  type PrompterSettings,
} from './lib/settings';
import './prompter.css';

export function PrompterApp() {
  const saved = useMemo(() => loadScript(), []);
  const [text, setText] = useState(saved.text);
  const [running, setRunning] = useState(false);
  const [settings, setSettings] = useState<PrompterSettings>(loadSettings);
  /** 메뉴가 열려 있으면 화살표·Enter가 메뉴 조작을 방해하지 않도록 단축키를 멈춘다 */
  const [menuOpen, setMenuOpen] = useState(false);
  /** 원고로 돌아갈 때, 읽고 있던 문장이 원고의 어디였는지 */
  const [focusRange, setFocusRange] = useState<{ start: number; end: number } | null>(null);

  const edgeAvailable = useMemo(() => hasEdgeBridge(), []);

  const { sentences, skippedLines } = useMemo(
    () => splitSentences(text, {
      readMode: settings.readMode,
      splitLong: settings.splitLongSentences,
      maxChars: settings.maxChars,
    }),
    [text, settings.readMode, settings.splitLongSentences, settings.maxChars],
  );

  const {
    index, status, fallbackReason, range, pendingStart, pace,
    goto, next, prev, repeat, stop, markStart, markEnd, clearRange,
  } = usePrompter(sentences, settings, Math.min(saved.index, Math.max(0, sentences.length - 1)));

  /** 원고의 글자 위치를 감싸는(또는 그 앞의 마지막) 문장을 찾는다 */
  const indexAtSource = useCallback((caret: number) => {
    if (sentences.length === 0) return 0;

    let found = 0;
    for (const sentence of sentences) {
      if (sentence.sourceStart > caret) break;
      found = sentence.index;
    }
    return found;
  }, [sentences]);

  const patch = useCallback((changes: Partial<PrompterSettings>) => {
    setSettings((current) => {
      const merged = { ...current, ...changes };
      saveSettings(merged);
      return merged;
    });
  }, []);

  useEffect(() => { saveScript(text); }, [text]);
  useEffect(() => { saveIndex(index); }, [index]);

  const handlers = useMemo(() => ({
    next, prev, repeat, stop, markStart, markEnd, clearRange,
    biggerFont: () => patch({ fontSize: Math.min(160, settings.fontSize + 4) }),
    smallerFont: () => patch({ fontSize: Math.max(24, settings.fontSize - 4) }),
    faster: () => patch({ rate: Math.min(1.5, Number((settings.rate + 0.05).toFixed(2))) }),
    slower: () => patch({ rate: Math.max(0.5, Number((settings.rate - 0.05).toFixed(2))) }),
  }), [next, prev, repeat, stop, markStart, markEnd, clearRange, patch, settings.fontSize, settings.rate]);

  useHotkeys(handlers, running && !menuOpen);

  if (!running) {
    return (
      <ScriptInput
        text={text}
        sentenceCount={sentences.length}
        skippedLines={skippedLines}
        readMode={settings.readMode}
        onChangeReadMode={(mode) => patch({ readMode: mode })}
        onChange={setText}
        focusRange={focusRange}
        onStart={(caret) => {
          setRunning(true);
          setFocusRange(null);
          // 원고에서 커서를 둔 곳을 감싸는 문장부터 읽는다
          const target = caret === null ? index : indexAtSource(caret);
          goto(target);
        }}
      />
    );
  }

  return (
    <div className="pr-root">
      <header className="pr-bar">
        <button
          className="pr-btn"
          onClick={() => {
            stop();
            const here = sentences[index];
            setFocusRange(here ? { start: here.sourceStart, end: here.sourceEnd } : null);
            setRunning(false);
          }}
        >
          ← 원고 수정
        </button>

        <div className="pr-progress">
          <strong>{index + 1}</strong> / {sentences.length}
          <span className={`pr-status pr-status-${status}`}>
            {status === 'playing' ? '재생 중' : status === 'loading' ? '불러오는 중' : '정지'}
          </span>

          {range ? (
            <span className="pr-range-chip">
              ↻ 구간 {range.a + 1}–{range.b + 1}
              <button onClick={clearRange} title="구간 해제 (C)">✕</button>
            </span>
          ) : pendingStart !== null ? (
            <span className="pr-range-chip is-pending">
              구간 시작 {pendingStart + 1} · 끝낼 문장에서 <kbd>B</kbd>
              <button onClick={clearRange} title="취소 (C)">✕</button>
            </span>
          ) : (
            <button className="pr-range-set" onClick={markStart} title="구간 반복 시작점 (A)">
              ↻ 구간 반복
            </button>
          )}
        </div>

        <div className="pr-speed-readout" title="실제로 읽고 있는 속도">
          <span className="pr-speed-rate">{settings.rate.toFixed(2)}x</span>
          <span className="pr-speed-pace">
            {settings.muted ? '무음' : pace !== null ? `${pace}자/분` : '측정 중…'}
          </span>
        </div>
      </header>

      {!edgeAvailable && (
        <div className="pr-banner">
          브라우저에서 실행 중이라 기기 내장 음성을 씁니다. 온라인 중국어 음성은 Electron 앱(<code>npm run app:dev</code>)에서 나옵니다.
        </div>
      )}
      {fallbackReason && (
        <div className="pr-banner pr-banner-warn">
          온라인 음성에 실패해 기기 음성으로 전환했습니다 — {fallbackReason}
        </div>
      )}

      <MenuBar
        settings={settings}
        onChange={patch}
        edgeAvailable={edgeAvailable}
        pace={pace}
        onOpenChange={setMenuOpen}
      />

      <PrompterView
        sentences={sentences}
        index={index}
        status={status}
        settings={settings}
        range={range}
        pendingStart={pendingStart}
        onSelect={(i) => goto(i)}
      />

      <footer className="pr-hints">
        <span><kbd>Space</kbd> 다음 문장</span>
        <span><kbd>↑</kbd><kbd>↓</kbd> 이동</span>
        <span><kbd>Enter</kbd> 다시 듣기</span>
        <span><kbd>Esc</kbd> 정지</span>
        <span><kbd>Shift</kbd>+이동 = 소리 없이</span>
        <span><kbd>[</kbd><kbd>]</kbd> 속도</span>
        <span>휠로 원고 훑기</span>
        <span><kbd>+</kbd><kbd>-</kbd> 글자</span>
        <span className="pr-hint-strong"><kbd>A</kbd>~<kbd>B</kbd> 구간 반복 · <kbd>C</kbd> 해제</span>
      </footer>
    </div>
  );
}
