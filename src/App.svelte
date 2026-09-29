<script lang="ts">
  import { onMount } from 'svelte';
  import { InstrumentController } from './state/controller.svelte';
  import PianoKeyboard from './components/PianoKeyboard.svelte';
  import Controls from './components/Controls.svelte';
  import LoopDisplay from './components/LoopDisplay.svelte';

  const c = new InstrumentController();

  onMount(() => {
    c.attach();
    return () => c.detach();
  });
</script>

<main>
  <h1>Live Loop Instrument <small>网页循环叠录合成器</small></h1>

  <Controls
    enabled={c.enabled}
    wave={c.wave}
    volume={c.volume}
    adsr={c.adsr}
    bpm={c.bpm}
    pendingBpm={c.pendingBpm}
    playing={c.playing}
    recordState={c.recordState}
    armedMode={c.armedMode}
    onenable={() => c.enableAudio()}
    onwave={(w) => c.setWave(w)}
    onvolume={(v) => c.setVolume(v)}
    onadsr={(p) => c.setAdsr(p)}
    onbpm={(v) => c.setBpm(v)}
    onplay={() => c.play()}
    onrecord={() => c.record()}
    onoverdub={() => c.overdub()}
    onstop={() => c.stop()}
    onclear={() => c.clear()}
  />

  <section class="loop-section">
    <div class="loop-head">
      <h2>循环窗</h2>
      <span class="sig">4/4 · 两小节 · 共 8 拍</span>
    </div>
    <LoopDisplay notes={c.notes} version={c.notesVersion} playhead={c.playhead} />
  </section>

  <section class="kb-section">
    <PianoKeyboard
      active={c.activeLive}
      disabled={!c.enabled}
      onpress={(midi, id) => c.pointerPress(midi, id)}
      onrelease={(id) => c.pointerRelease(id)}
    />
    <p class="hint">
      电脑键位：<b>Z S X D C V G B H N J M , L . ; /</b> 对应 C4–B4；
      <b>Q 2 W 3 E R 5</b> 对应 C5–B5。支持鼠标/触摸与键盘复音。
      每个来源独立释音：现场演奏与回放同音互不截断。
    </p>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #14161e;
    color: #e8ecff;
    font-family: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', sans-serif;
  }
  main { max-width: 1060px; margin: 0 auto; padding: 20px 24px 40px; display: flex; flex-direction: column; gap: 22px; }
  h1 { font-size: 22px; margin: 0; }
  h1 small { font-size: 13px; font-weight: 400; color: #9aa3c0; margin-left: 8px; }
  h2 { font-size: 15px; margin: 0; }
  .loop-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; }
  .sig { color: #9aa3c0; font-size: 12px; }
  .hint { color: #8a90a6; font-size: 12px; line-height: 1.7; }
</style>
