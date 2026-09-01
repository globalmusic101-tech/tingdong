/**
 * 낭독 중 단어 뜻 찾기.
 *
 * 마우스가 지나가는 단어마다 API를 때리면 어제 겪은 429가 그대로 돌아온다.
 * 그래서 한 번 찾은 단어는 이 세션 동안 다시 묻지 않는다.
 */
import {
  STORAGE_KEYS,
  llmCooldownSeconds,
  loadEngineConfig,
  lookupWord,
  translateFree,
  type LookupOutcome,
} from '../../lib/translate';

// 어느 엔진이 답했는지까지 들고 있는다 — 사전 엔진이 실패해 무료로 떨어진 걸
// 화면에서 알 수 없으면, 품사·예문이 왜 안 나오는지 영영 모른다.
const cache = new Map<string, LookupOutcome>();

// 한도 초과처럼 일시적인 이유로 뜻만 받은 것은 따로 둔다.
// 이것까지 영구 캐시하면 한도가 풀린 뒤에도 그 단어는 영영 무료 뜻만 보인다.
const provisional = new Map<string, LookupOutcome>();

/**
 * 제대로 찾아둔 뜻이 있으면 기다리지 않고 바로 보여준다.
 * 임시로 받아둔 것(한도 초과 등)은 일부러 내주지 않는다 —
 * 여기서 내주면 조회 경로를 아예 건너뛰어, 한도가 풀려도 영영 다시 찾지 않는다.
 */
export function peekWord(word: string): LookupOutcome | undefined {
  return cache.get(word);
}

/**
 * 사전 엔진을 무료로 되돌린다.
 * 한도에 막혀 아무것도 못 하는 상태에서 설정 창까지 찾아가게 하지 않으려고,
 * 경고 옆에서 바로 바꿀 수 있게 열어둔다.
 */
export function switchToFreeDictionary(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.apiType, 'free');
  } catch { /* 저장 못 해도 이번 세션에는 적용된다 */ }
  provisional.clear();
}

export async function lookupCached(word: string): Promise<LookupOutcome> {
  const hit = cache.get(word);
  if (hit) return hit;

  // 한도가 아직 안 풀렸으면 임시로 받아둔 뜻을 그대로 쓴다
  const held = provisional.get(word);
  if (held && llmCooldownSeconds() > 0) return held;

  const outcome = await lookupWord(word, loadEngineConfig());
  if (outcome.usedFallback) {
    // 나중에 한도가 풀리면 제대로 다시 찾도록 임시 자리에만 둔다
    provisional.set(word, outcome);
  } else {
    cache.set(word, outcome);
    provisional.delete(word);
  }
  return outcome;
}

const sentenceCache = new Map<string, string>();

export function peekSentence(text: string): string | undefined {
  return sentenceCache.get(text);
}

/**
 * 지금 읽고 있는 문장의 뜻.
 * 무료 번역에는 중→한 사전·예문 자료가 없어서, 원고의 이 문장을 그대로 용례로 쓴다.
 *
 * 문장 뜻은 무료 엔진만 쓴다 — 낭독을 따라 문장마다 새로 뜨는 자리라,
 * 왕복이 몇 초씩 걸리면 자동 진행을 따라가지 못한다. 단어 사전만 고른 엔진을 쓴다.
 */
export async function lookupSentenceCached(text: string): Promise<string> {
  const hit = sentenceCache.get(text);
  if (hit) return hit;

  const ko = await translateFree(text, 'ko');
  sentenceCache.set(text, ko);
  return ko;
}
