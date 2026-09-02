/**
 * 번역 엔진 한 벌.
 *
 * 번역기 탭(App.tsx)과 ⌘⇧F 팝업(popup.ts)이 이 파일 하나를 같이 쓴다.
 * 예전에는 팝업이 자기 몫의 번역 코드를 따로 갖고 있어서, 한쪽만 고치면
 * 다른 쪽은 옛날 방식(재시도 없음·길이 분할 없음·실패를 삼킴) 그대로였다.
 */

import { loadUiLang, stringsFor, type UiLang } from './i18n';

export type ApiType = 'openai' | 'free' | 'lmstudio';

export type EngineConfig = {
  apiType: ApiType;
  apiKey: string;
  lmStudioUrl: string;
  /** 화면 언어 — 사전 뜻과 오류 문구가 이 언어로 나온다 (F11-2) */
  lang: UiLang;
};

export const STORAGE_KEYS = {
  apiType: 'study_api_type',
  apiKey: 'study_api_key',
  lmStudioUrl: 'study_lmstudio_url',
} as const;

export const DEFAULT_LM_STUDIO_URL = 'http://localhost:1234';

export function loadEngineConfig(): EngineConfig {
  try {
    // 예전에 Gemini를 골라둔 설정이 남아 있어도 무료로 되돌린다 (무료 등급 한도가 하루 20회라 못 쓴다)
    const saved = localStorage.getItem(STORAGE_KEYS.apiType);
    return {
      apiType: saved === 'openai' || saved === 'lmstudio' ? saved : 'free',
      apiKey: localStorage.getItem(STORAGE_KEYS.apiKey) || '',
      lmStudioUrl: localStorage.getItem(STORAGE_KEYS.lmStudioUrl) || DEFAULT_LM_STUDIO_URL,
      lang: loadUiLang(),
    };
  } catch {
    return { apiType: 'free', apiKey: '', lmStudioUrl: DEFAULT_LM_STUDIO_URL, lang: loadUiLang() };
  }
}

/** 켜져 있는 엔진의 이름 — 상태 배지에 그대로 쓴다 */
export function engineLabel(apiType: ApiType, lang: UiLang): string {
  const t = stringsFor(lang);
  switch (apiType) {
    case 'openai': return 'OpenAI API';
    case 'lmstudio': return t.engineNameLmStudio;
    default: return t.engineNameFree;
  }
}

/**
 * 무료 구글 번역은 GET 주소로 보내기 때문에 URL 길이(약 16KB, 한자 1,800자쯤)에서 막힌다.
 * 그보다 짧게 잘라 보내야 긴 원고도 통과한다.
 */
export const FREE_MAX_CHARS = 1200;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 긴 글을 무료 API가 삼킬 수 있는 크기로 자른다.
 * 줄이 있는 글은 줄 단위로 묶는다 — 줄 수가 어긋나면 단어 뜻이 통째로 밀린다.
 */
export function chunkForFree(text: string): { parts: string[]; joiner: string } {
  if (text.length <= FREE_MAX_CHARS) return { parts: [text], joiner: '' };

  if (text.includes('\n')) {
    const parts: string[] = [];
    let cur: string[] = [];
    let len = 0;
    for (const line of text.split('\n')) {
      if (cur.length && len + line.length + 1 > FREE_MAX_CHARS) {
        parts.push(cur.join('\n'));
        cur = [];
        len = 0;
      }
      cur.push(line);
      len += line.length + 1;
    }
    if (cur.length) parts.push(cur.join('\n'));
    return { parts, joiner: '\n' };
  }

  const parts: string[] = [];
  let cur = '';
  for (const piece of text.split(/(?<=[。！？!?.])/)) {
    if (piece.length > FREE_MAX_CHARS) {
      if (cur) { parts.push(cur); cur = ''; }
      for (let i = 0; i < piece.length; i += FREE_MAX_CHARS) parts.push(piece.slice(i, i + FREE_MAX_CHARS));
      continue;
    }
    if (cur && cur.length + piece.length > FREE_MAX_CHARS) { parts.push(cur); cur = ''; }
    cur += piece;
  }
  if (cur) parts.push(cur);
  return { parts, joiner: '' };
}

/** 동시 요청 수를 묶어둔다 — 한꺼번에 쏘면 무료 API가 429로 막아버린다 */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// ── 번역 엔진 1: Google Translate 비공식 무료 API ──

