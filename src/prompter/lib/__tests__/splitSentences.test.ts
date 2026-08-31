import { describe, expect, it } from 'vitest';
import { splitSentences } from '../splitSentences';
import { hanCount } from '../extractChinese';

const texts = (raw: string, options?: Parameters<typeof splitSentences>[1]) =>
  splitSentences(raw, options).sentences.map((s) => s.text);

const skipped = (raw: string, options?: Parameters<typeof splitSentences>[1]) =>
  splitSentences(raw, options).skippedLines;

describe('splitSentences', () => {
  it('한 줄 안의 여러 문장을 끝 부호에서 나눈다', () => {
    expect(texts('大家好，很高兴见到你！我是老师。')).toEqual([
      '大家好，很高兴见到你！',
      '我是老师。',
    ]);
  });

  it('닫는 따옴표를 앞 문장에 붙이고 그 뒤에서 나눈다', () => {
    expect(texts('他说：“我来了。”然后走了。')).toEqual([
      '他说：“我来了。”',
      '然后走了。',
    ]);
  });

  it('연속된 끝 부호를 한 문장으로 묶는다', () => {
    expect(texts('真的吗？？好的……我明白了。')).toEqual([
      '真的吗？？',
      '好的……',
      '我明白了。',
    ]);
  });

  it('마침표 없이 줄만 바꾼 원고도 줄 단위로 나눈다', () => {
    expect(texts('第一行\n第二行\n\n第三行')).toEqual(['第一行', '第二行', '第三行']);
  });

  it('숫자와 중국어 구두점을 보존한다', () => {
    expect(texts('2001年，我来到北京。')).toEqual(['2001年，我来到北京。']);
  });

  it('부호뿐인 조각은 버린다', () => {
    expect(texts('。。。\n！\n你好。')).toEqual(['你好。']);
  });

  it('기본값에서는 긴 문장을 쪼개지 않는다', () => {
    const long = '这是一个很长很长的句子，用来测试逗号分割功能，因为它超过了四十五个字的限制，所以应该被分成好几段。';
    expect(texts(long)).toHaveLength(1);
  });

  it('옵션을 켜면 긴 문장을 쉼표에서 쪼갠다', () => {
    const long = '这是一个很长很长的句子，用来测试逗号分割功能，因为它超过了四十五个字的限制，所以应该被分成好几段。';
    const parts = texts(long, { splitLong: true, maxChars: 20 });
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join('')).toBe(long);        // 글자를 잃지 않는다
    expect(parts.every((p) => p.length <= 30)).toBe(true);
  });

  it('빈 원고는 빈 배열', () => {
    expect(texts('   \n\n  ')).toEqual([]);
  });
});

describe('중국어가 아니면 읽지 않는다', () => {
  it('한국어만 있는 줄은 통째로 건너뛴다', () => {
    const raw = '안녕하세요, 반갑습니다!\n大家好！\n오늘은 날씨 이야기입니다.';
    expect(texts(raw)).toEqual(['大家好！']);
    expect(skipped(raw)).toBe(2);
  });

  it('한 줄에 한국어와 중국어가 섞여 있으면 중국어만 남긴다', () => {
    expect(texts('사람마다 다릅니다. 每个人都不一样，对吧？'))
      .toEqual(['每个人都不一样，对吧？']);
  });

  it('영어와 병음을 걷어낸다', () => {
    expect(texts('因为 (yīnwèi) 天气 nice 很好。')).toEqual(['因为天气很好。']);
  });

  it('비중국어 괄호 주석을 통째로 지운다', () => {
    expect(texts('今天天气很好 (오늘 날씨가 좋다)')).toEqual(['今天天气很好']);
  });

  it('한자가 2자 미만이면 부스러기로 보고 버린다', () => {
    // 한국어 문장에 낀 한자 한 글자 — 정리하면 `管` 만 남는다
    expect(texts('이 글자는 관(管)이라고 읽는다')).toEqual([]);
    expect(texts('"인용한 문장" (참고 4:7)')).toEqual([]);
  });

  it('숫자와 중국어 구두점은 남긴다', () => {
    expect(texts('2001年，我来到北京学习。')).toEqual(['2001年，我来到北京学习。']);
  });

  it('필터를 끄면 원고를 있는 그대로 남긴다', () => {
    expect(texts('안녕하세요 大家好！', { readMode: 'raw' }))
      .toEqual(['안녕하세요 大家好！']);
  });

  it('순수 중국어 원고에는 아무 영향이 없다', () => {
    const raw = '大家好，很高兴见到你！我是老师。';
    expect(texts(raw)).toEqual(texts(raw, { readMode: 'raw' }));
    expect(skipped(raw)).toBe(0);
  });
});

