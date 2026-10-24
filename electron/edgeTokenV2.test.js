import { describe, it, expect } from 'vitest';
import { generateEdgeToken } from './edgeTokenV2.js';
import { installEdgeCompatibility } from './edgeCompatibility.js';

// Python edge-tts 7.3.1로 독립 생성한 고정 시각 결과입니다.
describe('Edge v2 compatibility', () => {
  it.each([
    [0,'52BC7A17B50DFEC9-28C4394775C8751CD2F6859C030C06DB1489ACAB3B3A7651831FC26895177ED6'],
    [1791888000,'492D7694A183A45E-56E821F95D4579C5B7C7E33DC7303FF379EC36D510213555BBBB9EB17EF15876'],
    [1791888299,'492D7694A183A45E-56E821F95D4579C5B7C7E33DC7303FF379EC36D510213555BBBB9EB17EF15876'],
    [1791888300,'6D26B5F5B70269AD-280E82E1BBE24E4E8866E3502EB6277B9436F61ABDC1C224518A038BBD7BBDAD'],
  ])('matches upstream token at %s', (time,expected) => expect(generateEdgeToken(time)).toBe(expected));
  it('uses a fixed endpoint, v2 and unique request ids', async () => {
    const transport={getSynthUrl:async()=>''};
    installEdgeCompatibility(transport);
    const a=new URL(await transport.getSynthUrl()),b=new URL(await transport.getSynthUrl());
    expect(a.origin).toBe('wss://speech.platform.bing.com');
    expect(a.searchParams.get('Sec-MS-GEC-Version')).toBe('2-143.0.3650.75');
    expect(a.searchParams.get('Sec-MS-GEC')).toMatch(/^[A-F0-9]{16}-[A-F0-9]{64}$/);
    expect(a.searchParams.get('ConnectionId')).not.toBe(b.searchParams.get('ConnectionId'));
  });
  it('fails explicitly for incompatible library versions',()=>{
    expect(()=>installEdgeCompatibility({})).toThrow('edge-transport-incompatible');
  });
});