/**
 * 같은 엔드포인트라도 client 값마다 차단 한도가 따로 걸린다.
 * 실제로 브라우저에서 나가는 client=gtx 요청만 429로 막히고 나머지는 멀쩡한 때가 있어서,
 * 한 쪽이 막히면 다른 쪽으로 넘어간다.
 */
const FREE_CLIENTS = ['gtx', 'dict-chrome-ex', 'at'] as const;
const FREE_CLIENT_KEY = 'study_free_client';

/** 마지막으로 통했던 client부터 시작한다 — 매번 막힌 쪽을 먼저 두드리지 않도록 */
function preferredClientIndex(): number {
  try {
    const saved = localStorage.getItem(FREE_CLIENT_KEY);
    const i = FREE_CLIENTS.indexOf(saved as (typeof FREE_CLIENTS)[number]);
    return i >= 0 ? i : 0;
  } catch {
    return 0;
  }
}

function rememberClient(index: number): void {
  try {
    localStorage.setItem(FREE_CLIENT_KEY, FREE_CLIENTS[index]);
  } catch { /* 저장 실패는 번역을 막을 이유가 아니다 */ }
}

/** 한 덩어리 요청. 막힌 client는 건너뛰고, 일시 오류는 잠깐 쉬었다 다시 시도한다. */
async function translateFreeOnce(text: string, targetLang: string): Promise<string> {
  let lastErr: unknown;
  const start = preferredClientIndex();

  for (let round = 0; round < 2; round++) {
    for (let step = 0; step < FREE_CLIENTS.length; step++) {
      const index = (start + step) % FREE_CLIENTS.length;
      const client = FREE_CLIENTS[index];
      if (round > 0 && step === 0) await sleep(800);

      try {
        const response = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=${client}&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
        );
        // 429·403은 이 client가 막힌 것 — 다음 client로 넘어간다
        if (response.status === 429 || response.status === 403 || response.status >= 500) {
          throw new Error(`Google Free API HTTP ${response.status} (client=${client})`);
        }
        if (!response.ok) {
          // 400 같은 오류는 client를 바꿔도 같다 — 바로 포기한다
          throw Object.assign(new Error(`Google Free API HTTP ${response.status}`), { fatal: true });
        }
        const data = await response.json();
        if (index !== start) rememberClient(index);
        // 번역할 것이 없으면(부호·숫자만) 원문을 그대로 돌려준다
        if (!Array.isArray(data?.[0])) return text;
        return data[0].map((item: any) => item[0]).join('');
      } catch (err) {
        lastErr = err;
        if ((err as { fatal?: boolean })?.fatal) throw err;
      }
    }
  }
  throw lastErr;
}

export async function translateFree(text: string, targetLang: string): Promise<string> {
  if (!text.trim()) return '';
  const { parts, joiner } = chunkForFree(text);
  if (parts.length === 1) return translateFreeOnce(parts[0], targetLang);
  // 나눈 조각은 순차로 — 한꺼번에 보내면 그 자체로 막힌다
  const out: string[] = [];
  for (const part of parts) out.push(await translateFreeOnce(part, targetLang));
  return out.join(joiner);
}

/**
 * 응답 본문에 담긴 진짜 이유를 꺼낸다.
 * 'HTTP 400'만 보여주면 키가 틀린 건지, 모델이 없는 건지, 한도를 넘긴 건지 알 수가 없다.
 */
async function readError(response: Response, engine: string): Promise<Error> {
  let detail = '';
  try {
    const body = await response.text();
    try {
      detail = JSON.parse(body)?.error?.message ?? '';
    } catch {
      detail = body.slice(0, 160);
    }
  } catch { /* 본문을 못 읽으면 상태 코드만으로 알린다 */ }

  return new Error(`${engine} HTTP ${response.status}${detail ? ` — ${detail}` : ''}`);
}

/**
 * LLM 프롬프트에 넣는 언어 이름. 화면 언어가 아니라 **모델에게 주는 말**이므로
 * 영어로 통일한다 — 프롬프트를 화면 언어에 따라 바꾸면 같은 요청이 언어마다
 * 다른 품질로 돌아온다.
 */
const langName = (targetLang: string) =>
  targetLang === 'ko' ? 'Korean'
    : targetLang === 'en' ? 'English'
    : targetLang === 'zh-CN' ? 'Simplified Chinese'
    : targetLang;

