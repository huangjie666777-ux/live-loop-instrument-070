import { SynthEngine, type AdsrParams, type WaveShape } from '../audio/synth';
import { computerKeyToMidi, isEditableTarget } from '../audio/notes';
import { LoopRecorder, type LoopNote } from '../loop/recorder';
import { Transport } from '../loop/transport';

interface LiveSource {
  midi: number;
  voiceKey: string;
}

export class InstrumentController {
  engine = new SynthEngine();
  recorder = new LoopRecorder();
  transport: Transport;

  enabled = $state(false);
  wave = $state<WaveShape>('sine');
  volume = $state(0.8);
  adsr = $state<AdsrParams>({ attack: 0.01, decay: 0.15, sustain: 0.7, release: 0.25 });
  bpm = $state(120);
  pendingBpm = $state<number | null>(null);
  playing = $state(false);
  recordState = $state<'idle' | 'armed' | 'recording'>('idle');
  armedMode = $state<'record' | 'overdub' | null>(null);
  activeLive = $state<Set<number>>(new Set());
  playhead = $state(0);
  notesVersion = $state(0);

  private live = new Map<string, LiveSource>();
  private keyDown = new Set<string>();
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;
  private boundPointerCancel: () => void;
  private boundPointerUp: (e: PointerEvent) => void;

  constructor() {
    this.transport = new Transport(
      this.engine,
      this.recorder,
      () => this.recorder.notes,
      {
        onCycle: () => {
          this.syncState();
          this.notesVersion++;
        },
        onFrame: (absBeat, playing) => {
          this.playhead = playing ? absBeat % 8 : 0;
          this.syncState();
        },
      },
    );

    this.boundKeyDown = (e) => this.onKeyDown(e);
    this.boundKeyUp = (e) => this.onKeyUp(e);
    this.boundBlur = () => this.releaseAllLive();
    this.boundPointerCancel = () => this.releaseAllLive();
    this.boundPointerUp = (e) => this.release(`ptr:${e.pointerId}`);
  }

  attach(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundBlur);
    window.addEventListener('pointercancel', this.boundPointerCancel);
    window.addEventListener('pointerup', this.boundPointerUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);
    window.removeEventListener('pointercancel', this.boundPointerCancel);
    window.removeEventListener('pointerup', this.boundPointerUp);
  }

  async enableAudio(): Promise<void> {
    const ok = await this.engine.enable();
    this.enabled = ok;
  }

  setWave(w: WaveShape): void {
    this.wave = w;
    this.engine.setWave(w);
  }

  setVolume(v: number): void {
    this.volume = v;
    this.engine.setVolume(v);
  }

  setAdsr(patch: Partial<AdsrParams>): void {
    this.adsr = { ...this.adsr, ...patch };
    this.engine.adsr = { ...this.adsr };
  }

  setBpm(v: number): void {
    const bpm = this.transport.clampBpm(v);
    this.transport.setBpm(bpm);
    this.bpm = this.transport.bpm;
    this.pendingBpm = this.transport.pendingBpm;
  }

  play(): void {
    if (!this.enabled) return;
    this.transport.start();
    this.playing = true;
    this.syncState();
  }

  record(): void { this.arm('record'); }
  overdub(): void { this.arm('overdub'); }

  private arm(mode: 'record' | 'overdub'): void {
    if (!this.enabled) return;
    if (!this.playing) {
      this.transport.start();
      this.playing = true;
    }
    this.recorder.arm(mode);
    this.syncState();
  }

  stop(): void {
    this.transport.stop();
    this.playing = false;
    this.releaseAllLive();
    this.playhead = 0;
    this.syncState();
    this.notesVersion++;
  }

  clear(): void {
    this.transport.clear();
    this.playing = false;
    this.releaseAllLive();
    this.playhead = 0;
    this.syncState();
    this.notesVersion++;
  }

  get notes(): LoopNote[] {
    return this.recorder.notes;
  }

  pointerPress(midi: number, pointerId: number): void {
    if (!this.enabled) return;
    this.press(`ptr:${pointerId}`, midi);
  }

  pointerRelease(pointerId: number): void {
    this.release(`ptr:${pointerId}`);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (isEditableTarget(e.target)) return;
    const midi = computerKeyToMidi(e.key);
    if (midi === null) return;
    e.preventDefault();
    if (this.keyDown.has(e.code)) return; // 忽略自动重复/抖动
    this.keyDown.add(e.code);
    this.press(`key:${e.code}`, midi);
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (isEditableTarget(e.target)) return;
    this.keyDown.delete(e.code);
    this.release(`key:${e.code}`);
  }

  private press(source: string, midi: number): void {
    if (this.live.has(source)) return;
    const voiceKey = `live:${source}:${midi}`;
    this.engine.noteOn(voiceKey, midi);
    this.live.set(source, { midi, voiceKey });
    if (this.recorder.isRecording) {
      this.recorder.press(midi, this.transport.currentAbsBeat());
    }
    const next = new Set(this.activeLive);
    next.add(midi);
    this.activeLive = next;
  }

  private release(source: string): void {
    const src = this.live.get(source);
    if (!src) return;
    this.live.delete(source);
    this.engine.noteOff(src.voiceKey);
    if (this.recorder.isRecording) {
      this.recorder.release(src.midi, this.transport.currentAbsBeat());
      this.notesVersion++;
    }
    if (![...this.live.values()].some((s) => s.midi === src.midi)) {
      const next = new Set(this.activeLive);
      next.delete(src.midi);
      this.activeLive = next;
    }
  }

  /** 失焦 / 指针取消 / 停止：释放全部现场按住的音，避免卡音 */
  releaseAllLive(): void {
    for (const [, src] of this.live) {
      this.engine.noteOff(src.voiceKey);
      if (this.recorder.isRecording) {
        this.recorder.release(src.midi, this.transport.currentAbsBeat());
      }
    }
    this.live.clear();
    this.keyDown.clear();
    this.activeLive = new Set();
    if (this.recorder.isRecording) this.notesVersion++;
  }

  private syncState(): void {
    this.recordState = this.recorder.state;
    this.armedMode = this.recorder.armedMode;
    this.bpm = this.transport.bpm;
    this.pendingBpm = this.transport.pendingBpm;
    this.playing = this.transport.state === 'playing';
  }
}
