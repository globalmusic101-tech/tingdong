# 03-Architecture — 중국어 원고 프롬프터

> **v2 (파서 제거로 축소).** 이전 판은 커밋 `cef9684`.
> 상위: [[appbuild-plan]] · 짝: `01-prd.md`

---

## 1. 스택

기존 `chinese-app`(Vite + React 18 + TS + Electron)에 **모드 하나를 추가한다.** 새 프로젝트 없음.

| 층 | 선택 | 이유 |
|---|---|---|
| 앱 셸 | 기존 Electron 31 + `electron-packager` | 맥 패키징이 이미 있다 |
| UI | React 18 + TS + Vite 5 | 그대로 |
| 병음 | `pinyin-pro` (설치됨) | 다음자 문맥 처리 |
| TTS(주) | Edge TTS — npm `msedge-tts` 후보 | 무료·키 불필요·SSML 스타일 지원. **설치 시 실사용 검증 필요** |
| TTS(폴백) | Web Speech API | 오프라인·차단 시. 기존 코드 재사용 |
| 저장 | `localStorage`(설정·원고·위치) | **IndexedDB 불필요해짐** — 아래 참조 |
| 백엔드 | 없음 | 전부 로컬 |

### 파일 구조

**v3에서 실제 코드에 맞춰 고쳤다.** v2의 트리는 만들기 전에 그린 것이라, 결국 만들지 않은
파일(`SentenceLine.tsx`·`SettingsPanel.tsx`·`pinyinLine.ts`)이 남아 있고 실제로 만든
파일(`MenuBar.tsx`·`wordLookup.ts`·`readDocx.ts`…)이 빠져 있었다.

```
src/
  main.tsx
  AppShell.tsx           'translate' | 'prompter' + 언어 토글 (F11-1)
  App.tsx                번역기 (S1)
  lib/
    translate.ts         번역·사전 엔진 한 벌 (번역기·팝업 공용)
    i18n.ts              ← v3 신규. 문자열표·UiLang (React 없음)
    i18nContext.tsx      ← v3 신규. LangProvider·useLang()
    matchHighlight.ts    ← v3 신규. 교차 하이라이트 매칭 (순수 · 테스트 대상)
  popup/
    popup.ts             ⌘⇧F 팝업 (S3, React 미사용 별도 엔트리)
  prompter/
    PrompterApp.tsx      모드 루트 (S2)
    ScriptInput.tsx      F1 (S2a)
    PrompterView.tsx     F3/F8 + 단어 카드
    MenuBar.tsx          F6/F7/F8/F9 (v2의 SettingsPanel 자리)
    lib/
      splitSentences.ts  F2  (순수 함수 · 테스트 대상)
      extractChinese.ts  readMode 필터
      readDocx.ts        .docx 읽기
      wordChunks.ts      단어 분절
      wordLookup.ts      단어 뜻 조회 + 세션 캐시
      tts/
        types.ts         TtsEngine 인터페이스
        edgeTts.ts       IPC 클라이언트
        webSpeech.ts     폴백
        voiceMap.ts      F6 매핑표
        audioCache.ts    캐시 + 프리페치
        pace.ts          실제 낭독 속도 (테스트 대상)
    hooks/
      usePrompter.ts     커서·재생 상태 머신
      useHotkeys.ts      F5
main.js                  Electron 메인 — 창·트레이·TTS 브리지
preload.cjs              window.tts 노출
popup.html               S3 문서
```

**Electron IPC가 필요한 이유**: Edge TTS는 WebSocket으로 MS 엔드포인트에 붙는다. 렌더러에서
직접 붙이면 CSP에 걸리므로 **main 프로세스에서 합성해 오디오 버퍼를 렌더러로 넘긴다.**

```
renderer --invoke('tts:synth', {text, voice, style, rate, pitch})--> main
main     --ArrayBuffer(mp3)--------------------------------------> renderer
renderer --> Blob URL --> <audio>
```

---

## 2. 데이터 모델

서버 DB 없음. 저장은 `localStorage` 하나로 끝난다.

> **v1 대비 단순해진 점**: 프롬프터 안에서 문장을 편집하지 않기로 하면서 `Sentence`가
> **다시 파생 데이터로 돌아왔다.** 저장하는 건 원고 문자열뿐이고 문장 배열은 매번 재계산한다.
> 덕분에 문장 id·origin 추적, undo 스택, IndexedDB 스키마가 전부 사라졌다.

### 번역기 모델 (S1 · 파생 · 저장 안 함) — v3에서 문서화

v2까지 이 문서는 프롬프터만 다뤄 번역기 쪽 모델이 통째로 빠져 있었다. 02-screens가
참조하는 이름들이라 여기 적는다. 전부 화면 상태이고 저장되지 않는다.

| 타입 | 필드 | 비고 |
|---|---|---|
| `WordData` | `id` `chinese` `pinyin` `translationLiteral` `isWord` | `isWord=false`는 구두점 |
| `SentenceData` | `index` `chinese` `translated` `words[]` `failed` `retrying?` | **v3에서 `korean` → `translated`로 개명** — 영어판에서 필드 이름이 거짓말을 하게 된다 |
| 화면 상태 | `highlightedWords: string[]` | 교차 하이라이트 대상. v3에서 `highlightedKoreanWords`에서 개명 |
| 화면 상태 | `engineStatus: string` | 상태 배지 문구 |

### Sentence (프롬프터 · 파생 · 저장 안 함)
| 필드 | 타입 | 설명 |
|---|---|---|
| `index` | number | 0부터 |
| `text` | string | 문장 |
| `pinyin` | string \| null | 지연 계산 + 메모 |

### 저장되는 것 (`localStorage`)
| 키 | 내용 |
|---|---|
| `prompter.scripts` | 최근 원고 5개 `{id, title, text, lastIndex, updatedAt}[]` |
| `prompter.currentId` | 마지막으로 보던 원고 |
| `prompter.settings` | 아래 |

