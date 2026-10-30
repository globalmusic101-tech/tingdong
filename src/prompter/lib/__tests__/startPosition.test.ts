import { describe, expect, it } from 'vitest';
import { startIndexFor } from '../startPosition';

describe('읽기 연습 시작 위치', () => {
  it('커서가 없으면 저장된 위치와 무관하게 첫 문장을 고른다', () => {
    expect(startIndexFor(null, () => 17)).toBe(0);
  });

  it('커서를 골랐으면 해당 위치의 문장을 고른다', () => {
    expect(startIndexFor(120, (caret) => Math.floor(caret / 10))).toBe(12);
  });
});
