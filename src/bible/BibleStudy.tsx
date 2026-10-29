import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pinyin } from 'pinyin-pro';
import { useLang } from '../lib/i18nContext';
import { englishBibleBookNames } from '../lib/i18n';
import { SentencePlayer } from '../prompter/lib/tts/player';
import { DEFAULT_SETTINGS } from '../prompter/lib/settings';
import { hasEdgeBridge } from '../prompter/lib/tts/types';
import { chapterFor, bibleBooks, headingTitle, meaningsFor, partition, passagesForAllBooks, selectionForPassageId, sentencesFor, sentencesForLanguage, textForVerse, type BibleLanguage, type Chapter, type Division, type Passage } from './model';
import { loadStudy, saveStudy, type StudyData, type StudySettings } from './storage';
import { StudyPlayback, type Playback } from './playback';
import { lessonFor, verseMeanings } from './lessons';
import { mergeLocalBibles, validateLocalBible, type LocalBible } from './localSource';
import { GrammarPanel, VocabularyPanel } from './LearningPanels';
import type { LearningView, WordReview } from './storage';
import './bible.css';

function passageTitle(p: Passage, language: BibleLanguage, fallback: string): string {
  return headingTitle(p.heading, language, fallback);
}

function speechLanguage(language: BibleLanguage): 'zh-CN' | 'ko-KR' | 'en-US' {
  return language === 'ko' ? 'ko-KR' : language === 'en' ? 'en-US' : 'zh-CN';
}

function languageLabel(language: BibleLanguage, t: ReturnType<typeof useLang>['t']): string {
  return language === 'ko' ? t.bibleKorean : language === 'en' ? t.bibleEnglish : t.bibleChinese;
}