### Settings
| 필드 | 기본값 |
|---|---|
| `engine` `'edge' \| 'local'` | `'edge'` |
| `gender` `'male' \| 'female'` | `'female'` |
| `tone` `'lecture' \| 'sermon' \| 'news' \| 'chat'` | `'lecture'` |
| `rate` 0.5–1.5 | `1.0` |
| `pitch` -10–10 (%) | `0` |
| `showPinyin` / `pinyinTone` / `pinyinOnContext` | `false` / `'symbol'` / `false` |
| `autoAdvance` / `gapMs` | `false` / `800` |
| `contextBefore` / `contextAfter` | `2` / `3` |
| `fontSize` | `44` |
| `splitLongSentences` / `maxChars` | `false` / `45` |
| `egressConsent` | `false` (F10) |

### 오디오 캐시 (메모리 전용, `Map`)
키 `text|voiceId|style|rate|pitch` → Blob. LRU 50개. **디스크에 저장하지 않는다** —
연습 한 세션 안에서만 의미가 있고, 원고가 디스크에 오디오로 남는 것도 피한다.

---

## 3. 음성·톤 매핑 (F6) — **실측 확정 (2026-08-30)**

무료 Edge 엔드포인트를 직접 두드려 확인한 결과:

| SSML 요소 | 결과 |
|---|---|
| `rate` (속도) | ✅ 적용됨 |
| `pitch` (음높이) | ✅ 적용됨 (길이는 그대로라 md5로 확인) |
| 음성 선택 | ✅ zh-CN 6종 |
| `mstts:express-as` (스타일/톤) | ❌ **요청 자체가 거부됨** — 서버가 turn.end 없이 연결을 끊는다 |
| `<break>` (호흡 삽입) | ❌ **거부됨** (time·strength 모두) |
| 음성 목록의 `StyleList` | ❌ 필드 자체가 없다 |

> 계획했던 "StyleList를 받아와 지원 스타일만 쓴다"는 성립하지 않는다. 무료 엔드포인트는
> 스타일을 무시하는 게 아니라 **거부**한다. 따라서 톤은 음성 인물 + rate/pitch로만 만든다.

### 쓸 수 있는 음성 (VoiceTag 성격은 서버가 준 값)

| 음성 | 성별 | 분야 | 성격 |
|---|---|---|---|
| `XiaoxiaoNeural` | 여 | News, Novel | Warm |
| `XiaoyiNeural` | 여 | Cartoon, Novel | Lively |
| `YunyangNeural` | 남 | News | Professional, Reliable |
| `YunjianNeural` | 남 | Sports, Novel | Passion |
| `YunxiNeural` | 남 | Novel | Lively, Sunshine |
| `YunxiaNeural` | 남 | Cartoon | Cute |

### 확정된 톤 프리셋 (`lib/tts/voiceMap.ts`)

| 성별 | 톤 | 음성 | rate | pitch |
|---|---|---|---|---|
| 남 | 강의 | 云扬 (뉴스·신뢰감) | -4% | 0 |
| 남 | 설교 | 云健 (열정적) | -14% | -6% |
| 남 | 뉴스 | 云扬 | +4% | 0 |
| 남 | 대화 | 云希 (밝음) | 0 | 0 |
| 여 | 강의 | 晓晓 (따뜻함) | -4% | 0 |
| 여 | 설교 | 晓晓 | -14% | -6% |
| 여 | 뉴스 | 晓晓 | +4% | 0 |
| 여 | 대화 | 晓伊 (발랄함) | 0 | 0 |

사용자 배속은 이 값에 더해진다 (`toRateString`). 실측 합성 시간은 문장당 **650~800ms**라
프리페치(다음 2문장)로 가려진다. 설교 프리셋은 같은 문장이 강의 대비 약 30% 길게 나온다.

**진짜 스타일 태그가 필요하면** Azure Speech 키로 엔진을 갈아끼운다. `TtsEngine` 경계가
`electron/ttsBridge.js` 하나이므로 교체 범위는 그 파일과 `voiceMap.ts`에 갇힌다.

폴백(내장 음성) 모드에서는 톤을 rate/pitch로만 근사하고 그 사실을 UI에 표시한다.

---

## 4. 재생 상태 머신

```
idle ──setScript──> ready ──goto(i)──> loading ──audio ready──> playing
                                          │                        │
                                          └──cache hit─────────────┘
playing ──ended──> (autoAdvance ? goto(i+1) : paused)
playing ──goto(j)/Enter/Esc──> (기존 audio 즉시 abort) ──> loading
```

**동시성**: 재생 요청마다 `requestId`를 증가시키고, 응답이 왔을 때 `requestId !== currentId`면
버린다. 화살표 연타 시 음성이 겹치는 걸 여기서 막는다.

**프리페치**: `goto(i)` 때 `i+1`, `i+2`를 백그라운드로 미리 합성해 캐시에 넣는다.
F4의 "0.5초 이내"를 지탱하는 장치.

---

## 5. 개발 순서

### Phase 0 — 기반 + 문장 분할 (0.5일)
모드 스위치, `prompter/` 골격, `splitSentences.ts`(순수 함수·테스트 먼저), 붙여넣기 화면.
**데모**: 중국어를 붙여넣으면 번호 붙은 문장 목록이 뜬다. 무음.

### Phase 1 — 프롬프터 뷰 + 키보드 (1일)
F3 + F5. 여전히 무음.
**데모**: 화살표로 넘기면 텍스트가 위로 밀려 올라가고 현재 문장이 크게 보인다.

### Phase 2 — 소리 (1.5일) ★ 여기서 쓸모가 생긴다
Electron IPC 브리지 + Edge TTS + **내장 음성 폴백을 같은 단계에서** + 남/여 + 속도(F7).
**데모**: 화살표를 누르면 그 문장을 읽어준다. Enter로 반복. 네트워크를 끊어도 폴백으로 계속 읽는다.
→ **2.5일차에 실사용 가능.** 여기서 며칠 실제로 연습해 보고 나머지 순서를 조정한다.

### Phase 3 — 톤 + 반응 속도 (0.5~1일)
음성 목록 실측 → 톤 매핑 확정(F6) → 캐시 + 프리페치 → 자동 진행.
**데모**: 강의톤/설교톤이 귀로 구분되고 문장 전환이 끊기지 않는다.

### Phase 4 — 병음 + 설정 유지 (0.5일)
F8 + F9 + F10 동의/오프라인 스위치.

