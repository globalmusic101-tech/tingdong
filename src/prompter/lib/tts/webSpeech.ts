/**
 * 오프라인·차단 시 폴백. 기기에 설치된 선택 언어 음성을 쓴다.
 * 톤 차이는 rate/pitch로만 근사되고, 음성 종류는 기기에 있는 것에 좌우된다.
 */
function pickVoice(language: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const prefix = language.toLowerCase().replace('_', '-');
  return voices.find((v) => v.localService && v.lang.toLowerCase().startsWith(prefix))
    ?? voices.find((v) => v.localService && v.lang.toLowerCase().startsWith(prefix.slice(0, 2)))
    ?? null;
}

export function voicesForLanguage(language: string, voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const normalized = language.toLowerCase().replace(/_/g, '-');
  const matches = (voice: SpeechSynthesisVoice) => {
    if (voice.localService !== true) return false;
    const tag = voice.lang.toLowerCase().replace(/_/g, '-');
    if (normalized === 'zh-cn') {
      if (/^(yue|zh-hk)(-|$)/.test(tag)) return false;
      return /^(cmn(-|$)|zh$|zh-(cn|sg|tw)(-|$)|zh-(hans|hant)(-|$))/.test(tag);
    }
    return tag.startsWith(`${normalized.split('-')[0]}-`);
  };
  const matched = voices.filter(matches);
  const counts = new Map<string, number>();
  matched.forEach(voice => counts.set(voice.voiceURI, (counts.get(voice.voiceURI) ?? 0) + 1));
  return matched.filter(voice => voice.voiceURI && counts.get(voice.voiceURI) === 1);
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
  language = 'zh-CN',
  voiceURI?: string,
): void {
  if (!isAvailable()) { onError('speech-unavailable'); return; }
  const api = window.electronAPI;
  const native = api?.speakChinese;
  if (native && api.stopChinese && api.onChineseEnded && api.onChineseError) {
    api.stopChinese();
    const removeEnded = api.onChineseEnded(() => { remove(); onEnd(); });
    const removeError = api.onChineseError((reason) => { remove(); onError(reason || 'speech-error'); });
    const remove = () => { removeEnded(); removeError(); };
    void native(text, rate, language).then((result) => {
      if (!result.ok) { remove(); onError(result.error || 'speech-error'); return; }
      onStart();
    }).catch((error) => { remove(); onError(error instanceof Error ? error.message : String(error)); });
    return;
  }
  window.speechSynthesis.cancel();

  if (voiceURI === '') { onError('device-voice-selection-required'); return; }
  const voice = voiceURI === undefined
    ? pickVoice(language)
    : (window.speechSynthesis.getVoices().find(item => item.voiceURI === voiceURI && item.localService === true
      && voicesForLanguage(language, [item]).length === 1) ?? null);
  if (!voice) { onError(language === 'zh-CN' ? 'chinese-voice-unavailable' : `${language}-voice-unavailable`); return; }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = Math.max(0.1, Math.min(10, rate));
  utterance.pitch = Math.max(0, Math.min(2, pitch));

  utterance.voice = voice;

  utterance.onend = onEnd;
  let started = false;
  const startOnce = () => {
    if (started) return;
    started = true;
    onStart();
  };
  utterance.onstart = startOnce;
  utterance.onerror = (event) => onError(event.error || 'speech-error');

  window.speechSynthesis.speak(utterance);
  // Electron/macOS에서는 speak()가 성공해도 onstart가 늦거나 누락될 수 있습니다.
  // 호출이 큐에 들어간 즉시 재생 상태로 전환해 '준비 중'에 고정되지 않게 합니다.
  startOnce();
}

export function cancelLocal(): void {
  window.electronAPI?.stopChinese?.();
  if (isAvailable()) window.speechSynthesis.cancel();
}
