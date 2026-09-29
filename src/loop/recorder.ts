// 循环录音纯模型：以“拍”为时间单位，固定两小节 4/4 = 8 拍。
export const BEATS_PER_CYCLE = 8;

export interface LoopNote {
  midi: number;
  /** 起始拍，范围 [0, 8) */
  start: number;
  /** 时长（拍），允许 >= 8 以表示跨圈长音 */
  duration: number;
}

export type ArmMode = 'record' | 'overdub';
export type RecordState = 'idle' | 'armed' | 'recording';

interface Held {
  midi: number;
  /** 按下时的全局绝对拍号 */
  startBeat: number;
  count: number;
}

export class LoopRecorder {
  notes: LoopNote[] = [];
  state: RecordState = 'idle';
  /** armed 时等待开始的模式 */
  armedMode: ArmMode | null = null;
  /** 正在录制时的模式 */
  activeMode: ArmMode | null = null;
  private held = new Map<number, Held>();
  /** 本圈起点的全局绝对拍号 */
  private cycleOrigin = 0;

  get isArmed(): boolean { return this.state === 'armed'; }
  get isRecording(): boolean { return this.state === 'recording'; }

  /** 请求从下一圈起点录制/叠录 */
  arm(mode: ArmMode): void {
    if (this.state === 'recording') {
      // 录制中再点：从下一圈起按所选模式进行（record 下一圈清空替换）
      this.activeMode = mode;
      this.armedMode = mode;
      return;
    }
    this.armedMode = mode;
    this.state = 'armed';
  }

  cancelArmed(): void {
    if (this.state === 'armed') {
      this.state = 'idle';
      this.armedMode = null;
    }
  }

  /**
   * 由调度器在每圈起点调用。
   * record 在此刻清空旧音符（替换）；overdub 保留。
   */
  beginCycle(originBeat: number): void {
    if (this.state === 'armed' && this.armedMode) {
      if (this.armedMode === 'record') this.notes = [];
      this.activeMode = 'overdub';
      this.state = 'recording';
      this.armedMode = null;
    } else if (this.state === 'recording' && this.armedMode === 'record') {
      // 录制中要求再替换：下一圈清空本圈之后继续叠录
      this.notes = [];
      this.armedMode = null;
    }
    this.cycleOrigin = originBeat;
  }

  press(midi: number, absBeat: number): void {
    if (this.state !== 'recording') return;
    const existing = this.held.get(midi);
    if (existing) {
      existing.count += 1;
    } else {
      this.held.set(midi, { midi, startBeat: absBeat, count: 1 });
    }
  }

  /** 松开，音符立即入库；跨圈长音的 duration 可大于一圈 */
  release(midi: number, absBeat: number): void {
    if (this.state !== 'recording') return;
    const held = this.held.get(midi);
    if (!held) return;
    held.count -= 1;
    if (held.count > 0) return;
    this.held.delete(midi);
    const duration = Math.max(0.05, absBeat - held.startBeat);
    const start = mod(held.startBeat, BEATS_PER_CYCLE);
    // 叠录时去除与上一次完全重复的同音（鼠标/键盘同源抖动保护外不去重）
    this.notes.push({ midi, start, duration: round3(duration) });
  }

  /** 停止：以当前拍号截断仍按住的录音音符，回到空闲 */
  stop(absBeat: number): void {
    for (const held of this.held.values()) {
      const duration = Math.max(0.05, absBeat - held.startBeat);
      this.notes.push({
        midi: held.midi,
        start: mod(held.startBeat, BEATS_PER_CYCLE),
        duration: round3(duration),
      });
    }
    this.held.clear();
    this.state = 'idle';
    this.armedMode = null;
    this.activeMode = null;
  }

  /** 清空：停止并删除全部音符 */
  clear(absBeat: number): void {
    this.stop(absBeat);
    this.notes = [];
  }
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
