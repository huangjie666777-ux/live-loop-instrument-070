// 十二平均律：A4 = MIDI 69 = 440Hz
export const A4_MIDI = 69;
export const A4_FREQ = 440;

export function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToName(midi: number): string {
  const name = NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return name + octave;
}

export function isBlackKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

// C4(MIDI 60) 至 B5(MIDI 83)，共 24 键
export const FIRST_MIDI = 60;
export const LAST_MIDI = 83;

export interface KeyInfo {
  midi: number;
  name: string;
  black: boolean;
  computerKey: string | null;
}

// 电脑按键映射：下行覆盖 C4-B4，上行覆盖 C5-B5
const KEY_MAP: Record<string, number> = {
  z: 60, s: 61, x: 62, d: 63, c: 64, v: 65, g: 66, b: 67,
  h: 68, n: 69, j: 70, m: 71, ',': 72, l: 73, '.': 74, ';': 75, '/': 76,
  q: 77, '2': 78, w: 79, '3': 80, e: 81, r: 82, '5': 83,
};

export function midiToComputerKey(midi: number): string | null {
  for (const [k, m] of Object.entries(KEY_MAP)) {
    if (m === midi) return k.toUpperCase();
  }
  return null;
}

const KEY_INDEX = new Map<string, number>(
  Object.entries(KEY_MAP).map(([k, v]) => [k, v]),
);

/** 把 KeyboardEvent.key 映射到 MIDI 音高；不认识返回 null */
export function computerKeyToMidi(key: string): number | null {
  if (key.length === 1) {
    const midi = KEY_INDEX.get(key.toLowerCase());
    if (midi !== undefined && midi >= FIRST_MIDI && midi <= LAST_MIDI) return midi;
  }
  return null;
}

export const KEYBOARD: KeyInfo[] = (() => {
  const keys: KeyInfo[] = [];
  for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi++) {
    keys.push({
      midi,
      name: midiToName(midi),
      black: isBlackKey(midi),
      computerKey: midiToComputerKey(midi),
    });
  }
  return keys;
})();

/** 判断事件目标是否为可编辑控件（输入框中不触发演奏） */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
    el.isContentEditable || el.getAttribute('role') === 'textbox';
}

