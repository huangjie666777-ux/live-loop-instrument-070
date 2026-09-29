// 纯逻辑：最多 max 个声部的复用策略（与 Web Audio 无关，便于测试）
// 1) 优先回收已释放的空闲声部
// 2) 其次复用已存在同 key 的声部（重新触发）
// 3) 最后替换最早按下（pressSeq 最小）的声部

export interface Slot {
  key: string | null;
  /** 按下序号，越大越新；空闲槽为 -1 */
  pressSeq: number;
}

export function createSlots(max: number): Slot[] {
  return Array.from({ length: max }, () => ({ key: null, pressSeq: -1 }));
}

/**
 * 选择一个可供按下使用的槽位下标。
 * @param seq 本次按下的全局序号
 */
export function acquireSlot(slots: Slot[], key: string, seq: number): number {
  let idle = -1;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].key === null) { idle = i; break; }
  }
  if (idle >= 0) {
    slots[idle] = { key, pressSeq: seq };
    return idle;
  }
  let same = -1;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].key === key) { same = i; break; }
  }
  if (same >= 0) {
    slots[same] = { key, pressSeq: seq };
    return same;
  }
  let oldest = 0;
  for (let i = 1; i < slots.length; i++) {
    if (slots[i].pressSeq < slots[oldest].pressSeq) oldest = i;
  }
  slots[oldest] = { key, pressSeq: seq };
  return oldest;
}

/** 仅当槽位当前持有该 key 时释放（不同来源同音互不误释放） */
export function releaseSlot(slots: Slot[], index: number, key: string): boolean {
  const slot = slots[index];
  if (slot && slot.key === key) {
    slot.key = null;
    slot.pressSeq = -1;
    return true;
  }
  return false;
}
