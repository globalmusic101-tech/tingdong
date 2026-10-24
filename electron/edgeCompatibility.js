import { randomUUID } from 'node:crypto';
import { generateEdgeToken, TRUSTED_CLIENT_TOKEN } from './edgeTokenV2.js';

// msedge-tts 2.1.0은 아직 v1 토큰입니다. 업스트림 edge-tts 7.3.1과
// 같은 v2 URL만 교체하고 스트림/시간제한/오류 처리는 라이브러리에 맡깁니다.
export function installEdgeCompatibility(TtsClass) {
  if (typeof TtsClass.getSynthUrl !== 'function') throw new Error('edge-transport-incompatible');
  TtsClass.getSynthUrl = async () => {
    const url = new URL('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1');
    url.search = new URLSearchParams({
      TrustedClientToken: TRUSTED_CLIENT_TOKEN,
      'Sec-MS-GEC': generateEdgeToken((Date.now() + (TtsClass._clockOffsetMs || 0))/1000),
      'Sec-MS-GEC-Version': '2-143.0.3650.75',
      ConnectionId: randomUUID().replaceAll('-', ''),
    }).toString();
    return url.toString();
  };
}