### Phase 5 — 마감 (0.5일)
전체화면, 글자 크기, 진행률, 최근 원고, `npm run app:build` 패키징.

**합계 약 4일치.** (파서 포함 v1은 6일이었다.)

---

## 8. 화면 언어 (F11 · v3 · 2026-09-02)

### 왜 문자열 파일 하나인가

문구가 컴포넌트마다 흩어져 있으면 "영어판에 한글이 남았다"를 사람 눈으로만 잡을 수 있다.
한 파일에 모으고 **영어를 원본 타입으로** 두면, 한쪽에만 있는 키는 `tsc`가 잡는다.
i18n 라이브러리는 넣지 않는다 — 두 언어, 한 화면 묶음에 런타임 의존성을 더할 이유가 없다.

```
src/lib/
  i18n.ts          UiLang · 문자열 표(en 원본 / ko) · loadUiLang · targetLangFor
                   ← React 없음. 팝업(popup.ts)이 같이 쓴다
  i18nContext.tsx  LangProvider · useLang()  ← React 트리용
  matchHighlight.ts 교차 하이라이트 매칭 (언어별 순수 함수 · 테스트 대상)
```

**두 파일로 나누는 이유**: ⌘⇧F 팝업은 React를 쓰지 않는 별도 엔트리다. 문자열표가
`.tsx`에 있으면 팝업 번들에 React가 딸려 들어간다.

### 데이터 흐름

```
UiLang ('ko' | 'en')
  ├→ stringsFor(lang)      → 화면 문구
  └→ targetLangFor(lang)   → translateFree(text, target) 의 타깃
                            → 교차 하이라이트 규칙 선택
```

언어는 `LangProvider` 컨텍스트로 두 화면에 함께 내려간다. 번역 재실행은 언어를
입력으로 걸어(effect 의존성) 언어가 바뀌면 화면의 번역이 새 언어로 다시 만들어진다.

### 저장

| 키 | 내용 | 기본값 |
|---|---|---|
| `study_ui_lang` | `'ko' \| 'en'` | 없으면 `navigator.language`가 `ko`로 시작하면 `ko`, 아니면 `en` |

기존 설정 키(`prompter.settings`·`study_api_type` 등)는 **건드리지 않는다.** 언어는
따로 사는 키라 `SETTINGS_VERSION`을 올릴 이유가 없다 — 올리면 사람들의 프롬프터 설정이
초기화된다(F11-5).

### 교차 하이라이트 매칭 (F11-3)

| 언어 | 규칙 | 이유 |
|---|---|---|
| `ko` | 2글자 이상, 부분 문자열 포함 | 조사가 붙는다 — `기적`이 `기적도`에 걸려야 한다 |
| `en` | 낱말 단위, 대소문자·구두점 무시, 3글자 이상, 불용어 제외 | 영어는 조사가 없어 부분 문자열이 필요 없고, 쓰면 `on`이 `only`에 걸린다 |

길이 3 미만은 이미 걸러지므로(`a` `of` `to` `in` `is` 등은 자동 제외) 목록에는 **3글자
이상인 기능어만** 넣는다. 확정 목록 — 테스트가 이 목록을 그대로 쓴다:

```
the  and  for  that  this  with  from  are  was  were  has  have  had
you  your  they  them  their  its  but  not  all  any  can  will  would
```

목록을 늘리는 기준: 실제로 문장 절반이 물드는 것을 본 낱말만 추가한다. 짐작으로 늘리면
정작 강조돼야 할 낱말이 조용히 빠진다.

### 언어를 바꿨을 때 (경합)

번역 요청은 왕복이 있고, 언어 전환은 그 사이에도 일어난다. 세 곳을 막는다.

| 곳 | 처리 |
|---|---|
| 문장 번역 (S1) | 이미 있는 회차 카운터 `runIdRef`를 언어 전환에도 올린다. 옛 회차의 응답은 도착해도 버린다 |
| 단어 뜻 캐시 (S2b `wordLookup.ts`) | 캐시 키에 언어를 넣는다. 언어별로 따로 산다 — 안 그러면 바꾼 뒤에도 옛 언어 뜻이 나온다 |
| 화면에 있는 번역 | 언어를 번역 재실행 effect의 의존성으로 건다. 바꾸는 즉시 새 언어로 다시 만든다 |

### Electron 껍데기

창 제목·트레이 메뉴는 렌더러 밖(`main.js`)이라 컨텍스트가 닿지 않는다. main 프로세스가
`app.getLocale()`로 자기 문자열을 고른다. 렌더러에서 언어를 바꿔도 트레이 문구는
다음 실행에 반영된다 — 트레이는 앱 이름 수준의 문구뿐이라 이 지연을 감수한다.

---

## 6. 테스트

| 대상 | 방법 |
|---|---|
| `splitSentences` | 단위 테스트. PRD F2 수용 기준의 각 예시 |
| 상태 머신 | 화살표 연타 시 음성 겹침 없음 |
| 톤 차이 | 사람이 듣고 판정 (자동화 불가) |
| 폴백 | 네트워크 차단 상태로 실행 |
| 문자열표 완결성 | `tsc` — `Strings` 타입이 두 표를 맞춘다 (F11-4) |
| 교차 하이라이트 | 단위 테스트. 언어별 규칙 + 기능어가 안 걸리는 것 (F11-3) |
| 영어판 한글 잔존 | 게이트에서 두 화면 전수 확인 (F11-4) |

## 7. 열린 질문

1. 설교문처럼 문장이 길 때 쉼표 분할을 기본으로 켤까 → Phase 1 실측 후 결정.
2. `Space`를 "재생/정지"로 뒀는데, 실사용에서 "다음 문장"이 더 자연스러우면 바꾼다 → Phase 2 후 결정.


---
# F12 — 성경 단락과 반복 학습 구조 (2026-10-22)
- src/bible/: 데이터, 단락 분할 순수 함수, 검증된 로컬 저장, 재생 컨트롤러, BibleStudy.tsx와 CSS.
- 원문 JSON: 판본 ID, 책 ID, 장, 절 번호, text. headings: 시작 절/끝 절/학습 제목 키/중국어 원제.
- 단락 ID는 판본+책+장+시작절+끝절. 제목/언어/배열 위치로 저장하지 않는다.
- 문장 ID는 절 번호+절 내 순번. splitSentences를 절마다 적용하고 verse 번호를 유지한다.
- partition: 정렬/범위/겹침을 검증한 headings 사용; 커버되지 않은 구간을 5절로 분할한다.
  유효하지 않은 headings는 명시적 오류. 본문 목록의 절 번호 연속성·빈 본문을 검증한다.
