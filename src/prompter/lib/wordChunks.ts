/**
 * 한 문장을 단어 덩어리로 묶는다.
 *
 * 낭독 화면은 글자마다 병음을 다는데(<ruby>), 마우스로 뜻을 보려면
 * 그 글자들을 다시 단어 단위로 감싸야 한다. 그래서 글자 배열을 그대로 들고
 * 단어 경계에서만 잘라 넘긴다 — 병음은 손대지 않는다.
 */

export type RubyChar = {
  char: string;
  /** 구두점처럼 읽을 게 없으면 빈 문자열 */
  reading: string;
};

export type WordChunk = {
  text: string;
  /** 한자가 들어 있어 뜻을 찾아볼 만한 덩어리인가 */
  isWord: boolean;
  chars: RubyChar[];
};

const HAN = /[一-龥]/;

/** 브라우저가 단어 경계를 모르면 글자 하나씩으로 떨어뜨린다 */
function segmentsOf(text: string): string[] {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Segmenter) return [...text];

  try {
    const segmenter = new Segmenter('zh-CN', { granularity: 'word' });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  } catch {
    return [...text];
  }
}

export function toWordChunks(chars: RubyChar[], text: string): WordChunk[] {
  const chunks: WordChunk[] = [];
  let cursor = 0;

  for (const segment of segmentsOf(text)) {
    // chars는 [...text]로 만든 배열이라 코드포인트 수로 세어야 자리가 맞는다
    const length = [...segment].length;
    chunks.push({
      text: segment,
      isWord: HAN.test(segment),
      chars: chars.slice(cursor, cursor + length),
    });
    cursor += length;
  }

  return chunks;
}

/** 덩어리 안의 병음을 한 줄로 — 사전 카드의 제목에 쓴다 */
export function chunkPinyin(chunk: WordChunk): string {
  return chunk.chars.map((c) => c.reading).filter(Boolean).join(' ');
}
