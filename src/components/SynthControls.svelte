<script lang="ts">
  import type { InstrumentStore } from '../state/instrumentStore.svelte';
  import type { Waveform } from '../audio/synthEngine';

  const { store }: { store: InstrumentStore } = $props();
  const waveforms: Waveform[] = ['sine', 'square', 'sawtooth'];
  const labels: Record<Waveform, string> = { sine: '正弦', square: '方波', sawtooth: '锯齿' };
</script>

<section class="controls">
  <fieldset>
    <legend>波形</legend>
    {#each waveforms as w}
      <label>
        <input
          type="radio"
          name="waveform"
          value={w}
          checked={store.waveform === w}
          onchange={() => store.setWaveform(w)}
        />
        {labels[w]}
      </label>
    {/each}
  </fieldset>

  <label>
    起音 A
    <input type="range" min="0.005" max="2" step="0.005" value={store.attack}
      oninput={(e) => store.setAttack(Number(e.currentTarget.value))} />
    <span>{store.attack.toFixed(2)}s</span>
  </label>
  <label>
    衰减 D
    <input type="range" min="0" max="2" step="0.01" value={store.decay}
      oninput={(e) => store.setDecay(Number(e.currentTarget.value))} />
    <span>{store.decay.toFixed(2)}s</span>
  </label>
  <label>
    保持 S
    <input type="range" min="0" max="1" step="0.01" value={store.sustain}
      oninput={(e) => store.setSustain(Number(e.currentTarget.value))} />
    <span>{Math.round(store.sustain * 100)}%</span>
  </label>
  <label>
    释音 R
    <input type="range" min="0.01" max="3" step="0.01" value={store.release}
      oninput={(e) => store.setRelease(Number(e.currentTarget.value))} />
    <span>{store.release.toFixed(2)}s</span>
  </label>
  <label class="volume">
    总音量
    <input type="range" min="0" max="1" step="0.01" value={store.volume}
      oninput={(e) => store.setVolume(Number(e.currentTarget.value))} />
    <span>{Math.round(store.volume * 100)}%</span>
  </label>
</section>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #ddd;
  }
  fieldset {
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 0.25rem 0.6rem;
  }
  label {
    display: inline-flex;
    flex-direction: column;
    font-size: 0.8rem;
    gap: 0.2rem;
  }
</style>
