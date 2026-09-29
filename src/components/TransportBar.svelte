<script lang="ts">
  import { MIN_BPM, MAX_BPM } from '../loop/transport';
  import type { InstrumentStore } from '../state/instrumentStore.svelte';

  const { store }: { store: InstrumentStore } = $props();

  const modeLabel = $derived.by(() => {
    switch (store.mode) {
      case 'playing': return '播放中';
      case 'recording': return '● 录音中';
      case 'overdubbing': return '● 叠录中';
      default: return '已停止';
    }
  });
</script>

<section class="transport">
  <div class="buttons">
    <button onclick={() => store.play()}>▶ 播放</button>
    <button class="rec" onclick={() => store.record()}>● 录制</button>
    <button class="rec" onclick={() => store.overdub()}>◐ 叠录</button>
    <button onclick={() => store.stop()}>■ 停止</button>
    <button onclick={() => store.clear()}>⌫ 清空</button>
  </div>
  <label class="tempo">
    速度
    <input
      type="number"
      min={MIN_BPM}
      max={MAX_BPM}
      value={store.bpm}
      onchange={(e) => store.setBpm(Number(e.currentTarget.value))}
    />
    BPM
  </label>
  <div class="status">
    <strong>{modeLabel}</strong>
    {#if store.pendingBpm !== null && store.pendingBpm !== store.bpm}
      <span class="pending">下一圈起：{store.pendingBpm} BPM</span>
    {/if}
    {#if store.waitingText}
      <span class="waiting">{store.waitingText}</span>
    {/if}
  </div>
</section>

<style>
  .transport {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem 1.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #ddd;
  }
  .buttons {
    display: flex;
    gap: 0.5rem;
  }
  button {
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    border: 1px solid #888;
    background: #f4f4f4;
    cursor: pointer;
  }
  button.rec {
    border-color: #c0392b;
  }
  .tempo {
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .tempo input {
    width: 4.5rem;
    padding: 0.2rem 0.4rem;
  }
  .status {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    gap: 0.15rem;
  }
  .waiting {
    color: #b45309;
  }
  .pending {
    color: #1d4ed8;
  }
</style>
