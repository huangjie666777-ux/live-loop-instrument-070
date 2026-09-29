import { SynthEngine } from '../audio/synth';
import { BEATS_PER_CYCLE, type LoopNote, type LoopRecorder } from './recorder';
import { TempoMap } from './timing';

const LOOKAHEAD_MS = 25;     // 调度器运行间隔
const SCHEDULE_AHEAD = 0.15; // 提前 150ms 排入音频时钟
const MIN_BPM = 40;
const MAX_BPM = 200;

export type TransportState = 'stopped' | 'playing';

interface PendingVoice {
  key: string;
  onTimer: ReturnType<typeof setTimeout> | null;
  offTimer: ReturnType<typeof setTimeout> | null;
}

export interface TransportEvents {
  onCycle?: (cycle: number, bpm: number) => void;
  onFrame?: (absBeat: number, playing: boolean) => void;
}

/**
 * 基于音频时钟的循环调度器：每 25ms 用 setTimeout 把未来 150ms 内
 * 的音符精确排入 AudioContext 时钟，绘制帧率不影响节拍。
 */
export class Transport {
  state: TransportState = 'stopped';
  bpm = 120;
  pendingBpm: number | null = null;

  private map: TempoMap | null = null;
  private nextCycle = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private raf = 0;
  private pending: PendingVoice[] = [];
  private scheduledKeys = new Set<string>();

  constructor(
    private synth: SynthEngine,
    private recorder: LoopRecorder,
    private getNotes: () => LoopNote[],
    private events: TransportEvents = {},
  ) {}

  clampBpm(v: number): number {
    return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v)));
  }

  /** 播放中变速只标记，下一圈边界生效；停止态立即生效 */
  setBpm(v: number): void {
    const bpm = this.clampBpm(v);
    if (this.state === 'playing') {
      this.pendingBpm = bpm;
    } else {
      this.bpm = bpm;
      this.pendingBpm = null;
    }
  }

  start(): void {
    if (this.state === 'playing') return;
    this.state = 'playing';
    this.nextCycle = 0;
    this.map = new TempoMap(this.synth.now + 0.06, [{ cycle: 0, bpm: this.bpm }]);
    this.scheduledKeys.clear();
    this.timer = setInterval(() => this.tick(), LOOKAHEAD_MS);
    const frame = (): void => {
      if (this.state !== 'playing' || !this.map) return;
      this.events.onFrame?.(this.map.beatAtTime(this.synth.now), true);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** 停止：结束未松开的录音、取消待发声并静音，回到起点 */
  stop(): void {
    if (this.state === 'stopped') {
      this.recorder.cancelArmed();
      return;
    }
    this.haltPlayback();
    const absBeat = this.map ? this.map.beatAtTime(this.synth.now) : 0;
    this.recorder.stop(absBeat);
    this.synth.allNotesOff();
    this.state = 'stopped';
    this.bpm = this.map?.segments[this.map.segments.length - 1]?.bpm ?? this.bpm;
    this.pendingBpm = null;
    this.map = null;
    this.events.onFrame?.(0, false);
  }

  /** 清空：同时停止并删除全部音符 */
  clear(): void {
    const wasPlaying = this.state === 'playing';
    const absBeat = this.map ? this.map.beatAtTime(this.synth.now) : 0;
    if (wasPlaying) this.haltPlayback();
    this.recorder.clear(absBeat);
    this.synth.allNotesOff();
    this.state = 'stopped';
    this.bpm = this.map?.segments[this.map.segments.length - 1]?.bpm ?? this.bpm;
    this.pendingBpm = null;
    this.map = null;
    this.events.onFrame?.(0, false);
  }

  currentAbsBeat(): number {
    if (this.state !== 'playing' || !this.map) return 0;
    return this.map.beatAtTime(this.synth.now);
  }

  private haltPlayback(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    cancelAnimationFrame(this.raf);
    for (const p of this.pending) {
      if (p.onTimer) clearTimeout(p.onTimer);
      if (p.offTimer) clearTimeout(p.offTimer);
    }
    this.pending = [];
    this.scheduledKeys.clear();
  }

  private tick(): void {
    if (!this.map) return;
    const horizon = this.synth.now + SCHEDULE_AHEAD;
    // 起点已进入 [过去, 未来调度窗口] 的圈立即调度（start() 后首个 tick
    // 会补上第 0 圈）；超过窗口的圈留待下一次 tick，不跳过、不重复。
    while (this.map.timeOfBeat(this.nextCycle * BEATS_PER_CYCLE) <= horizon) {
      const cycleStartAbs = this.nextCycle * BEATS_PER_CYCLE;
      if (this.nextCycle > 0 && this.pendingBpm !== null) {
        this.map.segments.push({ cycle: this.nextCycle, bpm: this.pendingBpm });
        this.bpm = this.pendingBpm;
        this.pendingBpm = null;
      }
      // 录音在圈起点翻转：record 在此替换旧音符，overdub 保留
      this.recorder.beginCycle(cycleStartAbs);
      this.events.onCycle?.(this.nextCycle, this.bpmAtCycle(this.nextCycle));
      this.scheduleCycle(this.nextCycle);
      this.nextCycle++;
    }
  }

  private scheduleCycle(cycle: number): void {
    if (!this.map) return;
    const notes = this.getNotes();
    const cycleEnd = this.map.timeOfBeat((cycle + 1) * BEATS_PER_CYCLE);

    for (const note of notes) {
      const onAbs = cycle * BEATS_PER_CYCLE + note.start;
      const onTime = this.map!.timeOfBeat(onAbs);
      if (onTime > cycleEnd) continue;
      const key = `play:${note.midi}:${onAbs.toFixed(3)}`;
      if (this.scheduledKeys.has(key)) continue;
      this.scheduledKeys.add(key);
      const offTime = this.map!.timeOfBeat(onAbs + note.duration);
      this.scheduleVoice(key, note, onTime, offTime);
    }
  }

  private scheduleVoice(
    key: string,
    note: LoopNote,
    onTime: number,
    offTime: number,
  ): void {
    const entry: PendingVoice = { key, onTimer: null, offTimer: null };
    const onDelay = Math.max(0, (onTime - this.synth.now) * 1000);
    entry.onTimer = setTimeout(() => {
      entry.onTimer = null;
      if (this.state !== 'playing' || !this.map) return;
      if (this.synth.noteOn(key, note.midi, onTime) < 0) return;
      const offDelay = Math.max(0, (offTime - this.synth.now) * 1000);
      entry.offTimer = setTimeout(() => {
        this.synth.noteOff(key, offTime);
        this.pending = this.pending.filter((p) => p !== entry);
      }, offDelay);
    }, onDelay);
    this.pending.push(entry);
  }

  private bpmAtCycle(cycle: number): number {
    let bpm = this.map?.segments[0]?.bpm ?? this.bpm;
    for (const seg of this.map?.segments ?? []) {
      if (seg.cycle <= cycle) bpm = seg.bpm;
    }
    return bpm;
  }
}