- mode=five는 각 장을 5절로 나눈다. 모드 변경 시 현재 절을 포함하는 단락으로 이동하고 정지한다.
- controller는 SentencePlayer를 어댑터로 사용. repeat/sequence 상태와 반복 횟수, 타이머를 한곳에 둔다.
  stop은 모든 대기와 현재 재생을 취소한다. SentencePlayer.requestId로 늦은 합성 응답을 버린다.
- 기존 player/webSpeech에 선택적 onError를 추가한다. 기기 음성 오류를 ended로 삼키지 않고 정지/오류를 보고한다.
  중국어 음성이 없으면 실패를 알린다. 기존 usePrompter도 오류가 fallback 안내에 보이도록 연결한다.
- 새 저장 키 tingdong.bible.v1. schema 검증 후 기본값 병합, 부분 손상 복구. 저장 실패 반환을 UI에서 안내.
  기존 prompter.* 키는 수정하지 않는다. 새 화면은 기존 설정의 암묵적 음소거를 물려받지 않는다.
- 학습 제목/문구는 i18n.ts, 중국어 원문/소제목은 콘텐츠 JSON. UI 언어 전환은 본문·진도에 영향 없음.
- 원문은 번들 내 보관, 렌더링에 네트워크 불필요. Edge 엔진 선택 시만 기존 IPC/TTS 호출.
- 브라우저는 기기 음성만 제공. 앱은 Edge+기기 음성 선택. TTS 캐시는 기존 세션 메모리 정책 유지.
- 새 런타임 패키지 없이 구현한다. 원본 HTML은 docs/sources 아래 보존하고 JSON 추출과 원문 대조를 수행한다.


---
# F13 — 로컬 양언어 학습 데이터
src/bible/lessons.ts: Bilingual {ko,en}, 45절 meanings, VocabularyItem[], GrammarItem[].
단어 id=판본:책:장:verse:word. 용례는 본문 실제 부분 문자열로 검증.
문법 항목은 anchor verse와 quote, pattern, breakdown(중국어 구성), explanation(ko/en),
practice(중국어)와 practiceMeaning(ko/en). lessonFor(passage)는 anchor verse가 범위 안인 항목만 반환.
학습 데이터는 UI 문자열과 구분하되 버튼/설명용 UI는 i18n.ts 한 곳. 학습용 한국어 데이터가
English에서 보이는 것은 사용자 명시 요청. 검사기는 UI와 en 표의 한글 검사를 그대로 유지하고
새 UI 파일 포함. 콘텐츠는 별도 테스트로 ko/en 존재·45절 커버리지·본문 인용/범위 정확성 검증.
StudyData 확장: settings.meanings=true, learningView='read'|'words'|'grammar',
wordReviews: Record<validWordId,'known'|'again'>. 기존 version=1 구조에 선택 필드 기본값 병합으로 이행.
StudySession은 영역이 바뀌어도 마운트를 유지하여 문장 위치 보존. read는 hidden으로 숨기고,
전환 handler에서 stopRef를 동기 호출. 새 자료 패널과 본문 뜻은 공유 BilingualMeaning UI 사용.
카드 숨김 상태는 지역 UI 상태, 기억/다시 상태만 저장. 새로 열면 뜻은 표시하고 기억 상태 복원.

