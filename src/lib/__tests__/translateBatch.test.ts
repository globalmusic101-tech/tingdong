import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FREE_BATCH_SENTENCES,
  FREE_MAX_CHARS,
  groupSentencesForFree,
  translateSentencesFree,
} from '../translate';

/** 구글 무료 API가 돌려주는 모양 그대로 흉내낸다 */
const reply = (text: string) =>
  ({ ok: true, status: 200, json: async () => [[[text, '', null, null, 0]]] }) as unknown as Response;

describe('묶음 나누기', () => {
  it('문장 수 한도에서 끊는다', () => {
    const sentences = Array.from({ length: FREE_BATCH_SENTENCES * 2 + 1 }, (_, i) => `문장${i}。`);
    const groups = groupSentencesForFree(sentences);
    expect(groups.map((g) => g.length)).toEqual([FREE_BATCH_SENTENCES, FREE_BATCH_SENTENCES, 1]);
    // 문장이 하나도 빠지거나 겹치지 않는다
    expect(groups.flat()).toEqual(sentences.map((_, i) => i));
  });

  it('글자 수 한도를 넘기지 않는다 — 넘기면 안에서 또 쪼개져 줄이 밀린다', () => {
    const long = '가'.repeat(FREE_MAX_CHARS / 3);
    const groups = groupSentencesForFree([long, long, long, long]);
    for (const group of groups) {
      const chars = group.reduce((sum, i) => sum + [long, long, long, long][i].length + 1, 0);
      expect(chars).toBeLessThanOrEqual(FREE_MAX_CHARS);
    }
    expect(groups.flat()).toEqual([0, 1, 2, 3]);
  });

  it('혼자서도 한도를 넘는 문장은 홀로 둔다', () => {
    const huge = '가'.repeat(FREE_MAX_CHARS + 10);
    expect(groupSentencesForFree(['짧다。', huge, '짧다。'])).toEqual([[0], [1], [2]]);
  });

  it('빈 목록은 빈 묶음이다', () => {
    expect(groupSentencesForFree([])).toEqual([]);
  });
});

describe('묶음 번역', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('세 문장을 요청 한 번으로 끝낸다', async () => {
    fetchMock.mockResolvedValue(reply('하나\n둘\n셋'));

    const out = await translateSentencesFree(['一。', '二。', '三。'], 'ko');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.get(0)).toBe('하나');
    expect(out.get(1)).toBe('둘');
    expect(out.get(2)).toBe('셋');
  });

  it('줄 수가 어긋나면 그 묶음을 통째로 버린다 — 밀린 뜻을 붙이느니 비운다', async () => {
    fetchMock.mockResolvedValue(reply('하나\n둘'));

    const out = await translateSentencesFree(['一。', '二。', '三。'], 'ko');

    expect(out.size).toBe(0);
  });

  it('묶음이 실패해도 던지지 않는다 — 부르는 쪽이 문장별로 되돌아간다', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const out = await translateSentencesFree(['一。', '二。'], 'ko');

    expect(out.size).toBe(0);
  });

  it('빈 줄로 돌아온 문장은 채우지 않는다', async () => {
    fetchMock.mockResolvedValue(reply('하나\n\n셋'));

    const out = await translateSentencesFree(['一。', '二。', '三。'], 'ko');

    expect(out.get(0)).toBe('하나');
    expect(out.has(1)).toBe(false);
    expect(out.get(2)).toBe('셋');
  });
});
