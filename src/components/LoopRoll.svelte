<script lang="ts">
  import { LOOP_BEATS, BEATS_PER_BAR } from '../loop/transport';
  import { noteName, LOWEST_MIDI, HIGHEST_MIDI } from '../audio/notes';
  import type { InstrumentStore } from '../state/instrumentStore.svelte';

  const { store }: { store: InstrumentStore } = $props();

  const rows = Array.from({ length: HIGHEST_MIDI - LOWEST_MIDI + 1 }, (_, i) => HIGHEST_MIDI - i);
  const beats = Array.from({ length: LOOP_BEATS }, (_, i) => i);

  // Notes longer than one loop are wrapped visually across the roll.
  const segments = $derived.by(() => {
    const out: { id: number; midi: number; start: number; duration: number }[] = [];
    for (const note of store.notes) {
      let start = note.start;
      let duration = note.duration;
      while (duration > 0) {
        const remaining = LOOP_BEATS - start;
        const piece = Math.min(duration, remaining);
        out.push({ id: note.id, midi: note.midi, start, duration: piece });
        duration -= piece;
        start = 0;
      }
    }
    return out;
  });

  const leftPct = (beat: number) => (beat / LOOP_BEATS) * 100;
  const widthPct = (beats: number) => (beats / LOOP_BEATS) * 100;
</script>

<section class="roll-wrap">
  <div class="time-signature">4/4 · 2 小节 · {LOOP_BEATS} 拍</div>
  <div class="ruler">
    {#each beats as beat (beat)}
      <div class="beat" class:barline={beat % BEATS_PER_BAR === 0}>
        {beat + 1}
      </div>
    {/each}
  </div>
  <div class="roll">
    <div class="labels">
      {#each rows as midi (midi)}
        <div class="row-label" style="height:14px">{noteName(midi)}</div>
      {/each}
    </div>
    <div class="grid-area" style={"height:" + 14 * rows.length + "px"}>
      {#each rows as midi (midi)}
        <div class="row"></div>
      {/each}
      {#each beats as beat (beat)}
        <div class="grid-beat" class:barline={beat % BEATS_PER_BAR === 0}
          style="left:{leftPct(beat)}%; width:{100 / LOOP_BEATS}%"></div>
      {/each}
      {#each segments as seg, i (seg.id + ':' + i)}
        {#key seg.id + ':' + i}
        <div
          class="note-block"
          style="left:{leftPct(seg.start)}%; width:{widthPct(seg.duration)}%;
                 top:{((HIGHEST_MIDI - seg.midi) / rows.length) * 100}%;
                 height:{100 / rows.length}%"
        ></div>
        {/key}
      {/each}
      <div class="playhead" style="left:{leftPct(store.playhead)}%"></div>
    </div>
  </div>
</section>

<style>
  .roll-wrap {
    padding: 0.75rem 1rem 1.25rem;
  }
  .time-signature {
    font-size: 0.85rem;
    margin-bottom: 0.4rem;
    color: #555;
  }
  .ruler {
    display: flex;
    margin-left: 3rem;
    font-size: 0.7rem;
    color: #666;
  }
  .beat {
    flex: 1;
    border-left: 1px dashed #ddd;
    padding-left: 0.2rem;
  }
  .beat.barline {
    border-left: 2px solid #888;
    font-weight: 700;
  }
  .roll {
    display: flex;
    margin-top: 0.15rem;
  }
  .labels {
    width: 3rem;
    flex-shrink: 0;
  }
  .row-label {
    height: 14px;
    font-size: 0.62rem;
    color: #555;
    line-height: 14px;
  }
  .grid-area {
    position: relative;
    flex: 1;
    background: #fafafa;
    border: 1px solid #bbb;
  }
  .row {
    height: 14px;
    border-bottom: 1px solid #eee;
  }
  .grid-beat {
    position: absolute;
    top: 0;
    bottom: 0;
    border-left: 1px dashed #e3e3e3;
  }
  .grid-beat.barline {
    border-left: 2px solid #bbb;
  }
  .note-block {
    position: absolute;
    background: #3b82f6;
    border: 1px solid #1d4ed8;
    border-radius: 2px;
    box-sizing: border-box;
  }
  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #dc2626;
    pointer-events: none;
  }
</style>
