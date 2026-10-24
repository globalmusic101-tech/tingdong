/**
 * 오프라인·차단 시 폴백. 기기에 설치된 중국어 음성을 쓴다.
 * 톤 차이는 rate/pitch로만 근사되고, 음성 종류는 기기에 있는 것에 좌우된다.
 */
function pickChineseVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return voices.find((v) => v.localService && v.lang.replace('_', '-').toLowerCase().startsWith('zh-cn'))
    ?? voices.find((v) => v.localService && v.lang.toLowerCase().startsWith('zh'))
    ?? null;
}

export function isAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** 음성 목록은 비동기로 채워지므로, 준비되면 캐시를 비워 다시 고르게 한다. */
// 매번 최신 목록을 읽으므로 voiceschanged 전역 리스너가 필요하지 않습니다.

export function speakLocal(
  text: string,
  rate: number,
  pitch: number,
  onEnd: () => void,
  onError: (reason: string) => void,
  onStart: () => void = () => {},
): void {
  if (!isAvailable()) { onError('speech-unavailable'); return; }
  window.speechSynthesis.cancel();

  const voice = pickChineseVoice();
  if (!voice) { onError('chinese-voice-unavailable'); return; }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = Math.max(0.1, Math.min(10, rate));
  utterance.pitch = Math.max(0, Math.min(2, pitch));

  utterance.voice = voice;

  utterance.onend = onEnd;
  utterance.onstart = onStart;
  utterance.onerror = (event) => onError(event.error || 'speech-error');

  window.speechSynthesis.speak(utterance);
}

export function cancelLocal(): void {
  if (isAvailable()) window.speechSynthesis.cancel();
}
