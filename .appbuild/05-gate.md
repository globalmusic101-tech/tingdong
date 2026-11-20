# F14 GATE — 공식 Google Cloud 중국어 음성

## F49 웹 개인 성경 파일 게이트
독립 감독관 기획 PASS. IndexedDB는 개인 계정이 아닌 출처·브라우저 프로필별 저장이다. 온라인 음성 및 기존 번역·사전 경로에서의 명시적 전송은 제외한다. 실기기, 네트워크, Electron 회귀와 배포는 검증 전 PENDING이다.

## F48 개인 성경 전체 불러오기 게이트
독립 감독관 기획 PASS. 01~04에서 정한 파일 검증, 저장 안전성, 기존 데이터 보존, 누락 절 표시 및 낭독 일치가 구현 조건이다. 실제 파일의 책별 매핑 확인과 패키지 실증은 별도로 기록한다. 웹 구현은 로컬 검증 후 별도 검토하며 미구현 상태다.

## F47 웹 방문 분석 게이트
독립 감독관이 01~04의 F47을 검토하고 URL query/hash 제거, Electron과 개발 환경 제외, 단일 페이지 집계의 한계 및 분석 실패 격리를 보완하도록 요청했다. 보완과 기존 F46 문단 복구 후 기획 PASS. 구현 및 실제 배포와 집계 검증은 PENDING.

> 2026-10-22 · 독립 감독관 `/root/planning_supervisor`가 개정된 01~04 F14 증분을 재검토해 파생했습니다.
> F13 기획·실행 증거와 loop-state는 `history/f13/`에 보존했습니다. 과거 PASS를 이번 실행 결과로 재사용하지 않습니다.

## 기획 검토 판정

**기획 PASS — F14 구현 착수 가능. 구현·인증·실합성·청음 검증은 PENDING입니다.**

이전 HIGH 2건과 MED 4건이 개정안에 반영되었습니다. OAuth/프로젝트 준비/음성 성공 상태를 구분하고,
예산 알림의 비용 차단 보장을 제거했으며, UTC 월 80만자 사전 예약·불명 응답 보수 집계·모델별 지원 검증·
loopback PKCE/저장 실패·캐시와 동의 수명주기를 명시했습니다. 고아 요구/작업 0, 미해결 기획 CRITICAL/HIGH/MED 0입니다.

다음 원칙으로 수용 기준을 적용합니다. 모델별 과금 차이가 있어도 80만자 상한은 이 설치본의 전송 제한일 뿐
무료 사용 또는 프로젝트 비용 상한이 아닙니다. 미인증 상태에서 기본 엔진을 무엇으로 표시하든 사용자 동의 없는
Google 합성을 시작하면 안 됩니다. 네트워크 인증 작업과 이미 검증된 로컬 캐시 재생의 경로를 구분합니다.
토큰 폐기는 로컬 연결 해제이며 프로젝트 전체 OAuth 승인 철회와 같다고 표시하지 않습니다.

## 수용 기준과 실행 증거

| ID | 요구 / 작업 | 필수 검증 | 결과 |
|---|---|---|---|
| J01 | F14-1 / D2 | Desktop client ID·quota project 설정, TTS API/결제/IAM 안내, x-goog-user-project 헤더. 로그인 성공·프로젝트 설정·합성 성공 상태를 각각 확인 | PENDING |
| J02 | F14-1,7 / D2 | 시스템 브라우저, 127.0.0.1 전용 ephemeral listener, PKCE S256, 무작위 일회 state. state 불일치/콜백 재사용/시간초과/취소/중복 연결 거절과 서버 종료 테스트 | PENDING |
| J03 | F14-1,7 / D2 | 토큰 교환/만료/refresh/재로그인/로컬 해제. refresh 응답에 새 refresh token이 없는 경우 기존 값 보존. 해제 중 늦은 인증/refresh 응답이 자격증명을 되살리지 않음 | PENDING |
| J04 | F14-1,7 / D2 | safeStorage 불가·잠금·복호화 오류·손상 파일 시 평문 fallback 없음. 토큰이 renderer/로그/번들에 없음. 패키지 재실행/업데이트에서 Keychain 처리 확인 | PENDING |
| J05 | F14-1,3,7 / D2,D3 | main IPC sender/인자/voice ID/형식/텍스트 길이 검증. 임의 endpoint·경로·SSML 주입 거절. 완성된 UTF-8 입력의 API 바이트 한도 검사. 오류에 원문/토큰을 남기지 않음 | PENDING |
| J06 | F14-2 / D3,D5 | 실제 voices:list의 name/languageCodes/ssmlGender와 선택값 일치, Mandarin 목록만 표시. 인벤토리 실패/선택 음성 삭제를 지원되는 음성처럼 꾸미지 않음 | PENDING |
| J07 | F14-2,3 / D3,D5 | 모델별 문서 기반 rate/pitch/SSML 지원표. Chirp Preview 표시, 지원 미확인 조절 비노출. 허용 범위/SSML escaping/MP3 payload·디코드·크기·오류 응답 검증 | PENDING |
| J08 | F14-2 / D5 | Mandarin 음성 최소 3종(Standard/WaveNet/Chirp 포함)의 실제 샘플과 지원 조절 비교. 사람 청음 품질 판정과 자동 오디오 이벤트 증거를 분리 | PENDING |
| J09 | F14-3,6 / D4 | 본문 해시/voice/model/language/rate/pitch/format/schema별 캐시 분리. 동일 성공 요청 및 동시 중복 요청은 추가 합성 0. 캐시 hit는 토큰 갱신·문자 계수 없이 재생 | PENDING |
| J10 | F14-3,6,9 / D4 | 캐시 원자 저장·용량 제한 LRU·손상 감지·디스크 실패·모두 삭제. 삭제 generation 이후 늦은 응답이 파일을 재생성하지 않음. 활성 URL 해제·재생 중 삭제 수명 확인 | PENDING |
| J11 | F14-5 / D4 | UTC 월 800,000자 상한 전송 전 원자 예약. 경계값/동시 요청/중복 병합/재시작/월 경계/샘플/재시도 테스트. 프리페치 0 | PENDING |
| J12 | F14-5 / D4 | 전송 후 timeout/취소/서버 오류는 예약 유지. 원장 손상·저장 실패는 신규 합성 차단. 명시적 원장 재설정 안내와 캐시 삭제/연결 해제로 원장이 초기화되지 않음 확인 | PENDING |
| J13 | F14-5 / D3,D4 | UI에 앱 전송 추정량과 UTC 월/80만자 표시. 프로젝트 청구량·무료 한도·비용 차단과 구분. 비용 보장 문구 없음 | PENDING |
| J14 | F14-4,8 / D3,D5 | 미연결·401/403·429·offline·timeout·상한 각각 원문 보존/오류/복구 경로. 성공 또는 완료로 처리하지 않으며 자동 webSpeech 호출 0 | PENDING |
| J15 | F14-8 / D3,D5 | Edge 403 반복 호출 차단 유지. Edge/Google 실패 뒤 기기 음성은 사용자가 직접 선택할 때만 실행. 기존 사용자 설정 이행 시 이를 실제 확인 | PENDING |
| J16 | F14-6 / D3,D5 | 성경·읽기 연습 양쪽에서 클릭 반복/연속/정지/Esc/단락·탭·언어 전환/늦은 응답/동시 취소 테스트. 반복 요청·자동 재생·오디오 겹침 없음 | PENDING |
| J17 | F14-9 / D3,D4 | 전송 전 Google·전송 내용·과금 안내와 명시 동의. 거절/철회/연결 해제 후 신규 요청 0, 기존 캐시 오프라인 재생 가능. 텍스트 전송 로그 없음 | PENDING |
| J18 | F12,F13 회귀 / D4,D6 | 기존 원고·진도·단어/문법·병렬 뜻·설정 보존, ko/en UI 전환. Cloud 설정이 기존 설정을 초기화하거나 실패를 빈칸으로 만들지 않음 | PENDING |
| J19 | D6 | typecheck/unit/i18n/변경파일 lint/diff/build 실제 결과. 보안·네트워크 주장은 코드 검색만으로 완료하지 않음 | PENDING |
| J20 | F14-7 / D6 | app:build·패키지 SHA 대조·native OAuth·실제 Cloud 합성·캐시 재생·완전 종료/재실행 확인. 인증 없으면 Cloud 실증은 미완료로 유지 | PENDING |

