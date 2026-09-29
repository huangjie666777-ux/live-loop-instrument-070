import { describe, expect, it } from 'vitest';
import { TempoMap } from '../src/loop/timing';
import { BEATS_PER_CYCLE } from '../src/loop/recorder';

describe('音频时钟与拍号换算', () => {
  it('120 BPM 下每拍 0.5 秒，一圈 4 秒', () => {
    const map = new TempoMap(10, [{ cycle: 0, bpm: 120 }]);
    expect(map.timeOfBeat(0)).toBe(10);
    expect(map.timeOfBeat(2)).toBeCloseTo(11, 5);
    expect(map.timeOfBeat(BEATS_PER_CYCLE)).toBeCloseTo(14, 5);
    expect(map.beatAtTime(12)).toBeCloseTo(4, 5);
  });

  it('换算互为逆函数，含跨圈', () => {
    const map = new TempoMap(0, [{ cycle: 0, bpm: 96 }]);
    for (const beat of [0, 1.25, 7.9, 8, 12.75, 20.1]) {
      expect(map.beatAtTime(map.timeOfBeat(beat))).toBeCloseTo(beat, 4);
    }
  });

  it('变速在下一圈边界生效：前一圈仍用旧速度', () => {
    const map = new TempoMap(0, [
      { cycle: 0, bpm: 60 },  // 一圈 8 秒
      { cycle: 1, bpm: 240 }, // 一圈 2 秒
    ]);
    expect(map.timeOfBeat(8)).toBeCloseTo(8, 5);      // 第一圈结束
    expect(map.timeOfBeat(16)).toBeCloseTo(10, 5);    // 第二圈结束 8+2
    expect(map.beatAtTime(7.99)).toBeCloseTo(7.99, 4);
    expect(map.beatAtTime(8)).toBeCloseTo(8, 6);
    expect(map.beatAtTime(9)).toBeCloseTo(12, 4);     // 新速度 1 秒 = 4 拍
  });
});