/** OpenAI 호환 채팅 API — OpenAI와 LM Studio가 같은 모양을 쓴다 */
async function chat(messages: { role: string; content: string }[], cfg: EngineConfig): Promise<string> {
  const isOpenAI = cfg.apiType === 'openai';
  if (isOpenAI && !cfg.apiKey) throw new Error(stringsFor(cfg.lang).errNoApiKey);

  const response = await fetch(
    isOpenAI ? 'https://api.openai.com/v1/chat/completions' : `${cfg.lmStudioUrl}/v1/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(isOpenAI ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: isOpenAI ? 'gpt-4o-mini' : 'local-model',
        messages,
        temperature: 0.1,
      }),
    }
  );
  if (!response.ok) {
    throw await readError(response, isOpenAI ? 'OpenAI API' : stringsFor(cfg.lang).errLmStudioHint);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/** 프롬프트를 그대로 던지고 답만 받아온다 — 묶음 번역이 쓴다 */
async function askEngine(prompt: string, cfg: EngineConfig): Promise<string> {
  return chat([{ role: 'user', content: prompt }], cfg);
}

async function translateWithChat(text: string, targetLang: string, cfg: EngineConfig): Promise<string> {
  return chat([
    {
      role: 'system',
      content: `You are a professional translator. Translate the user's text to ${langName(targetLang)}. Output only the translation, no explanations.`,
    },
    { role: 'user', content: text },
  ], cfg);
}

/** 한 번에 묶어 보낼 문장 수 */
const LLM_BATCH_SIZE = 12;

/**
 * LLM 엔진에 문장을 하나씩 물어보면 왕복이 문장 수만큼 쌓여 한참 걸린다.
 * 번호를 붙여 묶어 보내고, 돌아온 줄 수와 번호가 정확히 맞을 때만 쓴다.
 * 하나라도 어긋나면 그 묶음은 통째로 버린다 — 뜻이 밀린 번역보다 한 번 더 묻는 편이 낫다.
 *
 * 무료 엔진은 요청이 이미 빠르고 한꺼번에 몰면 차단되므로 묶지 않는다.
 */
export async function translateBatched(
  sentences: string[],
  targetLang: string,
  cfg: EngineConfig,
): Promise<Map<string, string>> {
  const done = new Map<string, string>();
  if (cfg.apiType === 'free' || sentences.length < 2) return done;

  const groups: string[][] = [];
  for (let i = 0; i < sentences.length; i += LLM_BATCH_SIZE) {
    groups.push(sentences.slice(i, i + LLM_BATCH_SIZE));
  }

  await mapWithLimit(groups, 4, async (group) => {
    const numbered = group.map((line, i) => `${i + 1}. ${line}`).join('\n');
    const prompt = `Translate the following sentences into ${langName(targetLang)}.
Output one line per sentence as "number. translation", keeping the same numbers and the same number of lines. No other explanation.

${numbered}`;

    try {
      const raw = await askEngine(prompt, cfg);
      const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length !== group.length) return;

      const local = new Map<string, string>();
      group.forEach((zh, i) => {
        const head = new RegExp(`^${i + 1}[.)\\]]\\s*`).exec(lines[i]);
        if (!head) return;
        const ko = lines[i].slice(head[0].length).trim();
        if (ko) local.set(zh, ko);
      });

      // 한 줄이라도 번호가 어긋나면 이 묶음은 쓰지 않는다
      if (local.size !== new Set(group).size) return;
      for (const [zh, ko] of local) done.set(zh, ko);
    } catch (err) {
      console.warn('묶음 번역 실패 — 문장별로 되돌아갑니다:', err);
    }
  });

  return done;
}

export type TranslateResult = {
  text: string;
  /** 실제로 번역해낸 엔진의 이름 */
  engine: string;
  /** 고른 엔진이 실패해서 무료 번역으로 대체했는가 */
  usedFallback: boolean;
  /** 대체했다면 그 엔진이 왜 실패했는가 — 이걸 감추면 원인을 알 수 없다 */
  fallbackReason?: string;
};

/**
 * 고른 엔진으로 번역하고, 실패하면 무료 번역으로 한 번 더 시도한다.
 * 끝내 안 되면 던진다 — 빈 문자열을 돌려주면 그 문장이 화면에서 소리 없이 사라진다.
 */
