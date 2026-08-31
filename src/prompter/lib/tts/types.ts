export type SynthParams = {
  text: string;
  voiceId: string;
  /** SSML rate 문자열 — "+0%", "-14%" */
  rate: string;
  /** SSML pitch 문자열 — "+0%", "-6%" */
  pitch: string;
};

export type TtsBridge = {
  synth: (params: SynthParams) => Promise<{ ok: true; data: Uint8Array } | { ok: false; error: string }>;
};

declare global {
  interface Window {
    tts?: TtsBridge;
  }
}

export const cacheKey = (p: SynthParams) => `${p.voiceId}|${p.rate}|${p.pitch}|${p.text}`;

/** Electron 안에서 실행 중이어서 Edge TTS를 쓸 수 있는가 */
export const hasEdgeBridge = () => typeof window !== 'undefined' && !!window.tts;
