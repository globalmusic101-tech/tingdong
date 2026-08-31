/**
 * 실측 읽기 속도 — 배속 숫자(1.05x)만으로는 빠른지 느린지 알 수 없어서,
 * 실제로 재생된 시간으로 분당 글자 수를 낸다.
 */

/** 이보다 짧게 끝난 재생은 소리가 난 게 아니라 오류다 */
const MIN_SECONDS = 0.3;

/** 한두 글자짜리 조각은 속도를 대표하지 못한다 */
const MIN_CHARS = 2;

export function charsPerMinute(chars: number, seconds: number): number | null {
  if (chars < MIN_CHARS || seconds < MIN_SECONDS) return null;
  return Math.round((chars / seconds) * 60);
}

/** 문장마다 들쭉날쭉해서 최근 몇 개를 평균낸다 */
export const SAMPLE_WINDOW = 5;

export function averagePace(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;
  return Math.round(samples.reduce((sum, n) => sum + n, 0) / samples.length);
}
