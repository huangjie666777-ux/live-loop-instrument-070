// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { InputManager, LIVE_SOURCE, MOUSE_SOURCE } from '../src/input/inputManager';

describe('InputManager', () => {
  it('maps keys to notes, ignores auto-repeat and input fields', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const target = document.createElement('div');
    document.body.appendChild(target);
    const input = new InputManager(target, { noteOn, noteOff });
    input.attach();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    expect(noteOn).toHaveBeenCalledWith(LIVE_SOURCE, 60);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', repeat: true, bubbles: true }));
    expect(noteOn).toHaveBeenCalledTimes(1);

    const field = document.createElement('input');
    document.body.appendChild(field);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    expect(noteOn).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z', bubbles: true }));
    expect(noteOff).toHaveBeenCalledWith(LIVE_SOURCE, 60);
    input.detach();
  });

  it('releases all live notes when the window loses focus', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const target = document.createElement('div');
    const input = new InputManager(target, { noteOn, noteOff });
    input.attach();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    window.dispatchEvent(new Event('blur'));
    expect(noteOff).toHaveBeenCalledWith(LIVE_SOURCE, 60);
    expect(noteOff).toHaveBeenCalledWith(LIVE_SOURCE, 62);
    input.detach();
  });

  it('tracks pointer notes and releases on pointer cancel', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const target = document.createElement('div');
    const key = document.createElement('button');
    key.dataset.midi = '64';
    target.appendChild(key);
    document.body.appendChild(target);
    const input = new InputManager(target, { noteOn, noteOff });
    input.attach();

    key.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    expect(noteOn).toHaveBeenCalledWith(MOUSE_SOURCE, 64);
    target.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
    expect(noteOff).toHaveBeenCalledWith(MOUSE_SOURCE, 64);
    input.detach();
  });
});
