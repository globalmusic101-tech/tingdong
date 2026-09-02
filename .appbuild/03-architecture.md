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
