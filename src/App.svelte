<script lang="ts">
  import { onMount } from 'svelte';
  import { InstrumentStore } from './state/instrumentStore.svelte';
  import { InputManager } from './input/inputManager';
  import Keyboard from './components/Keyboard.svelte';
  import SynthControls from './components/SynthControls.svelte';
  import TransportBar from './components/TransportBar.svelte';
  import LoopRoll from './components/LoopRoll.svelte';

  const store = new InstrumentStore();
  let keyboardEl: HTMLElement;
  let input: InputManager;

  onMount(() => {
    input = new InputManager(keyboardEl, store.handlers);
    input.attach();
    return () => {
      input.detach();
      store.releaseAllLive();
    };
  });
</script>

<main>
  <header>
    <h1>Live Loop Instrument</h1>
    <p class="hint">乐手演奏与循环叠录网页合成器 · C4–B5 · 十二平均律（A4 = 440Hz）</p>
  </header>

  {#if !store.enabled}
    <div class="enable-banner">
      <button class="enable" onclick={() => store.enable()}>点击启用音频</button>
      <span>浏览器要求用户点击后才能发声</span>
    </div>
  {/if}

  <SynthControls {store} />
  <TransportBar {store} />
  <div bind:this={keyboardEl} class="keyboard-host">
    <Keyboard {store} />
  </div>
  <LoopRoll {store} />

  <footer>
    <p>
      键位：下行 Z X C V B N M（白键 C4–B4）与 S D G H J（黑键），
      上行 Q W E R T Y U（白键 C5–B5）与 2 3 5 6 7（黑键）。
      支持鼠标与电脑键盘复音；失焦或取消指针会自动松开全部现场音符。
    </p>
  </footer>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    color: #222;
    background: #f7f7f5;
  }
  main {
    max-width: 1080px;
    margin: 0 auto;
    background: #fff;
    min-height: 100vh;
    box-shadow: 0 0 24px rgba(0, 0, 0, 0.06);
  }
  header {
    padding: 1rem 1rem 0.5rem;
  }
  h1 {
    margin: 0;
    font-size: 1.3rem;
  }
  .hint {
    margin: 0.25rem 0 0;
    font-size: 0.82rem;
    color: #666;
  }
  .enable-banner {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.75rem 1rem;
    background: #fff7e6;
    border-bottom: 1px solid #f0d8a8;
    font-size: 0.85rem;
  }
  .enable {
    padding: 0.45rem 1rem;
    border-radius: 6px;
    border: 1px solid #b45309;
    background: #f59e0b;
    color: #1f1f1f;
    font-weight: 600;
    cursor: pointer;
  }
  .keyboard-host {
    padding: 1rem 0;
    background: #f0eeea;
  }
  footer {
    padding: 0.5rem 1rem 1.25rem;
    font-size: 0.78rem;
    color: #777;
  }
</style>
