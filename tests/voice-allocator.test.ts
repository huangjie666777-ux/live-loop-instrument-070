import { describe, expect, it } from 'vitest';
import { acquireSlot, createSlots, releaseSlot } from '../src/audio/voice-allocator';

describe('声部回收策略（最多 8 声部）', () => {
  it('优先使用空闲槽', () => {
    const slots = createSlots(8);
    expect(acquireSlot(slots, 'a', 0)).toBe(0);
    expect(acquireSlot(slots, 'b', 1)).toBe(1);
    expect(releaseSlot(slots, 0, 'a')).toBe(true);
    expect(acquireSlot(slots, 'c', 2)).toBe(0);
  });

  it('满员后替换最早按下者', () => {
    const slots = createSlots(3);
    acquireSlot(slots, 'a', 0);
    acquireSlot(slots, 'b', 1);
    acquireSlot(slots, 'c', 2);
    releaseSlot(slots, 1, 'b'); // b 已释音
    expect(acquireSlot(slots, 'd', 3)).toBe(1); // 优先回收已释音槽
    expect(acquireSlot(slots, 'e', 4)).toBe(0); // 满员后抢最早按下的 a
    expect(acquireSlot(slots, 'f', 5)).toBe(2); // 再抢剩下最早的 c
    expect(slots.map((s) => s.key).sort()).toEqual(['d', 'e', 'f']);
  });

  it('错误来源不能释放别人的声部（同音各自释放）', () => {
    const slots = createSlots(8);
    acquireSlot(slots, 'live:64', 0);
    expect(releaseSlot(slots, 0, 'play:64')).toBe(false);
    expect(slots[0].key).toBe('live:64');
    expect(releaseSlot(slots, 0, 'live:64')).toBe(true);
    expect(slots[0].key).toBeNull();
  });

  it('同 key 再触发复用同槽而非抢占其他声部', () => {
    const slots = createSlots(2);
    acquireSlot(slots, 'x', 0);
    acquireSlot(slots, 'y', 1);
    const idx = acquireSlot(slots, 'x', 2);
    expect(idx).toBe(0);
    expect(slots[1].key).toBe('y');
  });
});
