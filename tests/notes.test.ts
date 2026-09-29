import { describe, expect, it } from 'vitest';
import {
  computerKeyToMidi, isBlackKey, midiToComputerKey, midiToFreq, midiToName,
} from '../src/audio/notes';

describe('十二平均律', () => {
  it('A4 = 440Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 5);
  });
  it('半音比值为 2^(1/12)，A#4 约 466.16', () => {
    expect(midiToFreq(70)).toBeCloseTo(466.1638, 3);
  });
  it('C4 约 261.63，B5 约 987.77', () => {
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 3);
    expect(midiToFreq(83)).toBeCloseTo(987.7666, 3);
  });
  it('每升高八度频率翻倍', () => {
    expect(midiToFreq(72) / midiToFreq(60)).toBeCloseTo(2, 6);
  });
});

describe('音名与键位映射', () => {
  it('音名含八度', () => {
    expect(midiToName(60)).toBe('C4');
    expect(midiToName(69)).toBe('A4');
    expect(midiToName(83)).toBe('B5');
  });
  it('黑白键判定', () => {
    expect(isBlackKey(60)).toBe(false);
    expect(isBlackKey(61)).toBe(true);
    expect(isBlackKey(64)).toBe(false);
  });
  it('电脑按键往返映射', () => {
    expect(computerKeyToMidi('z')).toBe(60);
    expect(computerKeyToMidi('Z')).toBe(60);
    expect(computerKeyToMidi('5')).toBe(83);
    expect(computerKeyToMidi('a')).toBeNull();
    expect(midiToComputerKey(60)).toBe('Z');
  });
});
