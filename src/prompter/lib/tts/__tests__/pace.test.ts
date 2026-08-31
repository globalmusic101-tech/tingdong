import { describe, expect, it } from 'vitest';
import { averagePace, charsPerMinute } from '../pace';

describe('charsPerMinute', () => {
  it('재생 시간으로 분당 글자 수를 낸다', () => {
    expect(charsPerMinute(12, 3)).toBe(240);      // 4자/초
    expect(charsPerMinute(11, 6.22)).toBe(106);   // 실측 예: 云希 기본 배속
  });

  it('즉시 끝난 재생은 속도가 아니다', () => {
    expect(charsPerMinute(12, 0.1)).toBeNull();
  });

  it('한두 글자짜리 조각은 세지 않는다', () => {
    expect(charsPerMinute(1, 2)).toBeNull();
  });
});

describe('averagePace', () => {
  it('표본이 없으면 값이 없다', () => {
    expect(averagePace([])).toBeNull();
  });

  it('표본을 평균내 반올림한다', () => {
    expect(averagePace([200, 210, 220])).toBe(210);
    expect(averagePace([201, 202])).toBe(202);   // 201.5 → 202
  });
});
