import { describe, expect, it, beforeEach } from 'vitest';
import { LoopTransport, LOOP_BEATS } from '../src/loop/transport';

interface Evt { kind: 'on' | 'off'; source: string; midi: number; time: number }

function harness(initialNotes: Parameters<LoopTransport['constructor']>[0] extends never ? never : ReturnType<typeof makeNote>[] = []) {
  let now = 100;
  const events: Evt[] = [];
  const cancelled: string[] = [];
  const timers = new Map<ReturnType<typeof setInterval>, () => void>();
  const transport = new LoopTransport({
    now: () => now,
    noteOn: (source, midi, time) => events.push({ kind: 'on', source, midi, time }),
    noteOff: (source, midi, time) => events.push({ kind: 'off', source, midi, time }),
    cancelSourcePrefix: (prefix) => cancelled.push(prefix),
    setIntervalFn: (fn) => {
      const id = Symbol('timer') as unknown as ReturnType<typeof setInterval>;
      timers.set(id, fn);
      return id;
    },
    clearIntervalFn: (id) => timers.delete(id),
  });
 transport.notes = [...initialNotes];
  return {
    transport,
    setTime(t: number) {
      now = t;
      transport.tick(now);
    },
    advance(seconds: number) {
      now += seconds;
      transport.tick(now);
    },
    get now() {
      return now;
    },
    events,
    cancelled,
  };
}

function makeNote(id: number, midi: number, start: number, duration: number) {
  return { id, midi, start, duration };
}

describe('LoopTransport scheduling', () => {
  it('schedules notes from the audio clock and advances the playhead', () => {
    const h = harness([makeNote(1, 60, 0, 1), makeNote(2, 62, 2, 0.5)]);
    h.transport.bpm = 60; // 1 beat = 1 second
    h.transport.play();
    const start = h.now;
    expect(h.transport.armed).toBe('off');
    expect(h.events.find((e) => e.kind === 'on' && e.midi === 60)!.time).toBe(start);

    h.advance(2.2);
    const on62 = h.events.find((e) => e.kind === 'on' && e.midi === 62);
    const off60 = h.events.find((e) => e.kind === 'off' && e.midi === 60);
    expect(on62!.time).toBeCloseTo(start + 2, 5);
    expect(off60!.time).toBeCloseTo(start + 1, 5);
    expect(h.transport.playhead).toBeGreaterThan(2);
  });

  it('keeps a held-over-loop note sounding across the boundary without an early off', () => {
    const h = harness([makeNote(1, 60, 6, 4)]); // starts beat 6, lasts 4 beats, wraps past boundary
    h.transport.bpm = 240; // 8 beats = 2 seconds, 1 beat = 0.25s
    h.transport.play();
    const start = h.now;
    h.setTime(start + 2.6); // into the second loop
    const firstOnset = h.events.find((e) => e.kind === 'on' && e.midi === 60)!;
    expect(firstOnset.time).toBeCloseTo(start + 6 * 0.25, 5);
    // No release at the boundary (2s); the only release is 4 beats after onset.
    const offs = h.events.filter((e) => e.kind === 'off' && e.midi === 60);
    expect(offs).toHaveLength(1);
    expect(offs[0].time - firstOnset.time).toBeCloseTo(1, 5);
  });

  it('retriggers the note each loop with independent sources', () => {
    const h = harness([makeNote(1, 60, 0, 0.5)]);
    h.transport.bpm = 240;
    h.transport.play();
    h.setTime(h.now + 4.3);
    const ons = h.events.filter((e) => e.kind === 'on');
    expect(ons.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ons.map((e) => e.source)).size).toBe(ons.length);
  });
});

describe('recording and overdub', () => {
  it('records press position and duration in beats and replaces old notes', () => {
    const h = harness([makeNote(1, 70, 0, 2)]);
    h.transport.bpm = 60;
    h.transport.record();
    const start = h.now;
    h.transport.noteOn(60, start + 1);
    h.setTime(start + 3);
    h.transport.noteOff(60, h.now);
    h.setTime(h.now + 6); // cross the next cycle boundary
    expect(h.transport.notes.find((n) => n.midi === 70)).toBeUndefined();
    const note = h.transport.notes.find((n) => n.midi === 60)!;
    expect(note.start).toBeCloseTo(1, 4);
    expect(note.duration).toBeCloseTo(2, 4);
  });

  it('overdub keeps existing notes and adds new ones', () => {
    const h = harness([makeNote(1, 70, 0, 1)]);
    h.transport.bpm = 60;
    h.transport.overdub();
    const start = h.now;
    h.transport.noteOn(60, start + 0.5);
    h.setTime(start + 1.5);
    h.transport.noteOff(60, h.now);
    h.setTime(h.now + 7.5);
    const midis = h.transport.notes.map((n) => n.midi).sort();
    expect(midis).toEqual([60, 70]);
  });

  it('stop closes held notes, cancels pending loop voices, and restarts from zero', () => {
    const h = harness([makeNote(1, 70, 0, 1)]);
    h.transport.bpm = 60;
    h.transport.record();
    h.transport.noteOn(60, h.now + 1);
    h.advance(2);
    h.transport.stop();
    expect(h.cancelled.at(-1)).toBe('loop');
    expect(h.transport.playhead).toBe(0);
    expect(h.transport.mode).toBe('idle');
    expect(h.transport.notes.some((n) => n.midi === 60)).toBe(true);

    h.transport.play();
    expect(h.transport.playhead).toBe(0);
    h.advance(1);
    const restartOn = h.events.filter((e) => e.kind === 'on' && e.time >= 102 - 0.001);
    expect(restartOn.length).toBeGreaterThan(0);
    expect(restartOn[0].time - 102).toBeCloseTo(1, 5); // recorded note starts on beat 1
  });

  it('clear stops and deletes every note', () => {
    const h = harness([makeNote(1, 70, 0, 1)]);
    h.transport.play();
    h.transport.clear();
    expect(h.transport.notes).toEqual([]);
    expect(h.transport.mode).toBe('idle');
    expect(h.cancelled.at(-1)).toBe('loop');
  });
});

describe('tempo changes', () => {
  it('applies a new BPM only at the next loop boundary without dropping events', () => {
    const h = harness([makeNote(1, 60, 0, 1), makeNote(2, 62, LOOP_BEATS - 0.5, 1)]);
    h.transport.bpm = 120;
    h.transport.play();
    const start = h.now;
    h.transport.setBpm(200);
    expect(h.transport.pendingBpm).toBe(200);
    for (let t = 0.05; t <= 10; t += 0.05) h.setTime(start + t);
    expect(h.transport.bpm).toBe(200);
    const ons = h.events.filter((e) => e.kind === 'on');
    const midis = new Set(ons.map((e) => e.midi));
    expect(midis.has(60)).toBe(true);
    expect(midis.has(62)).toBe(true);
  });
});
