import { SynthEngine, type Waveform } from '../audio/synthEngine';
import { LoopTransport, type LoopNote, type Mode, type ArmState } from '../loop/transport';
import { LIVE_SOURCE, MOUSE_SOURCE } from '../input/inputManager';

// UI-facing store implemented with Svelte 5 runes ($state).
export class InstrumentStore {
  engine = new SynthEngine();
  transport: LoopTransport;

  enabled = $state(false);
  waveform = $state<Waveform>('sine');
  attack = $state(0.01);
  decay = $state(0.2);
  sustain = $state(0.7);
  release = $state(0.3);
  volume = $state(0.8);

  mode = $state<Mode>('idle');
  armed = $state<ArmState>('off');
  bpm = $state(120);
  pendingBpm = $state<number | null>(null);
  playhead = $state(0);
  notes = $state<LoopNote[]>([]);
  liveHeld = $state<Set<number>>(new Set());
  mouseHeld = $state<Set<number>>(new Set());

  constructor() {
    this.transport = new LoopTransport({
      now: () => this.engine.currentTime,
      noteOn: (source, midi, when) => {
        this.engine.noteOn(source, midi, when);
      },
      noteOff: (source, midi, when) => {
        this.engine.noteOff(source, midi, when);
      },
      cancelSourcePrefix: (prefix) => {
        this.engine.silenceSourcePrefix(prefix);
      },
      onStateChange: () => this.sync(),
    });
  }

  private sync(): void {
    const t = this.transport;
    this.mode = t.mode;
    this.armed = t.armed;
    this.bpm = t.bpm;
    this.pendingBpm = t.pendingBpm;
    this.playhead = t.playhead;
    this.notes = [...t.notes];
  }

  async enable(): Promise<void> {
    await this.engine.enable();
    this.enabled = true;
    this.sync();
  }

  setWaveform(w: Waveform): void {
    this.waveform = w;
    this.engine.setWaveform(w);
  }

  setVolume(v: number): void {
    this.volume = v;
    this.engine.setVolume(v);
  }

  setAttack(v: number): void { this.attack = v; this.engine.setEnvelope({ attack: v }); }
  setDecay(v: number): void { this.decay = v; this.engine.setEnvelope({ decay: v }); }
  setSustain(v: number): void { this.sustain = v; this.engine.setEnvelope({ sustain: v }); }
  setRelease(v: number): void { this.release = v; this.engine.setEnvelope({ release: v }); }
  setBpm(v: number): void { this.transport.setBpm(v); }

  play(): void { this.transport.play(); this.sync(); }
  record(): void { this.transport.record(); this.sync(); }
  overdub(): void { this.transport.overdub(); this.sync(); }
  stop(): void { this.transport.stop(); this.sync(); }
  clear(): void { this.transport.clear(); this.sync(); }

  private liveOn(source: string, midi: number): void {
    if (!this.enabled) return;
    if (source === LIVE_SOURCE) {
      this.liveHeld = new Set(this.liveHeld).add(midi);
    } else {
      this.mouseHeld = new Set(this.mouseHeld).add(midi);
    }
    this.engine.noteOn(source, midi);
    this.transport.noteOn(midi);
  }

  private liveOff(source: string, midi: number): void {
    if (source === LIVE_SOURCE) {
      const next = new Set(this.liveHeld);
      next.delete(midi);
      this.liveHeld = next;
    } else {
      const next = new Set(this.mouseHeld);
      next.delete(midi);
      this.mouseHeld = next;
    }
    this.engine.noteOff(source, midi);
    this.transport.noteOff(midi);
  }

  readonly handlers = {
    noteOn: (source: string, midi: number) => this.liveOn(source, midi),
    noteOff: (source: string, midi: number) => this.liveOff(source, midi),
  };

  releaseAllLive(): void {
    this.engine.silenceSource(LIVE_SOURCE);
    this.engine.silenceSource(MOUSE_SOURCE);
    this.transport.releaseAllLive();
    this.liveHeld = new Set();
    this.mouseHeld = new Set();
  }

  get waitingText(): string {
    if (this.armed === 'record') return '等待下一圈起点开始录音…';
    if (this.armed === 'overdub') return '等待下一圈起点开始叠录…';
    if (this.armed === 'play') return '等待下一圈起点播放…';
    return '';
  }
}
