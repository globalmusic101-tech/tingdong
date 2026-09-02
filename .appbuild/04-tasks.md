# 04-Tasks — 띵동 영어권 배포판 (F11)

> 2026-09-02 · 상위: [[appbuild-tasks]] · 앞: `02-screens.md` → 다음: `05-gate.md`
>
> F1~F10은 이미 구현·배포되어 있다. 이 목록은 **F11 증분만** 다룬다.

## 슬라이스 원칙

수평(문자열 파일 먼저, 화면은 나중)으로 자르면 중간 어느 지점에서도 "영어로 써볼 수
있는 앱"이 없다. 그래서 **화면 하나씩 끝까지** 영어가 되게 자른다 — T2가 끝나면
번역기 화면은 영어로 완결이고, T3이 안 끝나도 그 화면은 팔 수 있다.

예외는 T1뿐이다. 언어 하나를 고르고 내려보내는 배선은 어느 화면도 혼자 못 만든다.

---

## T1 — 언어 스위치가 켜진다 (기반)

**무엇**: 언어를 고르고, 저장되고, 화면에 내려간다. 이 단계에서 실제로 바뀌는 문구는
탭 두 개와 언어 토글 자신뿐이다.

**산출**
- `src/lib/i18n.ts` — `UiLang` · `loadUiLang`/`saveUiLang` · `targetLangFor` · 문자열표(en 원본 / ko)
- `src/lib/i18nContext.tsx` — `LangProvider` · `useLang()`
- `src/AppShell.tsx` — 탭 줄에 언어 토글, 트리를 Provider로 감쌈
- `src/main.tsx` — Provider 장착

**수용 기준**
- [ ] 토글을 누르면 탭 이름이 `번역기/읽기 연습` ↔ `Translate/Read aloud`로 즉시 바뀐다.
- [ ] 껐다 켜도 고른 언어가 남는다.
- [ ] `localStorage`를 비우고 처음 켜면 기기 언어를 따른다.
- [ ] 문자열표에 한쪽에만 있는 키가 있으면 `npx tsc -b`가 실패한다.

**의존**: 없음. **크기**: 중.

---

## T2 — 번역기 화면이 영어로 끝까지 돈다

**무엇**: S1의 모든 문구 + 번역 타깃 + 교차 하이라이트.

**산출**
- `src/lib/matchHighlight.ts` + 단위 테스트 (03-architecture §8의 불용어 목록을 그대로)
- `src/App.tsx` — 문구 교체, `translateFree(..., targetLangFor(lang))`, 언어를 번역 재실행
  입력으로, **회차 카운터를 언어 전환에도 올려** 옛 언어 응답을 버림
- `src/App.tsx` 개명 — `SentenceData.korean` → `translated`,
  `highlightedKoreanWords` → `highlightedWords`, `renderKoreanTranslation` → `renderTranslation`
- `src/lib/translate.ts` — `translateFree` 기본 타깃 제거, `langName()`에 영어 추가,
  `engineLabel()` 언어별, 사전 프롬프트의 타깃 언어 매개변수화,
  `LookupResult.exampleKorean` → `exampleTranslation`

**수용 기준**
- [ ] `English`에서 `我爱你`를 넣으면 영어 문장 번역이 나온다.
- [ ] 언어를 바꾸면 화면의 번역이 새 언어로 다시 만들어진다(옛 결과 잔존 0).
- [ ] 영어에서 한자에 마우스를 올리면 오른쪽의 대응 낱말만 강조된다 — 관사·전치사는 안 걸린다.
- [ ] 한국어에서 `기적` → `기적도`가 여전히 걸린다(회귀).
- [ ] 설정 창을 열어 세 엔진 안내문까지 영어다.
- [ ] 실패 3종(문장 실패·전체 실패·중국어 변환 실패) 문구가 영어다.

**의존**: T1. **크기**: 대.

---

## T3 — 읽기 연습이 영어로 끝까지 돈다

**무엇**: S2a + S2b의 모든 문구 + 단어 카드 뜻의 언어.

**산출**
- `src/prompter/ScriptInput.tsx` — 제목·설명·카운트·읽기 모드·버튼·오류 4종
- `src/prompter/PrompterApp.tsx` — 진행 줄·배너 2종·단축키 힌트
- `src/prompter/MenuBar.tsx` — 메뉴 8개의 라벨·현재값·선택지·설명
- `src/prompter/PrompterView.tsx` — 단어 카드 5형태
- `src/prompter/lib/tts/voiceMap.ts` — `TONE_LABELS`를 언어별로
- `src/prompter/lib/wordLookup.ts` — 조회 타깃 언어 전달 + **캐시 키에 언어 포함**

**수용 기준**
- [ ] 메뉴 8개를 모두 열었을 때 한글이 없다.
- [ ] 파일 오류 4종을 각각 일으켜 영어 문구를 확인한다.
- [ ] `English`에서 단어 카드의 뜻이 영어로 나온다.
- [ ] 한국어로 되돌리면 v2 문구가 그대로다.
- [ ] 저장돼 있던 프롬프터 설정이 초기화되지 않는다.

**의존**: T1. **크기**: 대.

---

## T4 — 팝업과 앱 껍데기가 영어가 된다

**무엇**: 렌더러 트리 밖의 나머지 — ⌘⇧F 팝업, Electron 창 제목·트레이·메뉴.

**산출**
- `popup.html` · `src/popup/popup.ts` — 4상태 문구, `loadUiLang()` 직접 사용
- `main.js` — `app.getLocale()`로 창 제목·트레이 문구 선택
- `index.html` — 문서 제목

**수용 기준**
- [ ] 영어로 두고 ⌘⇧F 팝업을 열면 안내·버튼·결과·실패 문구가 영어다.
- [ ] 영어 로케일 기기에서 트레이 메뉴가 영어다.
- [ ] 한국어 로케일에서는 한국어 그대로다.

**의존**: T1. **크기**: 소.

---

## T5 — 게이트 통과 확인

**무엇**: `05-gate.md`의 항목을 실제로 돌려 증거를 남긴다.

**산출**: 빌드·테스트 결과, 두 언어 화면 전수 확인 기록.

**수용 기준**
- [ ] `npm test` 통과 · `npm run build` 통과.
- [ ] 05-gate의 전 항목에 증거가 붙는다.

**의존**: T2·T3·T4. **크기**: 중.

---

## 순서와 의존

```
T1 ──┬── T2 ──┐
     ├── T3 ──┼── T5
     └── T4 ──┘
```

T2·T3·T4는 T1만 끝나면 서로 독립이다. 순서대로 하되, 각각이 끝난 시점에 그 화면은
완결이어야 한다.

## 매핑 (RTM)

| 기능 | 화면 | 작업 |
|---|---|---|
| F11-1 언어 전환 | 공통 | T1 |
| F11-2 번역 타깃 | S1 · S2b · S3 | T2 · T3 · T4 |
| F11-3 교차 하이라이트 | S1 | T2 |
| F11-4 한국어 0 | 전 화면 | T2 · T3 · T4 (확인: T5) |
| F11-5 회귀 없음 | 전 화면 | T2 · T3 (확인: T5) |
