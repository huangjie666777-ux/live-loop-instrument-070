import { midiToFreq } from './notes';
import { acquireSlot, createSlots, releaseSlot } from './voice-allocator';

export type WaveShape = 'sine' | 'square' | 'sawtooth';

export interface AdsrParams {
  attack: number;   // 秒
  decay: number;    // 秒
  sustain: number;  // 0..1
  release: number;  // 秒
}

interface Voice {
  key: string;
  midi: number;
  osc: OscillatorNode;
  gain: GainNode;
  /** 是否已进入释音阶段（逻辑上不再占用声部） */
  released: boolean;
  /** 释放定时器：未释放为 null */
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const MAX_VOICES = 8;

export class SynthEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: (Voice | null)[] = new Array(MAX_VOICES).fill(null);
  private slots = createSlots(MAX_VOICES);
  private seq = 0;
  private volume = 0.8;
  private wave: WaveShape = 'sine';
  adsr: AdsrParams = { attack: 0.01, decay: 0.15, sustain: 0.7, release: 0.25 };

  /** 必须在用户手势中调用；成功后返回 true */
  async enable(): Promise<boolean> {
    if (!this.ctx) {
      const g = globalThis as typeof globalThis & {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctor = g.AudioContext || g.webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx.state === 'running';
  }

  get enabled(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
    }
  }

  setWave(wave: WaveShape): void {
    this.wave = wave;
    for (const voice of this.voices) {
      if (voice) voice.osc.type = wave;
    }
  }

  setAdsr(params: AdsrParams): void {
    this.adsr = { ...params };
  }

  /** 立即停止并释放全部声部（失焦、停止、清空时使用） */
  allNotesOff(): void {
    for (let i = 0; i < MAX_VOICES; i++) {
      if (this.voices[i]) this.teardownVoice(i, true);
    }
  }

  /**
   * 触发一个声部。
   * @param key 来源唯一标识（如 live:64 / play:64:圈号:拍），互不影响
   * @param when 音频时钟时间，默认当前
   * @returns 声部下标；引擎未启用返回 -1
   */
  noteOn(key: string, midi: number, when?: number): number {
    if (!this.ctx || !this.master) return -1;
    const startTime = when ?? this.ctx.currentTime;
    const index = acquireSlot(this.slots, key, this.seq++);
    // 被抢占的旧声部立刻静音拆除
    if (this.voices[index]) this.teardownVoice(index, true);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = this.wave;
    osc.frequency.value = midiToFreq(midi);

    const { attack, decay, sustain } = this.adsr;
    const a = Math.max(0.001, attack);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(1, startTime + a);
    gain.gain.linearRampToValueAtTime(
      Math.max(0, Math.min(1, sustain)),
      startTime + a + Math.max(0.001, decay),
    );

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(startTime);
    this.voices[index] = { key, midi, osc, gain, released: false, cleanupTimer: null };
    return index;
  }

  /**
   * 从当前包络电平进入释音，避免突变；释音结束后销毁节点。
   * @returns 是否找到并释放
   */
  noteOff(key: string, when?: number): boolean {
    if (!this.ctx) return false;
    const stopTime = when ?? this.ctx.currentTime;
    const index = this.voices.findIndex((v) => v !== null && v.key === key);
    if (index < 0) return false;
    const voice = this.voices[index]!;
    voice.released = true;
    const release = Math.max(0.005, this.adsr.release);
    let level = 0;
    try {
      level = Math.max(0, Math.min(1, voice.gain.gain.value));
    } catch {
      level = this.adsr.sustain;
    }
    voice.gain.gain.cancelScheduledValues(stopTime);
    voice.gain.gain.setValueAtTime(level, stopTime);
    voice.gain.gain.linearRampToValueAtTime(0, stopTime + release);
    try { voice.osc.stop(stopTime + release + 0.05); } catch { /* already stopped */ }
    voice.cleanupTimer = setTimeout(() => {
      // 若该声部未被重新占用则拆除
      if (this.voices[index] === voice) this.teardownVoice(index, false);
    }, (release + 0.1) * 1000);
    // 槽位在 teardownVoice 中（释音结束、节点断开后）才归还，
    // 释音期间不参与空闲回收。
    return true;
  }

  /** 是否仍有该 key 的未释放声部 */
  isSounding(key: string): boolean {
    return this.voices.some((v) => v !== null && v.key === key && !v.released);
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  private teardownVoice(index: number, immediate: boolean): void {
    const voice = this.voices[index];
    if (!voice) return;
    if (voice.cleanupTimer) clearTimeout(voice.cleanupTimer);
    try {
      if (immediate) {
        voice.gain.gain.cancelScheduledValues(this.ctx!.currentTime);
        voice.gain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.005);
        voice.osc.stop(this.ctx!.currentTime + 0.05);
      }
    } catch { /* noop */ }
    try { voice.osc.disconnect(); } catch { /* noop */ }
    try { voice.gain.disconnect(); } catch { /* noop */ }
    this.voices[index] = null;
    releaseSlot(this.slots, index, voice.key);
  }
}