describe("'중국어 + 영어' 모드", () => {
  const en = (raw: string) => texts(raw, { readMode: 'chinese-english' });

  it('문장에 섞인 영어를 남긴다', () => {
    expect(en('我们不是要 COPY，而是要 CREATE 新的东西。'))
      .toEqual(['我们不是要 COPY，而是要 CREATE 新的东西。']);
  });

  it('영어 단어 사이 공백을 없애지 않는다', () => {
    expect(en('他说 You do not need to worry。'))
      .toEqual(['他说 You do not need to worry。']);
  });

  it('괄호 안은 내용과 상관없이 버린다', () => {
    expect(en('我们要 CREATE (새로운 것) 新东西。')).toEqual(['我们要 CREATE 新东西。']);
    expect(en('因为 (yīnwèi) 天气很好。')).toEqual(['因为天气很好。']);
  });

  it('한국어는 여전히 지우고, 지운 자리의 빈틈도 메운다', () => {
    expect(en('여러분 大家好，很高兴见到你！')).toEqual(['大家好，很高兴见到你！']);
  });

  it('한국어를 지운 자리의 부호 찌꺼기를 앞머리에서 걷어낸다', () => {
    expect(en('그는 말했다 — . . "You do not need to worry about it."'))
      .toEqual(['"You do not need to worry about it."']);
  });

  it('영어로 적은 문장은 읽는다', () => {
    expect(en('You do not need to be perfect, just be honest.'))
      .toEqual(['You do not need to be perfect, just be honest.']);
    expect(en('God loves you.')).toEqual(['God loves you.']);
  });

  it('영어 제목·약어는 문장이 아니므로 읽지 않는다', () => {
    // 소문자 낱말이 둘 이상 있어야 문장으로 본다
    expect(en('COPY vs CREATE')).toEqual([]);
    expect(en('A: Apple (사과)')).toEqual([]);
    expect(en('Data + Base')).toEqual([]);
    expect(en('📱 SLIDES — Level 진단')).toEqual([]);
    expect(en('(참고 4:7)')).toEqual([]);
  });

  it('중국어만 모드에서는 영어 문장이 사라진다', () => {
    expect(texts('You do not need to worry.')).toEqual([]);
  });

  it('중국어만 모드에서는 같은 문장의 영어가 사라진다', () => {
    expect(texts('我们不是要 COPY，而是要 CREATE 新的东西。'))
      .toEqual(['我们不是要，而是要新的东西。']);
  });
});

describe('한자 판정', () => {
  it('한글을 한자로 세지 않는다', () => {
    // 호환 한자 영역의 첫 글자 U+F900은 일반 한자 U+8C48과 생김새가 같다.
    // 글자 그대로 범위를 쓰면 U+8C48–U+FAFF 가 되어 한글이 통째로 들어간다.
    expect(hanCount('오늘 날씨가 좋습니다')).toBe(0);
    expect(hanCount('今天天气')).toBe(4);
    expect(hanCount('(오늘 날씨)')).toBe(0);
  });
});

describe('원고에서의 위치', () => {
  const at = (raw: string) =>
    splitSentences(raw).sentences.map((s) => ({
      text: s.text,
      원문: raw.slice(s.sourceStart, s.sourceEnd),
    }));

  it('각 문장이 원고의 어느 구간에서 왔는지 가리킨다', () => {
    const raw = '大家好！我是老师。';
    expect(at(raw)).toEqual([
      { text: '大家好！', 원문: '大家好！' },
      { text: '我是老师。', 원문: '我是老师。' },
    ]);
  });

  it('건너뛴 줄을 지나도 위치가 밀리지 않는다', () => {
    const raw = '안녕하세요!\n오늘은 날씨 이야기입니다.\n大家好！';
    const [only] = splitSentences(raw).sentences;
    expect(raw.slice(only.sourceStart, only.sourceEnd)).toBe('大家好！');
  });

  it('한국어가 섞인 줄에서도 그 줄을 가리킨다', () => {
    const raw = '첫 줄입니다.\n사람마다 다릅니다. 每个人都不一样。';
    const [only] = splitSentences(raw).sentences;
    expect(raw.slice(only.sourceStart, only.sourceEnd))
      .toBe('사람마다 다릅니다. 每个人都不一样。');
  });

  it('빈 줄이 섞여도 위치가 맞는다', () => {
    const raw = '大家好！\n\n\n我是老师。';
    const [, second] = splitSentences(raw).sentences;
    expect(raw.slice(second.sourceStart, second.sourceEnd)).toBe('我是老师。');
  });
});