export async function translate(
  text: string,
  targetLang: string,
  cfg: EngineConfig,
): Promise<TranslateResult> {
  if (!text.trim()) return { text: '', engine: engineLabel(cfg.apiType, cfg.lang), usedFallback: false };

  try {
    let out: string;
    if (cfg.apiType === 'openai' || cfg.apiType === 'lmstudio') {
      out = await translateWithChat(text, targetLang, cfg);
    } else {
      out = await translateFree(text, targetLang);
    }
    return { text: out, engine: engineLabel(cfg.apiType, cfg.lang), usedFallback: false };
  } catch (err) {
    console.warn(`[${cfg.apiType}] 번역 실패:`, err);
    if (cfg.apiType === 'free') throw err;
    console.log('→ Google 무료 번역으로 폴백 시도');
    const out = await translateFree(text, targetLang);
    return {
      text: out,
      engine: engineLabel(cfg.apiType, cfg.lang),
      usedFallback: true,
      fallbackReason: (err as Error)?.message ?? String(err),
    };
  }
}

// ── 팝업용 사전식 조회 ────────────────────────────────────────────

export type LookupResult = {
  translation: string;
  partOfSpeech?: string;
  exampleChinese?: string;
  exampleTranslation?: string;
};

const lookupPrompt = (targetLang: string) => {
  const name = langName(targetLang);
  return `You are a professional Chinese-to-${name} translator and lexicographer.
Analyze the given Chinese text/word and return a JSON object with the following fields:
{
  "translation": "the meaning in ${name} (contextual, or a dictionary definition)",
  "partOfSpeech": "part of speech, written in ${name} (verb, noun, pronoun, adjective, adverb, verb phrase, idiom, ...)",
  "exampleChinese": "a Chinese example sentence",
  "exampleTranslation": "a natural ${name} translation of that example sentence"
}
Ensure example sentences are highly helpful for study. Respond ONLY with a valid JSON block, no markdown formatting tags.`;
};

/** LLM이 마크다운 코드블록을 씌워 돌려주는 일이 있어 벗겨낸다 */
function parseLookupJson(raw: string, lang: UiLang): LookupResult {
  const t = stringsFor(lang);
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  if (!cleaned) throw new Error(t.errLookupEmpty);

  // 설명이 앞뒤로 붙어 와도 JSON 덩어리만 떼어낸다
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const body = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    return JSON.parse(body) as LookupResult;
  } catch {
    throw new Error(t.errLookupUnreadable(cleaned.slice(0, 80)));
  }
}

async function lookupWithChat(text: string, cfg: EngineConfig): Promise<LookupResult> {
  const raw = await chat([
    { role: 'system', content: `${lookupPrompt(cfg.lang)} (Respond in raw JSON format only)` },
    { role: 'user', content: text },
  ], cfg);
  return parseLookupJson(raw, cfg.lang);
}

/**
 * 유료 API는 대개 요청 수 한도가 있다.
 * 한도에 걸린 뒤에도 계속 두드리면 한도만 더 깎이고 기다리는 시간도 길어진다.
 * 그래서 구글이 알려준 대기 시간 동안은 아예 보내지 않고 무료 뜻으로 넘긴다.
 */
let llmCooldownUntil = 0;
/** 연속으로 한도에 걸린 횟수 — 걸릴수록 더 오래 쉰다 */
let quotaStrikes = 0;

/**
 * 구글이 알려주는 "Please retry in 47.4s"는 믿을 만한 값이 아니다.
 * 실제로 그 시간을 기다린 뒤에도 그대로 막히는 경우가 있는데(하루 단위 한도로 보인다),
 * 그때마다 다시 두드리면 남은 한도만 갉아먹는다. 그래서 걸릴수록 쉬는 시간을 크게 늘린다.
 */
const BACKOFF_SECONDS = [60, 600, 3600];

function cooldownFrom(message: string): number {
  const hit = /retry in ([\d.]+)\s*s/i.exec(message);
  const suggested = hit && Number.isFinite(Number(hit[1])) ? Number(hit[1]) : 0;
  const step = BACKOFF_SECONDS[Math.min(quotaStrikes, BACKOFF_SECONDS.length - 1)];
  return Math.max(suggested, step);
}

