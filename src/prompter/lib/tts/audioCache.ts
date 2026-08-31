/**
 * 합성된 오디오를 세션 동안만 들고 있는다. 디스크에 쓰지 않는다 —
 * 연습 한 세션 밖에서는 쓸모가 없고, 원고 음성이 디스크에 남는 것도 피한다.
 */
const MAX_ENTRIES = 50;

const urls = new Map<string, string>();

export function get(key: string): string | undefined {
  const url = urls.get(key);
  if (url) {
    // LRU: 다시 쓴 항목을 맨 뒤로
    urls.delete(key);
    urls.set(key, url);
  }
  return url;
}

export function put(key: string, url: string): void {
  if (urls.has(key)) {
    URL.revokeObjectURL(url);
    return;
  }
  urls.set(key, url);

  while (urls.size > MAX_ENTRIES) {
    const oldest = urls.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    const stale = urls.get(oldest);
    urls.delete(oldest);
    if (stale) URL.revokeObjectURL(stale);
  }
}

export function clear(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}
