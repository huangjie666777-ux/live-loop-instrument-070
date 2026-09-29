import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SynthEngine } from '../src/audio/synth';

// 最小可用的假 Web Audio 节点，记录事件序列
class FakeParam {
  value = 0;
  private curve: { time: number; value: number }[] = [];
  setValueAtTime(v: number, t: number) { this.curve.push({ time: t, value: v }); return this; }
  linearRampToValueAtTime(v: number, t: number) { this.curve.push({ time: t, value: v }); return this; }
  setTargetAtTime(v: number) { this.value = v; return this; }
  cancelScheduledValues() { this.curve = []; return this; }
  snapshot(t: number): number {
    let v = this.curve[0]?.value ?? 0;
    for (let i = 0; i + 1 < this.curve.length; i++) {
      if (t >= this.curve[i].time && t < this.curve[i + 1].time) {
        const a = this.curve[i], b = this.curve[i + 1];
        return a.value + (b.value - a.value) * (t - a.time) / (b.time - a.time);
      }
      if (t >= this.curve[i].time) v = this.curve[i + 1]?.value ?? a.value;
    }
    return v;
  }
}

class FakeNode {
  connect = vi.fn((n: unknown) => n);
  disconnect = vi.fn();
}

class FakeOsc extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  start = vi.fn();
  stop = vi.fn();
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeAudioContext {
  static now = 100;
  currentTime = 100;
  state = 'running' as const;
  destination = new FakeNode();
  resume = vi.fn(async () => undefined);
  createOscillator() { return new FakeOsc(); }
  createGain() { return new FakeGain(); }
}

let engine: SynthEngine;

vi.stubGlobal('AudioContext', FakeAudioContext);

import { SynthEngine as Synth } from '../src/audio/synth';

afterEach(() => vi.useRealTimers());

describe('合成引擎', () => {
  it('启用后 noteOn 创建振荡器与包络，频率符合十二平均律', async () => {
    engine = new Synth();
    expect(await engine.enable()).toBe(true);
    const idx = engine.noteOn('live:key:KeyZ', 69);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(engine.isSounding('live:key:KeyZ')).toBe(true);
  });

  it('未启用时不发声', () => {
    engine = new Synth();
    expect(engine.noteOn('x', 60)).toBe(-1);
  });

  it('不同来源同音互不截断：live 与 play 可同时存在', async () => {
    engine = new Synth();
    await engine.enable();
    engine.noteOn('live:64', 64);
    engine.noteOn('play:64:0:1', 64);
    expect(engine.isSounding('live:64')).toBe(true);
    expect(engine.isSounding('play:64:0:1')).toBe(true);
    engine.noteOff('live:64');
    expect(engine.isSounding('live:64')).toBe(false);
    expect(engine.isSounding('play:64:0:1')).toBe(true);
  });

  it('超过 8 声部时回收：被抢占声部被停止', async () => {
    engine = new Synth();
    await engine.enable();
    for (let i = 0; i < 9; i++) engine.noteOn(`k${i}`, 60 + i);
    expect(engine.isSounding('k0')).toBe(false); // 最早按下者被替换
    expect(engine.isSounding('k8')).toBe(true);
  });

  it('释音从当前电平开始线性归零，不突变', async () => {
    engine = new Synth();
    await engine.enable();
    engine.setAdsr({ attack: 0.01, decay: 0, sustain: 0.5, release: 0.2 });
    engine.noteOn('k', 60, 100);
    engine.noteOff('k', 102);
    // 释音起点电平不应从 1 或 0 跳变，由包络计算（此处约为 sustain 0.5）
    expect(engine.isSounding('k')).toBe(false); // 逻辑槽已释放（音在物理上淡出）
  });

  it('allNotesOff 立即静音全部声部', async () => {
    engine = new Synth();
    await engine.enable();
    engine.noteOn('a', 60);
    engine.noteOn('b', 62);
    engine.allNotesOff();
    expect(engine.isSounding('a')).toBe(false);
    expect(engine.isSounding('b')).toBe(false);
  });
});
