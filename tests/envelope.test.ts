import { describe, expect, it } from 'vitest';
import { envelopeLevelAt } from '../src/audio/envelope';

const p = (over: Partial<Parameters<typeof envelopeLevelAt>[2]> = {}) => ({
  attack: 0.1,
  decay: 0.2,
  sustain: 0.5,
  release: 0.4,
  ...over,
});

describe('ADSR envelope', () => {
  it('ramps attack and decay toward sustain while held', () => {
    expect(envelopeLevelAt(0, null, p())).toBeCloseTo(0);
    expect(envelopeLevelAt(0.1, null, p())).toBeCloseTo(1);
    expect(envelopeLevelAt(0.3, null, p())).toBeCloseTo(0.5);
    expect(envelopeLevelAt(5, null, p())).toBeCloseTo(0.5);
  });

  it('releases from the current level without a jump', () => {
    const params = p();
    const releasedAt = 0.05; // mid attack -> level 0.5
    expect(envelopeLevelAt(releasedAt, releasedAt, params)).toBeCloseTo(0.5);
    expect(envelopeLevelAt(0.25, releasedAt, params)).toBeCloseTo(0.25);
    expect(envelopeLevelAt(1, releasedAt, params)).toBeCloseTo(0);
  });

  it('releases from sustain after decay completes', () => {
    const params = p();
    expect(envelopeLevelAt(1, 1, params)).toBeCloseTo(0.5);
    expect(envelopeLevelAt(1.2, 1, params)).toBeCloseTo(0.25);
  });
});
