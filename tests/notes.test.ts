import { describe, expect, it } from 'vitest';
import { frequencyOf, midiFromKey, buildKeyboard, noteName, LOWEST_MIDI, HIGHEST_MIDI } from '../src/audio/notes';

describe('equal temperament', () => {
  it('tunes A4 to 440 Hz and uses 12-TET ratios', () => {
    expect(frequencyOf(69)).toBeCloseTo(440, 5);
    expect(frequencyOf(70)).toBeCloseTo(440 * Math.pow(2, 1 / 12), 5);
    expect(frequencyOf(57)).toBeCloseTo(220, 5);
    expect(frequencyOf(81)).toBeCloseTo(880, 5);
  });

  it('covers C4 through B5 with correct names', () => {
    const kb = buildKeyboard();
    expect(kb).toHaveLength(24);
    expect(kb[0].name).toBe('C4');
    expect(kb[0].midi).toBe(LOWEST_MIDI);
    expect(noteName(HIGHEST_MIDI)).toBe('B5');
    expect(kb.at(-1)!.name).toBe('B5');
  });

  it('maps every note to a unique computer key', () => {
    const kb = buildKeyboard();
    const keys = kb.map((n) => n.key);
    expect(keys.every((k) => k !== null)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
    expect(midiFromKey('Z')).toBe(60);
    expect(midiFromKey('q')).toBe(72);
  });
});
