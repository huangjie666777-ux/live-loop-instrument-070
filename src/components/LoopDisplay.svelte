<script lang="ts">
  import { FIRST_MIDI, LAST_MIDI, midiToName, isBlackKey } from '../audio/notes';
  import { BEATS_PER_CYCLE, type LoopNote } from '../loop/recorder';

  interface Props {
    notes: LoopNote[];
    version: number;
    playhead: number;
  }
  let { notes, version, playhead }: Props = $props();

  const total = LAST_MIDI - FIRST_MIDI + 1;
  const rows = $derived(
    Array.from({ length: total }, (_, i) => LAST_MIDI - i).map((midi) => ({
      midi,
      label: midiToName(midi),
      black: isBlackKey(midi),
    })),
  );
  // 触发响应式读取
  const visibleNotes = $derived.by(() => {
    void version;
    return notes.map((n) => ({
      ...n,
      top: ((LAST_MIDI - n.midi) / total) * 100,
      height: 100 / total,
      left: (n.start / BEATS_PER_CYCLE) * 100,
      width: Math.min(100, (n.duration / BEATS_PER_CYCLE) * 100),
    }));
  });
  const beats = Array.from({ length: BEATS_PER_CYCLE + 1 }, (_, i) => i);
</script>

<div class="roll">
  <div class="grid">
    {#each rows as row (row.midi)}
      <div class="row" class:black={row.black} style="top:{((LAST_MIDI - row.midi) / total) * 100}%;height:{100 / total}%">
        <span class="rl">{row.label}</span>
      </div>
    {/each}
    {#each beats as b}
      <div class="bar" class:measure={b === 0 || b === 4 || b === 8} style="left:{(b / BEATS_PER_CYCLE) * 100}%"></div>
    {/each}
    {#each visibleNotes as n (n.midi + '-' + n.start)}
      <div
        class="note"
        style="top:{n.top}%;height:{n.height}%;left:{n.left}%;width:{n.width}%"
        title="{midiToName(n.midi)} @ {n.start.toFixed(2)} 拍，持续 {n.duration.toFixed(2)} 拍"
      ></div>
    {/each}
    <div class="playhead" style="left:{(playhead / BEATS_PER_CYCLE) * 100}%"></div>
  </div>
</div>

<style>
  .roll { border: 1px solid #334; border-radius: 8px; overflow: hidden; background: #1b1d27; }
  .grid { position: relative; height: 320px; margin-left: 46px; }
  .row {
    position: absolute; left: 0; right: 0;
    border-bottom: 1px solid #2a2d3a;
    display: flex; align-items: center;
  }
  .row.black { background: rgba(255,255,255,0.025); }
  .rl {
    position: absolute; left: -42px; font-size: 10px; color: #8a90a6; width: 38px;
    text-align: right;
  }
  .bar {
    position: absolute; top: 0; bottom: 0; width: 1px; background: #343a4d;
  }
  .bar.measure { background: #5a6180; width: 2px; }
  .note {
    position: absolute;
    background: linear-gradient(#67d39a, #36a66b);
    border-radius: 3px;
    min-width: 3px;
    box-shadow: 0 0 4px rgba(54,166,107,0.6);
    z-index: 2;
  }
  .playhead {
    position: absolute; top: 0; bottom: 0; width: 2px; background: #ff5d5d;
    z-index: 3; pointer-events: none;
  }
</style>
