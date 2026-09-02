/**
 * 화면 언어 한 벌.
 *
 * 영어판은 껍데기만 영어가 아니다 — 화면 문구와 함께 '무엇으로 번역할지'가
 * 같이 바뀐다. 한국어 화면에서 영어 뜻이 나오거나 그 반대가 되면 앱이 두 쪽으로
 * 갈라지므로, 두 가지를 한 설정에 묶어둔다. (01-prd F11)
 *
 * React를 쓰지 않는다 — ⌘⇧F 팝업(popup.ts)도 이 파일을 그대로 쓴다.
 * 문자열표는 영어를 원본으로 두었다. 한쪽에만 있는 키는 타입 검사에서 걸린다.
 */

export type UiLang = 'ko' | 'en';

export const UI_LANG_KEY = 'study_ui_lang';

/** 화면 언어가 곧 번역 타깃이다 */
export function targetLangFor(lang: UiLang): 'ko' | 'en' {
  return lang;
}

export function loadUiLang(): UiLang {
  try {
    const saved = localStorage.getItem(UI_LANG_KEY);
    if (saved === 'ko' || saved === 'en') return saved;
  } catch { /* 저장소를 못 읽어도 언어는 정해져야 한다 */ }

  // 처음 켠 사람에게는 기기 언어로 맞춰준다. 한국어가 아니면 영어가 낫다.
  try {
    return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
  } catch {
    return 'en';
  }
}

export function saveUiLang(lang: UiLang): void {
  try {
    localStorage.setItem(UI_LANG_KEY, lang);
  } catch { /* 저장 실패가 언어 전환을 막을 이유는 없다 */ }
}

