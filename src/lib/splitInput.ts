/**
 * 입력 원고를 다루는 자잘한 판단들.
 *
 * 번역기 탭이 "이 글이 중국어인가"를 묻고, 그 답에 따라 번역 방향이 갈린다.
 * 판단이 틀리면 화면 양쪽이 통째로 뒤바뀌므로 여기서 한 벌로 두고 시험한다.
 */

/** 한자 (CJK 통합 한자) */
const HAN = /[一-鿿]/g;
/** 한글 — 완성형 음절과 자모를 모두 센다 */
const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/g;

const count = (text: string, re: RegExp) => (text.match(re) || []).length;

/**
 * 한국어로 보기 시작하는 한글 비율. 한자 열 자당 한글 한 자.
 *
 * 그냥 '한글이 하나라도 있으면 한국어'로 하면, 한국어 제목 한 줄이 붙은
 * 중국어 원고가 통째로 뒤집힌다. 반대로 글자 수를 단순 비교하면
 * 한자가 많은 한국어('大韓民國은 民主共和國이다')를 중국어로 오인한다.
 * 그 사이를 가르는 선이다.
 */
const HANGUL_RATIO = 10;

/**
 * 이 글을 중국어로 볼 것인가. 번역 방향이 여기서 갈린다.
 *
 * 한자가 하나라도 있으면 중국어로 치던 예전 방식은 한자 섞인 한국어를 오인했다.
 * 한자가 없으면 볼 것도 없이 중국어가 아니다 — 영어도 여기로 온다.
 */
export function isChineseSource(text: string): boolean {
  const han = count(text, HAN);
  if (han === 0) return false;
  return count(text, HANGUL) * HANGUL_RATIO < han;
}

/** 문장 끝으로 보는 부호 */
const ENDINGS = '。！？!?…';
/** 끝 부호 뒤에 따라오면 앞 문장에 붙여주는 닫는 기호 */
const CLOSERS = '”’"\'』」）)]】';

/**
 * 원고를 문장으로 나눈다.
 *
 * 중국어 부호(。！？)만 보던 예전 방식은 한국어·영어 원고를 한 문장으로 뭉갰다.
 * 서양식 마침표도 경계로 보되, 뒤에 공백이나 글 끝이 올 때만 자른다 —
 * 그러지 않으면 '3.5'나 'U.S.A.'가 문장 셋으로 쪼개진다.
 */
/**
 * 이 마침표가 문장 끝인가.
 *
 * 뒤에 공백이나 글 끝이 와야 하고('3.5'를 지킨다), 다음 문장이 소문자로
 * 시작하면 문장 끝이 아니다 — 'U.S.A. now'의 약어 마침표를 걸러낸다.
 * 한글·한자로 이어지면 대소문자가 없으므로 그대로 문장 끝으로 본다.
 */
function isDotSentenceEnd(text: string, i: number): boolean {
  const rest = text.slice(i + 1);
  if (rest === '') return true;
  if (!/^\s/.test(rest)) return false;
  return !/^\s+[a-z]/.test(rest);
}

export function splitIntoSentences(text: string): string[] {
  const out: string[] = [];
  let cur = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    cur += ch;

    const isNewline = ch === '\n';
    const isEnding = ENDINGS.includes(ch);
    const isDot = ch === '.' && isDotSentenceEnd(text, i);
    if (!isNewline && !isEnding && !isDot) continue;

    // 부호가 연달아 오면 함께 삼킨다 ('뭐라고?!', '그리고……')
    if (!isNewline) {
      while (i + 1 < text.length && (ENDINGS.includes(text[i + 1]) || text[i + 1] === '.')) cur += text[++i];
    }
    // 닫는 따옴표·괄호는 앞 문장 것이다 (他说：“我来了。” → 한 문장)
    while (i + 1 < text.length && CLOSERS.includes(text[i + 1])) cur += text[++i];

    out.push(cur);
    cur = '';
  }
  if (cur) out.push(cur);

  return out.map((s) => s.trim()).filter(Boolean);
}
