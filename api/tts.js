import { synthesize } from '../electron/ttsBridge.js';

const voices = new Set([
  'zh-CN-YunjianNeural', 'zh-CN-YunyangNeural', 'zh-CN-YunxiNeural',
  'zh-CN-XiaoxiaoNeural', 'zh-CN-XiaoyiNeural', 'ko-KR-InJoonNeural',
  'ko-KR-SunHiNeural', 'en-US-GuyNeural', 'en-US-JennyNeural',
]);

function validPercent(value, min, max) {
  return typeof value === 'string' && /^[+-]\d{1,3}%$/.test(value)
    && Number(value.slice(0, -1)) >= min && Number(value.slice(0, -1)) <= max;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const { text, voiceId, rate, pitch } = req.body ?? {};
  if (typeof text !== 'string' || !text.trim() || text.length > 2000 || !voices.has(voiceId)
      || !validPercent(rate, -50, 200) || !validPercent(pitch, -50, 50)) {
    return res.status(400).json({ error: 'invalid-request' });
  }
  try {
    const audio = await synthesize({ text, voiceId, rate, pitch }, 4000);
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(audio);
  } catch {
    return res.status(502).json({ error: 'speech-unavailable' });
  }
}