---
# F14 — 공식 온라인 음성 아키텍처
현재 `TtsEngine` 경계에 `google-cloud` 어댑터를 추가합니다. 인증/토큰/HTTP는 Electron main에서만 수행하고
렌더러는 검증된 오디오 바이트·상태만 IPC로 받습니다. Cloud REST `text.synthesize`에는 OAuth access token이
필요하므로 API 키와 서비스 계정 JSON을 배포물에 넣지 않습니다. Desktop OAuth client ID는 public client 식별자이며
비밀값이 아닙니다. 앱 설정에서 Desktop client ID와 quota project ID를 입력받습니다. 프로젝트 관리자는 Cloud TTS API를
활성화하고 결제를 연결해야 하며, 사용자에게 `serviceusage.services.use`가 필요합니다. REST 호출마다
`x-goog-user-project`에 quota project를 지정합니다. OAuth 성공/프로젝트 준비/합성 테스트를 별도 상태로 둡니다.
시스템 브라우저를 열어 `http://127.0.0.1:<ephemeral-port>`에만 바인딩하고, PKCE S256 + 일회성 state,
일회 callback, 제한시간, 취소 및 재진입 금지를 적용합니다. IPC sender와 인자/음성 ID/텍스트 길이를 main에서 검증.
Refresh token은 `safeStorage`로 암호화하여 userData 아래 저장합니다. backend가 `basic_text` 또는 `plaintext`이거나
복호화가 실패하면 평문 저장으로 내려가지 않고 Cloud 사용을 중지합니다. 해제는 디스크 암호문 삭제와 로컬 연결정보
삭제이며, 사용자 동작 없이 프로젝트 전체 승인 폐기 endpoint를 호출하지 않습니다. 서명 없는 패키지 업데이트 뒤
Keychain 재승인이 필요할 수 있으므로 실제 앱 수용 기준에서 확인합니다.
음성 인벤토리는 Google voices:list 응답 기반으로 갱신하며, Mandarin cmn-CN/`cmn-Hans-CN`과 cmn-TW만
보여줍니다. 모델 선택(Standard/WaveNet/Chirp 3 HD), 성별, voice name, languageCode를 voice 목록과 일치 검증.
voices:list 자체는 pitch/rate 지원을 알려주지 않습니다. Standard/WaveNet는 해당 모델 문서·실합성으로 pitch/rate를
검증합니다. Chirp 3 HD SSML/prosody는 Preview이므로 별도 표시하고 pitch/rate 효과가 실합성에서 확인된 때만 제공합니다.
Google 합성 성공 오디오는 userData/audio-cache에 해시 기반 키로 원자 저장, 용량 제한 LRU. 캐시 key에 원문 해시·voice·모델·
언어·rate·pitch·format·schema 버전을 포함합니다. 원문 텍스트는 파일명/로그/사용량 원장에 저장하지 않습니다.
캐시 재생은 네트워크·문자량 계수에서 제외. 연결 해제/동의 철회는 신규 요청만 막고 캐시는 별도 삭제 전까지 로컬 재생 가능.
삭제 generation을 증가시켜 삭제와 겹친 늦은 응답이 캐시를 되살리지 않게 합니다.
사용량 원장은 main 프로세스에서 직렬화·원자 교체하며, UTC 월별 800,000자 기본 설치본 상한을 두고 전송 직전 예약합니다.
동일 진행 중 cache key 요청은 합칩니다. 샘플·재시도 요청도 계수, timeout/전송 뒤 실패는 과금 여부 불명으로 예약 유지,
프리페치는 비활성. 로컬 상한은 이 앱 설치의 신규 전송만 제한하며 Google 프로젝트 총비용을 보장하지 않습니다.
원장 손상 시 fail-closed. 사용자가 명시적으로 원장을 초기화하면 해당 앱 제한을 다시 시작하나 Cloud billing 사용량을
초기화하지 않음을 명시합니다. 요청 타임아웃·취소는 AbortSignal로 묶고 현재 request ID/삭제 generation으로 늦은 응답 폐기.
Google 오류, OAuth 취소, 토큰 만료, 네트워크/쿼터/상한에서 `onError`; 자동 `webSpeech` 호출은 하지 않습니다.
기존 Edge 실패 차단 유지. 사용자가 기기 음성 엔진을 직접 선택한 때에만 `webSpeech` 실행.
개인용 배포 기준. 공개 다중 사용자 배포 전 OAuth consent verification/각 사용자 프로젝트의 인증·요금·개인정보 검토 필수.
# Edge recovery maintenance
Compare installed msedge-tts 2.0.7 against 2.1.0. Use upstream transport fixes, no node_modules patch or browser credential extraction. Verify through the application's IPC handler with Mandarin female/male and prosody samples; decode MP3. Preserve validation and cancellation.
호환 어댑터 보완: 공개 edge-tts 7.3.1의 drm.py v2 생성 알고리즘을 별도 JS 파일로 이식하고
원본 버전·출처·LGPL 고지/라이선스를 함께 보존합니다. msedge-tts의 getSynthUrl을 명시적 어댑터에서
재정의해 해당 상위 구현의 endpoint와 버전 매개변수를 사용합니다. node_modules 직접 변경은 없습니다.
시간 인자를 주입할 수 있도록 하여 고정 시각 및 300초 경계의 결과를 Python 원본과 비교합니다.
JS 32비트 연산·곱셈 오버플로 및 FILETIME 정밀도를 검증합니다. 허용 호스트를 고정하며, 기존 인자 검증과
연결/합성 timeout을 유지합니다. 429에 대한 반복 재시도로 한도를 회피하지 않습니다.

---
# F15 architecture — Google 실험 경로 제거

- `PrompterSettings.engine`과 `StudySettings.engine`은 `'edge' | 'local'`만 허용합니다.
- 읽기 연습은 설정 스키마 버전을 올리되, 현행 v3를 기본값 초기화 전에 별도 migration으로 읽습니다.
  v3의 `engine === 'google'`만 `edge`로 바꾸고 다른 설정을 병합·검증해 보존합니다.
- 성경 StudyData는 version 1을 유지하며 validator에서 `google`만 `edge`로 정규화합니다.
- `googleTtsBridge`, preload `googleTts`, renderer Google 어댑터와 player 분기를 제거합니다.
- Google 자격 증명 파일은 더 이상 읽거나 쓰지 않지만 자동 삭제하지 않습니다.
- Edge IPC/v2 호환 어댑터와 사용자가 선택하는 기기 음성 경로는 유지합니다.

---

# F17 architecture — 개인 로컬 번역문

- `src/bible/localSource.ts`가 새한글성경 JSON의 version 1, `saehangul-2025`, Mark 1, 정확히 45절을 검증하고 영어 기존 뜻과 로컬 한국어 절을 합칩니다.
- `main.js`의 파일 선택 IPC만 원본 경로를 읽고 앱 전용 userData/private-bible에 저장합니다. preload는 검증 결과만 renderer에 전달하며 본문을 네트워크 요청하지 않습니다.
- 파일이 없거나 검증에 실패하면 기본 한국어 성경 1910을 사용합니다. 저장소와 패키징 입력에는 본문 파일을 만들지 않습니다.

## F18 architecture — 다중 로컬 판본과 BDB 변환

- main IPC는 사용자가 선택한 `.bdb`를 macOS SQLite 실행 파일로 읽어 Mark 1의 45절만 추출하고, 언어·판본명·절을 JSON으로 userData 언어별 폴더에 저장합니다. 원본 경로와 본문은 renderer나 네트워크로 보내지 않습니다.
- renderer는 언어별 로컬 판본 목록과 선택값을 별도로 보관하고, 선택 파일이 없으면 정적 기본 뜻으로 merge합니다.
- `gapMs = 0`은 연속 읽기이며 storage validator와 playback timer가 허용합니다.

## F19 architecture — 자동 진행 스크롤

`StudySession`은 playback index가 바뀔 때 현재 문장 버튼을 찾아 `scrollIntoView({ block: 'center' })`로 표시합니다. 데이터가 없는 장을 임의로 생성하지 않고, 장 확장은 출처가 확인된 원문과 병렬 뜻 데이터가 함께 들어올 때만 추가합니다.

# F16 architecture — 번역문 소스와 반복 진행

- `src/bible/lessons.ts`의 `verseMeanings`는 앱 번역 결과가 아니라 고정된 기존 번역문 데이터입니다.
  `ko`는 eBible `kor`(Korean Bible 1910), `en`은 `eng-web`(World English Bible Classic)으로
  절 번호를 키로 맞춥니다. 소스 URL·판본명은 별도 상수와 About 화면에서 추적할 수 있게 합니다.
