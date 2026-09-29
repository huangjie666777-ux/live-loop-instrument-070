import { describe, expect, it } from 'vitest';
import { LoopRecorder } from '../src/loop/recorder';

describe('录制 / 叠录模型', () => {
  it('armed 到下一圈起点才开始，record 替换旧音符', () => {
    const rec = new LoopRecorder();
    rec.notes = [{ midi: 60, start: 1, duration: 1 }];
    rec.arm('record');
    expect(rec.state).toBe('armed');
    // armed 期间按的键不应记录
    rec.press(62, -0.5);
    expect(rec.notes.length).toBe(1);
    rec.beginCycle(0);
    expect(rec.state).toBe('recording');
    expect(rec.notes.length).toBe(0); // 旧音符被替换
    rec.press(62, 0.5);
    rec.release(62, 1.5);
    expect(rec.notes[0]).toMatchObject({ midi: 62, start: 0.5, duration: 1 });
  });

  it('overdub 保留旧音符并追加', () => {
    const rec = new LoopRecorder();
    rec.notes = [{ midi: 60, start: 1, duration: 1 }];
    rec.arm('overdub');
    rec.beginCycle(0);
    rec.press(64, 2);
    rec.release(64, 3);
    expect(rec.notes.length).toBe(2);
    expect(rec.notes[0].midi).toBe(60);
  });

  it('按下位置按拍对 8 取模，跨圈长音不截断', () => {
    const rec = new LoopRecorder();
    rec.arm('record');
    rec.beginCycle(0);
    rec.press(60, 7); // 第一圈第 7 拍按下
    rec.beginCycle(8);
    rec.release(60, 9.5); // 第二圈第 1.5 拍松开
    expect(rec.notes.length).toBe(1);
    expect(rec.notes[0].start).toBeCloseTo(7, 5);
    expect(rec.notes[0].duration).toBeCloseTo(2.5, 5); // 跨越边界仍完整
  });

  it('停止截断未松开的音并回到空闲', () => {
    const rec = new LoopRecorder();
    rec.arm('record');
    rec.beginCycle(0);
    rec.press(60, 2);
    rec.stop(4.5);
    expect(rec.state).toBe('idle');
    expect(rec.notes[0]).toMatchObject({ start: 2, duration: 2.5 });
  });

  it('停止时取消 armed 等待', () => {
    const rec = new LoopRecorder();
    rec.arm('record');
    rec.stop(0);
    expect(rec.state).toBe('idle');
  });

  it('录制中再点录制：下一圈清空替换；叠录则保留', () => {
    const rec = new LoopRecorder();
    rec.arm('overdub');
    rec.beginCycle(0);
    rec.press(60, 0); rec.release(60, 1);
    expect(rec.notes.length).toBe(1);
    rec.arm('record');
    rec.beginCycle(8);
    expect(rec.notes.length).toBe(0); // 下一圈替换
    rec.press(62, 9); rec.release(62, 10);
    expect(rec.notes.length).toBe(1);
  });
});