const en = {
  // ── 앱 껍데기 ──
  appTitle: 'Tingdong (听懂)',
  navTranslate: 'Translate',
  navPractice: 'Read aloud',

  // ── 번역기 화면 ──
  settingsBtn: 'Settings',
  layoutParagraph: 'Paragraph',
  layoutParagraphHint: 'Natural flow, no gaps between words',
  layoutSpaced: 'Spaced',
  layoutSpacedHint: 'Space out each word so the boundaries are clear',
  pinyinHover: 'Pinyin on hover',
  pinyinHoverHint: 'Show pinyin only while the pointer rests on a word',
  pinyinAlways: 'Pinyin always',
  pinyinAlwaysHint: 'Always show pinyin above the characters',
  modeLiteral: 'Word by word',
  modeLocalized: 'Natural',
  autoWord: (on: boolean) => `Auto word meanings: ${on ? 'ON' : 'OFF'}`,
  autoWordHint: 'On: load every word meaning up front | Off: load only the word you hover',

  sourcePaneTitle: 'Chinese (Simplified) — detected',
  targetPaneTitle: 'English',
  clearHint: 'Clear the text',
  inputPlaceholder: 'Enter text',
  translationPlaceholder: 'The translation appears here.',
  editHint: 'Click the text to edit it again.',
  loading: 'Translating…',

  literalNeedsWords: 'Word-by-word view needs the individual meanings.',
  literalTurnOn: 'Turn on auto word meanings',
  literalHoverInstead: ' Or leave it off and hover a character on the left.',

  retranslating: 'Translating again…',
  sentenceFailed: 'Translation failed',
  retry: 'Try again',

  statusFree: 'Google Translate (free)',
  statusToChineseFailed: (reason: string) => `Could not convert to Chinese: ${reason}`,
  statusSomeFailed: (failed: number, total: number) =>
    `${failed} of ${total} sentences failed — press “Try again” where they are`,
  statusError: 'Something went wrong while translating.',

  // ── 설정 창 ──
  settingsHeading: 'Word dictionary engine',
  settingsNoteLead: 'Sentences are always translated by the free Google engine.',
  settingsNoteBody:
    ' It measures about 0.24s per sentence — far faster than an AI engine (several seconds) — and the quality gap is small. The engine you pick here is used only when you point at a word while reading aloud, and in the ⌘⇧F popup.',
  engineRowLabel: 'Dictionary engine:',
  engineFree: 'Google free',
  engineFreeNote: 'No key · no limit · default',
  engineOpenAI: 'OpenAI API',
  engineOpenAINote: 'Adds part of speech and examples · needs an API key',
  engineLmStudio: 'LM Studio',
  engineLmStudioNote: 'Local LLM · completely free',
  engineInfoFree:
    'Word meanings come from free Google Translate. No API key, no usage limit, and it is the fastest. You do not get part of speech or example sentences, but while reading aloud the sentence from your own script is shown as the example.',
  engineInfoOpenAILead: 'The dictionary uses OpenAI GPT-4o-mini.',
  engineInfoOpenAIBody:
    ' You get the meaning along with part of speech and an example. If it fails, the free engine fills in the meaning.',
  engineInfoOpenAILink: 'Get an API key →',
  engineInfoLmStudioLead: 'Uses a model running locally in LM Studio.',
  engineInfoLmStudioBody:
    ' No internet needed, completely free. Load a model in LM Studio and start the Local Server.',
  apiKeyLabel: 'API Key:',
  apiKeySaved: 'An API key is set (stored on this device only)',
  lmStudioUrlLabel: 'LM Studio server address:',
  lmStudioUrlNote: 'Start the server from LM Studio → Local Server. Default port: 1234',
  saveAndClose: 'Save and close',
  deleteKey: 'Delete key',

  // ── 읽기 연습: 원고 입력 ──
  scriptHeading: 'Paste your Chinese script',
  scriptIntro:
    'Sentences are split on 。！？ and line breaks. You can drop in a Word file (.docx) too, and any line without Chinese is skipped. Click in the script to put the cursor where you want reading to start.',
  scriptCount: (chars: string, sentences: number) => `${chars} characters · ${sentences} sentences`,
  scriptSkipped: (lines: number) => `· ${lines} lines skipped`,
  scriptSkippedHint: 'Lines with no Chinese are not read',
  readModeChinese: 'Chinese only',
  readModeChineseEnglish: 'Chinese + English (outside brackets)',
  readModeRaw: 'The script as it is',
  openFile: 'Open file',
  start: 'Start →',
  errDocx: 'Could not read the Word file. It may be damaged, or in the older .doc format.',
  errFileKind: (kind: string) =>
    `${kind} files cannot be read. Please use a text file (.txt, .md) or a Word file (.docx).`,
  errFileRead: 'Could not read the file.',
  errNotText: 'This does not read as text. Check that it is a UTF-8 text file.',
  errUnknownKind: 'These',

  // ── 읽기 연습: 진행 화면 ──
  backToScript: '← Edit script',
  statusPlaying: 'playing',
  statusLoadingAudio: 'loading',
  statusStopped: 'stopped',
  rangeChip: (a: number, b: number) => `↻ Loop ${a}–${b}`,
  rangeClear: 'Clear the loop (C)',
  rangePendingLead: (start: number) => `Loop starts at ${start} · press`,
  rangePendingTail: 'on the last sentence',
  rangeCancel: 'Cancel (C)',
  rangeSet: '↻ Loop a range',
  rangeSetHint: 'Start of the loop (A)',
  paceTitle: 'How fast it is actually reading',
  paceMuted: 'silent',
  paceMeasuring: 'measuring…',
  paceUnit: (cpm: number) => `${cpm} chars/min`,
  bannerNoBridge:
    'Running in a browser, so device voices are used. Online Chinese voices come from the Electron app',
  bannerFallback: (reason: string) =>
    `The online voice failed, so a device voice took over — ${reason}`,

  hintNext: 'next sentence',
  hintMove: 'move',
  hintRepeat: 'hear it again',
  hintStop: 'stop',
  hintHover: 'point at a word for its meaning',
  hintSilent: 'move without sound',
  hintSpeed: 'speed',
  hintScroll: 'scroll the script with the wheel',
  hintFont: 'text size',
  hintRange: 'loop a range ·',
  hintRangeClear: 'clear',

  // ── 읽기 연습: 메뉴바 ──
  menuSound: 'Sound',
  menuVoice: 'Voice',
  menuTone: 'Tone',
  menuFont: 'Typeface',
  menuSpeed: 'Speed',
  menuPinyin: 'Pinyin',
  menuText: 'Text',
  menuMore: 'More',
  menuMoreValue: 'pacing · source',
  on: 'On',
  off: 'Off',
  soundOnHint: 'Reads each sentence aloud',
  soundOffTitle: 'Off — prompter',
  soundOffHint: 'Text only. Auto-advance still moves at the set pace',
  voiceFemale: 'Female',
  voiceMale: 'Male',
  /** 음성 이름 옆에 붙는 한 마디. 키는 Edge TTS의 voiceId다 */
  voiceBlurbs: {
    'zh-CN-YunjianNeural': 'warm and driving',
    'zh-CN-YunyangNeural': 'news — steady, trustworthy',
    'zh-CN-YunxiNeural': 'bright and natural',
    'zh-CN-XiaoxiaoNeural': 'warm',
    'zh-CN-XiaoyiNeural': 'lively',
  } as Record<string, string>,
  toneSermon: 'Sermon',
  toneNews: 'News',
  toneChat: 'Conversation',
  toneHintSermon: 'slow, with long breaths',
  toneHintNews: 'clear and even',
  toneHintChat: 'natural, conversational',
  fontSans: 'Sans',
  fontSerif: 'Serif',
  fontSansHint: 'PingFang SC · for screens, crisp strokes',
  fontSerifHint: 'Songti SC · a printed feel',
  speedRate: 'Rate',
  speedPitch: 'Pitch',
  speedNoteMuted: (cpm: number) => `Advancing at about ${cpm} chars/min`,
  speedNoteLive: 'Actually reading at',
  speedKeysSlow: 'slower ·',
  speedKeysFast: 'faster',
  pinyinOff: 'Off',
  pinyinOffHint: 'Characters only',
  pinyinAbove: 'Above',
  pinyinAboveHint: 'Tone marks above each character',
  pinyinBelow: 'Below',
  pinyinBelowHint: 'Tone marks below each character',
  textSize: 'Size',
  textNextLines: 'Next sentences',
  textPrevLines: 'Previous sentences',
  textCountUnit: (n: number) => `${n}`,
  textKeysBig: 'bigger ·',
  textKeysSmall: 'smaller',
  shortcut: 'Shortcut',
  moreGap: 'Pause between',
  moreGapUnit: (s: string) => `${s}s`,
  moreReadWhat: 'What to read',
  readModeChineseHint: 'Skips Korean, English and pinyin',
  readModeChineseEnglishHint: 'Drops bracketed text, reads English mixed into a sentence',
  readModeRawHint: 'Nothing filtered out',
  moreAutoAdvance: 'Auto-advance',
  moreSplitLong: (maxChars: number) => `Split long sentences (${maxChars} chars)`,
  moreOffline: 'Offline only (device voice)',
  moreOfflineHint: 'Online voices are only available in the Electron app',
  moreReset: 'Back to defaults',
  menubarMuted: 'Sound off — prompter mode',

  // ── 단어 카드 ──
  cardSearching: 'looking it up…',
  cardLookupFailed: (reason: string) => `Could not get the meaning — ${reason}`,
  cardNotFound: 'No meaning found',
  cardEngineFallback: (engine: string) =>
    `${engine} failed — meaning only (no part of speech or example)`,
  cardSwitchBtn: 'Switch to the free dictionary',
  backToCurrent: 'Back to the current sentence ↩',
  cardExample: 'Example',
  cardSentenceFailed: 'Could not get this sentence’s meaning',
  cardSentenceLoading: 'translating…',
  cardSwitchToFree:
    'Switches the dictionary to the free engine. You can change it back in settings any time.',

  // ── 엔진 이름 ──
  engineNameFree: 'Google Translate (free)',
  engineNameLmStudio: 'LM Studio (local)',

  // ── 엔진 오류 (단어 카드·상태 줄에 그대로 나온다) ──
  errNoApiKey: 'There is no OpenAI API key.',
  errLmStudioHint: 'LM Studio — check that a model is loaded.',
  errLookupEmpty: 'The dictionary returned nothing',
  errLookupUnreadable: (head: string) => `Could not read the dictionary response: ${head}`,
  quotaExhausted:
    'The free tier limit keeps being exceeded — waiting may not help (it looks like a daily limit). Change the dictionary engine in settings.',
  quotaWaitMinutes: (minutes: number) =>
    `Free tier limit reached — the dictionary resumes in about ${minutes} min`,
  quotaWaitSeconds: (seconds: number) =>
    `Free tier limit reached — the dictionary resumes in about ${seconds}s`,

  // ── 팝업(⌘⇧F) ──
  popupSpeak: 'Play pronunciation',
  popupCopy: 'Copy',
  popupPin: 'Keep on top',
  popupClose: 'Close (ESC)',
  popupLoading: 'Loading translation…',
  popupCallingEngine: 'Calling the translation engine…',
  popupNoTranslation: 'No translation',
  popupPosTag: 'part of speech',
  popupDismissHint: 'Press Esc or click outside to close.',
  popupEngineFallback: (engine: string) => `⚠️ ${engine} failed → Google free`,
  popupFailedBadge: '❌ Translation failed',
  popupFetchFailed: (reason: string) => `Could not get the translation — ${reason}`,
  popupGrantBtn: 'Open permission settings',
  popupWarnAccessibility:
    "⚠️ Could not copy the selection automatically. In macOS System Settings → Privacy &amp; Security → Accessibility, check that this app (or the terminal running it) is allowed. (Without it, copy with <b>Cmd+C</b> first, then press the shortcut.)",
  popupWarnNoSelection:
    '⚠️ Nothing is selected. Select some text with the mouse, then press the shortcut.',
};

