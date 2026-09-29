// Equal temperament note utilities. MIDI note 69 = A4 = 440 Hz.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

// Keyboard range C4 (MIDI 60) through B5 (MIDI 83).
export const LOWEST_MIDI = 60;
export const HIGHEST_MIDI = 83;
export const NOTE_COUNT = HIGHEST_MIDI - LOWEST_MIDI + 1;

export interface NoteInfo {
  midi: number;
  name: string;
  octave: number;
  black: boolean;
  key: string | null;
}

export function frequencyOf(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteName(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export function isBlack(midi: number): boolean {
  return NOTE_NAMES[midi % 12].includes('#');
}

// Two-row computer keyboard map covering C4..B5 (24 notes).
const KEY_TO_MIDI: Record<string, number> = {
  // C4 .. B4 white keys
  z: 60, x: 62, c: 64, v: 65, b: 67, n: 69, m: 71,
  // C4 .. B4 black keys
  s: 61, d: 63, g: 66, h: 68, j: 70,
  // C5 .. B5 white keys
  q: 72, w: 74, e: 76, r: 77, t: 79, y: 81, u: 83,
  // C5 .. B5 black keys
  '2': 73, '3': 75, '5': 78, '6': 80, '7': 82,
};

export function midiFromKey(key: string): number | undefined {
  return KEY_TO_MIDI[key.toLowerCase()];
}

function keyForMidi(midi: number): string | null {
  for (const [key, value] of Object.entries(KEY_TO_MIDI)) {
    if (value === midi) return key;
  }
  return null;
}

export function buildKeyboard(): NoteInfo[] {
  const notes: NoteInfo[] = [];
  for (let midi = LOWEST_MIDI; midi <= HIGHEST_MIDI; midi++) {
    const name = NOTE_NAMES[midi % 12];
    notes.push({
      midi,
      name: noteName(midi),
      octave: Math.floor(midi / 12) - 1,
      black: name.includes('#'),
      key: keyForMidi(midi),
    });
  }
  return notes;
}