- 본문 뜻 데이터는 로컬 번들이므로 성경 읽기 화면 렌더링을 위해 번역 엔진이나 네트워크를 호출하지 않습니다.
  단어·문법 해설은 별도의 작성 학습 데이터로 유지하며 뜻 데이터의 출처와 섞지 않습니다.
- `StudySettings.repeats`의 유한 값은 `1 | 3 | 5`, 무한 값은 `0`입니다. 저장 validator도 이 집합만 허용합니다.
- `StudyPlayback`의 repeat 모드는 유한 횟수를 채우면 같은 모드를 유지한 채 다음 문장으로 index를 이동하고 count를 0부터 다시 셉니다.
  마지막 문장에서는 `stop()`으로 종료합니다. 무한 반복은 현재 문장에 남습니다. generation으로 정지·선택·언마운트 뒤의 대기 타이머를 무효화합니다.

## F20 architecture — 66권 데이터 카탈로그

`src/bible/bible-full.json`은 eBible Public Domain CUV 간체·한국어 성경 1910·WEB Classic의 책·장·절 병렬 데이터입니다. `bibleBooks`와 `chapterFor`가 책·장 선택을 제공하고, 기존 `partition`과 `StudyPlayback`을 재사용합니다. 학습 자료는 기존 마가복음 1장 데이터만 범위 필터로 표시합니다.

## F21 architecture — 음성 요청 타임아웃과 세대 검사

## F22 architecture — 성경 음성 설정과 책별 제목 fallback

`StudySettings`는 공통 `Gender`·`Tone`으로 성별과 말투를 저장합니다. 성경 낭독은 읽기 연습과 같은 `VOICE_MAP`을 사용하며, 제목 fallback은 고정된 마가복음 문구가 아니라 현재 `Passage`의 책·장·절 범위를 사용합니다.

## F23 architecture — 공개 USFM 문맥 카탈로그

`scripts/import-context-headings.py`가 공개 CUV USFM의 `\s1` 소제목과 `\v` 절을 읽어 `src/bible/context-headings.json`을 생성합니다. `chapterFor`는 책·장에 맞는 headings를 주입하고 `partition(..., 'story')`는 이 범위를 검증해 문맥 단락을 만듭니다. 소제목이 없는 장은 장 전체 범위의 기본 heading 하나를 사용하며, 원문 절은 새로 만들거나 수정하지 않습니다.

## F24 architecture — 로컬 판본 범위 보호

`LocalBible`은 현재 마가복음 1장 전용이므로 `BibleStudy`는 선택 책이 `MRK`이고 장이 `1`일 때만 `mergeLocalBibles`에 로컬 판본을 전달합니다. 다른 책·장에서는 `meaningsFor(book, chapter)`의 기본 병렬 뜻을 그대로 사용합니다.

## F25 architecture — 음성 프리페치와 0초 전환

`StudyPlayback`은 다음으로 넘어갈 수 있는 문장의 텍스트를 선택해 `AudioPort.prefetch`에 전달합니다. `SentencePlayer`는 Edge 합성 promise를 문장·음성·배속·음높이 키로 보관하고, 실제 재생에서 같은 promise를 소비합니다. `gapMs=0`이면 `setTimeout`을 거치지 않고 다음 문장을 즉시 요청하며, 프리페치 실패 시 `synthEdge`의 기존 경로가 처리합니다.

`synthEdge` 는 renderer 내에도 응답 타임아웃을 두어 IPC가 끝나지 않을 때 폴백으로 진입합니다. 기기 `SpeechSynthesis` 는 `speak()` 호출이 큐에 들어간 즉시 시작 상태를 알리고, `onstart`가 오지 않아도 준비 상태에 고정되지 않게 하며, 이후 오류 이벤트는 그대로 오류로 처리합니다. `requestId`와 최신 요청 검사로 늦은 응답은 현재 문장에 적용하지 않습니다.

`BibleStudy`의 `chapterFor` 및 `partition` 결과는 책·장·분할 모드에 맞춰 메모화합니다. `StudySession`의 낭독 컨트롤러는 `lines`가 바뀔 때 재생성되므로, 커서 저장으로 인한 부모 렌더에서 `lines` 참조가 바뀌면 진행 중인 음성이 취소됩니다. 이 참조 안정성을 유지하고 단락이 실제로 바뀔 때만 기존 컨트롤러를 정리합니다.

## F26 architecture — 학습 카드 음성

`LearningPanels`는 학습 영역당 하나의 `SentencePlayer`를 만들고, 카드의 중국어 텍스트를 `play(text, DEFAULT_SETTINGS)`로 전달합니다. 버튼은 카드별로 노출하지만 재생기는 공유하여 새 버튼을 누르면 이전 오디오와 기기 음성을 취소합니다. 학습 카드에는 성별·말투 상태를 만들지 않으며, 읽기 낭독 설정과도 분리합니다.

## F27 architecture — 전권 진도 집계

`passagesForAllBooks(mode)`가 66권·전체 장을 현재 분할 방식으로 변환해 진도 표의 행을 만듭니다. `StudyData.completed`의 단락 ID를 이 전권 목록으로 검증하므로 마가복음 1장 밖에서 완료한 기록도 저장·복원됩니다. 표는 `data.completed`와 `data.mode`를 기준으로 메모화합니다.

## F28 architecture — 언어별 책 이름

책 ID를 기준으로 `i18n.ts`의 영어 책 이름 표를 조회합니다. `BibleStudy`는 책 선택 목록·진도 표·현재 범위에 같은 `bibleBookName` 함수를 사용하고, 한국어 UI에서는 원본 책 이름을 유지합니다.

## F29 architecture — 준비된 오디오 재사용

`SentencePlayer.prefetch`는 Edge 합성 promise가 완료되면 별도의 `Audio` 객체를 만들고 `preload=auto`, `load()`를 호출합니다. `play`는 같은 문장·음성 설정 키의 준비된 객체를 소비하고, 요청 ID 검사로 늦은 준비 결과를 무시합니다. 기기 음성은 OS 엔진이 관리하므로 이 최적화의 대상이 아닙니다.

## F30 architecture — 저장된 단락에서 선택 복원

`StudyData.passageId`의 `version:book:chapter:start-end` 구조에서 책 ID와 장 번호를 읽어 `BibleStudy`의 초기 `selectedBook`·`selectedChapter`를 정합니다. 책·장 검증에 실패하면 `MRK`·`1`로 되돌립니다. 별도 저장 키를 추가하지 않아 기존 저장 데이터와 호환합니다.

