// Polyphonic voice allocator, independent of Web Audio so it is unit testable.

export interface VoiceLike {
  source: string;
  midi: number;
  pressedAt: number;
  released: boolean;
}

export class VoicePool<T extends VoiceLike> {
  readonly voices: T[] = [];

  constructor(readonly capacity: number) {}

  activeCount(): number {
    return this.voices.length;
  }

  // Returns an existing held voice for the same source+midi (ignored retrigger),
  // otherwise allocates: a free released voice first, then the oldest pressed.
  allocate(source: string, midi: number, now: number, factory: () => T): { voice: T; stolen: T | null; existing: boolean } {
    const existing = this.voices.find((v) => v.source === source && v.midi === midi && !v.released);
    if (existing) return { voice: existing, stolen: null, existing: true };

    const releasedIndex = this.voices.findIndex((v) => v.released);
    if (releasedIndex >= 0) {
      const stolen = this.voices[releasedIndex];
      const voice = factory();
      this.voices[releasedIndex] = voice;
      return { voice, stolen, existing: false };
    }

    if (this.voices.length < this.capacity) {
      const voice = factory();
      this.voices.push(voice);
      return { voice, stolen: null, existing: false };
    }

    let oldestIndex = 0;
    for (let i = 1; i < this.voices.length; i++) {
      if (this.voices[i].pressedAt < this.voices[oldestIndex].pressedAt) oldestIndex = i;
    }
    const stolen = this.voices[oldestIndex];
    const voice = factory();
    this.voices[oldestIndex] = voice;
    return { voice, stolen, existing: false };
  }

  // Releases voices matching source+midi. Other sources holding the same pitch
  // keep sounding, so a replay never cuts a live performer's note.
  release(source: string, midi: number): T[] {
    const out: T[] = [];
    for (const voice of this.voices) {
      if (!voice.released && voice.source === source && voice.midi === midi) {
        voice.released = true;
        out.push(voice);
      }
    }
    return out;
  }

  releaseAll(source?: string): T[] {
    const out: T[] = [];
    for (const voice of this.voices) {
      if (!voice.released && (source === undefined || voice.source === source)) {
        voice.released = true;
        out.push(voice);
      }
    }
    return out;
  }

  remove(voice: T): void {
    const index = this.voices.indexOf(voice);
    if (index >= 0) this.voices.splice(index, 1);
  }

  clear(): void {
    this.voices.length = 0;
  }
}
