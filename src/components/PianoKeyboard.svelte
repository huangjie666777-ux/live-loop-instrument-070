<script lang="ts">
  import { KEYBOARD } from '../audio/notes';

  interface Props {
    active: Set<number>;
    disabled?: boolean;
    onpress: (midi: number, pointerId: number) => void;
    onrelease: (pointerId: number) => void;
  }

  let { active, disabled = false, onpress, onrelease }: Props = $props();

  const whiteKeys = KEYBOARD.filter((k) => !k.black);
  const blackKeys = KEYBOARD.filter((k) => k.black);

  // 黑键相对白键索引定位
  const whiteIndex = new Map<number, number>();
  whiteKeys.forEach((k, i) => whiteIndex.set(k.midi, i));

  function blackLeft(midi: number): number {
    // 黑键位于前一个白键与下一个白键之间：取左侧白键索引 + 0.65
    const leftWhite = whiteIndex.get(midi - 1);
    return (leftWhite ?? 0) + 1 - 0.32;
  }

  function handleDown(e: PointerEvent, midi: number) {
    if (disabled) return;
    e.preventDefault();
    onpress(midi, e.pointerId);
  }
  function handleUp(e: PointerEvent) {
    if (disabled) return;
    onrelease(e.pointerId);
  }
</script>

<div class="keyboard" class:disabled>
  <div class="white-row">
    {#each whiteKeys as key (key.midi)}
      <button
        type="button"
        class="key white"
        class:on={active.has(key.midi)}
        onpointerdown={(e) => handleDown(e, key.midi)}
        onpointerup={handleUp}
        onpointercancel={handleUp}
      >
        <span class="name">{key.name}</span>
        {#if key.computerKey}<span class="ckey">{key.computerKey}</span>{/if}
      </button>
    {/each}
  </div>
  <div class="black-row">
    {#each blackKeys as key (key.midi)}
      <button
        type="button"
        class="key black"
        class:on={active.has(key.midi)}
        style="left: calc({((blackLeft(key.midi) / whiteKeys.length) * 100).toFixed(3)}% )"
        onpointerdown={(e) => handleDown(e, key.midi)}
        onpointerup={handleUp}
        onpointercancel={handleUp}
      >
        <span class="name">{key.name}</span>
        {#if key.computerKey}<span class="ckey">{key.computerKey}</span>{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .keyboard {
    position: relative;
    height: 170px;
    border-radius: 8px;
    overflow: hidden;
    user-select: none;
    touch-action: none;
  }
  .keyboard.disabled { opacity: 0.55; pointer-events: none; }
  .white-row { display: flex; height: 100%; }
  .key {
    font: inherit;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    padding-bottom: 8px;
  }
  .white {
    flex: 1;
    background: #f7f5f0;
    border: 1px solid #b8b2a4;
    border-top: none;
    border-radius: 0 0 6px 6px;
    color: #555;
  }
  .white.on { background: #8fc7ff; }
  .black-row { position: absolute; inset: 0; pointer-events: none; }
  .black {
    position: absolute;
    top: 0;
    width: calc(100% / 14 * 0.62);
    height: 62%;
    background: #222;
    color: #ddd;
    border: 1px solid #000;
    border-radius: 0 0 5px 5px;
    pointer-events: auto;
    z-index: 2;
    font-size: 11px;
  }
  .black.on { background: #1f6fc4; }
  .name { font-size: 11px; font-weight: 600; }
  .white .name { font-size: 12px; }
  .ckey {
    font-size: 10px;
    opacity: 0.7;
    border: 1px solid currentColor;
    border-radius: 4px;
    padding: 0 4px;
  }
</style>