## F31 architecture — 로마서 문맥 카탈로그 검증

`context-headings.json`의 `ROM` 항목을 `chapterFor('ROM', chapter)`가 주입하고, 기존 `partition(..., 'story')`가 소제목 시작 절부터 다음 소제목 직전까지 단락을 만듭니다. 로마서 회귀 테스트는 16장 전체의 절 중복·누락과 대표 장의 경계를 확인합니다.

## F34 architecture — 언어별 heading과 안전한 fallback

`Heading`은 `title` 중국어 원문과 선택적 `titleKo`, `titleEn`을 함께 가질 수 있습니다. `headingTitle(heading, language, range)`가 주 본문 언어에 맞는 제목을 고르고, 번역 제목이 없으면 이미 UI 언어로 만들어진 책·장·절 범위를 반환합니다. 원문 `title`은 본문 제목에 직접 사용하지 않고 출처 소제목에만 표시합니다.

## F35 architecture — 연속 장 전환

`StudyPlayback`은 현재 단락의 마지막 문장을 성공적으로 끝냈을 때만 `onComplete`를 호출합니다. `BibleStudy`는 이 콜백을 `gapMs === 0`인 경우에만 처리해 현재 책의 다음 장 첫 단락으로 `passageId`와 책·장 선택을 바꾸고, 새 `StudySession`에 자동 시작 신호를 전달합니다. 사용자가 정지하거나 다른 문장을 선택한 경우에는 generation 검사로 장 전환을 무효화합니다.

## F32 architecture — 책별 학습 자료 필터

`lessonFor(passage, bookId)`가 기존 마가복음 자료와 로마서 자료를 책 ID로 분리한 뒤 절 범위로 필터합니다. 로마서 자료는 `bible-full.json`의 ROM 절을 기준으로 핵심 어휘·문법 정의가 실제 원문에 등장하는 경우에만 카드로 생성합니다. `validWordIds`에는 두 책의 단어 복습 ID를 포함합니다.

## F33 architecture — 주 본문 언어와 보조 언어

`StudySettings.primaryLanguage`는 `zh | ko | en` 중 하나를 저장하고, `secondaryLanguages`는 같은 세 언어의 목록에서 주 본문을 제외한 선택 목록을 저장합니다. `BibleStudy`는 현재 단락의 절 번호를 기준으로 중국어 원문과 선택된 한국어·영어 판본을 같은 절에 매칭해 렌더링합니다. 기존 로컬 판본은 현재 지원 범위인 마가복음 1장에서만 해당 언어의 본문을 덮어쓰며, 파일이 없으면 기본 병렬 본문을 사용합니다.

성경 낭독은 `SentencePlayer`에 언어별 음성 설정을 전달하고 Edge 음성은 중국어·한국어·영어 voice map을 사용합니다. 기기 음성도 선택 언어의 locale을 전달하며, 중국어 주 본문일 때만 병음을 계산합니다. 기존 저장 데이터에는 중국어 주 본문과 한국어·영어 표시를 기본값으로 보충해 호환합니다.

## F36 architecture — 본문 표시 설정

`StudySettings.fontSize`는 `small | medium | large | xlarge`를 저장하고 `StudySession`의 CSS 변수로 주 본문 문장에 적용합니다. 기존 `primaryLanguage`와 `secondaryLanguages`는 유지하며, 상단 진도 집계 UI만 제거합니다. 로컬 한국어·영어 판본 상태와 본문 선택은 기존 저장·merge 경로를 재사용합니다.

## F37 architecture — 낭독 속도 범위

`StudySettings.rate`는 기존 선택값을 포함해 0.5부터 3까지 검증합니다. `BibleStudy`는 선택 속도를 온라인 Edge 합성과 기기 음성에 전달하며, Edge SSML 속도 변환의 상한도 3×에 맞춰 `+200%`까지 허용합니다. 기존 저장 데이터와 지원되지 않는 값은 기존 기본값으로 복구합니다.

## F38 architecture — RNKSV 이야기 단락 카탈로그

`context-headings.json`은 RNKSV 공개 페이지의 장별 소제목 시작 절을 `titleKo`로 저장하고, 다음 시작 절 직전까지를 단락 범위로 계산합니다. 기존 중국어 `title`은 유지하며, RNKSV에 명시적 소제목이 없는 42개 장은 기존 경계를 보존해 `headingTitle`의 범위 fallback을 사용합니다.

## F39 architecture — Edge 고속 음성 검증

`electron/ttsBridge.js`는 rate를 `-50%`부터 `+200%`까지 허용하고 pitch는 기존 `-50%`부터 `+50%` 범위를 유지합니다. renderer의 `toRateString`이 만드는 `+100%`·`+200%` 요청도 검증을 통과하며, `SentencePlayer`의 fallback은 Edge 요청 실패 시 선택 언어 locale을 그대로 사용합니다.

## F40 architecture — 읽기 연습 시작 인덱스

`PrompterApp`은 시작 버튼에 전달된 caret이 없을 때 저장된 `prompter.lastIndex`를 사용하지 않고 `0`을 `usePrompter`의 `goto`에 전달합니다. caret이 있으면 기존 `indexAtSource`로 해당 문장을 계산합니다. 시작점 결정은 `startPosition.ts`의 순수 함수로 분리해 저장 위치가 마지막 문장인 경우를 회귀 테스트합니다.

## F41 architecture — 붙여넣기 caret 구분

`ScriptInput`은 `onChange`와 `onPaste`에서 직접 위치 선택 플래그를 해제하고, 브라우저가 붙여넣기·입력 후 발생시키는 `select`/키보드 이벤트는 선택 위치로 기록하지 않습니다. `onClick`으로 실제 textarea 위치를 누른 경우에만 `startIndexFor`에 caret을 전달합니다.

## F42 architecture — 소제목 코드 fallback

`headingTitle`은 중국어 소제목이 `BOOK 1:1` 형태의 내부 코드인지 검사합니다. 코드 형식이면 선택한 언어의 정상 제목을 만들 수 없으므로 호출자가 넘긴 책·장·절 범위를 반환하고, `titleKo`·`titleEn` 또는 정상 중국어 제목은 기존 우선순위를 유지합니다.

