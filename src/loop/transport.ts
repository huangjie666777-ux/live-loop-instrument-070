// Fixed 2 bars of 4/4 = 8 beats per loop. Audio-clock scheduling with look-ahead.

export const BEATS_PER_BAR = 4;
export const BARS = 2;
export const LOOP_BEATS = BEATS_PER_BAR * BARS;
export const MIN_BPM = 40;
export const MAX_BPM = 200;
export const LOOK_AHEAD = 0.12;
export const TIMER_MS = 25;

export interface LoopNote {
  id: number;
  midi: number;
  start: number; // beats inside the loop, 0 <= start < LOOP_BEATS
  duration: number; // beats; can exceed LOOP_BEATS for notes held across the boundary
}

export type Mode = 'idle' | 'playing' | 'recording' | 'overdubbing';
export type ArmState = 'off' | 'play' | 'record' | 'overdub';

export interface ScheduledNoteEvent {
  kind: 'on' | 'off';
  source: string;
  midi: number;
  time: number;
}

export interface TransportCallbacks {
  now(): number;
  noteOn(source: string, midi: number, when: number): void;
  noteOff(source: string, midi: number, when: number): void;
  cancelSourcePrefix(prefix: string): void;
  onStateChange?: () => void;
  setIntervalFn?: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearIntervalFn?: (id: ReturnType<typeof setInterval>) => void;
}

interface ActiveRecordedNote {
  noteId: number;
  midi: number;
  startBeat: number;
  startCycle: number;
}

interface Breakpoint {
  onset: number;
  cycle: number;
  bpm: number;
}

export class LoopTransport {
  notes: LoopNote[] = [];
  mode: Mode = 'idle';
  armed: ArmState = 'off';
  bpm = 120;
  pendingBpm: number | null = null;
  playhead = 0;
  readonly sourcePrefix = 'loop';

  private nextId = 1;
  private breakpoints: Breakpoint[] = [];
  private scheduledUpToContinuousBeat = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = new Map<number, ActiveRecordedNote>();
  private takeNotes: LoopNote[] = [];
  private pendingNotes: LoopNote[] | null = null;
  private pendingBoundary = Infinity;
  private startOnset = 0;
  private readonly setIntervalFn: NonNullable<TransportCallbacks['setIntervalFn']>;
  private readonly clearIntervalFn: NonNullable<TransportCallbacks['clearIntervalFn']>;

  constructor(private cb: TransportCallbacks) {
    this.setIntervalFn = cb.setIntervalFn ?? ((fn, ms) => setInterval(fn, ms));
    this.clearIntervalFn = cb.clearIntervalFn ?? ((id) => clearInterval(id));
  }

  get waiting(): boolean {
    return this.armed !== 'off';
  }

  get isRunning(): boolean {
    return this.breakpoints.length > 0;
  }

