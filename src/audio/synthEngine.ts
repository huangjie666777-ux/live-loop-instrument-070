import { frequencyOf } from './notes';
import { envelopeLevelAt, type EnvelopeParams } from './envelope';
import { VoicePool } from './voicePool';

export type Waveform = 'sine' | 'square' | 'sawtooth';

interface SynthVoice {
  source: string;
  midi: number;
  pressedAt: number;
  released: boolean;
  osc: OscillatorNode;
  gain: GainNode;
  cleanupAt: number;
  timer: ReturnType<typeof setTimeout> | null;
}

export class SynthEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private pool = new VoicePool<SynthVoice>(8);
  private timers = new Set<ReturnType<typeof setTimeout>>();

  envelope: EnvelopeParams = { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 };
  waveform: Waveform = 'sine';
  volume = 0.8;
  enabled = false;

  async enable(): Promise<void> {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.enabled = true;
  }

  get currentTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setVolume(value: number): void {
    this.volume = value;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
    }
  }

  setWaveform(waveform: Waveform): void {
    this.waveform = waveform;
  }

  setEnvelope(params: Partial<EnvelopeParams>): void {
    this.envelope = { ...this.envelope, ...params };
  }

  // Schedules a note; when omitted the note sounds immediately.
  noteOn(source: string, midi: number, when?: number): SynthVoice | null {
    if (!this.ctx || !this.master) return null;
    const startAt = when ?? this.ctx.currentTime;
    const { voice: existing, existing: isExisting, stolen } = this.pool.allocate(source, midi, startAt, () => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = this.waveform;
      osc.frequency.value = frequencyOf(midi);
      gain.gain.setValueAtTime(0, startAt);
      gain.connect(this.master!);
      osc.connect(gain);
      osc.start(startAt);
      return {
        source,
        midi,
        pressedAt: startAt,
        released: false,
        osc,
        gain,
        cleanupAt: Infinity,
        timer: null,
      };
    });
    if (isExisting) return existing;
    if (stolen) this.killVoice(stolen, startAt);
    this.applyAttack(existing, startAt);
    return existing;
  }

  private applyAttack(voice: SynthVoice, at: number): void {
    const { attack, decay, sustain } = this.envelope;
    const g = voice.gain.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(0, at);
    g.linearRampToValueAtTime(1, at + Math.max(attack, 0.0001));
    g.linearRampToValueAtTime(Math.max(sustain, 0.0001), at + attack + Math.max(decay, 0.0001));
  }

  // Begins release from the envelope's current level for every voice owned by
  // source+midi. Voices from other sources keep holding the same pitch.
  noteOff(source: string, midi: number, when?: number): void {
    if (!this.ctx) return;
    const at = when ?? this.ctx.currentTime;
    for (const voice of this.pool.release(source, midi)) {
      this.startRelease(voice, at);
    }
  }

  private startRelease(voice: SynthVoice, at: number): void {
    if (!this.ctx) return;
    const level = envelopeLevelAt(at - voice.pressedAt, null, this.envelope);
    const endAt = at + this.envelope.release;
    const g = voice.gain.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(level, at);
    g.linearRampToValueAtTime(0.0001, endAt);
    voice.cleanupAt = endAt;
    this.scheduleCleanup(voice, endAt + 0.05);
  }

  private scheduleCleanup(voice: SynthVoice, at: number): void {
    if (!this.ctx) return;
    const delayMs = Math.max(0, (at - this.ctx.currentTime) * 1000);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      try {
        voice.osc.stop();
      } catch {
        // already stopped
      }
      voice.osc.disconnect();
      voice.gain.disconnect();
      this.pool.remove(voice);
    }, delayMs);
    this.timers.add(timer);
    voice.timer = timer;
  }

  private killVoice(voice: SynthVoice, at: number): void {
    if (!this.ctx) return;
    if (voice.timer) {
      clearTimeout(voice.timer);
      this.timers.delete(voice.timer);
    }
    const stopAt = Math.max(at, this.ctx.currentTime + 0.001);
    const g = voice.gain.gain;
    g.cancelScheduledValues(Math.min(at, this.ctx.currentTime));
    g.setValueAtTime(0, stopAt);
    try {
      voice.osc.stop(stopAt);
    } catch {
      // already stopped
    }
    voice.osc.onended = () => {
      voice.osc.disconnect();
      voice.gain.disconnect();
    };
  }

  // Immediately silences and removes all voices belonging to a source,
  // cancelling both future starts and in-flight releases.
  silenceSource(source: string, when?: number): void {
    this.silenceBy((s) => s === source, when);
  }

  silenceSourcePrefix(prefix: string, when?: number): void {
    this.silenceBy((s) => s.startsWith(prefix), when);
  }

  private silenceBy(predicate: (source: string) => boolean, when?: number): void {
    if (!this.ctx) return;
    const at = when ?? this.ctx.currentTime;
    for (const voice of [...this.pool.voices]) {
      if (!predicate(voice.source)) continue;
      if (voice.timer) {
        clearTimeout(voice.timer);
        this.timers.delete(voice.timer);
      }
      const g = voice.gain.gain;
      g.cancelScheduledValues(at);
      if (at <= this.ctx.currentTime + 0.001) {
        g.setValueAtTime(0, this.ctx.currentTime);
      } else {
        g.setValueAtTime(0, at);
      }
      try {
        voice.osc.stop(Math.max(at, this.ctx.currentTime + 0.001));
      } catch {
        // already stopped
      }
      voice.osc.disconnect();
      voice.gain.disconnect();
      this.pool.remove(voice);
    }
  }

  dispose(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.pool.clear();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.enabled = false;
  }
}
