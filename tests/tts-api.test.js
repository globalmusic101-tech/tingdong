import { describe, expect, it, vi } from 'vitest';
const synth = vi.hoisted(() => vi.fn());
vi.mock('../electron/ttsBridge.js', () => ({ synthesize: synth }));
import handler from '../api/tts.js';

function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status: vi.fn().mockReturnThis(), end: vi.fn(), json: vi.fn(), send: vi.fn() };
}
const valid = { text: '你好', voiceId: 'zh-CN-XiaoxiaoNeural', rate: '+0%', pitch: '+0%' };
describe('speech endpoint', () => {
  it('rejects invalid voice, prosody and long text before synthesis', async () => {
    for (const patch of [{ voiceId: 'unknown' }, { rate: '+201%' }, { text: '字'.repeat(2001) }]) {
      const res = response();
      await handler({ method: 'POST', body: { ...valid, ...patch } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(synth).not.toHaveBeenCalled();
  });
  it('returns the generated audio and hides upstream errors', async () => {
    synth.mockResolvedValueOnce(Buffer.from('audio')).mockRejectedValueOnce(new Error('private text'));
    const success = response();
    await handler({ method: 'POST', body: valid }, success);
    expect(success.headers['Content-Type']).toBe('audio/mpeg');
    expect(success.send).toHaveBeenCalled();
    const failed = response();
    await handler({ method: 'POST', body: valid }, failed);
    expect(failed.status).toHaveBeenCalledWith(502);
    expect(failed.json).toHaveBeenCalledWith({ error: 'speech-unavailable' });
  });
});