## F43 architecture — 병음 선택·복사 분리

중국어 본문의 병음은 ruby의 `rt`로 렌더링하되 `user-select: none`과 `pointer-events: none`을 적용합니다. 본문 버튼의 copy 이벤트에서도 선택 fragment의 `rt` 노드를 제거한 뒤 text/plain을 기록해 Chromium의 ruby 선택 동작과 관계없이 중국어 원문만 복사합니다.

## F44 architecture — 언어별 책 이름 fallback

`BibleStudy`는 `primaryLanguage`가 중국어일 때 `chineseBibleBookNames`를 사용해 제목·범위 fallback을 만들고, 한국어·영어일 때는 기존 언어별 책 이름을 사용합니다. 따라서 내부 코드가 제거된 단락도 주변 중국어 소제목과 같은 언어로 표시됩니다.

## F45 architecture — 웹 Speech Synthesis 음성 선택

웹 환경에서만 `speechSynthesis.getVoices()`를 읽고 `voiceschanged`를 구독해 음성 목록의 비동기 준비와 갱신을 반영합니다. 초기 빈 목록은 준비 중으로 두되 3초 후 목록 없음 상태로 전환하고, 재시도 버튼은 목록을 다시 확인합니다. 이벤트나 재시도에서 음성이 나중에 도착하면 상태를 갱신합니다. 태그 비교는 소문자 및 밑줄을 정규화합니다. 중국어는 `cmn`, 일반 `zh`, `zh-CN/SG/TW`, `zh-Hans*`, `zh-Hant*`를 허용하고 `yue*` 및 `zh-HK`는 제외합니다. 한국어·영어는 `ko-*`와 `en-*`를 각각 허용합니다. `localService === true`만 표시하며 `false`나 누락값은 제외합니다.

선택 URI는 성경 설정에 `deviceVoiceByLanguage` 맵으로 저장합니다. 본문 언어별로 선택을 보존하고, 재방문 시 해당 언어의 현재 음성 목록에서 URI가 정확히 하나로 확인되는 경우만 복원합니다. 같은 URI가 중복되거나 목록에서 사라지면 그 언어 값을 지우고 선택 필요 상태를 보입니다. 키보드 접근 가능한 `<select>`와 `aria-live` 상태로 대기·오류를 알립니다. 실제 목록이 도착하지 않은 브라우저에서 무한 대기하지 않습니다.

`speakLocal`은 선택 음성 URI를 옵션으로 받아 브라우저 utterance에 지정합니다. Electron의 native speech bridge는 이 옵션을 사용하지 않으며 기존 locale 기반 동작을 유지합니다. 기기 음성 선택이 웹 브라우저에만 노출되므로 선택값을 바탕으로 Electron의 기존 Edge/기기 fallback 설정을 바꾸지 않습니다. 선택·저장은 본문 언어별로 처리합니다. `speechSynthesis.cancel()`은 기존 플레이어의 전환·정지 경로를 사용해 동시 발화를 막습니다. `localService === true`는 브라우저가 보고한 분류로만 취급하며, 문장 처리가 로컬에만 머문다고 보장하지 않습니다. 실제 네트워크 동작은 브라우저별로 별도 검증합니다.
# 웹 공개판 구조 초안 (2026-11-12)

웹 빌드는 번역 탭·팝업·단어 조회와 현재/다음 문장 자동 번역 요청을 제외합니다. 원고는 저장하지 않고 현재 화면의 메모리에만 유지합니다. 진도·설정은 브라우저에 보관하며 원고가 번역 서비스에 전송되지 않도록 네트워크 검사로 확인합니다. 외부 요청은 같은 사이트 정적 자산과 확인된 글꼴 요청으로 한정해 검증하며 기기 음성의 처리 방식은 기기별로 확인되지 않은 경우 단정하지 않습니다. 손상 데이터는 사용자 확인 없이 변경하지 않습니다.

웹 전용 빌드에서 데스크톱 번역 경로와 단어 조회 진입점을 제거합니다. 기존 탭 설정의 접근과 브라우저 네트워크 요청을 확인합니다. 사용자 원고·진도·설정의 저장과 전송 범위, 외부 글꼴 및 브라우저 음성의 실제 요청을 점검합니다. 배포 산출물에 비밀키와 개인 판본을 포함하지 않습니다. 우선 /tingdong/ 경로를 대상으로 설계하며 서버 라우팅은 배포 전 확인합니다. 기존 Electron 빌드도 회귀 확인합니다.

Vite 정적 빌드를 사이트 경로에서 서비스합니다. 브라우저 음성과 로컬 저장을 사용하고, 배포 경로와 기존 Electron 빌드의 호환성을 확인합니다. 번역 요청과 API 키의 공개 범위는 공개 전에 별도로 설계합니다.

## F46 웹 Edge 전송
브라우저는 같은 출처 POST API에 문장·검증된 음성·속도·높이를 전송하고 MP3를 받는다. 기존 Electron 합성 코드와 호환 토큰을 재사용한다. 서버는 입력 및 크기 제한, XML 이스케이프, 시간 제한과 응답 크기 제한을 적용하고 원문을 로그에 남기지 않는다. 브라우저 캐시는 기존 음성·속도·높이·문장 키를 사용한다. 취소 후 늦은 응답은 재생하지 않는다. 서버리스 인스턴스 제한은 전체 사용량 제한으로 주장하지 않는다. 공개 호출 권한과 Vercel 실제 성공은 별도 미확인이다.
서버 요청은 텍스트 1~2000 UTF-16 코드 단위, 현재 voiceMap에 등록된 음성 ID만 허용한다. rate -50~200%, pitch -50~50%를 정수로 검증한다. timeout과 빈 응답·초과 응답은 실패로 처리한다.

## F47 웹 방문 분석

Vercel 웹에서만 공식 Web Analytics를 실행하고 Electron 및 개발 환경을 제외한다. beforeSend에서 이벤트 URL의 query와 hash를 제거한다. 사용자 입력과 본문을 이벤트에 포함하지 않는다. 분석 로딩 실패는 앱 실행을 막지 않는다.
