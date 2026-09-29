import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoopRecorder, type LoopNote } from '../src/loop/recorder';
import { Transport } from '../src/loop/transport';

let baseDate = 0;

class FakeSynth {
  onEvents: { key: string; midi: number; when: number }[] = [];
  offEvents: { key: string; when: number }[] = [];
  muted = false;
  get now(): number { return (Date.now() - baseDate) / 1000; }
  noteOn(key: string, midi: number, when?: number): number {
    this.onEvents.push({ key, midi, when: when ?? this.now });
    return 0;
  }
  noteOff(key: string, when?: number): boolean {
    this.offEvents.push({ key, when: when ?? this.now });
    return true;
  }
  allNotesOff(): void { this.muted = true; }
}

describe('循环调度器', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    baseDate = Date.now();
  });
  afterEach(() => vi.useRealTimers());

  function setup(getNotes: () => LoopNote[]) {
    const synth = new FakeSynth();
    const recorder = new LoopRecorder();
    const transport = new Transport(synth as never, recorder, getNotes, {});
    return { synth, recorder, transport };
  }

  it('120 BPM 下音符按音频时钟时刻排入，绘制帧率无关', () => {
    const { synth, transport } = setup(() => [{ midi: 60, start: 0, duration: 1 }]);
    transport.start();
    vi.advanceTimersByTime(300);
    expect(synth.onEvents.length).toBe(1);
    expect(synth.onEvents[0].when).toBeCloseTo(0.06, 5);
  });

  it('下一圈同位置再次回放（每圈触发一次，不漏不重）', () => {
    const { synth, transport } = setup(() => [{ midi: 62, start: 2, duration: 0.5 }]);
    transport.start();
    vi.advanceTimersByTime(5200);
    expect(synth.onEvents.length).toBe(2);
    expect(synth.onEvents[0].when).toBeCloseTo(0.06 + 1, 5);
    expect(synth.onEvents[1].when).toBeCloseTo(0.06 + 5, 5);
  });

  it('跨圈长音只在起点触发一次，释音时刻越过边界', () => {
    const { synth, transport } = setup(() => [{ midi: 64, start: 7, duration: 3 }]);
    transport.start();
    vi.advanceTimersByTime(6000);
    expect(synth.onEvents.length).toBe(1);
    expect(synth.onEvents[0].when).toBeCloseTo(0.06 + 3.5, 5);
    expect(synth.offEvents.length).toBe(1);
    expect(synth.offEvents[0].when).toBeCloseTo(0.06 + 3.5 + 1.5, 5);
  });

  it('播放中变速在下一圈边界生效并显示待生效速度', () => {
    const { transport } = setup(() => []);
    transport.start();
    transport.setBpm(200);
    expect(transport.pendingBpm).toBe(200);
    expect(transport.bpm).toBe(120);
    vi.advanceTimersByTime(4200);
    expect(transport.bpm).toBe(200);
    expect(transport.pendingBpm).toBeNull();
  });

  it('停止取消待发声并静音，再次播放从起点开始', () => {
    const { synth, transport } = setup(() => [{ midi: 60, start: 0, duration: 0.5 }]);
    transport.start();
    transport.stop();
    vi.advanceTimersByTime(10000);
    expect(synth.onEvents.length).toBe(0);
    transport.start();
    vi.advanceTimersByTime(300);
    expect(synth.onEvents.length).toBe(1);
    expect(synth.muted).toBe(true);
  });

  it('录制的音符不重触发监听：现场 key 独立，新音符下一圈对应位置回放', () => {
    const { synth, recorder, transport } = setup(() => recorder.notes);
    transport.start();
    recorder.arm('record');
    vi.advanceTimersByTime(100);
    recorder.press(60, 1);
    synth.noteOn('live:k', 60);
    recorder.release(60, 2);
    vi.advanceTimersByTime(5000);
    const playOns = synth.onEvents.filter((e) => e.key.startsWith('play:'));
    const liveOns = synth.onEvents.filter((e) => e.key.startsWith('live:'));
    expect(liveOns.length).toBe(1);
    expect(playOns.length).toBeGreaterThanOrEqual(1);
    expect(playOns[0].when).toBeCloseTo(0.06 + 4 + 0.5, 5);
  });
});