## 완료 규칙

모든 행의 실제 증거와 미해결 CRITICAL/HIGH 0일 때만 구현 PASS입니다. mock/단위 테스트를 실제 계정 인증·
Cloud 합성·사람 청음으로 바꾸어 기록하지 않습니다. 외부 인증이 없어 수행 못 한 행은 PENDING/부분으로 남기고
구성 방법을 안내합니다. 기존 F13 부분 검증은 역사 기록 그대로 남습니다.

공식 근거: [Cloud TTS 인증](https://docs.cloud.google.com/text-to-speech/docs/authentication),
[Desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app),
[Voice 응답](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/voices/list),
[Chirp 3 HD](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd),
[입력 바이트 제한](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/SynthesisInput),
[safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).
지원 여부는 설치된 Electron 버전과 실제 Cloud 응답에서도 확인합니다.

**현재: 기획 PASS / J01~J20 구현 증거 PENDING.**

---
## Edge 403 복구 유지보수 게이트 (2026-10-23)

독립 감독관 검토: **기획 PASS — 기존 Edge 연결의 좁은 의존성 수정 착수 가능.**
01~04의 유지보수 증분을 검토했습니다. 허용 범위는 설치된 `msedge-tts` 2.0.7의 실패 재현,
상위 프로젝트 2.1.0 변경 확인 및 고정, 기존 IPC 경로의 실제 합성, 회귀 검사와 패키징입니다.
소스에서 브라우저 자격증명을 추출하거나 `node_modules`를 직접 패치하는 방식은 범위에 없습니다.
저장된 엔진 선택과 사용자 학습 자료를 자동 변경하지 않습니다.

| ID | 필수 검증 | 결과 |
|---|---|---|
| E01 | 2.0.7의 현재 실제 요청 결과와 2.1.0 상위 변경 근거를 분리 기록. 오류가 재현되지 않으면 과거 403을 현재 재현했다고 표현하지 않음 | PASS — 2.0.7 앱 IPC에서 403 재현. 2.1.0 단독 갱신은 429였고, Python edge-tts 7.3.1 v2 경로는 같은 문장 합성 성공 |
| E02 | 고정된 의존성으로 앱의 `tts:synth` 처리 경로에서 중국어 남성·여성 및 rate/pitch 샘플 합성. 실제 바이트 크기와 MP3 디코드 결과 기록 | PASS — Xiaoxiao 21,024바이트, Yunxi(-25%/-6%) 28,944바이트. 두 MP3 모두 ffmpeg 디코드 성공 |
| E03 | 기존 인자 검증·중지/늦은 응답 처리를 보존. 반복 재생·엔진 선택의 회귀 검사. 사람 청음과 자동 합성/디코드 증거 구분 | PASS — 전체 122개 테스트 통과, 기존 player/webSpeech 검사 포함. 합성·디코드는 확인했으며 사람 청음은 미확인 |
| E04 | 기존 테스트와 build, 관련 i18n/변경 파일 검사, app:build 수행. 패키지에 실제 2.1.0 포함 여부 확인 | PASS — test 122개, check:i18n, 변경 파일 ESLint, app:build, diff 검사 통과. 패키지에 msedge-tts 2.1.0과 호환 모듈 포함 확인 |
| E05 | 사용자에게 실제 성공 여부와 선택/재실행 방법 안내. 무료 비공식 경로의 장기 가용성을 보장하지 않음 | PASS — Edge 선택 및 완전 종료 후 재실행 절차 안내. Microsoft의 비공식 무료 경로라 향후 변경 가능성 명시 |

이 게이트는 기존 F14 전체 완료를 승인하지 않습니다. J01~J20은 위의 PENDING 상태를 유지합니다.
특히 기존 자동 기기 폴백 동작은 이번 의존성 복구만으로 해결되었다고 간주하지 않으며 J15 검증은 별도입니다.
유지보수 완료는 E01~E05 실제 증거를 기록한 뒤 판정합니다. 네트워크 실패가 남으면 실패 그대로 보고합니다.

### 유지보수 범위 보완 검토 — v2 호환 어댑터

**기획 PASS — 독립 JS 호환 어댑터 구현 착수 가능.** 감독관은 설치된 edge-tts 7.3.1의 drm.py를 읽고
상위 구현에 v2 생성 함수가 있음을 확인했습니다. 부모 작업자가 보고한 2.1.0의 429 및 Python 합성 성공은
실행 증거로 별도 기록해야 하며, 감독관의 독립 실합성 증거로 간주하지 않습니다.

허용 범위는 01~04 보완안의 독립 모듈 이식과 명시적 getSynthUrl 재정의입니다. 원본 버전/출처와 LGPL
라이선스 고지를 보존하고 node_modules 수정이나 브라우저 자격증명 추출을 하지 않습니다.

| ID | 추가 필수 검증 | 결과 |
|---|---|---|
| E06 | Python 7.3.1 원본과 JS를 고정 시각 여러 개·300초 경계에서 대조. 숫자 정밀도·32비트 곱셈 검증 | PASS — 고정 시각 4개(300초 경계 전후 포함)의 토큰이 Python 7.3.1과 정확히 일치 |
| E07 | 고정된 상위 endpoint/매개변수와 timeout 유지. 실제 IPC 남녀·prosody 합성 및 MP3 디코드 성공. 429 반복 재시도 없음 | PASS — v1 endpoint와 기존 timeout을 유지한 v2 토큰으로 소스 IPC 및 패키지 IPC 합성 성공. 패키지 결과 24,336바이트, MP3 디코드 성공 |
| E08 | 출처·버전·라이선스가 소스 및 앱 번들에 포함됨. 패키지에서 동일 호환 모듈 사용 확인 | PASS — edge-tts 7.3.1 출처·변경 설명, LGPL/GPL 전문, 호환 모듈이 앱 Resources/app에 포함됨을 확인 |

**유지보수 판정: E01~E08 PASS.** 사람 청음은 미확인으로 보고하며 기존 J01~J20 상태는 바꾸지 않습니다.

---
## F15 독립 게이트 — Edge 복구 뒤 음성 설정 정리 (2026-10-24)

독립 감독관 `/root/planning_supervisor`가 수정된 01~04 F15 증분을 재검토했습니다.
**기획 PASS — F15 구현 착수 가능. 구현 완료는 PENDING입니다.**

초기 검토의 HIGH 1건(스키마 버전 증가로 기존 설정이 초기화되는 위험)은 v3 전용 보존 migration,
성경 version 1 유지, 기존 설정 fixture 검증을 01/03/04에 명시하여 기획상 해소되었습니다.
현재 미해결 기획 CRITICAL/HIGH/MED는 0건이며 요구·화면·작업 간 고아 항목은 없습니다.
감독관은 실제 settings.ts의 버전 불일치 초기화 분기를 확인했으며, 이 승인 자체는 수정 구현의 검증이 아닙니다.

이 증분은 Google Cloud의 활성 UI/런타임 제거를 승인합니다. 위 F14 J01~J20의 미완료 기록과
Edge 유지보수 E01~E08의 기존 증거는 그대로 보존합니다. Google 제거를 과거 F14 구현 성공으로 기록하지 않습니다.
기존 Edge 실패 차단·폴백 정책은 이번에 변경하지 않으며, 기기 음성을 직접 선택한 사용자의 설정도 보존합니다.
소스 런타임 제거와 userData 자격증명/설정 파일 삭제는 별개입니다. 후자는 이번 범위가 아닙니다.

| ID | 작업 | 필수 수용 및 증거 | 결과 |
|---|---|---|---|
| K01 | G2 | 읽기 연습 더보기에서 Google 선택·OAuth Client/Project 입력·연결 UI가 없고 오프라인 전용 전환이 동작합니다. 성경은 Edge/기기 음성만 표시합니다. 두 언어 실제 UI 확인 | PASS — 패키지 재시작 뒤 한국어/English 더보기에서 오프라인 전용과 초기화만 표시, Google UI 없음. 성경 선택 DOM은 Edge/기기 음성만 포함 |
| K02 | G3 | 읽기 연습 v3 google fixture를 기본값 초기화 전에 이행하여 engine만 edge로 변경합니다. 새 스키마로 재저장·재로드해도 유지되는 테스트 | PASS — settings migration 테스트에서 v3 google→v4 edge, Google 전용 필드 제거, 재저장값 확인 |
| K03 | G3 | v3 edge/local fixture의 엔진, 배속·음높이·성별·톤·병음·글자·무음·자동 진행·간격·읽기 방식 등 유효 설정을 보존합니다. 원고/현재 위치 저장 키 전후 대조 | PASS — edge/local fixture 및 전체 설정·원고·index 보존 테스트 통과. 실제 앱 기존 원고와 선택도 재시작 뒤 유지 |
| K04 | G3 | 성경 version 1에서 google만 edge로 변경합니다. 단락·문장·완료·단어 복습·학습 영역·뜻/병음·반복/간격/배속 보존, edge/local 유지, 재저장/재로드 테스트 | PASS — version 1 Google fixture에서 엔진만 Edge로 변경하고 진도·복습·학습 설정 보존 테스트 통과 |
| K05 | G3 | 잘못된 저장값은 검증하되 유효 사용자 데이터를 통째로 지우지 않습니다. 저장 실패 때 학습을 성공적으로 영구 보존했다고 주장하지 않습니다. 초기 실행·손상 값·실패 테스트 | PASS — 기존 손상/저장 실패 테스트와 신규 migration 테스트 통과. 알 수 없는 성경 엔진은 기존 기본값 local 유지 |
| K06 | G2,G4 | main의 Google IPC 등록/import, preload 노출, renderer 어댑터·player 분기·타입·활성 참조가 제거됩니다. 실행 중 Google 인증/합성 경로 호출이 없음 확인 | PASS — 소스·dist·패키지 main/preload/electron에서 활성 Google TTS 참조 0건. bridge/renderer 파일 제거 |
| K07 | G4 | 앱 실행·설정 이행·패키징 과정에서 기존 Google userData 설정/토큰 파일을 읽기·쓰기·삭제하지 않습니다. 임시 사용자 데이터 fixture로 파일 내용/존재 보존 및 접근 경로 확인. 실제 토큰을 출력하지 않음 | PASS — userData 파일명과 fs 접근 구현을 포함한 bridge 전체 제거, 패키지에도 설정/토큰 파일과 접근 경로 없음. 기존 userData 삭제 동작 없음 |
| K08 | G2,G5 | Edge 실패·기기 음성 실패·429 차단과 오류 표시 정책이 제거 작업으로 바뀌지 않습니다. 실패를 빈 값/성공으로 바꾸지 않음. 기존 음성 테스트와 실패 경로 확인 | PASS — player의 Edge 실패 차단·기기 실패 전달 테스트 포함 전체 132개 통과 |
| K09 | G2,G5 | 두 학습 화면에서 문장 클릭/반복/정지/Esc/탭 전환 및 기기 음성 선택 회귀 확인. 신규 음성 요청은 원래 재생 동작에서만 발생하고 이행 자체로 자동 재생하지 않음 | PASS — playback/player 테스트 통과. 패키지 UI에서 성경 문장 클릭→음성 준비→읽는 중→같은 문장 클릭 정지 확인 |
| K10 | G5 | F13 병렬 뜻·단어·문법·진도 유지. 한국어/English UI 전환 및 i18n 검사에서 신규 잔존 문구가 없음. Google 제거를 위해 번역기의 무료 Google 번역 기능을 제거하지 않음 | PASS — 패키지에서 기존 단어 진도와 양언어 뜻 확인, 한국어/English 메뉴 확인, check:i18n 0건. translate.ts 무료 번역 유지 |
| K11 | G5 | 전체 test, build, check:i18n, 변경 파일 lint, git diff --check 실제 결과. 현재 범위 밖 이력 문서의 Google 언급은 활성 런타임과 구분 | PASS — 14파일 132테스트, build, check:i18n, 변경 파일 ESLint, diff 검사 모두 통과 |
| K12 | G5 | app:build 후 패키지에서 Google 런타임 부재, Edge v2 호환 모듈/라이선스 포함과 소스 일치 확인. 패키지 실행 UI와 Edge 합성/MP3 디코드 증거. 사람 청음 미실행이면 별도 미확인 표시 | PASS — app:build 성공. 패키지 Google 런타임 0건, Edge 모듈·2.1.0·라이선스 포함. 패키지 IPC 21,024바이트/3.504초 MP3 생성·디코드 및 UI 재생 상태 확인. 사람 청음은 사용자 보고 외 독립 미확인 |

**현재: F15 기획 및 구현 K01~K12 PASS.**
사람 청음은 사용자의 정상 작동 보고와 자동 생성·디코드·UI 재생 상태를 구분해 기록합니다.

---

## F16 독립 게이트 — 기존 성경 번역문과 문장별 자동 진행 (2026-10-24)

01~04에 F16 요구·화면·구조·작업을 추가했습니다. 이 증분은 기존 F15 게이트의 구현 PASS를
재사용하지 않으며, 아래 검증을 새로 수행해야 합니다.

| ID | 필수 검증 | 결과 |
|---|---|---|
| H01 | 한국어 성경 1910과 World English Bible Classic의 마가복음 1장 45절을 절 번호별로 대조하고 출처·Public Domain 안내를 확인 | PENDING |
| H02 | 로컬 번들에서 한국어·영어 뜻이 모두 제공되고, 실행 중 번역 엔진/네트워크 요청 없이 렌더링되는지 확인 | PENDING |
| H03 | 단어·문법 앱 작성 자료와 성경 번역문을 화면에서 구분하고 ko/en UI에서 양언어 뜻·출처가 유지되는지 확인 | PENDING |
| H04 | 반복 선택지 1/3/5/계속 및 저장·재로드 validator를 확인 | PENDING |
| H05 | 유한 반복 종료 후 다음 문장 자동 진행, count 초기화, 마지막 문장 정지, 정지·다른 문장 선택·탭 전환 취소를 fake timer와 실제 UI에서 확인 | PENDING |
| H06 | 전체 test/build/check:i18n/변경 파일 lint/diff와 필요한 경우 app:build를 실제 실행하고 결과를 기록 | PENDING |

**현재: F16 기획 문서 반영 / 구현·독립 검증 PENDING.** 이 표의 PENDING을 PASS로 바꾸기 전에는
F16 구현 완료로 보고하지 않습니다.

## F17 독립 게이트 — 개인용 새한글성경 로컬 불러오기

| ID | 필수 검증 | 결과 |
|---|---|---|
| L01 | JSON version/판본/Mark 1/정확히 45절 검증과 잘못된 파일 거부 | PENDING |
| L02 | userData 저장·재실행 로드·기본 판본 fallback | PENDING |
| L03 | 본문이 git·dist·app 패키지에 포함되지 않고 네트워크 요청도 없음 | PENDING |
| L04 | 로컬 한국어와 기존 영어 뜻의 병렬 표시 및 ko/en UI | PENDING |
| L05 | 전체 검사와 app:build 실제 결과 | PENDING |

**현재: F17 기획 반영 / 구현·독립 검증 PENDING.**

## F18 독립 게이트 — 로컬 판본 선택과 BDB 자동 변환

| ID | 필수 검증 | 결과 |
|---|---|---|
| M01 | 한국어·영어 `.bdb` 및 JSON의 Mark 1 45절 자동 변환·검증 | PENDING |
| M02 | 언어별 다중 판본 저장·드롭다운 선택·재실행 복원 | PENDING |
| M03 | 선택 파일이 없거나 삭제된 경우 기본 판본 fallback과 사용자 안내 | PENDING |
| M04 | 원본·본문이 저장소/패키지/네트워크에 포함되지 않음 | PENDING |
| M05 | `연속` 간격 0의 반복·다음 문장 진행과 기존 간격 회귀 | PENDING |
| M06 | test/build/check:i18n/lint/diff/app:build 실제 결과 | PENDING |

**현재: F18 기획 반영 / 구현·독립 검증 PENDING.**

## F19 독립 게이트 — 자동 진행 위치 표시와 범위 확장

| ID | 필수 검증 | 결과 |
|---|---|---|
| N01 | 자동·수동 문장 이동 시 현재 문장이 화면에 보이고 기존 재생 동작이 유지됨 | PENDING |
| N02 | 추가 장의 원문·양언어 뜻·단어·문법 자료와 출처가 실제로 일치함 | PENDING |
| N03 | 추가 장의 저장·단락 진행·스크롤·ko/en UI 회귀 | PENDING |

**현재: F19 기획 반영 / 구현·독립 검증 PENDING.**

## F20 독립 게이트 — Public Domain 66권 본문

| ID | 필수 검증 | 결과 |
|---|---|---|
| O01 | 66권·장·절 수와 CUV/KOR1910/WEB 출처·Public Domain 확인 | PENDING |
| O02 | 책·장 선택, 본문·양언어 뜻·단락·반복·자동 스크롤 연결 | PENDING |
| O03 | 마가복음 1장 학습 카드 유지 및 다른 장의 자료 없음 안내 | PENDING |
| O04 | 저장소·패키지에 저작권 판본이 없고 로컬 판본 경계 유지 | PENDING |
| O05 | 전체 테스트/build/check:i18n/lint/diff/app:build 실제 결과 | PENDING |

**현재: F20 기획 반영 / 구현·독립 검증 PENDING.**

## F21 독립 게이트 — 낭독 준비 상태 회복

| ID | 필수 검증 | 결과 |
|---|---|---|
| P01 | Edge 요청 지연이 설정된 시간 후 끝나고 폴백/오류로 전환됨 | PENDING |
| P02 | 기기 음성 `onstart` 누락 시 즉시 재생 상태로 전환되고, 시작 실패 시 제한 시간 후 오류 처리됨 | PENDING |
| P03 | 다음 절 선택 후 이전 응답이 현재 문장을 덮어쓰지 않음 | PENDING |
| P04 | test/build/check:i18n/lint/diff/app:build 실제 결과 기록 | PASS — 138개 테스트, TypeScript/Vite 및 macOS app:build, i18n, 변경 파일 ESLint, diff 검사 통과. 66권 JSON으로 인한 기존 번들 크기 경고는 남음 |
| P05 | 절 클릭과 자동 진행으로 커서가 저장되어도 낭독 컨트롤러가 유지되고 다음 절에서 실제 읽기 상태로 전환됨 | 부분 검증 — 재빌드 앱에서 기기 음성 1→2절 수동 전환 뒤 5절까지 자동 진행, Edge 음성 1→2절 자동 진행 및 정지 확인. 스피커 청음은 수행하지 못함 |

**현재: F21 기획 반영 / 구현·독립 검증 PENDING.**

## F22 독립 게이트 — 성경 낭독 음성 선택과 책별 제목

| ID | 필수 검증 | 결과 |
|---|---|---|
| Q01 | 성경 공부의 성별·말투 선택과 저장·낭독 전달 | PASS — 공통 VoiceMap과 StudySettings 연결, 저장 validator 및 UI 확인 |
| Q02 | 누가복음 선택 시 오른쪽 제목과 목록에 마가복음이 남지 않음 | PASS — 제목 fallback을 현재 선택 책·장 범위로 통일 |
| Q03 | 테스트/build/check:i18n/lint/diff/app:build 및 패키지 앱 화면 | PASS — 138개 테스트, build, i18n, 변경 파일 lint, diff, app:build 통과 |

**현재: F22 기획·구현·검증 완료.**

## F23 독립 게이트 — 66권 문맥 단락 카탈로그

| ID | 필수 검증 | 결과 |
|---|---|---|
| R01 | 공개 CUV USFM 소제목과 시작·끝 절의 변환·출처 기록 | PASS — eBible 공개 USFM을 기준으로 66권 카탈로그 생성 |
| R02 | 66권·1,189장 전체 단락이 절을 중복·누락 없이 포함 | PASS — 2,656개 문맥 단락과 전체 절 범위 검증 |
| R03 | 이야기별 화면의 문맥 제목·절 범위와 5절 모드 구분 | PASS — headings 기반 이야기별과 기존 5절 분할을 분리 |
| R04 | 마가복음 1장 학습 카드, 책 변경, ko/en UI 회귀 | PASS — 기존 학습 자료·책별 headings 연결 및 i18n 검사 통과 |
| R05 | 전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 138개 테스트 및 전체 빌드·패키징 검사 통과 |

**현재: F23 기획·구현·검증 완료.**

## F24 독립 게이트 — 로컬 판본 적용 범위

| ID | 필수 검증 | 결과 |
|---|---|---|
| S01 | 마가복음 1장 전용 로컬 판본이 마가복음 1장에만 적용됨 | PASS — 선택 책·장을 확인한 뒤 로컬 override를 조건부 전달 |
| S02 | 다른 책·장에서 해당 책·장의 한국어·영어 뜻이 표시됨 | PASS — `meaningsFor(book, chapter)` 기본 매핑 유지 |
| S03 | 테스트/build/check:i18n/lint/diff/app:build | PASS — 138개 테스트와 전체 빌드·검사·패키징 통과 |

**현재: F24 기획·구현·검증 완료.**

## F25 독립 게이트 — 연속 읽기 음성 프리페치

| ID | 필수 검증 | 결과 |
|---|---|---|
| T01 | 다음 Edge 음성 프리페치와 실제 재생 promise 재사용 | PASS — 문장·음성 설정별 promise를 저장하고 다음 재생에서 소비하는 테스트 통과 |
| T02 | 반복 1회·단락 듣기에서 0초 전환 및 다음 문장 진행 | PASS — 연속 모드의 0ms 즉시 전환과 다음 문장 진행 테스트 통과 |
| T03 | 정지·선택·설정 변경·프리페치 실패·기존 폴백 회귀 | PASS — 기존 취소·늦은 응답·폴백 테스트와 프리페치 실패 정리 로직 확인 |
| T04 | 전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 140개 테스트, TypeScript/Vite build, check:i18n, 변경 파일 ESLint, diff 검사, macOS arm64 app:build 통과 |

**현재: F25 기획·구현·독립 검증 완료.**

## F26 독립 게이트 — 단어·문법 학습 음성

| ID | 필수 검증 | 결과 |
|---|---|---|
| U01 | 단어·문법 카드 중국어 텍스트의 재생 버튼과 공유 재생기 | PASS — 단어·본문 표현·문법 구성·연습 문장에 학습 영역별 공유 `SentencePlayer` 연결 |
| U02 | 성별·말투 선택 없이 기본 음성 사용, 다른 카드 재생 시 이전 음성 중지 | PASS — `DEFAULT_SETTINGS` 고정 사용 및 새 카드 재생 전 기존 `SentencePlayer` 중지 경로 확인 |
| U03 | Edge 실패 시 기존 기기 음성 폴백 및 학습 카드 회귀 | PASS — 기존 `SentencePlayer` 폴백·취소 테스트와 전체 학습 테스트 통과 |
| U04 | 전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 140개 테스트, TypeScript/Vite build, check:i18n, 변경 파일 ESLint, diff 검사, macOS arm64 app:build 통과 |

**현재: F26 기획·구현·독립 검증 완료.**

## F27 독립 게이트 — 성경 읽기 진도 표

| ID | 필수 검증 | 결과 |
|---|---|---|
| V01 | 66권 전체 책별 진도 표와 현재 책 강조 | PASS — 66권 행에 장 수·완료 단락·전체 단락·진행률을 표시하고 현재 책 행을 강조 |
| V02 | 이야기별/5절 단위 전환에 따른 단락 수·진행률 갱신 | PASS — `data.mode` 기준 전체 단락 집계와 화면 갱신을 연결하고 전권 카탈로그 테스트 통과 |
| V03 | 마가복음 1장 밖 완료 기록 저장·재실행 보존 | PASS — 전권 단락 ID를 저장 검증 대상으로 확장하고 요한복음 단락 보존 테스트 통과 |
| V04 | 전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 142개 테스트, TypeScript/Vite build, check:i18n, 변경 파일 ESLint, diff 검사, macOS arm64 app:build 통과 |

**현재: F27 기획·구현·독립 검증 완료.**

## F28 독립 게이트 — 영어 화면의 성경 책 이름

| ID | 필수 검증 | 결과 |
|---|---|---|
| W01 | 영어 UI의 책 선택·진도 표에 영어 책 이름 표시 | PASS — 66권 ID별 영어 이름 매핑과 공통 표시 함수 연결 |
| W02 | 현재 책 제목·단락 범위의 언어 일치 | PASS — 선택 목록·진도 표·현재 범위에서 동일 함수 사용 |
| W03 | 전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 142개 테스트, TypeScript/Vite build, check:i18n, 변경 파일 ESLint, diff 검사, macOS arm64 app:build 통과 |

**현재: F28 기획·구현·독립 검증 완료.**

## F29 독립 게이트 — 연속 전환 오디오 준비

| ID | 필수 검증 | 결과 |
|---|---|---|
| X01 | 다음 음성 합성 후 오디오 객체 preload | PASS — 프리페치 완료 후 `Audio` 객체 생성, `preload=auto`, `load()` 호출 및 테스트 확인 |
| X02 | 준비된 오디오 객체 재사용과 기존 폴백 | PASS — 동일 키의 준비 객체를 재생에서 소비하고 미준비 시 기존 합성 경로 사용 |
| X03 | 정지·문장 변경·늦은 응답 회귀 | PASS — 기존 requestId 취소·늦은 응답·폴백 테스트와 preload 재사용 테스트 통과 |
| X04 | 전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 142개 테스트, TypeScript/Vite build, check:i18n, 변경 파일 ESLint, diff 검사, macOS arm64 app:build 통과 |

**현재: F29 기획·구현·독립 검증 완료.**

## F30 독립 게이트 — 마지막 성경 위치 복원

| ID | 필수 검증 | 결과 |
|---|---|---|
| Y01 | 마지막 저장 단락의 책·장 복원 | PASS — 저장된 `passageId`에서 책 ID와 장 번호를 복원 |
| Y02 | 유효하지 않은 저장값의 마가복음 1장 fallback | PASS — 잘못된 ID·없는 장을 MRK 1장으로 되돌리는 테스트 통과 |
| Y03 | 저장 단락·문장 커서와 화면 선택 일치 | PASS — 기존 `passageId`·`sentenceId` 저장 구조를 유지한 초기 선택 복원 |
| Y04 | 전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 143개 테스트, TypeScript/Vite build, check:i18n, 변경 파일 ESLint, diff 검사, macOS arm64 app:build 통과 |

**현재: F30 기획·구현·독립 검증 완료.**

## F31 독립 게이트 — 로마서 이야기별 단락

| ID | 필수 검증 | 결과 |
|---|---|---|
| Z01 | 로마서 1–16장 문맥 소제목과 절 범위 존재 | PASS — 기존 `context-headings.json`의 ROM 16장 문맥 카탈로그 확인 |
| Z02 | 이야기별 로마서 단락의 절 중복·누락 없음 | PASS — 16장 전체 partition 결과가 원문 절을 정확히 한 번씩 포함 |
| Z03 | 로마서 선택 시 목록·현재 제목·본문 범위 일치 | PASS — 기존 책·장 선택과 story partition 연결 및 대표 경계 회귀 검증 |
| Z04 | 전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 144개 테스트, TypeScript/Vite build, check:i18n, 변경 파일 ESLint, diff 검사, macOS arm64 app:build 통과 |

**현재: F31 기획·구현·독립 검증 완료.**

## F32 독립 게이트 — 로마서 단어·문법 학습

| ID | 필수 검증 | 결과 |
|---|---|---|
| AA01 | 로마서 실제 본문 기반 단어 카드와 절 범위 필터 | PASS — ROM 절에 실제 등장하는 핵심 어휘를 생성하고 현재 단락 범위로 필터 |
| AA02 | 로마서 실제 본문 기반 문법 카드와 절 범위 필터 | PASS — ROM 절에 실제 등장하는 문법 표현과 병렬 설명·연습 예문을 연결 |
| AA03 | 기존 마가복음 학습 자료·복습 ID·학습 음성 회귀 | PASS — 기존 마가복음 lessonFor 기본 경로와 단어 복습 ID, 학습 음성 구조 유지 |
| AA04 | 전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 146개 테스트, TypeScript/Vite build, check:i18n, 변경 파일 ESLint, diff 검사, macOS arm64 app:build 통과 |

**현재: F32 기획·구현·독립 검증 완료.**

## F33 독립 게이트 — 성경 본문 언어 선택과 병렬 표시

| ID | 필수 검증 | 결과 |
|---|---|---|
| AB01 | 주 본문·보조 언어 설정 저장 및 기본값 호환 | PASS — 기존 저장 데이터에 중국어 주 본문과 한국어·영어 표시를 보충하고 저장 테스트 통과 |
| AB02 | 중국어·한국어·영어 본문 매칭, 주 본문 중복 제외, 중국어 병음 조건 | PASS — 절 번호 기반 언어별 문장 분할·주 본문 중복 제외·중국어 병음 조건 테스트 통과 |
| AB03 | 선택 언어의 Edge/기기 음성 전달 및 기존 낭독 회귀 | PASS — 언어별 Edge voice map, 기기 locale/음성 전달, 기존 TTS 회귀 테스트 통과 |
| AB04 | 전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 147개 테스트, TypeScript/Vite build, check:i18n, 변경 파일 ESLint, diff 검사, macOS arm64 app:build 통과 |

**현재: F33 기획·구현·독립 검증 완료.**

## F34 독립 게이트 — 언어별 단락 제목

| ID | 필수 검증 | 결과 |
|---|---|---|
| AC01 | 한국어·영어 주 본문 선택 시 목록·현재 제목 언어 일치 | PENDING |
| AC02 | 번역 제목 누락 시 중국어 재사용 방지 및 범위 fallback | PENDING |
| AC03 | 원문 소제목 출처 표시와 전체 회귀 검증 | PENDING |

**현재: F34 구현 중.**

## F34 독립 게이트 결과

| ID | 필수 검증 | 결과 |
|---|---|---|
| AC01 | 한국어·영어 주 본문 선택 시 목록·현재 제목 언어 일치 | PASS — 주 본문 언어별 제목 선택과 UI 언어별 범위 fallback 연결 |
| AC02 | 번역 제목 누락 시 중국어 재사용 방지 및 범위 fallback | PASS — `headingTitle` 회귀 테스트에서 비중국어 fallback 확인 |
| AC03 | 원문 소제목 출처 표시와 전체 회귀 검증 | PASS — 원문 제목은 출처 영역에 유지, 148개 테스트 및 빌드/check:i18n/lint/diff 통과 |

**현재: F34 기획·구현·독립 검증 완료.**

## F35 독립 게이트 — 연속 읽기의 장 전환

| ID | 필수 검증 | 결과 |
|---|---|---|
| AD01 | 마지막 문장 정상 완료와 수동 정지 구분 | PENDING |
| AD02 | 연속 설정에서 다음 장 첫 단락 자동 선택·재생 | PENDING |
| AD03 | 마지막 장·문장 선택·설정 유지 및 전체 회귀 | PENDING |

**현재: F35 구현 중.**

## F35 독립 게이트 결과

| ID | 필수 검증 | 결과 |
|---|---|---|
| AD01 | 마지막 문장 정상 완료와 수동 정지 구분 | PASS — `StudyPlayback` 완료 콜백과 수동 정지 회귀 테스트 통과 |
| AD02 | 연속 설정에서 다음 장 첫 단락 자동 선택·재생 | PASS — 같은 장 다음 단락과 다음 장 첫 단락에 자동 시작 신호 연결 |
| AD03 | 마지막 장·문장 선택·설정 유지 및 전체 회귀 | PASS — 마지막 장은 정지, 설정 유지, 149개 테스트 및 build/check:i18n/lint/diff 통과 |

**현재: F35 기획·구현·독립 검증 완료.**

## F36 독립 게이트 — 본문 표시 설정 단순화

| ID | 필수 검증 | 결과 |
|---|---|---|
| AE01 | 읽기 진도 표 제거 | PASS — BibleStudy에서 읽기 진도 표와 계산을 제거하고 본문 선택 영역을 바로 표시 |
| AE02 | 주 본문·보조 언어·글자 크기 선택 및 저장 | PASS — 주 본문 언어·보조 언어·4단계 글자 크기를 UI와 StudySettings 저장/마이그레이션에 연결 |
| AE03 | 로컬 판본·낭독·학습 기능 회귀 및 전체 검증 | PASS — 149개 테스트, build, check:i18n, eslint, diff --check 통과 |

**현재: F36 기획·구현·독립 검증 완료.**

## F37 독립 게이트 — 성경 낭독 고속 읽기

| ID | 필수 검증 | 결과 |
|---|---|---|
| AF01 | 3×까지 속도 선택·저장·복원 | PASS — 읽기 속도 목록·StudySettings validator·저장 테스트에 3×까지 반영 |
| AF02 | 온라인·기기 음성에 고속 설정 전달 및 기존 낭독 회귀 | PASS — Edge SSML 상한을 +200%로 확장하고 기존 음성·낭독 경로 유지 |
| AF03 | 전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 150개 테스트, TypeScript/Vite build, check:i18n, ESLint, diff 검사 및 app:build 통과 |

**현재: F37 기획·구현·독립 검증 완료.**

## F38 독립 게이트 — RNKSV 한국어 이야기 단락

| ID | 필수 검증 | 결과 |
|---|---|---|
| AG01 | RNKSV 장별 소제목·시작 절 수집과 66권 카탈로그 반영 | PASS — RNKSV 1,189개 장을 확인하고 소제목이 있는 장의 `titleKo`·절 경계를 카탈로그에 반영 |
| AG02 | 한국어 선택 시 목록·현재 제목·절 범위 일치 및 소제목 없는 장 fallback | PASS — 마가복음 1장 대표 경계와 한국어 제목 회귀, 42개 소제목 미제공 장의 범위 fallback 확인 |
| AG03 | 기존 중국어·영어 제목·낭독·학습과 전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 151개 테스트, TypeScript/Vite build, check:i18n, ESLint, diff 검사 및 app:build 통과 |

**현재: F38 기획·구현·독립 검증 완료.**

## F39 독립 게이트 — 언어별 낭독 음성 안정화

| ID | 필수 검증 | 결과 |
|---|---|---|
| AH01 | 한국어·영어 선택 시 기기 음성 라벨과 locale 전달 | PASS — 기기·온라인 음성 라벨을 선택 언어 기준으로 일반화하고 기존 locale 전달 경로를 회귀 확인 |
| AH02 | Edge 2×·3× rate 검증과 온라인 음성 유지 | PASS — Edge prosody 검증을 +200%까지 확장하고 0.5×·2×·3× 매핑 테스트 추가 |
| AH03 | Edge 실패 fallback·기존 낭독·전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 154개 테스트, TypeScript/Vite build, check:i18n, ESLint, diff 검사 및 app:build 통과 |

**현재: F39 기획·구현·독립 검증 완료.**

## F40 독립 게이트 — 읽기 연습 시작 위치

| ID | 필수 검증 | 결과 |
|---|---|---|
| AI01 | caret 없는 시작은 첫 문장, caret 있는 시작은 선택 문장 | PASS — caret이 없으면 0번 문장, caret이 있으면 해당 원고 위치의 문장으로 결정하는 순수 함수와 테스트 추가 |
| AI02 | 저장된 마지막 문장 위치와 새 원고에서 첫 문장 정책 유지 | PASS — 저장된 `prompter.lastIndex`를 일반 시작 경로에서 사용하지 않고 첫 문장으로 초기화 |
| AI03 | 시작 위치 회귀·전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 156개 테스트, TypeScript/Vite build, check:i18n, ESLint, diff 검사 및 app:build 통과 |

**현재: F40 기획·구현·독립 검증 완료.**

## F41 독립 게이트 — 붙여넣기 시작 위치 안정화

| ID | 필수 검증 | 결과 |
|---|---|---|
| AJ01 | 붙여넣기·입력 후 caret을 직접 위치 선택으로 오인하지 않음 | PASS — `onChange`·`onPaste`에서 선택 플래그를 해제하고 자동 `select`·키보드 이벤트를 위치 선택으로 기록하지 않음 |
| AJ02 | 실제 클릭 선택은 유지하고 붙여넣기 시작은 첫 문장 | PASS — 실제 textarea 클릭만 선택 위치로 유지하고 붙여넣기 시작은 0번 문장으로 회귀 확인 |
| AJ03 | 시작 위치 회귀·전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 156개 테스트, TypeScript/Vite build, check:i18n, ESLint, diff 검사 및 app:build 통과 |

**현재: F41 기획·구현·독립 검증 완료.**

## F42 독립 게이트 — 성경 단락 제목의 내부 코드 제거

| ID | 필수 검증 | 결과 |
|---|---|---|
| AK01 | 내부 책 코드 소제목 감지와 범위 fallback | PASS — `BOOK 1:1` 형식의 중국어 내부 코드를 감지해 책·장·절 범위로 대체 |
| AK02 | 누가복음 대표 사례 및 정상 제목 회귀 | PASS — `LUK 1:1–3`은 `누가복음 1:1–4`로 fallback하고 정상 한국어·영어·중국어 제목은 유지 |
| AK03 | 전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 157개 테스트, TypeScript/Vite build, check:i18n, ESLint, diff 검사 및 app:build 통과 |

**현재: F42 기획·구현·독립 검증 완료.**

## F43 독립 게이트 — 병음 제외 중국어 선택·복사

| ID | 필수 검증 | 결과 |
|---|---|---|
| AL01 | 병음의 텍스트 선택·포인터 제외 | PASS — `rt`에 `user-select: none`과 `pointer-events: none`을 적용 |
| AL02 | 중국어 본문 복사 시 원문만 클립보드 기록 | PASS — copy fragment에서 `rt`를 제거한 text/plain만 기록 |
| AL03 | 선택·복사 회귀·전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 157개 테스트, TypeScript/Vite build, check:i18n, ESLint, diff 검사 및 app:build 통과 |

**현재: F43 기획·구현·독립 검증 완료.**

## F44 독립 게이트 — 중국어 단락 제목 일관성

| ID | 필수 검증 | 결과 |
|---|---|---|
| AM01 | 66권 중국어 책 이름 매핑과 범위 fallback | PASS — 중국어 책 이름 66권 매핑을 범위 fallback에 연결 |
| AM02 | 누가복음 대표 단락과 정상 소제목 언어 일치 | PASS — 첫 단락은 `路加福音 1:1–4`, 나머지 정상 소제목도 중국어로 표시 |
| AM03 | 언어별 제목 회귀·전체 테스트/build/check:i18n/lint/diff/app:build | PASS — 157개 테스트, TypeScript/Vite build, check:i18n, ESLint, diff 검사 및 app:build 통과 |

**현재: F44 기획·구현·독립 검증 완료.**

## F45 독립 게이트 — 웹 성경 기기 음성 선택

독립 감독관 재검토: **기획 PASS — CRITICAL 0 / HIGH 0 / MED 0.** 01~04 F45 문서는 웹의 브라우저 음성 선택, 로컬 표시값의 제한, 비동기 목록 준비, 언어별 선택 저장, Electron 회귀 및 브라우저별 검증 조건을 명시합니다. 이번 판정은 구현 승인 범위만 정하며 기능·실제 재생을 검증하지 않습니다.

| ID | 필수 검증 | 결과 |
|---|---|---|
| AN01 | SpeechSynthesis 미지원·초기 빈 목록·3초 대기·재시도·`voiceschanged` 후 갱신 상태를 구분 | PARTIAL — 공개 배포에서 초기 로딩 후 중국어 음성 목록이 나타남. 미지원·3초 제한·재시도 및 빈 목록의 지연 복구는 미검증 |
| AN02 | 언어별 태그 필터, `localService === true`만 노출, 언어 불일치·false/미정·중복 URI 제외 | PASS — 중국어 허용/배제, ko/en 태그, false/미정, 중복 URI 단위 테스트 통과. 공개 웹 목록도 중국어 음성만 표시 |
| AN03 | 언어별 URI 저장/복원, 사라진 음성 제거 및 재선택 요구, 저장 호환과 언어 전환 보존 | PARTIAL — 언어별 URI 저장/복원·잘못된 식별자 제외·StudyData 호환 테스트 통과. 공개 웹에서 중국어 음성 선택 후 새로고침 복원 확인. 음성 삭제 및 UI 언어 전환은 미검증 |
| AN04 | 웹에서 고른 URI가 실제 발화에 반영되고 오류·정지·반복·연속에서 겹침이 없음 | PARTIAL — 선택 URI 단위 테스트 통과. 공개 웹에서 선택 뒤 재생 절이 1:1에서 1:2로 이동하고 정지 동작 확인. 실물 출력 청음과 모든 반복/연속 모드는 미검증 |
| AN05 | Electron Edge 선택·실패 기기 음성 경로와 StudyData 설정 회귀 | PARTIAL — 전체 기존 player/TTS/storage 회귀 통과. F45 변경 후 Electron 패키지 UI·실합성은 미검증 |
| AN06 | 키보드 접근성 및 대기·미지원·음성 없음·재생 오류 상태 안내 | PARTIAL — 키보드로 음성 선택, 공개 웹의 대기·재생 상태 표시 확인. 스크린리더 및 나머지 오류 상태는 미검증 |
| AN07 | 전체 기존 테스트/build/check:i18n/변경 파일 lint/diff 결과 기록 | PASS — `npm test` 17개 파일/162개 테스트, `npm run build`, `npm run check:i18n`, `npm run lint`, `git diff --check` 통과. ESLint는 기존 두 경고(App.tsx, i18nContext.tsx), Vite는 큰 번들 경고를 보고 |
| AN08 | 데스크톱 Chrome/Edge/Safari, Android Chrome, iOS Safari의 실제 목록·재생·언어 전환·네트워크 관찰. 미확인 환경은 미검증 유지 | PARTIAL — 공개 `tingdong-liart.vercel.app`을 ChatGPT 인앱 브라우저에서 열어 음성 선택·진행·정지·새로고침 복원을 확인. Chrome/Edge/Safari 및 모바일 환경과 네트워크 관찰은 미검증 |

로컬 개발 서버 실행은 환경이 `127.0.0.1:5173` 수신을 `EPERM`으로 거부했습니다. 이후 공개 프로덕션 도메인에서 실제 UI를 확인했습니다. Vercel 전용 배포 URL은 로그인 보호로 열 수 없어 SSO 예외가 적용된 `tingdong-liart.vercel.app`에서 확인했습니다.

**현재: F45 기획 PASS / 자동 검증 PASS / 공개 웹 실증 부분 완료 / 기기별·네트워크 실증 PENDING.** `localService`는 브라우저 분류값일 뿐이며, 이것만으로 네트워크 전송이 없다고 판정하지 않습니다.

## F46 게이트 — 웹 Edge 음성

독립 감독관 F46 기획 검토 PASS. 01~04의 웹 엔진 선택, 설정 보존, 2000 UTF-16 단위 제한, 입력 검증, 오류와 취소, 전송 안내 및 캐시 검증을 수용 기준으로 한다. 2000 단위 초과 문장은 원문을 보존하고 오류를 표시한다. 자동 테스트, 실제 Vercel 합성, iOS 재생은 각각 별도로 기록한다. 구현과 실증은 PENDING.

F46 구현 검증: 전체 테스트 165개 통과(이동 전 API 테스트 포함), TypeScript/Vite 빌드, i18n, lint(기존 경고 2건), diff 검사 및 macOS app:build 통과. 서버 합성 로컬 시도는 DNS ENOTFOUND로 실패해 실음원 미검증. Vercel 실제 합성·iOS/Android 재생·사용량 제한은 PENDING. 웹은 실패 시 다음 문장을 보내지 않도록 사전 요청을 사용하지 않는다. 서버 전역 요청 빈도 제한은 구현하지 않았다.
