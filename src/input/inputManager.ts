import { midiFromKey } from '../audio/notes';

export const LIVE_SOURCE = 'live';
export const MOUSE_SOURCE = 'mouse';

export interface InputHandlers {
  noteOn: (source: string, midi: number) => void;
  noteOff: (source: string, midi: number) => void;
}

interface PointerRecord {
  element: HTMLElement;
  midi: number;
}

// Normalizes computer keyboard and pointer input into polyphonic note events.
// - ignores OS key auto-repeat (event.repeat)
// - ignores typing inside editable elements
// - window blur / pointer cancel releases everything so notes never stick
export class InputManager {
  private keysDown = new Set<number>();
  private pointers = new Map<number, PointerRecord>();
  private detached = false;

  constructor(private target: HTMLElement | Window, private handlers: InputHandlers) {}

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    const el = this.target instanceof Window ? null : this.target;
    if (el) {
      el.addEventListener('pointerdown', this.onPointerDown);
      el.addEventListener('pointerup', this.onPointerUp);
      el.addEventListener('pointercancel', this.onPointerCancel);
    }
  }

  detach(): void {
    this.detached = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.releaseAll();
  }

  private isEditable(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.detached || event.repeat || this.isEditable(event)) return;
    const midi = midiFromKey(event.key);
    if (midi === undefined) return;
    if (this.keysDown.has(midi)) return;
    event.preventDefault();
    this.keysDown.add(midi);
    this.handlers.noteOn(LIVE_SOURCE, midi);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (this.detached || this.isEditable(event)) return;
    const midi = midiFromKey(event.key);
    if (midi === undefined || !this.keysDown.has(midi)) return;
    event.preventDefault();
    this.keysDown.delete(midi);
    this.handlers.noteOff(LIVE_SOURCE, midi);
  };

  private onBlur = (): void => this.releaseAllKeyboard();
  private onVisibility = (): void => {
    if (document.hidden) this.releaseAll();
  };

  private onPointerDown = (event: PointerEvent): void => {
    const keyEl = (event.target as HTMLElement).closest<HTMLElement>('[data-midi]');
    if (!keyEl || this.pointers.has(event.pointerId)) return;
    const midi = Number(keyEl.dataset.midi);
    event.preventDefault();
    keyEl.setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { element: keyEl, midi });
    this.handlers.noteOn(MOUSE_SOURCE, midi);
  };

  private onPointerUp = (event: PointerEvent): void => {
    const record = this.pointers.get(event.pointerId);
    if (!record) return;
    this.pointers.delete(event.pointerId);
    this.handlers.noteOff(MOUSE_SOURCE, record.midi);
  };

  private onPointerCancel = (event: PointerEvent): void => {
    const record = this.pointers.get(event.pointerId);
    if (!record) return;
    this.pointers.delete(event.pointerId);
    this.handlers.noteOff(MOUSE_SOURCE, record.midi);
  };

  releaseAllKeyboard(): void {
    for (const midi of this.keysDown) this.handlers.noteOff(LIVE_SOURCE, midi);
    this.keysDown.clear();
  }

  releaseAllMouse(): void {
    for (const record of this.pointers.values()) {
      this.handlers.noteOff(MOUSE_SOURCE, record.midi);
    }
    this.pointers.clear();
  }

  releaseAll(): void {
    this.releaseAllKeyboard();
    this.releaseAllMouse();
  }
}
