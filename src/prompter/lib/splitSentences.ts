import { cleanScript, isReadable, type ReadMode } from './extractChinese';

export type Sentence = {
  index: number;
  text: string;
  /** 원고에서 이 문장이 시작하는 글자 위치 — 입력창과 서로 위치를 맞추는 데 쓴다 */
  sourceStart: number;
  /** 원고에서 이 문장이 끝나는 글자 위치 */
  sourceEnd: number;
};

export type SplitResult = {
  sentences: Sentence[];
  /** 중국어가 아니어서 읽지 않고 넘긴 줄 수 — 화면에 숫자로 보여준다 */
  skippedLines: number;
};

/**
 * 문장 끝 부호에서 자른다. 닫는 따옴표·괄호가 뒤따르면 그것까지 앞 문장에 붙이므로,
 * 실제 경계는 "끝 부호 + 닫는 기호들" 다음이다 (`他说：“我来了。”然后…` → `…了。”` / `然后…`).
 */
const SENTENCE_END = /(?<=[。！？!?；;…][”’"』」）)\]】]*)(?![”’"』」）)\]】。！？!?；;…])/;

export type SplitOptions = {
  /** 원고를 어떻게 읽을지 (기본 'chinese') */
  readMode?: ReadMode;
  /** 긴 문장을 쉼표에서 보조 분할할지 (기본 false) */
  splitLong?: boolean;
  /** 보조 분할을 시작하는 길이 (기본 45자) */
  maxChars?: number;
};

/** 45자를 넘는 문장을 쉼표 경계에서 나눈다. 나눠도 여전히 길면 그대로 둔다. */
function splitAtCommas(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const pieces = text.split(/(?<=[，、])/);
  const out: string[] = [];
  let buf = '';

  for (const piece of pieces) {
    // 이어붙이면 한도를 넘고, 이미 담아둔 게 있으면 여기서 끊는다
    if (buf && buf.length + piece.length > maxChars) {
      out.push(buf);
      buf = piece;
    } else {
      buf += piece;
    }
  }
  if (buf) out.push(buf);

  return out;
}

/**
 * 원고를 낭독 단위로 자른다.
 * 줄바꿈은 항상 문장 경계로 본다 — 마침표 없이 줄만 바꾼 원고가 흔하기 때문이다.
 */
export function splitSentences(raw: string, options: SplitOptions = {}): SplitResult {
  const { readMode = 'chinese', splitLong = false, maxChars = 45 } = options;

  const out: Omit<Sentence, 'index'>[] = [];
  let skippedLines = 0;

  // 원고에서의 글자 위치를 따라간다. 줄도 조각도 잘린 부분을 이어붙이면
  // 원문이 그대로 나오므로(경계가 폭 0), 길이를 더해가면 위치가 맞는다.
  let lineStart = 0;

  for (const line of raw.split('\n')) {
    if (!line.trim()) {
      lineStart += line.length + 1;
      continue;
    }

    let kept = 0;
    let chunkStart = lineStart;

    for (const chunk of line.split(SENTENCE_END)) {
      // 문장 안에서 정리한다. 줄 단위로만 보면 한국어와 중국어가 섞인 줄에서
      // 한국어까지 읽어버린다.
      const text = cleanScript(chunk, readMode);
      const source = { sourceStart: chunkStart, sourceEnd: chunkStart + chunk.length };
      chunkStart += chunk.length;

      if (!text || !isReadable(text, readMode)) continue;

      // 쉼표로 더 쪼개도 원고에서의 출처는 같은 조각이다
      if (splitLong) out.push(...splitAtCommas(text, maxChars).map((piece) => ({ text: piece, ...source })));
      else out.push({ text, ...source });
      kept += 1;
    }

    if (kept === 0) skippedLines += 1;
    lineStart += line.length + 1;
  }

  return {
    sentences: out.map((sentence, index) => ({ index, ...sentence })),
    skippedLines,
  };
}