function StudySession({ passage, data, meanings, activeChapter, onCursor, onStopReady, onSettings, onPassageComplete, autoStart, onAutoStartConsumed }: {
  passage: Passage; data: StudyData; meanings: typeof verseMeanings; activeChapter: Chapter; onCursor: (id: string) => void;
  onStopReady: (stop: (() => void) | null) => void; onSettings: (patch: Partial<StudySettings>) => void;
  onPassageComplete: () => void; autoStart: boolean; onAutoStartConsumed: () => void;
}) {
  const { t } = useLang();
  const lines = useMemo(() => sentencesForLanguage(passage, data.settings.primaryLanguage, meanings), [passage, data.settings.primaryLanguage, meanings]);
  const initialIndex = Math.max(0, lines.findIndex(l => l.id === data.sentenceId));
  const initialIndexRef = useRef(initialIndex);
  const [playback, setPlayback] = useState<Playback>({ phase: 'idle', index: initialIndex, count: 0, mode: null });
  const [fallback, setFallback] = useState(false);
  const controller = useRef<StudyPlayback | null>(null);
  const playerRef = useRef<SentencePlayer | null>(null);
  const settingsRef = useRef(data.settings);
  settingsRef.current = data.settings;
  const autoStartRef = useRef(autoStart);
  autoStartRef.current = autoStart;
  const cursorRef = useRef(onCursor);
  cursorRef.current = onCursor;
  const edge = hasEdgeBridge();
  const effectiveEngine = edge ? data.settings.engine : 'local';

  useEffect(() => {
    let live = true;
    const player = new SentencePlayer({
      onStatus: status => engine.status(status), onEnded: () => engine.ended(),
      onFallback: () => { if (live) setFallback(true); }, onPace: () => {},
      onError: reason => engine.fail(reason),
    });
    playerRef.current = player;
    const engine = new StudyPlayback(lines, {
      play: text => {
        const s = settingsRef.current;
        void player.play(text, { ...DEFAULT_SETTINGS, engine: hasEdgeBridge() ? s.engine : 'local',
          muted: false, rate: s.rate, tone: s.tone, gender: s.gender, language: speechLanguage(s.primaryLanguage) });
      },
      stop: () => player.stop(),
      prefetch: text => {
        const s = settingsRef.current;
        player.prefetch(text, { ...DEFAULT_SETTINGS, engine: hasEdgeBridge() ? s.engine : 'local',
          muted: false, rate: s.rate, tone: s.tone, gender: s.gender, language: speechLanguage(s.primaryLanguage) });
      },
    }, state => {
      if (!live) return;
      setPlayback(state);
      cursorRef.current(lines[state.index].id);
    }, settingsRef.current.repeats, settingsRef.current.gapMs, initialIndexRef.current, onPassageComplete);
    controller.current = engine;
    onStopReady(() => engine.stop());
    if (autoStartRef.current) {
      onAutoStartConsumed();
      window.setTimeout(() => { if (live) engine.sequence(); }, 0);
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') engine.stop();
    };
    window.addEventListener('keydown', keydown);
    return () => {
      live = false;
      engine.stop();
      controller.current = null;
      playerRef.current = null;
      onStopReady(null);
      window.removeEventListener('keydown', keydown);
    };
  }, [lines, onStopReady, onPassageComplete, onAutoStartConsumed]);

  useEffect(() => {
    controller.current?.configure(data.settings.repeats, data.settings.gapMs);
    playerRef.current?.resetFallback();
    setFallback(false);
  }, [data.settings]);

  useEffect(() => {
    const target = document.querySelector<HTMLButtonElement>(`button[data-sentence="${lines[playback.index]?.id}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, [lines, playback.index]);

  const readings = useMemo(() => lines.map(line => {
    const sounds = pinyin(line.text, { type: 'array', toneType: 'symbol' });
    return [...line.text].map((char, i) => ({ char, sound: sounds[i] !== char ? sounds[i] : '' }));
  }), [lines]);
  const busy = playback.mode !== null;
  const status = { idle: t.bibleIdle, loading: t.bibleLoading, playing: t.biblePlaying,
    waiting: t.bibleWaiting, error: t.bibleAudioFailed }[playback.phase];

  return <>
    <div className="bible-controls">
      <div className="bible-primary-controls">
        <button className="bible-primary" onClick={() => controller.current?.sequence()}>{t.bibleListen}</button>
        <button onClick={() => controller.current?.stop()} disabled={!busy}>{t.bibleStop}</button>
        <label className="bible-checkbox"><input type="checkbox" checked={data.settings.pinyin} disabled={data.settings.primaryLanguage !== 'zh'}
          onChange={e => onSettings({ pinyin: e.target.checked })} />{t.biblePinyin}</label>
        <span className="bible-setting-label">{t.biblePrimaryLanguage}</span>
        <select value={data.settings.primaryLanguage} onChange={e => {
          const next = e.target.value as BibleLanguage;
          onSettings({ primaryLanguage: next, secondaryLanguages: [...new Set([...data.settings.secondaryLanguages.filter(item => item !== next), data.settings.primaryLanguage])] });
        }}>
          {(['zh', 'ko', 'en'] as BibleLanguage[]).map(language => <option key={language} value={language}>{languageLabel(language, t)}</option>)}
        </select>
        <span className="bible-setting-label">{t.bibleSecondaryLanguages}</span>
        {(['zh', 'ko', 'en'] as BibleLanguage[]).filter(language => language !== data.settings.primaryLanguage).map(language =>
          <label className="bible-checkbox" key={language}><input type="checkbox" checked={data.settings.meanings && data.settings.secondaryLanguages.includes(language)}
          onChange={e => onSettings({ meanings: true, secondaryLanguages: e.target.checked ? [...data.settings.secondaryLanguages, language] : data.settings.secondaryLanguages.filter(item => item !== language) })} />{languageLabel(language, t)}</label>)}
      </div>
      <div className="bible-selects">
        <label>{t.bibleRate}<select value={data.settings.rate} onChange={e => onSettings({ rate: Number(e.target.value) })}>
          {[0.5, 0.65, 0.75, 0.85, 1, 1.15, 1.25, 1.5].map(rate => <option key={rate} value={rate}>{rate}×</option>)}
        </select></label>
        <label>{t.bibleRepeats}<select value={data.settings.repeats} onChange={e => onSettings({ repeats: Number(e.target.value) })}>
          <option value={0}>{t.bibleForever}</option><option value={1}>{t.bibleTimes(1)}</option>
          <option value={3}>{t.bibleTimes(3)}</option><option value={5}>{t.bibleTimes(5)}</option>
        </select></label>
        <label>{t.bibleGap}<select value={data.settings.gapMs} onChange={e => onSettings({ gapMs: Number(e.target.value) })}>
          <option value={0}>{t.bibleContinuous}</option>{[500, 1000, 2000, 3000].map(ms => <option value={ms} key={ms}>{t.bibleSeconds(ms / 1000)}</option>)}
        </select></label>
        <label>{t.voiceGender}<select value={data.settings.gender} onChange={e => onSettings({ gender: e.target.value as 'male' | 'female' })}>
          <option value="male">{t.voiceMale}</option><option value="female">{t.voiceFemale}</option>
        </select></label>
        <label>{t.menuTone}<select value={data.settings.tone} onChange={e => onSettings({ tone: e.target.value as 'sermon' | 'news' | 'chat' })}>
          <option value="sermon">{t.toneSermon}</option><option value="news">{t.toneNews}</option><option value="chat">{t.toneChat}</option>
        </select></label>
        <label>{t.bibleVoice}<select value={effectiveEngine} onChange={e => {
          onSettings({ engine: e.target.value as 'local' | 'edge' });
        }}>
          <option value="edge" disabled={!edge}>{t.bibleEdgeLegacy}</option><option value="local">{t.bibleLocal}</option>
        </select></label>
      </div>
      <p className="bible-note">{effectiveEngine === 'edge' ? t.bibleEdgeLegacyNotice : t.bibleLocalNotice} {!edge && t.bibleBrowserNotice}</p>
    </div>
    {fallback && <div className="bible-alert" role="status">{t.bibleFallbackNotice}</div>}
    <div className={`bible-playback bible-phase-${playback.phase}`} role="status" aria-live="polite">
      <span className="bible-status-dot" />{status}
      {busy && playback.mode === 'repeat' && <span className="bible-round">{t.bibleRound(playback.count)}</span>}
    </div>
    {playback.error && <div className="bible-alert" role="alert">
      {playback.error === 'chinese-voice-unavailable' || playback.error.endsWith('-voice-unavailable') ? t.bibleNoVoice : playback.error}
    </div>}
    <p className="bible-click-hint">{t.bibleClickHint}</p>
    <div className="bible-verses" lang={speechLanguage(data.settings.primaryLanguage)}>
      {passage.verses.map(verse => <div className="bible-verse" key={verse.number}>
        <span className="bible-verse-number" aria-hidden="true">{verse.number}</span>
        <div className="bible-sentences">{lines.map((line, i) => line.verse !== verse.number ? null :
          <button key={line.id} data-sentence={line.id} className={`bible-sentence ${i === playback.index ? 'is-selected' : ''} ${i === playback.index && busy ? 'is-active' : ''}`}
            aria-label={`${activeChapter.chapter}:${verse.number} ${line.text}`} aria-pressed={i === playback.index && busy}
            onClick={() => controller.current?.select(i)}>
            {data.settings.pinyin && data.settings.primaryLanguage === 'zh' ? readings[i].map(({ char, sound }, n) => sound
              ? <ruby key={n}>{char}<rt>{sound}</rt></ruby> : <span key={n}>{char}</span>) : line.text}
          </button>)}
          {data.settings.meanings && data.settings.secondaryLanguages.filter(language => language !== data.settings.primaryLanguage).map(language => {
            const text = textForVerse(verse, language, meanings);
            return <div className="bible-secondary-text" lang={speechLanguage(language)} key={language}>
              <span className="bible-language-label">{languageLabel(language, t)}</span><p>{text || t.bibleMeaningMissing}</p>
            </div>;
          })}
        </div>
      </div>)}
    </div>
  </>;
}

export function BibleStudy() {
  const { t } = useLang();
  const [loaded] = useState(loadStudy);
  const [data, setData] = useState(loaded.data);
  const [storageFailed, setStorageFailed] = useState(loaded.failed);
  const [localBibles, setLocalBibles] = useState<{ ko: LocalBible[]; en: LocalBible[] }>({ ko: [], en: [] });
  const [selectedVersions, setSelectedVersions] = useState({ ko: 'default', en: 'default' });
  const [selectedBook, setSelectedBook] = useState(() => selectionForPassageId(loaded.data.passageId).book);
  const [selectedChapter, setSelectedChapter] = useState(() => selectionForPassageId(loaded.data.passageId).chapter);
  const [localBibleMessage, setLocalBibleMessage] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const autoStartChapterRef = useRef<number | null>(null);
  const activeChapter = useMemo(() => chapterFor(selectedBook, selectedChapter), [selectedBook, selectedChapter]);
  const activeBook = bibleBooks.find(book => book.id === selectedBook);
  const activeBookName = t.bibleBookName(selectedBook, selectedBook === 'MRK' ? t.bibleBook : (activeBook?.name ?? selectedBook));
  const primaryBookName = data.settings.primaryLanguage === 'en'
    ? (englishBibleBookNames[selectedBook] ?? activeBookName)
    : (activeBook?.name ?? activeBookName);
  const passageRange = (p: Passage) => `${primaryBookName} ${activeChapter.chapter}:${p.start}${p.start === p.end ? '' : `–${p.end}`}`;
  const primaryPassageRange = (p: Passage) => {
    return `${primaryBookName} ${activeChapter.chapter}:${p.start}${p.start === p.end ? '' : `–${p.end}`}`;
  };
  const passages = useMemo(() => partition(activeChapter, data.mode), [activeChapter, data.mode]);
  const passageIndex = Math.max(0, passages.findIndex(p => p.id === data.passageId));
  const passage = passages[passageIndex];
  const selectedKo = localBibles.ko.find(item => item.translation === selectedVersions.ko);
  const selectedEn = localBibles.en.find(item => item.translation === selectedVersions.en);
  const usesMarkLocalVersions = selectedBook === 'MRK' && selectedChapter === 1;
  const baseMeanings = useMemo(() => usesMarkLocalVersions ? verseMeanings : meaningsFor(selectedBook, selectedChapter), [selectedBook, selectedChapter, usesMarkLocalVersions]);
  const meanings = useMemo(() => mergeLocalBibles(
    usesMarkLocalVersions ? selectedKo : undefined,
    usesMarkLocalVersions ? selectedEn : undefined,
    baseMeanings,
  ), [selectedKo, selectedEn, usesMarkLocalVersions, baseMeanings]);
  const completed = data.completed.includes(passage.id);
  const last = passageIndex === passages.length - 1;
  const progressRows = useMemo(() => bibleBooks.map(book => {
    const bookPassages = book.chapters.flatMap(item => partition(chapterFor(book.id, item.chapter), data.mode));
    const done = bookPassages.filter(item => data.completed.includes(item.id)).length;
    return { ...book, displayName: t.bibleBookName(book.id, book.name), done, total: bookPassages.length };
  }), [data.completed, data.mode, t]);
  const progressTotal = useMemo(() => {
    const all = passagesForAllBooks(data.mode);
    return { done: all.filter(item => data.completed.includes(item.id)).length, total: all.length };
  }, [data.completed, data.mode]);
  const stopReady = useCallback((stop: (() => void) | null) => { stopRef.current = stop; }, []);
  const cursor = useCallback((id: string) => setData(d => d.sentenceId === id ? d : { ...d, sentenceId: id }), []);
  const settings = (patch: Partial<StudySettings>) => {
    stopRef.current?.();
    setData(d => ({ ...d, settings: { ...d.settings, ...patch } }));
  };
  useEffect(() => { if (!saveStudy(data)) setStorageFailed(true); }, [data]);
  useEffect(() => {
    const load = window.electronAPI?.loadLocalBibles;
    if (!load) return;
    void load().then(result => {
      const ko = (result.ko?.data ?? []).flatMap(item => { const checked = validateLocalBible(item, 'ko'); return checked.ok ? [checked.data] : []; });
      const en = (result.en?.data ?? []).flatMap(item => { const checked = validateLocalBible(item, 'en'); return checked.ok ? [checked.data] : []; });
      setLocalBibles({ ko, en });
      try {
        const saved = JSON.parse(localStorage.getItem('tingdong.bible.versions') ?? '{}');
        const next = { ko: ko.some(item => item.translation === saved.ko) ? saved.ko : 'default', en: en.some(item => item.translation === saved.en) ? saved.en : 'default' };
        if ((saved.ko && next.ko === 'default') || (saved.en && next.en === 'default')) setLocalBibleMessage(t.bibleLocalBibleFallback);
        setSelectedVersions(next);
      } catch { /* 기본 판본을 사용합니다 */ }
    });
  }, [t]);
  const importLocalBible = useCallback(async (language: 'ko' | 'en') => {
    const result = await window.electronAPI?.importLocalBible?.(language);
    if (!result || result.code === 'cancelled') return;
    if (!result.ok || !result.data) { setLocalBibleMessage(result.error ?? t.bibleLocalBibleInvalid); return; }
    const checked = validateLocalBible(result.data, language);
    if (!checked.ok) { setLocalBibleMessage(t.bibleLocalBibleInvalid); return; }
    setLocalBibles(current => ({
      ...current,
      [language]: [...current[language].filter(item => item.translation !== checked.data.translation), checked.data],
    }));
    setSelectedVersions(current => {
      const next = { ...current, [language]: checked.data.translation };
      localStorage.setItem('tingdong.bible.versions', JSON.stringify(next));
      return next;
    });
    setLocalBibleMessage(null);
  }, [t]);
  const go = useCallback((p: Passage, mark = false) => {
    stopRef.current?.();
    if (p.id === passage.id) return;
    setData(d => ({ ...d, passageId: p.id, sentenceId: sentencesFor(p)[0].id,
      completed: mark ? [...new Set([...d.completed, passage.id])] : d.completed }));
  }, [passage.id]);
  const divide = (mode: Division) => {
    stopRef.current?.();
    const verse = Number(data.sentenceId.split(':')[0]);
    const next = partition(activeChapter, mode).find(p => p.start <= verse && p.end >= verse) ?? partition(activeChapter, mode)[0];
    setData(d => ({ ...d, mode, passageId: next.id }));
  };
  const toggleComplete = () => setData(d => ({ ...d, completed: completed
    ? d.completed.filter(id => id !== passage.id) : [...d.completed, passage.id] }));
  const doneCount = passages.filter(p => data.completed.includes(p.id)).length;
  const lesson = lessonFor(passage, selectedBook);
  const selectChapter = (book: string, number: number) => {
    stopRef.current?.();
    autoStartChapterRef.current = null;
    setSelectedBook(book);
    setSelectedChapter(number);
    const next = chapterFor(book, number);
    const first = partition(next, data.mode)[0];
    setData(d => ({ ...d, passageId: first.id, sentenceId: sentencesFor(first)[0].id }));
  };
  const consumeAutoStart = useCallback(() => { autoStartChapterRef.current = null; }, []);
  const continueReading = useCallback(() => {
    if (data.settings.gapMs !== 0) return;
    if (passageIndex < passages.length - 1) {
      autoStartChapterRef.current = selectedChapter;
      go(passages[passageIndex + 1], true);
      return;
    }
    const nextChapter = activeBook?.chapters.find(item => item.chapter === selectedChapter + 1);
    if (!nextChapter) return;
    const first = partition(chapterFor(selectedBook, nextChapter.chapter), data.mode)[0];
    stopRef.current?.();
    autoStartChapterRef.current = nextChapter.chapter;
    setSelectedChapter(nextChapter.chapter);
    setData(d => ({ ...d, passageId: first.id, sentenceId: sentencesFor(first)[0].id,
      completed: [...new Set([...d.completed, passage.id])] }));
  }, [activeBook, data.mode, data.settings.gapMs, go, passage.id, passageIndex, passages, selectedBook, selectedChapter]);
  const switchView = (view: LearningView) => {
    stopRef.current?.();
    setData(d => ({ ...d, learningView: view }));
  };
  const reviewWord = (id: string, status: WordReview | undefined) => {
    setData(d => {
      const wordReviews = { ...d.wordReviews };
      if (status) wordReviews[id] = status;
      else delete wordReviews[id];
      return { ...d, wordReviews };
    });
  };

  return <main className="bible-study">
    <header className="bible-hero">
      <div><p className="bible-eyebrow">{t.bibleEyebrow}</p><h1>{t.bibleTitle}</h1><p>{t.bibleIntro}</p></div>
    </header>
    {storageFailed && <p className="bible-alert" role="alert">{t.bibleStorageFailed}</p>}
    <section className="bible-progress-overview" aria-labelledby="bible-progress-heading">
      <div className="bible-progress-overview-heading"><div><h2 id="bible-progress-heading">{t.bibleProgressOverview}</h2>
        <p>{t.bibleProgressSummary(progressTotal.done, progressTotal.total)}</p></div>
        <span>{data.mode === 'story' ? t.bibleStory : t.bibleFive}</span></div>
      <div className="bible-progress-table-wrap"><table><thead><tr>
        <th scope="col">{t.bibleProgressBook}</th><th scope="col">{t.bibleProgressChapters}</th>
        <th scope="col">{t.bibleProgressDone}</th><th scope="col">{t.bibleProgressTotal}</th><th scope="col">{t.bibleProgressPercent}</th>
      </tr></thead><tbody>{progressRows.map(row => {
        const percent = row.total ? Math.round(row.done / row.total * 100) : 0;
        return <tr key={row.id} className={row.id === selectedBook ? 'is-current' : undefined}>
          <th scope="row">{row.displayName}</th><td>{row.chapters.length}</td><td>{row.done}</td><td>{row.total}</td><td>{percent}%</td>
        </tr>;
      })}</tbody></table></div>
    </section>
    <div className="bible-layout">
      <aside className="bible-sidebar">
        <h2>{t.bibleLibrary}</h2>
        <label className="bible-division">{t.bibleBookSelect}<select value={selectedBook} onChange={e => selectChapter(e.target.value, 1)}>
          {bibleBooks.map(book => <option key={book.id} value={book.id}>{t.bibleBookName(book.id, book.name)}</option>)}
        </select></label>
        <label className="bible-division">{t.bibleChapterSelect}<select value={selectedChapter} onChange={e => selectChapter(selectedBook, Number(e.target.value))}>
          {(bibleBooks.find(book => book.id === selectedBook)?.chapters ?? []).map(item => <option key={item.chapter} value={item.chapter}>{t.bibleChapter(item.chapter)}</option>)}
        </select></label>
        <label className="bible-division">{t.bibleDivision}<select value={data.mode} onChange={e => divide(e.target.value as Division)}>
          <option value="story">{t.bibleStory}</option><option value="five">{t.bibleFive}</option>
        </select></label>
        <p className="bible-progress">{t.bibleProgress(doneCount, passages.length)}</p>
        <nav aria-label={t.bibleLibrary} className="bible-passages">
          {passages.map((p, i) => <button key={p.id} aria-current={p.id === passage.id ? 'step' : undefined}
            className={p.id === passage.id ? 'is-current' : ''} onClick={() => go(p)}>
            <span className="bible-passage-index">{String(i + 1).padStart(2, '0')}</span>
            <span><strong>{passageTitle(p, data.settings.primaryLanguage, primaryPassageRange(p))}</strong><small>{passageRange(p)}
              {data.completed.includes(p.id) && <span className="bible-done"> · {t.bibleCompleted}</span>}</small></span>
          </button>)}
        </nav>
      </aside>
      <article className="bible-reader">
        <header className="bible-passage-header">
          <p>{passageRange(passage)} <span>· {t.bibleVerseCount(passage.verses.length)}</span></p>
          <h2>{passageTitle(passage, data.settings.primaryLanguage, primaryPassageRange(passage))}</h2>
          <p className="bible-original-heading">{passage.heading
            ? <><span>{t.bibleSourceHeading} · </span><span lang="zh-CN">{passage.heading.title}</span></> : t.bibleFallback}</p>
        </header>
        <nav className="bible-learning-tabs" aria-label={t.bibleLearningAreas}>
          <button aria-pressed={data.learningView === 'read'} onClick={() => switchView('read')}>{t.bibleReadTab}</button>
          <button aria-pressed={data.learningView === 'words'} onClick={() => switchView('words')}>{t.bibleWordsTab(lesson.words.length)}</button>
          <button aria-pressed={data.learningView === 'grammar'} onClick={() => switchView('grammar')}>{t.bibleGrammarTab(lesson.grammar.length)}</button>
        </nav>
        <p className="bible-meaning-note">{t.bibleMeaningNote}</p>
        <div hidden={data.learningView !== 'read'}>
          <StudySession key={`${data.mode}:${passage.id}`} passage={passage} data={data} meanings={meanings} activeChapter={activeChapter} onCursor={cursor}
            onStopReady={stopReady} onSettings={settings} onPassageComplete={continueReading}
            autoStart={autoStartChapterRef.current === selectedChapter} onAutoStartConsumed={consumeAutoStart} />
        </div>
        {data.learningView === 'words' && <VocabularyPanel key={passage.id} items={lesson.words} reviews={data.wordReviews} onReview={reviewWord} />}
        {data.learningView === 'grammar' && <GrammarPanel items={lesson.grammar} />}
        <footer className="bible-footer">
          <div className="bible-completion"><button className={completed ? 'bible-mark is-done' : 'bible-mark'}
            onClick={toggleComplete}>{completed ? t.bibleUndoComplete : t.bibleComplete}</button>
            <p>{t.bibleCompletionHint}</p></div>
          <div className="bible-navigation">
            <button disabled={passageIndex === 0} onClick={() => go(passages[passageIndex - 1])}>{t.biblePrev}</button>
            {!last && <button className="bible-primary" onClick={() => go(passages[passageIndex + 1], true)}>{t.bibleCompleteNext}</button>}
            <button disabled={last} onClick={() => go(passages[passageIndex + 1])}>{t.bibleNext}</button>
          </div>
          {last && <p className="bible-note">{t.bibleLast}</p>}
        </footer>
        <details className="bible-about"><summary>{t.bibleAbout}</summary><p>{t.bibleAboutText}</p><p>{t.biblePinyinNotice}</p>
          <div className="bible-local-source"><strong>{t.bibleLocalBibleTitle}</strong><p>{t.bibleLocalBibleDescription}</p>
            <div className="bible-version-row"><label>{t.bibleKorean}<select value={selectedVersions.ko} onChange={e => { const value = e.target.value; setSelectedVersions(v => ({ ...v, ko: value })); localStorage.setItem('tingdong.bible.versions', JSON.stringify({ ...selectedVersions, ko: value })); }}>
              <option value="default">{t.bibleDefaultVersion1910}</option>{localBibles.ko.map(item => <option key={item.translation} value={item.translation}>{item.name}</option>)}
            </select></label><button onClick={() => void importLocalBible('ko')} disabled={!window.electronAPI?.importLocalBible}>{t.bibleLocalBibleImportKo}</button></div>
            <div className="bible-version-row"><label>{t.bibleEnglish}<select value={selectedVersions.en} onChange={e => { const value = e.target.value; setSelectedVersions(v => ({ ...v, en: value })); localStorage.setItem('tingdong.bible.versions', JSON.stringify({ ...selectedVersions, en: value })); }}>
              <option value="default">{t.bibleDefaultVersionWeb}</option>{localBibles.en.map(item => <option key={item.translation} value={item.translation}>{item.name}</option>)}
            </select></label><button onClick={() => void importLocalBible('en')} disabled={!window.electronAPI?.importLocalBible}>{t.bibleLocalBibleImportEn}</button></div>
            {(selectedVersions.ko !== 'default' || selectedVersions.en !== 'default') && <p>{t.bibleLocalBibleReady([selectedKo?.name, selectedEn?.name].filter(Boolean).join(' · '))}</p>}
            {localBibleMessage && <p className="bible-alert" role="alert">{localBibleMessage}</p>}
          </div>
          <p><a href={activeChapter.source} target="_blank" rel="noreferrer">{t.bibleContentSource}</a> · <a href="https://ebible.org/kor/MRK01.htm" target="_blank" rel="noreferrer">Korean Bible 1910</a> · <a href="https://ebible.org/eng-web/MRK01.htm" target="_blank" rel="noreferrer">World English Bible Classic</a> · <a href="https://ebible.org/cmn-cu89s/copyright.htm" target="_blank" rel="noreferrer">{t.bibleLicense}</a></p>
        </details>
      </article>
    </div>
  </main>;
}
