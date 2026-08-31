/**
 * 읽을거리가 아닌 것을 걷어낸다.
 *
 * 원칙: 읽을 수 없는 것은 고치려 들지 않고 그냥 목록에 넣지 않는다.
 * 원고에 남은 한국어 메모는 중국어 음성이 읽어봐야 소리만 망친다.
 */

/** 원고를 어떻게 읽을지 */
export type ReadMode =
  /** 중국어만. 한국어·영어·병음을 모두 뺀다 */
  | 'chinese'
  /** 중국어 + 문장에 섞인 영어. 괄호 안은 버린다 */
  | 'chinese-english'
  /** 원고 그대로 */
  | 'raw';

/**
 * 한자 — 기본(U+4E00–9FFF), 확장A(U+3400–4DBF), 호환(U+F900–FAFF).
 * 코드포인트로 적는다: 호환 영역의 첫 글자 U+F900은 일반 한자 U+8C48과
 * 생김새가 같아서, 글자를 그대로 쓰면 범위가 한글까지 삼킨다.
 */
const HAN = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g;

/** 한글 — 음절, 자모, 호환 자모 */
const HANGUL = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]+/g;

/** 라틴 문자와 성조 부호 붙은 병음 */
const LATIN = /[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ]+/g;

/** 괄호 주석 — `（주: …）` `(yīnwèi)` `[note]`. 「」『』는 인용이라 건드리지 않는다 */
const BRACKETED = /[（(\[【][^）)\]】]*[）)\]】]/g;

/** 마크다운 장식과 목록 기호 */
const DECORATION = /^[#>*\-\s]+/;

/** 정리 후 앞머리에 남은 구두점 — 한국어를 지운 자리에 부호와 공백만 남는다 */
const LEADING_PUNCT = /^[\s，。！？；：、…—·,.!?;:]+/;

/** 한국어를 지우면서 한자 사이에 생긴 빈틈 */
const CJK_OR_PUNCT = '\\u4E00-\\u9FFF\\u3400-\\u4DBF，。！？；：、「」『』（）';
const GAP_BETWEEN_CJK = new RegExp(`(?<=[${CJK_OR_PUNCT}])\\s+(?=[${CJK_OR_PUNCT}])`, 'g');

export const hanCount = (text: string): number => (text.match(HAN) ?? []).length;

/**
 * 한 줄에서 읽지 않을 부분을 덜어낸다.
 * 숫자와 중국어 구두점은 남긴다 — `2026年3月`은 정상적으로 읽힌다.
 */
export function cleanScript(line: string, mode: ReadMode): string {
  if (mode === 'raw') return line.trim();

  const keepEnglish = mode === 'chinese-english';

  let s = line.replace(DECORATION, '');

  // 영어를 읽는 모드에서는 괄호 안을 통째로 버린다 — 원고의 괄호는 대개 한국어 주석이다.
  // 중국어만 읽는 모드에서는 괄호 안이 중국어면 본문이므로 살린다.
  s = s.replace(BRACKETED, (m) => (!keepEnglish && hanCount(m) >= 2 ? m : ''));

  s = s.replace(HANGUL, '');
  if (!keepEnglish) s = s.replace(LATIN, '');

  // 영어를 남길 때는 단어 사이 공백을 지우면 안 된다 (`COPY vs CREATE`)
  s = keepEnglish
    ? s.replace(/\s+/g, ' ').replace(GAP_BETWEEN_CJK, '')
    : s.replace(/[ \t]+/g, '');

  return s.replace(LEADING_PUNCT, '').trim();
}

/** 영어 낱말 — 한 글자짜리(`R:` 같은 항목 기호)는 낱말로 치지 않는다 */
const ENGLISH_WORDS = /[A-Za-z][A-Za-z']+/g;

/**
 * 영어만 남은 줄이 "문장"인지 "제목"인지 가른다.
 *
 * 원고에는 영어로 적은 문장(`You don't need to be a missionary…`)과
 * 표 머리글(`COPY vs CREATE`, `A: Apple`, `SNS`)이 함께 있다. 앞의 것은 읽어야 하고
 * 뒤의 것은 읽으면 방해가 된다.
 *
 * 가르는 신호는 소문자다. 제목은 약어와 고유명사로 이루어져 대문자로 시작하지만,
 * 문장에는 소문자 낱말(to, be, just…)이 반드시 섞인다.
 */
function looksLikeEnglishSentence(text: string): boolean {
  const words = text.match(ENGLISH_WORDS) ?? [];
  if (words.length < 3) return false;

  const lowercase = words.filter((w) => w === w.toLowerCase());
  return lowercase.length >= 2;
}

/**
 * 읽을 만한가.
 * 한자 2자 미만이면 부스러기다 (`(4:7)` → `管` → `→→`).
 * 영어를 읽는 모드에서는 영어로 적은 문장도 읽는다.
 */
export const isReadable = (text: string, mode: ReadMode): boolean => {
  if (mode === 'raw') return /[\p{L}\p{N}]/u.test(text);
  if (hanCount(text) >= 2) return true;
  return mode === 'chinese-english' && looksLikeEnglishSentence(text);
};