/** 한도에 계속 걸리는 중인가 — 잠깐 기다려서 될 일이 아닐 때 */
export function quotaLikelyExhausted(): boolean {
  return quotaStrikes >= 2;
}

function isQuotaError(message: string): boolean {
  return message.includes('429') || /quota/i.test(message);
}

/** 한도가 풀릴 때까지 남은 초 (풀렸으면 0) */
export function llmCooldownSeconds(): number {
  return Math.max(0, Math.ceil((llmCooldownUntil - Date.now()) / 1000));
}

/**
 * 한도에 걸렸을 때 사람에게 보여줄 말. 두 자리(보내기 전·실패한 뒤)에서 같은 문구를
 * 쓰므로 여기서 한 번만 만든다 — 따로 쓰면 언어를 옮길 때 한쪽만 옮겨진다.
 */
function quotaMessage(waitSeconds: number, lang: UiLang): string {
  const t = stringsFor(lang);
  if (quotaLikelyExhausted()) return t.quotaExhausted;
  return waitSeconds > 90
    ? t.quotaWaitMinutes(Math.ceil(waitSeconds / 60))
    : t.quotaWaitSeconds(Math.ceil(waitSeconds));
}

// ── 무료 사전 ─────────────────────────────────────────────────

/**
 * 키 없이 만드는 단어 카드. 중→한 번역 한 번이 전부다.
 *
 * 중→영 사전(dt=bd)을 거치면 품사와 여러 뜻을 얻을 수 있고 몇몇 단어는 확실히 나아진다
 * (祝福이 '신을 하다'가 아니라 '축복'이 된다). 대신 요청이 셋으로 늘고, 두 번 옮기는 만큼
 * 엉뚱한 말이 섞이기도 한다(盼望 → '오랫동안'). 실측해 보니 절반은 결과가 같아서
 * 단순한 쪽을 택했다. 되살리려면 zh→en에 dt=bd를 붙여 받고 그 목록을 한국어로 옮기면 된다.
 */
export async function lookupFree(word: string, targetLang: string): Promise<LookupResult> {
  return { translation: await translateFree(word, targetLang) };
}

export type LookupOutcome = {
  result: LookupResult;
  engine: string;
  usedFallback: boolean;
  fallbackReason?: string;
};

/**
 * 팝업의 단어 카드 한 장을 만든다.
 * LLM이 있으면 품사·예문까지, 없거나 실패하면 무료 번역으로 뜻만 채운다.
 */
export async function lookupWord(text: string, cfg: EngineConfig): Promise<LookupOutcome> {
  const hasKey = cfg.apiKey.trim() !== '';
  const useLLM = (cfg.apiType === 'openai' && hasKey) || cfg.apiType === 'lmstudio';

  if (useLLM) {
    const waiting = llmCooldownSeconds();
    if (waiting > 0) {
      // 한도가 풀리기 전에는 보내지 않는다 — 보낼수록 남은 한도만 갉아먹는다
      return {
        result: await lookupFree(text, cfg.lang),
        engine: engineLabel(cfg.apiType, cfg.lang),
        usedFallback: true,
        fallbackReason: quotaMessage(waiting, cfg.lang),
      };
    }

    try {
      const result = await lookupWithChat(text, cfg);
      quotaStrikes = 0;   // 한 번이라도 통했으면 처음부터 다시 센다
      return { result, engine: engineLabel(cfg.apiType, cfg.lang), usedFallback: false };
    } catch (err) {
      console.warn(`[${cfg.apiType}] 사전 조회 실패, 무료 번역으로 대체:`, err);
      const raw = (err as Error)?.message ?? String(err);

      // 한도 초과는 사람이 읽을 수 있는 말로 바꾸고, 그동안은 보내지 않는다
      let reason = raw;
      if (isQuotaError(raw)) {
        const seconds = cooldownFrom(raw);
        quotaStrikes += 1;
        llmCooldownUntil = Date.now() + seconds * 1000;

        reason = quotaMessage(seconds, cfg.lang);
      }

      return {
        result: await lookupFree(text, cfg.lang),
        engine: engineLabel(cfg.apiType, cfg.lang),
        usedFallback: true,
        fallbackReason: reason,
      };
    }
  }

  return { result: await lookupFree(text, cfg.lang), engine: engineLabel('free', cfg.lang), usedFallback: false };
}
