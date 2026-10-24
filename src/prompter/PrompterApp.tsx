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
import { useLang } from '../lib/i18nContext';
import './prompter.css';

export function PrompterApp() {
  const { t } = useLang();
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
    index, status, fallbackReason, playbackError, range, pendingStart, pace,
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
          {t.backToScript}
        </button>

        <div className="pr-progress">
          <strong>{index + 1}</strong> / {sentences.length}
          <span className={`pr-status pr-status-${status}`}>
            {status === 'playing' ? t.statusPlaying : status === 'loading' ? t.statusLoadingAudio : t.statusStopped}
          </span>

          {range ? (
            <span className="pr-range-chip">
              {t.rangeChip(range.a + 1, range.b + 1)}
              <button onClick={clearRange} title={t.rangeClear}>✕</button>
            </span>
          ) : pendingStart !== null ? (
            <span className="pr-range-chip is-pending">
              {t.rangePendingLead(pendingStart + 1)} <kbd>B</kbd> {t.rangePendingTail}
              <button onClick={clearRange} title={t.rangeCancel}>✕</button>
            </span>
          ) : (
            <button className="pr-range-set" onClick={markStart} title={t.rangeSetHint}>
              {t.rangeSet}
            </button>
          )}
        </div>

        <div className="pr-speed-readout" title={t.paceTitle}>
          <span className="pr-speed-rate">{settings.rate.toFixed(2)}x</span>
          <span className="pr-speed-pace">
            {settings.muted ? t.paceMuted : pace !== null ? t.paceUnit(pace) : t.paceMeasuring}
          </span>
        </div>
      </header>

      {!edgeAvailable && (
        <div className="pr-banner">
          {t.bannerNoBridge} (<code>npm run app:dev</code>).
        </div>
      )}
      {fallbackReason && !playbackError && (
        <div className="pr-banner pr-banner-warn">
          {t.bannerFallback(fallbackReason)}
        </div>
      )}
      {playbackError && (
        <div className="pr-banner pr-banner-warn" role="alert">
          {playbackError === 'chinese-voice-unavailable' ? t.bibleNoVoice : t.audioFailed(playbackError)}
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
        <span><kbd>Space</kbd> {t.hintNext}</span>
        <span><kbd>↑</kbd><kbd>↓</kbd> {t.hintMove}</span>
        <span><kbd>Enter</kbd> {t.hintRepeat}</span>
        <span><kbd>Esc</kbd> {t.hintStop}</span>
        <span>{t.hintHover}</span>
        <span><kbd>Shift</kbd>+{t.hintSilent}</span>
        <span><kbd>[</kbd><kbd>]</kbd> {t.hintSpeed}</span>
        <span>{t.hintScroll}</span>
        <span><kbd>+</kbd><kbd>-</kbd> {t.hintFont}</span>
        <span className="pr-hint-strong"><kbd>A</kbd>~<kbd>B</kbd> {t.hintRange} <kbd>C</kbd> {t.hintRangeClear}</span>
      </footer>
    </div>
  );
}
