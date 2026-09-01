import { useState, useEffect, useRef } from 'react';
import { pinyin } from 'pinyin-pro';
import {
  DEFAULT_LM_STUDIO_URL,
  STORAGE_KEYS,
  mapWithLimit,
  translateFree,
  type ApiType,
} from './lib/translate';
import './App.css';

type WordData = {
  id: string;
  chinese: string;
  pinyin: string;
  translationLiteral: string;
  isWord: boolean;
};

type SentenceData = {
  index: number;
  chinese: string;
  korean: string;
  words: WordData[];
  /** 이 문장의 번역이 실패했는가 — 실패를 숨기면 원고가 조용히 빠진다 */
  failed: boolean;
  /** 다시 시도하는 중 */
  retrying?: boolean;
};

function App() {
  const [inputText, setInputText] = useState('');
  const [isEditing, setIsEditing] = useState(true);
  const [translationMode, setTranslationMode] = useState<'literal' | 'localized'>('localized');
  const [pinyinOption, setPinyinOption] = useState<'hover' | 'always'>('hover');
  const [viewMode, setViewMode] = useState<'paragraph' | 'spaced'>('paragraph');
  const [autoWordTranslation, setAutoWordTranslation] = useState(() => localStorage.getItem('study_auto_word_trans') === 'true');
  
  const [sentencesData, setSentencesData] = useState<SentenceData[]>([]);
  const [hoveredWordId, setHoveredWordId] = useState<string | null>(null);
  const [hoveredSentenceIndex, setHoveredSentenceIndex] = useState<number | null>(null);
  const [highlightedKoreanWords, setHighlightedKoreanWords] = useState<string[]>([]);
  
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEYS.apiKey) || '');
  const [apiType, setApiType] = useState<ApiType>(() => {
    // Gemini는 무료 등급 한도(하루 20회)로는 쓸 수 없어 뺐다. 남아 있던 설정은 무료로 되돌린다.
    const saved = localStorage.getItem(STORAGE_KEYS.apiType);
    return saved === 'openai' || saved === 'lmstudio' ? saved : 'free';
  });
  const [lmStudioUrl, setLmStudioUrl] = useState(
    () => localStorage.getItem(STORAGE_KEYS.lmStudioUrl) || DEFAULT_LM_STUDIO_URL
  );
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [engineStatus, setEngineStatus] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** 설정을 저장하고 닫을 때만 다시 번역한다 — 키를 한 글자 칠 때마다 재번역하지 않기 위해 */
  const [settingsEpoch, setSettingsEpoch] = useState(0);
  /** 뒤늦게 도착한 옛 번역이 새 결과를 덮어쓰지 않게 하는 회차 번호 */
  const runIdRef = useRef(0);
  /** 마우스가 단어 위에 머무는지 재는 타이머 */
  const hoverTimer = useRef<number | null>(null);
  /** 마지막으로 붙여넣은 시각 — 타이핑인지 붙여넣기인지 가른다 */
  const pastedAtRef = useRef(0);

  // Debounced processing
  useEffect(() => {
    if (!inputText.trim()) {
      setSentencesData([]);
      return;
    }

    // 타이핑 중에는 손이 멈추길 기다리지만, 통째로 붙여넣은 글은 더 기다릴 이유가 없다.
    // (길이 비교 대신 붙여넣기 시각을 보는 이유: 개발 모드에서 effect가 두 번 도는데,
    //  길이로 재면 두 번째에 '타이핑'으로 오판한다)
    const pasted = Date.now() - pastedAtRef.current < 500;

    const delayDebounceFn = setTimeout(() => {
      processText(inputText);
    }, pasted ? 150 : 800);

    return () => clearTimeout(delayDebounceFn);
  }, [inputText, apiType, autoWordTranslation, settingsEpoch]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
    localStorage.setItem(STORAGE_KEYS.apiType, apiType);
    localStorage.setItem(STORAGE_KEYS.lmStudioUrl, lmStudioUrl);
    localStorage.setItem('study_auto_word_trans', autoWordTranslation ? 'true' : 'false');
    // ⌘⇧F 팝업은 창이 따로라 이 설정을 못 본다 — 메인 프로세스를 거쳐 넘겨준다
    window.electronAPI?.syncEngineConfig?.({ apiType, apiKey, lmStudioUrl });
  }, [apiKey, apiType, lmStudioUrl, autoWordTranslation]);

  // Helper to split text into sentences
  const splitIntoSentences = (text: string): string[] => {
    // Split by punctuation and keep the punctuation
    const parts = text.split(/([。！？!?\n]+)/);
    const sentences: string[] = [];
    let currentSentence = '';

    for (const part of parts) {
      if (!part) continue;
      if (/^[。！？!?\n]+$/.test(part)) {
        currentSentence += part;
        sentences.push(currentSentence);
        currentSentence = '';
      } else {
        currentSentence += part;
      }
    }
    if (currentSentence.trim()) {
      sentences.push(currentSentence);
    }
    return sentences.map(s => s.trim()).filter(Boolean);
  };

  const processText = async (text: string) => {
    // 뒤늦게 끝난 옛 번역이 새 결과를 덮지 않도록 회차를 매긴다
    const runId = ++runIdRef.current;
    const isStale = () => runIdRef.current !== runId;

    setIsLoading(true);
    setEngineStatus('');
    setHighlightedKoreanWords([]);
    setHoveredSentenceIndex(null);

    try {
      const hasChinese = /[\u4e00-\u9fa5]/.test(text);
      let chineseText = text;

      if (!hasChinese) {
        // 한국어/영어 → 중국어 변환 (선택된 엔진 사용)
        try {
          chineseText = await translateFree(text, 'zh-CN');
        } catch (err) {
          if (isStale()) return;
          setEngineStatus(`❌ 중국어 변환 실패: ${(err as Error)?.message ?? err}`);
          // 지난 번역이 남아 있으면 방금 넣은 원고가 그 뒤에 가려진다 — 치우고 원고를 보여준다
          setSentencesData([]);
          return;
        }
      }
      if (isStale()) return;

      // 문장 단위 분리
      const chineseSentences = splitIntoSentences(chineseText);

      // 문장 번역은 무료 엔진만 쓴다. 실측으로 한 문장 왕복이 무료는 약 240ms,
      // LLM은 몇 초였다. 번역기는 속도가 전부라 여기서 LLM을 쓸 이유가 없다.
      // (설정에서 고른 엔진은 '단어 사전' 쪽에서만 쓰인다)
      const results = await mapWithLimit(chineseSentences, 4, async (cSent, sIdx) => {
        // 단어 쪼개기는 통신이 필요 없다 — 먼저 해둔다
        const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
        const segments = Array.from(segmenter.segment(cSent)) as any[];

        // 중국어 단어들만 추출하여 번역 API 한 번에 일괄 요청 (배치 처리로 개별 호출 제거)
        const chineseWords = segments
          .map((seg) => seg.segment)
          .filter((wordStr) => /[\u4e00-\u9fa5]/.test(wordStr));

        // 단어 뜻은 문장 번역과 아무 상관이 없다. 기다렸다 보내면 두 왕복이 그대로 더해진다.
        const wordsPromise: Promise<{ [key: string]: string }> =
          autoWordTranslation && chineseWords.length > 0
            ? translateFree(chineseWords.join('\n'), 'ko').then(
                (translatedJoined) => {
                  const splitTranslations = translatedJoined.split('\n');
                  // 줄 수가 다르면 단어와 뜻이 통째로 밀린다 — 틀린 뜻을 붙이느니 비워둔다
                  if (splitTranslations.length !== chineseWords.length) {
                    console.warn(
                      `[sentence-${sIdx}] 단어 ${chineseWords.length}개에 번역 ${splitTranslations.length}줄 — 어긋나서 건너뜀`
                    );
                    return {};
                  }
                  const map: { [key: string]: string } = {};
                  chineseWords.forEach((word, idx) => {
                    map[word] = splitTranslations[idx]?.trim() || word;
                  });
                  return map;
                },
                (err) => {
                  // 여기서 단어를 하나씩 다시 쏘면 막힌 상황을 더 악화시킨다. 호버할 때 채운다.
                  console.warn(`[sentence-${sIdx}] 단어 일괄 번역 실패 (호버 시 개별 로드):`, err);
                  return {};
                },
              )
            : Promise.resolve({});

        // 문장 전체 번역 (선택된 엔진 사용)
        let kSent = '';
        let failed = false;
        try {
          kSent = await translateFree(cSent, 'ko');
        } catch (err) {
          console.warn(`[sentence-${sIdx}] 문장 번역 실패:`, err);
          failed = true;
        }

        const literalTranslations = await wordsPromise;

        const words: WordData[] = [];
        for (let wIdx = 0; wIdx < segments.length; wIdx++) {
          const seg = segments[wIdx];
          const wordStr = seg.segment;
          const isChineseWord = /[\u4e00-\u9fa5]/.test(wordStr);

          if (isChineseWord) {
            const wordPinyin = pinyin(wordStr, { toneType: 'symbol' });
            // 자동 단어 번역이 꺼져 있으면 빈 값으로 두고, 호버할 때 채운다
            const literal = literalTranslations[wordStr] || '';
            words.push({
              id: `word-${sIdx}-${wIdx}`,
              chinese: wordStr,
              pinyin: wordPinyin,
              translationLiteral: literal,
              isWord: true,
            });
          } else {
            words.push({
              id: `word-${sIdx}-${wIdx}`,
              chinese: wordStr,
              pinyin: '',
              translationLiteral: wordStr,
              isWord: false,
            });
          }
        }

        return { index: sIdx, chinese: cSent, korean: kSent, words, failed };
      });

      if (isStale()) return;

      setSentencesData(results);

      // 실패한 문장이 있으면 초록불로 덮지 않는다 — 몇 문장이 빠졌는지 알려준다
      const failedCount = results.filter((r) => r.failed).length;
      if (failedCount > 0) {
        setEngineStatus(`⚠️ ${results.length}문장 중 ${failedCount}문장 번역 실패 — 해당 자리의 '다시 시도'를 누르세요`);
      } else {
        setEngineStatus('🟢 Google 번역 (무료)');
      }

      // 아직 입력 중이면 편집창을 빼앗지 않는다 — 치던 글자가 사라진다
      if (document.activeElement !== textareaRef.current) {
        setIsEditing(false);
      }
    } catch (error) {
      if (isStale()) return;
      console.error('Error processing text:', error);
      setEngineStatus('❌ 번역 중 오류가 발생했습니다.');
      setSentencesData([]);
    } finally {
      if (runIdRef.current === runId) setIsLoading(false);
    }
  };

  /** 실패한 문장 하나만 다시 번역한다 */
  const retrySentence = async (index: number) => {
    const target = sentencesData.find((s) => s.index === index);
    if (!target) return;
    const mark = (patch: Partial<SentenceData>) =>
      setSentencesData((prev) => prev.map((s) => (s.index === index ? { ...s, ...patch } : s)));

    mark({ retrying: true });
    try {
      const kSent = await translateFree(target.chinese, 'ko');
      mark({ korean: kSent, failed: false, retrying: false });
    } catch (err) {
      console.warn(`[sentence-${index}] 재시도 실패:`, err);
      mark({ failed: true, retrying: false });
    }
  };

  const playAudio = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
  };

  const updateWordTranslation = (sentenceIdx: number, wordId: string, translation: string) => {
    setSentencesData((prev) =>
      prev.map((sData) => {
        if (sData.index !== sentenceIdx) return sData;
        return {
          ...sData,
          words: sData.words.map((w) => {
            if (w.id !== wordId) return w;
            return { ...w, translationLiteral: translation };
          }),
        };
      })
    );
  };

  /**
   * 마우스가 단어 위에 이만큼 머문 뒤에야 소리를 내고 뜻을 찾는다.
   * 스쳐 지나가는 단어마다 읽어주면 발음이 수십 개씩 쌓여 한참 뒤까지 흘러나온다.
   */
  const HOVER_SETTLE_MS = 250;

  const cancelPendingHover = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const handleWordHover = (word: WordData, sentenceIdx: number) => {
    if (!word.isWord) return;
    // 강조 표시는 바로 — 이건 공짜다
    setHoveredWordId(word.id);
    setHoveredSentenceIndex(sentenceIdx);

    cancelPendingHover();
    hoverTimer.current = window.setTimeout(() => {
      hoverTimer.current = null;
      void settleOnWord(word, sentenceIdx);
    }, HOVER_SETTLE_MS);
  };

  /** 마우스가 실제로 멈춘 단어에만 소리와 뜻을 붙인다 */
  const settleOnWord = async (word: WordData, sentenceIdx: number) => {
    playAudio(word.chinese);

    // 만약 단어 직역이 비어있거나 불러오지 못했다면 요청 시점에 동적으로 번역 데이터 로드
    let currentLiteral = word.translationLiteral;
    if (!currentLiteral || currentLiteral === '...') {
      currentLiteral = '...';
      updateWordTranslation(sentenceIdx, word.id, '...');
      try {
        const trans = await translateFree(word.chinese, 'ko');
        currentLiteral = trans;
        updateWordTranslation(sentenceIdx, word.id, trans);
      } catch (err) {
        console.error('On-demand word translation failed:', err);
        currentLiteral = word.chinese;
        updateWordTranslation(sentenceIdx, word.id, word.chinese);
      }
    }

    if (translationMode === 'localized' && currentLiteral && currentLiteral !== '...') {
      // Find matches: exact substring of translation literal (e.g. "기적" inside "기적도")
      const cleanSearch = currentLiteral.replace(/[~\[\]]/g, '').trim();
      // 한 글자('의', '은'…)로 찾으면 문장 절반이 물든다 — 두 글자부터만 강조한다
      if (cleanSearch.length >= 2) {
        setHighlightedKoreanWords([cleanSearch]);
      }
    }
  };

  const handleWordLeave = () => {
    cancelPendingHover();
    setHoveredWordId(null);
    setHoveredSentenceIndex(null);
    setHighlightedKoreanWords([]);
  };

  const handleClear = () => {
    setInputText('');
    setSentencesData([]);
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  /** 실패·대체 알림인가 — 이런 건 잘라내면 안 된다 */
  const hasProblem = engineStatus.startsWith('⚠️') || engineStatus.startsWith('❌');

  const renderKoreanTranslation = () => {
    if (sentencesData.length === 0) return <div className="placeholder-text">번역이 여기에 표시됩니다.</div>;

    if (translationMode === 'literal') {
      // Literal Mode: Word-by-word display grouped by sentences
      return (
        <div className="literal-mode-view">
          {!autoWordTranslation && (
            <div className="mode-hint">
              직역 모드는 단어별 뜻이 필요합니다.
              <button className="mode-hint-btn" onClick={() => setAutoWordTranslation(true)}>
                단어 자동 번역 켜기
              </button>
              <span> 끈 채로 보려면 왼쪽 한자에 마우스를 올리세요.</span>
            </div>
          )}
          {sentencesData.map((sData) => (
            <div 
              key={`lit-sent-${sData.index}`} 
              className={`sentence-container ${hoveredSentenceIndex === sData.index ? 'underlined' : ''}`}
              style={{ marginBottom: '1.2rem', paddingBottom: '0.4rem' }}
            >
              <div className="content-display">
                {sData.words.map((word) => (
                  word.isWord ? (
                    <div 
                      key={`trans-${word.id}`}
                      className={`translation-block ${hoveredWordId === word.id ? 'highlighted' : ''}`}
                      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '0.2rem 0.4rem' }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>{word.translationLiteral}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({word.chinese})</span>
                    </div>
                  ) : (
                    <span key={`trans-${word.id}`} style={{ alignSelf: 'flex-end', fontSize: '1.2rem', padding: '0 4px', color: 'var(--text-secondary)' }}>
                      {word.chinese}
                    </span>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    } else {
      // Localized Mode: Coherent paragraph with sentence-level underline & word-level highlight
      return (
        <div className="localized-paragraph-view">
          {sentencesData.map((sData) => {
            const isSentenceHovered = hoveredSentenceIndex === sData.index;
            const koreanWords = sData.korean.split(/\s+/);

            // 실패한 문장을 빈칸으로 두면 원고에서 조용히 빠진다
            if (sData.failed || sData.retrying) {
              return (
                <span key={`loc-sent-${sData.index}`} className="failed-sentence">
                  {sData.retrying ? (
                    <span>다시 번역 중…</span>
                  ) : (
                    <>
                      <span>⚠️ 번역 실패</span>
                      <button className="retry-btn" onClick={() => retrySentence(sData.index)}>
                        다시 시도
                      </button>
                    </>
                  )}
                  <span className="failed-source" title={sData.chinese}>{sData.chinese}</span>
                </span>
              );
            }

            return (
              <span 
                key={`loc-sent-${sData.index}`}
                className={`sentence-block ${isSentenceHovered ? 'underlined' : ''}`}
                style={{ 
                  marginRight: '6px', 
                  display: 'inline',
                  transition: 'border-color 0.2s'
                }}
              >
                {koreanWords.map((word, wIdx) => {
                  // Highlight Korean word if it contains the hovered word's literal translation (no single character stems!)
                  const isHighlighted = highlightedKoreanWords.some(hlWord => word.includes(hlWord));
                  return (
                    <span
                      key={`word-span-${sData.index}-${wIdx}`}
                      className={`translation-block ${isHighlighted ? 'highlighted' : ''}`}
                      style={{ 
                        marginRight: '4px', 
                        display: 'inline-block',
                        padding: '1px 3px',
                        borderRadius: '4px',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </span>
            );
          })}
        </div>
      );
    }
  };

  return (
    <div className={`app-container pinyin-mode-${pinyinOption} layout-mode-${viewMode}`}>
      <header className="header">
        <div className="logo-section">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#1a73e8" style={{ marginRight: '8px' }}>
            <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
          </svg>
          <h1>중국어 번역기</h1>
        </div>
        
        <div className="controls">
          <button className="settings-toggle-btn" onClick={() => setShowSettings(!showSettings)}>
            ⚙️ 설정 (Settings)
          </button>

          <div className="toggle-container layout-options-toggle">
            <button 
              className={`toggle-btn ${viewMode === 'paragraph' ? 'active' : ''}`}
              onClick={() => setViewMode('paragraph')}
              title="띄어쓰기 없이 자연스러운 문장 정렬"
            >
              문장형 (기본)
            </button>
            <button 
              className={`toggle-btn ${viewMode === 'spaced' ? 'active' : ''}`}
              onClick={() => setViewMode('spaced')}
              title="단어별로 띄어쓰기하여 명확하게 정렬"
            >
              단어형
            </button>
          </div>
          
          <div className="toggle-container pinyin-options-toggle">
            <button 
              className={`toggle-btn ${pinyinOption === 'hover' ? 'active' : ''}`}
              onClick={() => setPinyinOption('hover')}
              title="마우스를 대면 병음 노출"
            >
              호버 병음
            </button>
            <button 
              className={`toggle-btn ${pinyinOption === 'always' ? 'active' : ''}`}
              onClick={() => setPinyinOption('always')}
              title="한자 위에 항시 병음 표시"
            >
              항상 병음
            </button>
          </div>

          <div className="toggle-container">
            <button 
              className={`toggle-btn ${translationMode === 'literal' ? 'active' : ''}`}
              onClick={() => setTranslationMode('literal')}
            >
              직역 (Literal)
            </button>
            <button 
              className={`toggle-btn ${translationMode === 'localized' ? 'active' : ''}`}
              onClick={() => setTranslationMode('localized')}
            >
              현지화 (Localized)
            </button>
          </div>

          <div className="toggle-container">
            <button 
              className={`toggle-btn ${autoWordTranslation ? 'active' : ''}`}
              onClick={() => setAutoWordTranslation(!autoWordTranslation)}
              title="켬: 번역 시 모든 단어 해석 자동 로드 | 끔: 마우스 호버 시 필요한 단어만 로드"
            >
              단어 자동 번역: {autoWordTranslation ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="settings-pane">
          <h3>⚙️ 단어 사전 엔진 설정</h3>

          <div className="setting-note">
            <strong>문장 번역은 항상 Google 무료 엔진을 씁니다.</strong> 실측으로 한 문장에 약 0.24초로,
            AI 엔진(수 초)보다 훨씬 빠르고 번역 품질 차이는 크지 않기 때문입니다.
            여기서 고르는 엔진은 <strong>읽기 연습에서 단어를 짚었을 때</strong>와
            <strong> ⌘⇧F 팝업</strong>의 사전에만 쓰입니다.
          </div>

          <div className="setting-row">
            <span className="setting-label">단어 사전 엔진:</span>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label className={`engine-option ${apiType === 'free' ? 'selected' : ''}`}>
                <input type="radio" name="apiType" value="free" checked={apiType === 'free'} onChange={() => setApiType('free')} />
                <span>🌐 Google 무료</span>
                <small>키 불필요 · 한도 없음 · 기본값</small>
              </label>
              <label className={`engine-option ${apiType === 'openai' ? 'selected' : ''}`}>
                <input type="radio" name="apiType" value="openai" checked={apiType === 'openai'} onChange={() => setApiType('openai')} />
                <span>🤖 OpenAI API</span>
                <small>품사·예문까지 · API Key 필요</small>
              </label>
              <label className={`engine-option ${apiType === 'lmstudio' ? 'selected' : ''}`}>
                <input type="radio" name="apiType" value="lmstudio" checked={apiType === 'lmstudio'} onChange={() => setApiType('lmstudio')} />
                <span>🖥️ LM Studio</span>
                <small>로컬 LLM · 완전 무료</small>
              </label>
            </div>
          </div>

          <div className="setting-info-box">
            {apiType === 'free' && (
              <p>🌐 <strong>Google 무료 번역</strong>으로 단어 뜻을 찾습니다. API 키도 사용 한도도 없고 가장 빠릅니다. 품사·예문은 나오지 않지만, 읽기 연습에서는 원고의 그 문장을 용례로 함께 보여줍니다.</p>
            )}
            {apiType === 'openai' && (
              <p>🤖 단어 사전에 <strong>OpenAI GPT-4o-mini</strong>를 씁니다. 뜻과 함께 품사·예문이 나옵니다. 실패하면 무료 번역으로 뜻만 채웁니다. <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">API 키 발급 →</a></p>
            )}
            {apiType === 'lmstudio' && (
              <p>🖥️ <strong>LM Studio</strong>에서 로컬로 실행 중인 모델을 사용합니다. 인터넷 연결 불필요, 완전 무료. LM Studio에서 모델을 로드하고 <strong>Local Server를 시작</strong>해야 합니다.</p>
            )}
          </div>

          {apiType === 'openai' && (
            <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
              <label>🔑 API Key:</label>
              <input 
                type="password" 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)} 
                placeholder="sk-..."
                className="api-key-input"
              />
              {apiKey && <small style={{ color: 'var(--text-secondary)' }}>✅ API 키가 입력되어 있습니다 (로컬에만 저장)</small>}
            </div>
          )}

          {apiType === 'lmstudio' && (
            <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
              <label>🔗 LM Studio 서버 주소:</label>
              <input
                type="text"
                value={lmStudioUrl}
                onChange={(e) => setLmStudioUrl(e.target.value)}
                placeholder="http://localhost:1234"
                className="api-key-input"
              />
              <small style={{ color: 'var(--text-secondary)' }}>LM Studio → Local Server 탭에서 서버를 시작하세요. 기본 포트: 1234</small>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              className="save-btn"
              onClick={() => { setSettingsEpoch((n) => n + 1); setShowSettings(false); }}
            >저장 및 닫기</button>
            {apiType === 'openai' && apiKey && (
              <button 
                className="save-btn" 
                style={{ background: 'var(--border-color)', color: 'var(--text-primary)' }}
                onClick={() => { setApiKey(''); localStorage.removeItem('study_api_key'); }}
              >키 삭제</button>
            )}
          </div>
        </div>
      )}

      <main className="split-view">
        <section className="pane left-pane">
          <div className="pane-header">
            <span>중국어(간체) - 감지됨</span>
            {inputText && (
              <button className="clear-btn" onClick={handleClear} title="텍스트 지우기">
                ✕
              </button>
            )}
          </div>
          
          {/* 번역 결과가 없는데 편집창까지 감추면 원고가 사라진 것처럼 보인다 */}
          <div className="pane-content-wrapper" onClick={() => setIsEditing(true)}>
            {isEditing || (sentencesData.length === 0 && inputText.trim() !== '') ? (
              <textarea 
                ref={textareaRef}
                className="text-input" 
                placeholder="텍스트 입력"
                maxLength={5000}
                value={inputText}
                onPaste={() => { pastedAtRef.current = Date.now(); }}
                onChange={(e) => setInputText(e.target.value)}
                onBlur={() => {
                  if (inputText.trim() && !isLoading) {
                    setIsEditing(false);
                  }
                }}
                autoFocus
              />
            ) : (
              <div className="content-display study-mode">
                {sentencesData.length > 0 ? (
                  sentencesData.map((sData) => (
                    <span 
                      key={`sent-${sData.index}`}
                      className={`chinese-sentence-wrapper ${hoveredSentenceIndex === sData.index ? 'active' : ''}`}
                    >
                      {sData.words.map((word) => (
                        word.isWord ? (
                          <div 
                            key={word.id} 
                            className={`word-block ${hoveredWordId === word.id ? 'highlighted' : ''}`}
                            onMouseEnter={() => handleWordHover(word, sData.index)}
                            onMouseLeave={handleWordLeave}
                          >
                            <span className="pinyin">{word.pinyin}</span>
                            <span className="chinese">{word.chinese}</span>
                          </div>
                        ) : (
                          <span key={word.id} className="punctuation-block">
                            {word.chinese}
                          </span>
                        )
                      ))}
                    </span>
                  ))
                ) : (
                  <div className="placeholder-text">텍스트 입력</div>
                )}
              </div>
            )}
          </div>
          
          <div className="pane-footer">
            <span>{inputText.length} / 5000</span>
            {!isEditing && inputText && (
              <span className="study-hint">💡 본문을 클릭하면 다시 수정할 수 있습니다.</span>
            )}
          </div>
        </section>

        <section className="pane right-pane">
          <div className="pane-header">
            <span>한국어</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {engineStatus && !isLoading && !hasProblem && (
                <span className="engine-status-badge">{engineStatus}</span>
              )}
              {isLoading && <span className="loading-indicator">번역 중...</span>}
            </div>
          </div>

          {/* 문제가 생겼을 때는 알약 배지에 우겨넣지 않는다 — 잘리면 정작 사유를 못 읽는다 */}
          {engineStatus && !isLoading && hasProblem && (
            <div className="engine-status-line">{engineStatus}</div>
          )}

          <div className="pane-content-wrapper">
            {renderKoreanTranslation()}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
