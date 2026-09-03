import { describe, expect, it } from 'vitest';
import { isChineseSource, splitIntoSentences } from '../splitInput';

describe('중국어인지 가리기', () => {
  it('중국어 원고는 중국어다', () => {
    expect(isChineseSource('我小时候住在南方的一个小城。')).toBe(true);
  });

  it('한국어 원고는 중국어가 아니다', () => {
    expect(isChineseSource('나는 어렸을 때 남쪽의 작은 마을에 살았습니다.')).toBe(false);
  });

  it('한자가 섞인 한국어를 중국어로 오인하지 않는다', () => {
    // 한자가 하나라도 있으면 중국어로 치던 예전 방식이 통째로 틀리던 자리
    expect(isChineseSource('大韓民國은 民主共和國이다')).toBe(false);
    expect(isChineseSource('이번 週末에 만나요')).toBe(false);
  });

  it('한국어가 눈에 띄게 섞이면 한국어로 본다', () => {
    expect(isChineseSource('我们明天见面吧，그래요?')).toBe(false);
  });

  it('긴 중국어 원고에 한국어 제목 한 줄이 붙어도 중국어다', () => {
    const 원고 = '我小时候住在南方的一个小城。'.repeat(10);
    expect(isChineseSource(`설교 원고\n${원고}`)).toBe(true);
  });

  it('영어와 빈 글은 중국어가 아니다 — 중국어로 옮겨야 할 쪽이다', () => {
    expect(isChineseSource('See you tomorrow.')).toBe(false);
    expect(isChineseSource('')).toBe(false);
    expect(isChineseSource('12345 !!')).toBe(false);
  });
});

describe('문장 나누기', () => {
  it('중국어 부호에서 자르고 부호는 앞 문장에 남긴다', () => {
    expect(splitIntoSentences('我来了。你好吗？走吧！')).toEqual(['我来了。', '你好吗？', '走吧！']);
  });

  it('한국어 마침표에서도 자른다 — 예전에는 통째로 한 문장이었다', () => {
    expect(splitIntoSentences('안녕하세요. 반갑습니다. 잘 부탁드립니다.')).toEqual([
      '안녕하세요.',
      '반갑습니다.',
      '잘 부탁드립니다.',
    ]);
  });

  it('소수점과 약어는 쪼개지 않는다', () => {
    expect(splitIntoSentences('가격은 3.5달러입니다.')).toEqual(['가격은 3.5달러입니다.']);
    expect(splitIntoSentences('He lives in the U.S.A. now.')).toEqual(['He lives in the U.S.A. now.']);
    // 대문자로 이어지면 새 문장이다
    expect(splitIntoSentences('It rained. Then we left.')).toEqual(['It rained.', 'Then we left.']);
  });

  it('닫는 따옴표는 앞 문장에 붙인다', () => {
    expect(splitIntoSentences('他说：“我来了。”然后走了。')).toEqual(['他说：“我来了。”', '然后走了。']);
  });

  it('연달아 오는 부호를 함께 삼킨다', () => {
    expect(splitIntoSentences('뭐라고?! 정말요……')).toEqual(['뭐라고?!', '정말요……']);
  });

  it('줄바꿈도 경계다', () => {
    expect(splitIntoSentences('첫 줄\n둘째 줄\n\n셋째 줄')).toEqual(['첫 줄', '둘째 줄', '셋째 줄']);
  });

  it('부호 없는 한 줄은 통째로 한 문장이다', () => {
    expect(splitIntoSentences('부호가 하나도 없는 글')).toEqual(['부호가 하나도 없는 글']);
  });

  it('빈 글은 빈 목록이다', () => {
    expect(splitIntoSentences('')).toEqual([]);
    expect(splitIntoSentences('   \n  ')).toEqual([]);
  });
});