  setBpm(value: number): void {
    const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)));
    if (this.isRunning) {
      this.pendingBpm = clamped;
    } else {
      this.bpm = clamped;
      this.pendingBpm = null;
    }
    this.emit();
  }

  private emit(): void {
    this.cb.onStateChange?.();
  }

  play(): void {
    if (this.isRunning) return;
    this.begin('playing', 'play');
  }

  record(): void {
    if (this.isRunning) {
      if (this.mode === 'recording') return;
      this.switchRecordMode('recording');
      return;
    }
    this.begin('recording', 'record');
  }

  overdub(): void {
    if (this.isRunning) {
      if (this.mode === 'overdubbing') return;
      this.switchRecordMode('overdubbing');
      return;
    }
    this.begin('overdubbing', 'overdub');
  }

  private switchRecordMode(mode: Mode): void {
    // Mid-loop mode change waits for the next cycle boundary.
    this.queueTakeSwap(mode === 'overdubbing' ? [...this.notes] : [], this.currentCycle() + 1);
    this.mode = mode;
    this.armed = 'off';
    this.emit();
  }

  private queueTakeSwap(notes: LoopNote[], boundaryCycle: number): void {
    this.pendingNotes = notes;
    this.pendingBoundary = boundaryCycle;
    this.takeNotes = notes;
  }

  private begin(mode: Mode, armed: ArmState): void {
    // Start from the next loop boundary: cycle 0 begins now, and the UI shows
    // the armed/waiting state until the scheduler kicks in.
    this.mode = mode;
    this.armed = armed;
    this.playhead = 0;
    this.pendingBpm = null;
    this.startOnset = this.cb.now();
    this.breakpoints = [{ onset: this.startOnset, cycle: 0, bpm: this.bpm }];
    this.scheduledUpToContinuousBeat = 0;
    this.takeNotes = mode === 'overdubbing' ? [...this.notes] : [];
    this.pendingNotes = null;
    this.pendingBoundary = Infinity;
    this.active.clear();
    this.timer = this.setIntervalFn(() => this.tick(), TIMER_MS);
    this.tick();
  }

  stop(): void {
    if (this.isRunning) {
      const now = this.cb.now();
      for (const note of this.active.values()) {
        const duration = this.beatTimeOf(now) - note.startCycle * LOOP_BEATS - note.startBeat;
        if (duration > 0) {
          this.takeNotes.push({ id: note.noteId, midi: note.midi, start: note.startBeat, duration });
        }
      }
      this.notes = [...this.takeNotes];
    }
    this.active.clear();
    if (this.timer) this.clearIntervalFn(this.timer);
    this.timer = null;
    this.breakpoints = [];
    this.armed = 'off';
    this.pendingBpm = null;
    this.pendingNotes = null;
    this.pendingBoundary = Infinity;
    this.takeNotes = [];
    this.mode = 'idle';
    this.playhead = 0;
    this.cb.cancelSourcePrefix(this.sourcePrefix);
    this.emit();
  }

  clear(): void {
    const wasRunning = this.isRunning;
    this.stop();
    this.notes = [];
    if (!wasRunning) this.emit();
  }

  private spb(bpm: number): number {
    return 60 / bpm;
  }

  beatTimeOf(time: number): number {
    if (this.breakpoints.length === 0) return 0;
    let bp = this.breakpoints[0];
    for (const candidate of this.breakpoints) {
      if (time >= candidate.onset) bp = candidate;
    }
    return bp.cycle * LOOP_BEATS + (time - bp.onset) / this.spb(bp.bpm);
  }

  private timeOfContinuousBeat(continuousBeat: number): number {
    let bp = this.breakpoints[0];
    for (const candidate of this.breakpoints) {
      if (continuousBeat >= candidate.cycle * LOOP_BEATS) bp = candidate;
    }
    return bp.onset + (continuousBeat - bp.cycle * LOOP_BEATS) * this.spb(bp.bpm);
  }

  private currentCycle(now = this.cb.now()): number {
    return Math.max(0, Math.floor(this.beatTimeOf(now) / LOOP_BEATS));
  }

  tick(now: number = this.cb.now()): void {
    if (this.breakpoints.length === 0) return;

    // Apply pending take swap at its cycle boundary.
    if (this.pendingNotes !== null) {
      const swapTime = this.timeOfContinuousBeat(this.pendingBoundary * LOOP_BEATS);
      if (now >= swapTime) {
        this.notes = this.pendingNotes;
        this.pendingNotes = null;
        this.pendingBoundary = Infinity;
      }
    }

    // Apply a pending tempo at the earliest upcoming boundary inside horizon.
    if (this.pendingBpm !== null) {
      const cycle = this.currentCycle(now);
      const boundaryCycle = cycle + 1;
      const boundaryTime = this.timeOfContinuousBeat(boundaryCycle * LOOP_BEATS);
      const withinHorizon = boundaryTime <= now + LOOK_AHEAD + 0.001;
      if (withinHorizon || boundaryTime > now + LOOK_AHEAD + 0.001) {
        const bpm = this.pendingBpm;
        if (!withinHorizon) {
          // Large time jump beyond the next boundary: land the tempo at the
          // start of the cycle containing "now".
          this.breakpoints.push({ onset: this.timeOfContinuousBeat(cycle * LOOP_BEATS), cycle, bpm });
        } else {
          this.breakpoints.push({ onset: boundaryTime, cycle: boundaryCycle, bpm });
        }
        this.bpm = bpm;
        this.pendingBpm = null;
      }
    }

    const events: ScheduledNoteEvent[] = [];
    const horizonBeat = this.beatTimeOf(now + LOOK_AHEAD);
    const fromBeat = this.scheduledUpToContinuousBeat;
    const fromCycle = Math.floor(fromBeat / LOOP_BEATS);
    const toCycle = Math.floor(horizonBeat / LOOP_BEATS) + 1;
    for (const note of this.notes) {
      for (let cycle = fromCycle; cycle <= toCycle; cycle++) {
        const onBeat = cycle * LOOP_BEATS + note.start;
        const offBeat = onBeat + note.duration;
        for (const [beat, kind] of [[onBeat, 'on'], [offBeat, 'off']] as const) {
          if (beat < fromBeat - 1e-6 || beat > horizonBeat + 1e-6) continue;
          const time = this.timeOfContinuousBeat(beat);
          if (time > now + LOOK_AHEAD + 1e-6) continue;
          events.push({ kind, source: `${this.sourcePrefix}:c${cycle}:n${note.id}`, midi: note.midi, time });
        }
      }
    }
    events.sort((a, b) => a.time - b.time);
    for (const event of events) {
      if (this.armed !== 'off') {
        this.armed = 'off';
        this.emit();
      }
      if (event.kind === 'on') this.cb.noteOn(event.source, event.midi, event.time);
      else this.cb.noteOff(event.source, event.midi, event.time);
    }
    this.scheduledUpToContinuousBeat = Math.max(fromBeat, horizonBeat);

    const continuous = this.beatTimeOf(now);
    this.playhead = ((continuous % LOOP_BEATS) + LOOP_BEATS) % LOOP_BEATS;
    this.emit();
  }

  noteOn(midi: number, when = this.cb.now()): void {
    if (this.mode !== 'recording' && this.mode !== 'overdubbing') return;
    if (this.active.has(midi)) return;
    const continuous = this.beatTimeOf(when);
    const cycle = Math.floor(continuous / LOOP_BEATS);
    const startBeat = continuous - cycle * LOOP_BEATS;
    this.active.set(midi, { noteId: this.nextId++, midi, startBeat, startCycle: cycle });
  }

  noteOff(midi: number, when = this.cb.now()): void {
    const note = this.active.get(midi);
    if (!note) return;
    const duration = this.beatTimeOf(when) - note.startCycle * LOOP_BEATS - note.startBeat;
    if (duration > 0) {
      this.takeNotes.push({ id: note.noteId, midi, start: note.startBeat, duration });
      this.queueCommit();
    }
    this.active.delete(midi);
  }

  // Finished notes appear from the next corresponding position, never cutting
  // the currently monitoring voice: swap at the following cycle boundary.
  private queueCommit(): void {
    if (this.pendingBoundary !== Infinity) {
      this.pendingNotes = [...this.takeNotes];
    } else {
      const boundaryCycle = this.currentCycle() + 1;
      this.pendingNotes = [...this.takeNotes];
      this.pendingBoundary = boundaryCycle;
    }
  }

  releaseAllLive(): void {
    const now = this.cb.now();
    for (const midi of [...this.active.keys()]) this.noteOff(midi, now);
  }
}
