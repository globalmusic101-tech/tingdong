import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { installEdgeCompatibility } from './edgeCompatibility.js';

installEdgeCompatibility(MsEdgeTTS);

/**
 * 렌더러가 직접 WebSocket으로 MS 엔드포인트에 붙으면 CSP에 걸리므로,
 * 메인 프로세스에서 합성하고 오디오 버퍼만 넘긴다.
 *
 * 무료 Edge 엔드포인트 실측(2026-08-30): rate·pitch·음성 선택은 되지만
 * mstts:express-as 와 <break> 는 요청 자체가 거부된다. 그래서 SSML은 prosody만 쓴다.
 */

const SYNTH_TIMEOUT_MS = 3_000;

const VOICE_PATTERN = /^(?:zh-CN|ko-KR|en-US)-[A-Za-z]+Neural$/;
const PROSODY_PATTERN = /^[+-]\d{1,2}%$/;

/** 원고 텍스트가 SSML 구조를 깨거나 태그로 해석되지 않게 한다 */
function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSsml({ text, voiceId, rate, pitch }) {
  const language = voiceId.slice(0, 5);
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}">` +
    `<voice name="${voiceId}">` +
    `<prosody rate="${rate}" pitch="${pitch}">${escapeXml(text)}</prosody>` +
    '</voice></speak>'
  );
}

async function synthesize(params) {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(params.voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.rawToStream(buildSsml(params));
    const chunks = [];

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('음성 합성 응답이 없습니다 (3초)')), SYNTH_TIMEOUT_MS);
      const finish = (err) => {
        clearTimeout(timer);
        err ? reject(err) : resolve();
      };

      audioStream.on('data', (chunk) => chunks.push(chunk));
      audioStream.on('end', () => finish());
      audioStream.on('error', finish);
    });

    const audio = Buffer.concat(chunks);
    if (audio.length === 0) throw new Error('빈 오디오가 돌아왔습니다');
    return audio;
  } finally {
    try { tts.close(); } catch { /* 이미 닫혔으면 무시 */ }
  }
}

export function registerTtsBridge(ipcMain) {
  ipcMain.handle('tts:synth', async (_event, params) => {
    try {
      if (!params || typeof params.text !== 'string' || !params.text.trim()) {
        throw new Error('합성할 문장이 없습니다');
      }
      if (!VOICE_PATTERN.test(params.voiceId ?? '')) {
        throw new Error(`음성 이름이 올바르지 않습니다: ${params.voiceId}`);
      }
      if (!PROSODY_PATTERN.test(params.rate ?? '') || !PROSODY_PATTERN.test(params.pitch ?? '')) {
        throw new Error('속도·음높이 값이 올바르지 않습니다');
      }

      return { ok: true, data: await synthesize(params) };
    } catch (error) {
      console.error('[tts] 합성 실패:', error?.message ?? error);
      return { ok: false, error: error?.message ?? '알 수 없는 오류' };
    }
  });
}
