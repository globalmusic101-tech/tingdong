/**
 * 오프라인·차단 시 폴백. 기기에 설치된 중국어 음성을 쓴다.
 * 톤 차이는 rate/pitch로만 근사되고, 음성 종류는 기기에 있는 것에 좌우된다.
 */
let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickChineseVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice;

  const voices = window.speechSynthesis?.getVoices() ?? [];
  cachedVoice = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith('zh-cn'))
    ?? voices.find((v) => v.lang.toLowerCase().startsWith('zh'))
    ?? null;
  return cachedVoice;
}

export function isAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** 음성 목록은 비동기로 채워지므로, 준비되면 캐시를 비워 다시 고르게 한다. */
export function watchVoices(): void {
  if (!isAvailable()) return;
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    cachedVoice = undefined;
  });
}

export function speakLocal(
  text: string,
  rate: number,
  pitch: number,
  onEnd: () => void,
): void {
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = Math.max(0.1, Math.min(10, rate));
  utterance.pitch = Math.max(0, Math.min(2, pitch));

  const voice = pickChineseVoice();
  if (voice) utterance.voice = voice;

  utterance.onend = onEnd;
  utterance.onerror = onEnd;

  window.speechSynthesis.speak(utterance);
}

export function cancelLocal(): void {
  if (isAvailable()) window.speechSynthesis.cancel();
}
