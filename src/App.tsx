import { useState, useEffect, useRef } from 'react';
import { pinyin } from 'pinyin-pro';
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
  
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('study_api_key') || '');
  const [apiType, setApiType] = useState<'gemini' | 'openai' | 'free' | 'lmstudio'>(() => 
    (localStorage.getItem('study_api_type') as 'gemini' | 'openai' | 'free' | 'lmstudio') || 'free'
  );
  const [lmStudioUrl, setLmStudioUrl] = useState(() => localStorage.getItem('study_lmstudio_url') || 'http://localhost:1234');
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [engineStatus, setEngineStatus] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── 번역 엔진 1: Google Translate 비공식 무료 API ──
  const translateFree = async (text: string, targetLang: string = 'ko'): Promise<string> => {
    if (!text.trim()) return '';
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );
    if (!response.ok) throw new Error(`Google Free API HTTP ${response.status}`);
    const data = await response.json();
    return data[0].map((item: any) => item[0]).join('');
  };

  // ── 번역 엔진 2: Gemini API ──
  const translateGemini = async (text: string, targetLang: string = 'ko'): Promise<string> => {
    if (!text.trim()) return '';
    if (!apiKey) throw new Error('Gemini API Key가 없습니다.');
    const langName = targetLang === 'ko' ? '한국어' : targetLang === 'zh-CN' ? '중국어(간체)' : targetLang;
    const prompt = `다음 텍스트를 ${langName}로 번역해줘. 번역 결과만 출력하고 설명은 하지 마:
${text}`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 }
        })
      }
    );
    if (!response.ok) throw new Error(`Gemini API HTTP ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  };

  // ── 번역 엔진 3: OpenAI API ──
  const translateOpenAI = async (text: string, targetLang: string = 'ko'): Promise<string> => {
    if (!text.trim()) return '';
    if (!apiKey) throw new Error('OpenAI API Key가 없습니다.');
    const langName = targetLang === 'ko' ? '한국어' : targetLang === 'zh-CN' ? '중국어(간체)' : targetLang;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are a professional translator. Translate the user's text to ${langName}. Output only the translation, no explanations.` },
          { role: 'user', content: text }
        ],
        temperature: 0.1
      })
    });
    if (!response.ok) throw new Error(`OpenAI API HTTP ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  };

  // ── 번역 엔진 4: LM Studio (로컬 LLM, OpenAI 호환) ──
  const translateLMStudio = async (text: string, targetLang: string = 'ko'): Promise<string> => {
    if (!text.trim()) return '';
    const langName = targetLang === 'ko' ? '한국어' : targetLang === 'zh-CN' ? '중국어(간체)' : targetLang;
    const response = await fetch(`${lmStudioUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local-model',  // LM Studio는 현재 로드된 모델을 자동 사용
        messages: [
          { role: 'system', content: `You are a professional translator. Translate the user's text to ${langName}. Output only the translation, no explanations.` },
          { role: 'user', content: text }
        ],
        temperature: 0.1
      })
    });
    if (!response.ok) throw new Error(`LM Studio HTTP ${response.status} — 모델이 로드되어 있는지 확인하세요.`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  };

  // ── 통합 번역 함수: 선택된 엔진으로 번역, 실패 시 Free로 폴백 ──
  const translate = async (text: string, targetLang: string = 'ko'): Promise<string> => {
    if (!text.trim()) return '';
    try {
      if (apiType === 'gemini') {
        const result = await translateGemini(text, targetLang);
        setEngineStatus('🟢 Gemini API');
        return result;
      } else if (apiType === 'openai') {
        const result = await translateOpenAI(text, targetLang);
        setEngineStatus('🟢 OpenAI API');
        return result;
      } else if (apiType === 'lmstudio') {
        const result = await translateLMStudio(text, targetLang);
        setEngineStatus('🟢 LM Studio (로컬)');
        return result;
      } else {
        const result = await translateFree(text, targetLang);
        setEngineStatus('🟢 Google 번역 (무료)');
        return result;
      }
    } catch (err: any) {
      console.warn(`[${apiType}] 번역 실패: ${err.message}`);
      const engineLabel = apiType === 'gemini' ? 'Gemini' : apiType === 'openai' ? 'OpenAI' : 'LM Studio';
      if (apiType !== 'free') {
        try {
          console.log('→ Google 무료 번역으로 폴백 시도');
          const result = await translateFree(text, targetLang);
          setEngineStatus(`⚠️ ${engineLabel} 실패 → Google 무료로 대체`);
          return result;
        } catch (fallbackErr: any) {
          setEngineStatus(`❌ 번역 실패: ${fallbackErr.message}`);
          return '';
        }
      }
      setEngineStatus(`❌ Google 번역 실패: ${err.message}`);
      return '';
    }
  };

  // Debounced processing
  useEffect(() => {
    if (!inputText.trim()) {
      setSentencesData([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      processText(inputText);
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [inputText, apiType, apiKey, autoWordTranslation]);

  useEffect(() => {
    localStorage.setItem('study_api_key', apiKey);
    localStorage.setItem('study_api_type', apiType);
    localStorage.setItem('study_lmstudio_url', lmStudioUrl);
    localStorage.setItem('study_auto_word_trans', autoWordTranslation ? 'true' : 'false');
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
    setIsLoading(true);
    setEngineStatus('');
    setHighlightedKoreanWords([]);
    setHoveredSentenceIndex(null);

    try {
      const hasChinese = /[\u4e00-\u9fa5]/.test(text);
      let chineseText = text;

      if (!hasChinese) {
        // 한국어/영어 → 중국어 변환 (선택된 엔진 사용)
        chineseText = await translate(text, 'zh-CN');
      }

      // 문장 단위 분리
      const chineseSentences = splitIntoSentences(chineseText);

      // 모든 문장 처리를 병렬(Promise.all)로 실행하여 번역 속도 대폭 향상
      const tempSentencesData = await Promise.all(
        chineseSentences.map(async (cSent, sIdx) => {
          // 문장 전체 번역 (선택된 엔진 사용)
          const kSent = await translate(cSent, 'ko');

          // 단어 단위 분리
          const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
          const segments = Array.from(segmenter.segment(cSent)) as any[];

          // 중국어 단어들만 추출하여 번역 API 한 번에 일괄 요청 (배치 처리로 개별 호출 제거)
          const chineseWords = segments
            .map((seg) => seg.segment)
            .filter((wordStr) => /[\u4e00-\u9fa5]/.test(wordStr));

          const literalTranslations: { [key: string]: string } = {};

          if (autoWordTranslation && chineseWords.length > 0) {
            try {
              // 단어들을 개행(\n)으로 묶어서 한 번에 구글 무료 번역 요청
              const joinedWords = chineseWords.join('\n');
              const translatedJoined = await translateFree(joinedWords, 'ko');
              const splitTranslations = translatedJoined.split('\n');

              chineseWords.forEach((word, idx) => {
                literalTranslations[word] = splitTranslations[idx]?.trim() || word;
              });
            } catch (err) {
              console.warn(`[sentence-${sIdx}] 일괄 단어 번역 실패, 병렬 개별 번역 폴백:`, err);
              // 폴백: 일괄 번역 실패 시 개별 단어들을 병렬로 번역 진행
              await Promise.all(
                chineseWords.map(async (word) => {
                  try {
                    const trans = await translateFree(word, 'ko');
                    literalTranslations[word] = trans;
                  } catch {
                    literalTranslations[word] = word;
                  }
                })
              );
            }
          }

          const words: WordData[] = [];
          for (let wIdx = 0; wIdx < segments.length; wIdx++) {
            const seg = segments[wIdx];
            const wordStr = seg.segment;
            const isChineseWord = /[\u4e00-\u9fa5]/.test(wordStr);

            if (isChineseWord) {
              const wordPinyin = pinyin(wordStr, { toneType: 'symbol' });
              // 자동 단어 번역이 꺼져 있으면 빈 값이나 대기 상태(...)로 둠
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

          return {
            index: sIdx,
            chinese: cSent,
            korean: kSent,
            words,
          };
        })
      );

      // 병렬 완료 후 인덱스 순서대로 정렬
      tempSentencesData.sort((a, b) => a.index - b.index);

      setSentencesData(tempSentencesData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error processing text:', error);
      setEngineStatus('❌ 번역 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
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

  const handleWordHover = async (word: WordData, sentenceIdx: number) => {
    if (!word.isWord) return;
    setHoveredWordId(word.id);
    setHoveredSentenceIndex(sentenceIdx);
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
      if (cleanSearch && cleanSearch.length > 0) {
        setHighlightedKoreanWords([cleanSearch]);
      }
    }
  };

  const handleWordLeave = () => {
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

  const renderKoreanTranslation = () => {
    if (sentencesData.length === 0) return <div className="placeholder-text">번역이 여기에 표시됩니다.</div>;

    if (translationMode === 'literal') {
      // Literal Mode: Word-by-word display grouped by sentences
      return (
        <div className="literal-mode-view">
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
          <h1>Google 번역 <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>+ 학(Xué)</span></h1>
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
          <h3>⚙️ 번역 엔진 설정</h3>

          <div className="setting-row">
            <span className="setting-label">번역 엔진 선택:</span>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label className={`engine-option ${apiType === 'free' ? 'selected' : ''}`}>
                <input type="radio" name="apiType" value="free" checked={apiType === 'free'} onChange={() => setApiType('free')} />
                <span>🌐 Google 무료</span>
                <small>API 키 불필요 · 기본값</small>
              </label>
              <label className={`engine-option ${apiType === 'gemini' ? 'selected' : ''}`}>
                <input type="radio" name="apiType" value="gemini" checked={apiType === 'gemini'} onChange={() => setApiType('gemini')} />
                <span>✨ Gemini API</span>
                <small>고품질 · API Key 필요</small>
              </label>
              <label className={`engine-option ${apiType === 'openai' ? 'selected' : ''}`}>
                <input type="radio" name="apiType" value="openai" checked={apiType === 'openai'} onChange={() => setApiType('openai')} />
                <span>🤖 OpenAI API</span>
                <small>GPT-4o-mini · API Key 필요</small>
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
              <p>🌐 <strong>Google 무료 번역기</strong>를 사용합니다. API 키가 필요 없으며, 과도한 요청 시 일시적으로 차단될 수 있습니다. 막히면 Gemini나 OpenAI로 전환하세요.</p>
            )}
            {apiType === 'gemini' && (
              <p>✨ <strong>Gemini API</strong>를 사용합니다. 실패 시 자동으로 Google 무료 번역으로 폴백됩니다. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">API 키 발급 →</a></p>
            )}
            {apiType === 'openai' && (
              <p>🤖 <strong>OpenAI GPT-4o-mini</strong>를 사용합니다. 실패 시 자동으로 Google 무료 번역으로 폴백됩니다. <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">API 키 발급 →</a></p>
            )}
            {apiType === 'lmstudio' && (
              <p>🖥️ <strong>LM Studio</strong>에서 로컬로 실행 중인 모델을 사용합니다. 인터넷 연결 불필요, 완전 무료. LM Studio에서 모델을 로드하고 <strong>Local Server를 시작</strong>해야 합니다.</p>
            )}
          </div>

          {(apiType === 'gemini' || apiType === 'openai') && (
            <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
              <label>🔑 API Key:</label>
              <input 
                type="password" 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)} 
                placeholder={apiType === 'gemini' ? 'AIza...' : 'sk-...'}
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
            <button className="save-btn" onClick={() => setShowSettings(false)}>저장 및 닫기</button>
            {(apiType === 'gemini' || apiType === 'openai') && apiKey && (
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
          
          <div className="pane-content-wrapper" onClick={() => setIsEditing(true)}>
            {isEditing ? (
              <textarea 
                ref={textareaRef}
                className="text-input" 
                placeholder="텍스트 입력"
                value={inputText}
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
              {engineStatus && !isLoading && (
                <span className="engine-status-badge">{engineStatus}</span>
              )}
              {isLoading && <span className="loading-indicator">번역 중...</span>}
            </div>
          </div>
          <div className="pane-content-wrapper">
            {renderKoreanTranslation()}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
