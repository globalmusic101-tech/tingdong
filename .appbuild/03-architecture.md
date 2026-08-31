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

`App.tsx`(713줄, 번역기)는 건드리지 않는다. 최상단에 모드 스위치만 둔다.

```
src/
  main.tsx
  AppShell.tsx           ← 신규. 'translate' | 'prompter'
  App.tsx                ← 기존 번역기. 그대로
  prompter/
    PrompterApp.tsx      모드 루트
    ScriptInput.tsx      F1
    PrompterView.tsx     F3
    SentenceLine.tsx     F3/F8
    SettingsPanel.tsx    F6/F7/F8/F9
    lib/
      splitSentences.ts  F2  (순수 함수 · 테스트 대상)
      pinyinLine.ts      F8
      tts/
        types.ts         TtsEngine 인터페이스
        edgeTts.ts       IPC 클라이언트
        webSpeech.ts     폴백
        voiceMap.ts      F6 매핑표
        audioCache.ts    캐시 + 프리페치
    hooks/
      usePrompter.ts     커서·재생 상태 머신
      useHotkeys.ts      F5
electron/
  ttsBridge.cjs          ← 신규. main에서 Edge TTS 호출
preload.cjs              ← window.tts 노출
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

### Sentence (파생 · 저장 안 함)
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

## 6. 테스트

| 대상 | 방법 |
|---|---|
| `splitSentences` | 단위 테스트. PRD F2 수용 기준의 각 예시 |
| 상태 머신 | 화살표 연타 시 음성 겹침 없음 |
| 톤 차이 | 사람이 듣고 판정 (자동화 불가) |
| 폴백 | 네트워크 차단 상태로 실행 |

## 7. 열린 질문

1. 설교문처럼 문장이 길 때 쉼표 분할을 기본으로 켤까 → Phase 1 실측 후 결정.
2. `Space`를 "재생/정지"로 뒀는데, 실사용에서 "다음 문장"이 더 자연스러우면 바꾼다 → Phase 2 후 결정.
