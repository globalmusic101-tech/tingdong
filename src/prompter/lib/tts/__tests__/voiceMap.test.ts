import { describe, expect, it } from 'vitest';
import { toRateString } from '../voiceMap';

describe('Edge voice rate mapping', () => {
  it.each([[2, '+100%'], [3, '+200%'], [0.5, '-50%']] as const)('maps %s× to %s', (rate, expected) => {
    expect(toRateString(rate, 0)).toBe(expected);
  });
});