/**
 * 영어 표의 '모양'만 가져온다. `as const`로 굳히면 값까지 타입이 되어,
 * 한국어 표가 같은 키가 아니라 같은 문구를 요구받는다.
 */
export type Strings = typeof en;

const ko: Strings = {
  appTitle: '띵동 (听懂)',
  navTranslate: '번역기',
  navPractice: '읽기 연습',

  settingsBtn: '설정',
  layoutParagraph: '문장형',
  layoutParagraphHint: '띄어쓰기 없이 자연스러운 문장 정렬',
  layoutSpaced: '단어형',
  layoutSpacedHint: '단어별로 띄어쓰기하여 명확하게 정렬',
  pinyinHover: '호버 병음',
  pinyinHoverHint: '마우스를 대면 병음 노출',
  pinyinAlways: '항상 병음',
  pinyinAlwaysHint: '한자 위에 항시 병음 표시',
  modeLiteral: '직역',
  modeLocalized: '현지화',
  autoWord: (on: boolean) => `단어 자동 번역: ${on ? '켬' : '끔'}`,
  autoWordHint: '켬: 번역 시 모든 단어 해석 자동 로드 | 끔: 마우스 호버 시 필요한 단어만 로드',

  sourcePaneTitle: '중국어(간체) - 감지됨',
  targetPaneTitle: '한국어',
  clearHint: '텍스트 지우기',
  inputPlaceholder: '텍스트 입력',
  translationPlaceholder: '번역이 여기에 표시됩니다.',
  editHint: '본문을 클릭하면 다시 수정할 수 있습니다.',
  loading: '번역 중...',

  literalNeedsWords: '직역 모드는 단어별 뜻이 필요합니다.',
  literalTurnOn: '단어 자동 번역 켜기',
  literalHoverInstead: ' 끈 채로 보려면 왼쪽 한자에 마우스를 올리세요.',

  retranslating: '다시 번역 중…',
  sentenceFailed: '번역 실패',
  retry: '다시 시도',

  statusFree: 'Google 번역 (무료)',
  statusToChineseFailed: (reason: string) => `중국어 변환 실패: ${reason}`,
  statusSomeFailed: (failed: number, total: number) =>
    `${total}문장 중 ${failed}문장 번역 실패 — 해당 자리의 '다시 시도'를 누르세요`,
  statusError: '번역 중 오류가 발생했습니다.',

  settingsHeading: '단어 사전 엔진 설정',
  settingsNoteLead: '문장 번역은 항상 Google 무료 엔진을 씁니다.',
  settingsNoteBody:
    ' 실측으로 한 문장에 약 0.24초로, AI 엔진(수 초)보다 훨씬 빠르고 번역 품질 차이는 크지 않기 때문입니다. 여기서 고르는 엔진은 읽기 연습에서 단어를 짚었을 때와 ⌘⇧F 팝업의 사전에만 쓰입니다.',
  engineRowLabel: '단어 사전 엔진:',
  engineFree: 'Google 무료',
  engineFreeNote: '키 불필요 · 한도 없음 · 기본값',
  engineOpenAI: 'OpenAI API',
  engineOpenAINote: '품사·예문까지 · API Key 필요',
  engineLmStudio: 'LM Studio',
  engineLmStudioNote: '로컬 LLM · 완전 무료',
  engineInfoFree:
    'Google 무료 번역으로 단어 뜻을 찾습니다. API 키도 사용 한도도 없고 가장 빠릅니다. 품사·예문은 나오지 않지만, 읽기 연습에서는 원고의 그 문장을 용례로 함께 보여줍니다.',
  engineInfoOpenAILead: '단어 사전에 OpenAI GPT-4o-mini를 씁니다.',
  engineInfoOpenAIBody: ' 뜻과 함께 품사·예문이 나옵니다. 실패하면 무료 번역으로 뜻만 채웁니다.',
  engineInfoOpenAILink: 'API 키 발급 →',
  engineInfoLmStudioLead: 'LM Studio에서 로컬로 실행 중인 모델을 사용합니다.',
  engineInfoLmStudioBody:
    ' 인터넷 연결 불필요, 완전 무료. LM Studio에서 모델을 로드하고 Local Server를 시작해야 합니다.',
  apiKeyLabel: 'API Key:',
  apiKeySaved: 'API 키가 입력되어 있습니다 (로컬에만 저장)',
  lmStudioUrlLabel: 'LM Studio 서버 주소:',
  lmStudioUrlNote: 'LM Studio → Local Server 탭에서 서버를 시작하세요. 기본 포트: 1234',
  saveAndClose: '저장 및 닫기',
  deleteKey: '키 삭제',

  scriptHeading: '중국어 원고 붙여넣기',
  scriptIntro:
    '문장 부호(。！？)와 줄바꿈을 기준으로 문장을 나눕니다. 워드 문서(.docx)도 끌어다 놓을 수 있고, 한국어·병음이 섞여 있으면 읽지 않고 건너뜁니다. 원고를 눌러 커서를 두면 그 자리부터 읽습니다.',
  scriptCount: (chars: string, sentences: number) => `${chars}자 · ${sentences}문장`,
  scriptSkipped: (lines: number) => `· 건너뛴 줄 ${lines}`,
  scriptSkippedHint: '중국어가 없어 읽지 않는 줄입니다',
  readModeChinese: '중국어만 읽기',
  readModeChineseEnglish: '중국어 + 영어 (괄호 제외)',
  readModeRaw: '원고 그대로',
  openFile: '파일 열기',
  start: '시작 →',
  errDocx: '워드 문서를 읽지 못했습니다. 손상되었거나 .doc(구버전) 형식일 수 있습니다.',
  errFileKind: (kind: string) =>
    `${kind} 파일은 읽지 못합니다. 텍스트 파일(.txt·.md)이나 워드 문서(.docx)를 넣어주세요.`,
  errFileRead: '파일을 읽지 못했습니다.',
  errNotText: '텍스트로 읽히지 않는 파일입니다. UTF-8 텍스트 파일인지 확인해주세요.',
  errUnknownKind: '이',

  backToScript: '← 원고 수정',
  statusPlaying: '재생 중',
  statusLoadingAudio: '불러오는 중',
  statusStopped: '정지',
  rangeChip: (a: number, b: number) => `↻ 구간 ${a}–${b}`,
  rangeClear: '구간 해제 (C)',
  rangePendingLead: (start: number) => `구간 시작 ${start} · 끝낼 문장에서`,
  rangePendingTail: '',
  rangeCancel: '취소 (C)',
  rangeSet: '↻ 구간 반복',
  rangeSetHint: '구간 반복 시작점 (A)',
  paceTitle: '실제로 읽고 있는 속도',
  paceMuted: '무음',
  paceMeasuring: '측정 중…',
  paceUnit: (cpm: number) => `${cpm}자/분`,
  bannerNoBridge:
    '브라우저에서 실행 중이라 기기 내장 음성을 씁니다. 온라인 중국어 음성은 Electron 앱에서 나옵니다',
  bannerFallback: (reason: string) => `온라인 음성에 실패해 기기 음성으로 전환했습니다 — ${reason}`,

  hintNext: '다음 문장',
  hintMove: '이동',
  hintRepeat: '다시 듣기',
  hintStop: '정지',
  hintHover: '단어에 마우스 = 뜻',
  hintSilent: '이동 = 소리 없이',
  hintSpeed: '속도',
  hintScroll: '휠로 원고 훑기',
  hintFont: '글자',
  hintRange: '구간 반복 ·',
  hintRangeClear: '해제',

  menuSound: '소리',
  menuVoice: '목소리',
  menuTone: '톤',
  menuFont: '서체',
  menuSpeed: '속도',
  menuPinyin: '병음',
  menuText: '글자',
  menuMore: '더보기',
  menuMoreValue: '진행·소스',
  on: '켬',
  off: '끔',
  soundOnHint: '문장을 읽어줍니다',
  soundOffTitle: '끔 — 프롬프터',
  soundOffHint: '소리 없이 글만. 자동 진행은 속도에 맞춰 계속 넘어갑니다',
  voiceFemale: '여성',
  voiceMale: '남성',
  voiceBlurbs: {
    'zh-CN-YunjianNeural': '열정적',
    'zh-CN-YunyangNeural': '뉴스·신뢰감',
    'zh-CN-YunxiNeural': '밝고 자연스러움',
    'zh-CN-XiaoxiaoNeural': '따뜻함',
    'zh-CN-XiaoyiNeural': '발랄함',
  },
  toneSermon: '설교',
  toneNews: '뉴스',
  toneChat: '대화',
  toneHintSermon: '느리고 호흡이 길게',
  toneHintNews: '또렷하고 균일하게',
  toneHintChat: '자연스러운 대화체',
  fontSans: '고딕',
  fontSerif: '명조',
  fontSansHint: 'PingFang SC · 화면용, 획이 선명',
  fontSerifHint: 'Songti SC · 인쇄물 느낌',
  speedRate: '배속',
  speedPitch: '음높이',
  speedNoteMuted: (cpm: number) => `넘어가는 속도 약 ${cpm}자/분`,
  speedNoteLive: '실제 읽는 속도',
  speedKeysSlow: '느리게 ·',
  speedKeysFast: '빠르게',
  pinyinOff: '끔',
  pinyinOffHint: '한자만 보기',
  pinyinAbove: '한자 위',
  pinyinAboveHint: '글자마다 성조를 얹어 표시',
  pinyinBelow: '한자 아래',
  pinyinBelowHint: '글자마다 성조를 밑에 표시',
  textSize: '크기',
  textNextLines: '다음 문장',
  textPrevLines: '이전 문장',
  textCountUnit: (n: number) => `${n}개`,
  textKeysBig: '크게 ·',
  textKeysSmall: '작게',
  shortcut: '단축키',
  moreGap: '진행 간격',
  moreGapUnit: (s: string) => `${s}초`,
  moreReadWhat: '무엇을 읽을지',
  readModeChineseHint: '한국어·영어·병음을 모두 건너뜀',
  readModeChineseEnglishHint: '괄호 안은 버리고, 문장에 섞인 영어는 읽음',
  readModeRawHint: '거르지 않음',
  moreAutoAdvance: '자동 진행',
  moreSplitLong: (maxChars: number) => `긴 문장 쪼개기 (${maxChars}자)`,
  moreOffline: '오프라인 전용 (기기 음성)',
  moreOfflineHint: 'Electron 앱에서만 온라인 음성을 쓸 수 있습니다',
  moreReset: '기본값으로 되돌리기',
  menubarMuted: '소리 꺼짐 — 프롬프터 모드',

  cardSearching: '찾는 중…',
  cardLookupFailed: (reason: string) => `뜻을 가져오지 못했습니다 — ${reason}`,
  cardNotFound: '뜻을 찾지 못했습니다',
  cardEngineFallback: (engine: string) => `${engine} 실패 — 무료 뜻만 (품사·예문 없음)`,
  cardSwitchBtn: '무료 사전으로 바꾸기',
  backToCurrent: '현재 문장으로 ↩',
  cardExample: '예문',
  cardSentenceFailed: '이 문장의 뜻을 가져오지 못했습니다',
  cardSentenceLoading: '번역 중…',
  cardSwitchToFree: '사전 엔진을 무료로 바꿉니다. 설정에서 언제든 되돌릴 수 있습니다.',

  engineNameFree: 'Google 번역 (무료)',
  engineNameLmStudio: 'LM Studio (로컬)',

  errNoApiKey: 'OpenAI API Key가 없습니다.',
  errLmStudioHint: 'LM Studio — 모델이 로드돼 있는지 확인하세요.',
  errLookupEmpty: '사전 응답이 비어 있습니다',
  errLookupUnreadable: (head: string) => `사전 응답을 읽지 못했습니다: ${head}`,
  quotaExhausted:
    '무료 등급 한도를 계속 넘고 있습니다 — 기다려서 될 일이 아닐 수 있습니다(하루 한도). 설정에서 사전 엔진을 바꾸세요.',
  quotaWaitMinutes: (minutes: number) => `무료 등급 한도 초과 — 약 ${minutes}분 뒤에 다시 사전을 씁니다`,
  quotaWaitSeconds: (seconds: number) => `무료 등급 한도 초과 — 약 ${seconds}초 뒤에 다시 사전을 씁니다`,

  popupSpeak: '발음 듣기',
  popupCopy: '복사',
  popupPin: '핀 고정',
  popupClose: '닫기 (ESC)',
  popupLoading: '번역 로딩 중...',
  popupCallingEngine: '번역 엔진 호출 중...',
  popupNoTranslation: '번역 정보 없음',
  popupPosTag: '품사',
  popupDismissHint: 'Esc를 누르거나 외부를 클릭하면 닫힙니다.',
  popupEngineFallback: (engine: string) => `⚠️ ${engine} 실패 → Google 무료`,
  popupFailedBadge: '❌ 번역 실패',
  popupFetchFailed: (reason: string) => `번역을 가져오지 못했습니다 — ${reason}`,
  popupGrantBtn: '권한 설정 열기',
  popupWarnAccessibility:
    "⚠️ 클립보드 자동 복사에 실패했습니다. macOS의 '시스템 설정 &gt; 개인정보 보호 및 보안 &gt; 손쉬운 사용(Accessibility)'에서 이 앱(또는 실행 중인 터미널)의 권한이 켜져 있는지 확인해 주세요. (미허용 시 직접 <b>Cmd+C</b> 복사 후 단축키를 눌러야 작동합니다.)",
  popupWarnNoSelection: '⚠️ 선택된 텍스트가 없습니다. 마우스 드래그로 텍스트를 선택한 후 단축키를 눌러주세요.',
};

const TABLES: Record<UiLang, Strings> = { ko, en };

export function stringsFor(lang: UiLang): Strings {
  return TABLES[lang];
}
