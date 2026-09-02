/**
 * 교차 하이라이트 매칭 (01-prd F11-3).
 *
 * 왼쪽 한자에 마우스를 올리면 오른쪽 번역에서 대응하는 자리가 강조된다.
 * 이 매칭 규칙은 언어마다 다르다.
 *
 * - 한국어: 조사가 붙는다. `기적`이 `기적도`에 걸려야 하므로 부분 문자열로 찾는다.
 *   대신 한 글자('의', '은')로 찾으면 문장 절반이 물들어 두 글자부터만 쓴다.
 * - 영어: 조사가 없으니 부분 문자열이 필요 없고, 쓰면 `on`이 `only`에 걸린다.
 *   낱말 단위로 맞추되 대소문자·구두점은 무시한다.
 */

export type MatchLang = 'ko' | 'en';

/** 한국어에서 강조어로 쓸 최소 길이 */
const KO_MIN = 2;
/** 영어에서 강조어로 쓸 최소 길이 */
const EN_MIN = 3;

/**
 * 3글자 이상인 영어 기능어. 이보다 짧은 것(`a` `of` `to`)은 길이로 이미 걸러진다.
 * 늘리는 기준은 짐작이 아니라 실제로 문장이 물드는 것을 본 낱말이다 —
 * 짐작으로 늘리면 정작 강조돼야 할 낱말이 조용히 빠진다. (03-architecture §8)
 */
const EN_STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'were',
  'has', 'have', 'had', 'you', 'your', 'they', 'them', 'their', 'its', 'but',
  'not', 'all', 'any', 'can', 'will', 'would',
]);

/** 영어 낱말에서 비교에 쓸 알맹이만 남긴다 — `Miracle,` → `miracle` */
function normalizeEn(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * 단어 뜻 하나를 강조어 목록으로 바꾼다.
 * 쓸 수 없는 뜻(너무 짧거나 기능어뿐)이면 빈 배열 — 아무것도 강조하지 않는다.
 */
export function highlightTerms(literal: string, lang: MatchLang): string[] {
  const cleaned = literal.replace(/[~[\]]/g, '').trim();
  if (!cleaned) return [];

  if (lang === 'ko') {
    return cleaned.length >= KO_MIN ? [cleaned] : [];
  }

  // 영어 뜻은 한 낱말이 아닐 수 있다 — `to look forward to` 같은 것
  const terms = cleaned
    .split(/\s+/)
    .map(normalizeEn)
    .filter((word) => word.length >= EN_MIN && !EN_STOPWORDS.has(word));

  // 같은 낱말이 두 번 들어와도 결과는 같다 — 중복은 지운다
  return Array.from(new Set(terms));
}

/** 번역문에서 잘라낸 낱말 하나가 강조 대상인가 */
export function matchesHighlight(word: string, terms: string[], lang: MatchLang): boolean {
  if (terms.length === 0) return false;

  if (lang === 'ko') return terms.some((term) => word.includes(term));

  const normalized = normalizeEn(word);
  if (!normalized) return false;
  return terms.some((term) => normalized === term);
}
