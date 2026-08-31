export type Gender = 'male' | 'female';
export type Tone = 'sermon' | 'news' | 'chat';

export type VoicePreset = {
  voiceId: string;
  /** 설정 화면에 보여줄 이름 */
  label: string;
  /** 이 톤이 얹는 속도 보정 (%) — 사용자 배속에 더해진다 */
  ratePct: number;
  /** 이 톤이 얹는 음높이 보정 (%) */
  pitchPct: number;
};

/**
 * 무료 Edge 엔드포인트 실측 결과 (2026-08-30):
 *   허용 — rate, pitch, 음성 선택
 *   거부 — mstts:express-as(스타일), <break>  ← 요청 자체가 끊긴다
 * 따라서 톤은 "음성 인물 + rate/pitch 프리셋"으로만 만든다.
 * 진짜 스타일 태그가 필요하면 Azure Speech 키로 엔진을 교체해야 한다.
 */
export const VOICE_MAP: Record<Gender, Record<Tone, VoicePreset>> = {
  male: {
    // Sports / Passion — 열정적인 톤을 느리게 눌러 설교 호흡에 가깝게
    sermon: { voiceId: 'zh-CN-YunjianNeural', label: '云健 (열정적)', ratePct: -14, pitchPct: -6 },
    // News / Professional·Reliable — 또렷하고 균일
    news: { voiceId: 'zh-CN-YunyangNeural', label: '云扬 (뉴스·신뢰감)', ratePct: 0, pitchPct: 0 },
    // Novel / Lively·Sunshine — 가장 대화체
    chat: { voiceId: 'zh-CN-YunxiNeural', label: '云希 (밝고 자연스러움)', ratePct: 0, pitchPct: 0 },
  },
  female: {
    // News,Novel / Warm — 여성 음성 중 유일하게 낭독에 쓸 만하다
    sermon: { voiceId: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (따뜻함)', ratePct: -14, pitchPct: -6 },
    news: { voiceId: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (따뜻함)', ratePct: 0, pitchPct: 0 },
    // Cartoon / Lively — 가볍고 빠른 대화체
    chat: { voiceId: 'zh-CN-XiaoyiNeural', label: '晓伊 (발랄함)', ratePct: 0, pitchPct: 0 },
  },
};

export const TONE_LABELS: Record<Tone, string> = {
  sermon: '설교',
  news: '뉴스',
  chat: '대화',
};

export function resolveVoice(gender: Gender, tone: Tone): VoicePreset {
  return VOICE_MAP[gender][tone];
}

/** 사용자 배속(0.5~1.5)과 톤 보정을 합쳐 SSML rate 문자열로 만든다. */
export function toRateString(userRate: number, tonePct: number): string {
  const pct = Math.round((userRate - 1) * 100 + tonePct);
  const clamped = Math.max(-50, Math.min(80, pct));
  return `${clamped >= 0 ? '+' : ''}${clamped}%`;
}

export function toPitchString(userPitchPct: number, tonePct: number): string {
  const pct = Math.round(userPitchPct + tonePct);
  const clamped = Math.max(-50, Math.min(50, pct));
  return `${clamped >= 0 ? '+' : ''}${clamped}%`;
}
