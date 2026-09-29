<script lang="ts">
  import { buildKeyboard } from '../audio/notes';
  import type { InstrumentStore } from '../state/instrumentStore.svelte';

  const { store }: { store: InstrumentStore } = $props();
  const notes = buildKeyboard();
  const whiteNotes = notes.filter((n) => !n.black);
  const keyLabel = (k: string | null) => (k === ',' ? ',' : k ?? '');
</script>

<div class="keyboard" role="group" aria-label="C4 至 B5 键盘">
  {#snippet blackKey(midi: number)}
    {@const note = notes.find((n) => n.midi === midi)!}
    <button
      class="black"
      data-midi={midi}
      class:active={store.liveHeld.has(midi) || store.mouseHeld.has(midi)}
      aria-label={note.name}
    >
      <span class="keycap">{keyLabel(note.key)}</span>
    </button>
  {/snippet}

  <div class="white-row">
    {#each whiteNotes as note (note.midi)}
      <div class="white-wrap">
        <button
          class="white"
          data-midi={note.midi}
          class:active={store.liveHeld.has(note.midi) || store.mouseHeld.has(note.midi)}
        >
          <span class="keycap">{keyLabel(note.key)}</span>
          <span class="name">{note.name}</span>
        </button>
        {#if note.midi % 12 !== 4 && note.midi % 12 !== 11}
          {@const sharpMidi = note.midi + 1}
          <div class="black-slot">{@render blackKey(sharpMidi)}</div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .keyboard {
    overflow-x: auto;
    padding: 0 0.5rem;
  }
  .white-row {
    display: flex;
    position: relative;
    min-width: 760px;
    user-select: none;
    touch-action: none;
  }
  .white-wrap {
    position: relative;
    flex: 1;
  }
  button {
    cursor: pointer;
    font-family: inherit;
  }
  .white {
    width: 100%;
    height: 180px;
    background: #fdfdfd;
    border: 1px solid #888;
    border-radius: 0 0 6px 6px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0 8px;
    color: #444;
  }
  .white.active {
    background: #ffd25e;
  }
  .black-slot {
    position: absolute;
    top: 0;
    right: -0.7rem;
    width: 0;
    height: 0;
    z-index: 2;
  }
  .black {
    position: absolute;
    top: 0;
    left: -0.7rem;
    width: 1.4rem;
    height: 110px;
    background: #222;
    color: #ddd;
    border: 1px solid #000;
    border-radius: 0 0 4px 4px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 6px;
  }
  .black.active {
    background: #c87f1a;
  }
  .keycap {
    font-size: 0.72rem;
    font-weight: 600;
    border-radius: 3px;
  }
  .name {
    font-size: 0.68rem;
  }
</style>
