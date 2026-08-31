import * as cache from './audioCache';
import { cacheKey, type SynthParams } from './types';

/** 같은 문장을 두 번 요청하지 않도록, 진행 중인 합성을 공유한다. */
const inFlight = new Map<string, Promise<string>>();

export async function synthEdge(params: SynthParams): Promise<string> {
  const key = cacheKey(params);

  const cached = cache.get(key);
  if (cached) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = (async () => {
    if (!window.tts) throw new Error('Edge TTS 브리지를 쓸 수 없습니다 (Electron 밖).');

    const result = await window.tts.synth(params);
    if (!result.ok) throw new Error(result.error);

    const url = URL.createObjectURL(new Blob([result.data], { type: 'audio/mpeg' }));
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
