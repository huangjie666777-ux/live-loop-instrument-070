import { BEATS_PER_CYCLE } from './recorder';

export interface TempoSegment {
  /** 该速度生效的第一圈编号 */
  cycle: number;
  bpm: number;
}

/** 一圈的时长（秒） */
export function cycleDuration(bpm: number): number {
  return (60 / bpm) * BEATS_PER_CYCLE;
}

/**
 * 纯函数：音频时钟时间 <-> 全局绝对拍号。
 * segments 按 cycle 递增，描述每圈的速度。
 */
export class TempoMap {
  constructor(
    public originTime: number,
    public segments: TempoSegment[],
  ) {}

  /** 全局绝对拍号 -> 秒 */
  timeOfBeat(absBeat: number): number {
    if (absBeat < 0) absBeat = 0;
    const totalCycles = Math.floor(absBeat / BEATS_PER_CYCLE);
    const beatInCycle = absBeat - totalCycles * BEATS_PER_CYCLE;
    let elapsed = 0;
    let segIndex = 0;
    for (let c = 0; c < totalCycles; c++) {
      while (segIndex + 1 < this.segments.length &&
             this.segments[segIndex + 1].cycle <= c) segIndex++;
      elapsed += cycleDuration(this.segments[segIndex].bpm);
    }
    while (segIndex + 1 < this.segments.length &&
           this.segments[segIndex + 1].cycle <= totalCycles) segIndex++;
    elapsed += (60 / this.segments[segIndex].bpm) * beatInCycle;
    return this.originTime + elapsed;
  }

  /** 秒 -> 全局绝对拍号 */
  beatAtTime(time: number): number {
    let elapsed = Math.max(0, time - this.originTime);
    let cycle = this.segments[0].cycle;
    let segIndex = 0;
    for (;;) {
      while (segIndex + 1 < this.segments.length &&
             this.segments[segIndex + 1].cycle <= cycle) segIndex++;
      const dur = cycleDuration(this.segments[segIndex].bpm);
      if (elapsed < dur) {
        return (cycle - this.segments[0].cycle) * BEATS_PER_CYCLE +
          elapsed * (this.segments[segIndex].bpm / 60);
      }
      elapsed -= dur;
      cycle++;
    }
  }
}

export function beatToTime(
  cycle: number,
  beat: number,
  segments: TempoSegment[],
  originTime: number,
): number {
  return new TempoMap(originTime, segments).timeOfBeat(
    (cycle - segments[0].cycle) * BEATS_PER_CYCLE + beat,
  );
}

export function timeToAbsBeat(
  time: number,
  segments: TempoSegment[],
  originTime: number,
): number {
  return new TempoMap(originTime, segments).beatAtTime(time);
}
