import * as cache from './audioCache';
import { cacheKey, type SynthParams } from './types';

/** 같은 문장을 두 번 요청하지 않도록, 진행 중인 합성을 공유한다. */
const inFlight = new Map<string, Promise<string>>();
const RENDERER_TIMEOUT_MS = 4_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error('음성 합성 응답이 없습니다 (4초)')), RENDERER_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) window.clearTimeout(timer);
  });
}

export async function synthEdge(params: SynthParams): Promise<string> {
  const key = cacheKey(params);

  const cached = cache.get(key);
  if (cached) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = (async () => {
    let audio: Blob;
    if (window.tts) {
      const result = await withTimeout(window.tts.synth(params));
      if (!result.ok) throw new Error(result.error);
      audio = new Blob([result.data], { type: 'audio/mpeg' });
    } else {
      if (params.text.length > 2000) throw new Error('text-too-long');
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 12000);
      let response: Response;
      try {
        response = await fetch('/api/tts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params), signal: controller.signal,
        });
      } finally { window.clearTimeout(timer); }
      if (!response.ok || !response.headers.get('content-type')?.includes('audio/mpeg')) throw new Error('speech-unavailable');
      audio = await response.blob();
      if (!audio.size) throw new Error('speech-unavailable');
    }
    const url = URL.createObjectURL(audio);
    cache.put(key, url);
    return url;
  })();

  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
}
