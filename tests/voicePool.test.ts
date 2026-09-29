import { describe, expect, it } from 'vitest';
import { VoicePool, type VoiceLike } from '../src/audio/voicePool';

interface V extends VoiceLike {
  id: number;
}

describe('VoicePool', () => {
  const make = (id: number, source: string, midi: number, pressedAt: number): V =>
    ({ id, source, midi, pressedAt, released: false });

  it('holds at most eight voices and steals the oldest pressed one', () => {
    const pool = new VoicePool<V>(8);
    let id = 0;
    for (let i = 0; i < 8; i++) {
      pool.allocate('live', 60 + i, i, () => make(++id, 'live', 60 + i, i));
    }
    expect(pool.voices).toHaveLength(8);
    const oldest = pool.voices[0];
    const { stolen } = pool.allocate('live', 80, 9, () => make(++id, 'live', 80, 9));
    expect(stolen).toBe(oldest);
    expect(pool.voices).toHaveLength(8);
  });

  it('prefers recycling a released voice over stealing', () => {
    const pool = new VoicePool<V>(8);
    let id = 0;
    pool.allocate('live', 60, 0, () => make(++id, 'live', 60, 0));
    pool.allocate('live', 62, 1, () => make(++id, 'live', 62, 1));
    pool.release('live', 60);
    const { stolen, existing } = pool.allocate('live', 64, 2, () => make(++id, 'live', 64, 2));
    expect(existing).toBe(false);
    expect(stolen?.midi).toBe(60);
    expect(pool.voices.some((v) => v.midi === 62)).toBe(true);
  });

  it('releases per source so the same pitch from another source keeps sounding', () => {
    const pool = new VoicePool<V>(8);
    let id = 0;
    pool.allocate('live', 60, 0, () => make(++id, 'live', 60, 0));
    pool.allocate('loop:c0:n1', 60, 0.1, () => make(++id, 'loop:c0:n1', 60, 0.1));
    pool.release('live', 60);
    const live = pool.voices.find((v) => v.source === 'live')!;
    const loop = pool.voices.find((v) => v.source.startsWith('loop'))!;
    expect(live.released).toBe(true);
    expect(loop.released).toBe(false);
    pool.release('loop:c0:n1', 60);
    expect(loop.released).toBe(true);
  });

  it('ignores a duplicate retrigger for the same source and pitch', () => {
    const pool = new VoicePool<V>(8);
    let id = 0;
    pool.allocate('live', 60, 0, () => make(++id, 'live', 60, 0));
    const result = pool.allocate('live', 60, 1, () => make(++id, 'live', 60, 1));
    expect(result.existing).toBe(true);
    expect(pool.voices).toHaveLength(1);
  });
});
