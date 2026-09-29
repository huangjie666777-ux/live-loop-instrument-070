<script lang="ts">
  import type { AdsrParams, WaveShape } from '../audio/synth';

  interface Props {
    enabled: boolean;
    wave: WaveShape;
    volume: number;
    adsr: AdsrParams;
    bpm: number;
    pendingBpm: number | null;
    playing: boolean;
    recordState: 'idle' | 'armed' | 'recording';
    armedMode: 'record' | 'overdub' | null;
    onenable: () => void;
    onwave: (w: WaveShape) => void;
    onvolume: (v: number) => void;
    onadsr: (p: Partial<AdsrParams>) => void;
    onbpm: (v: number) => void;
    onplay: () => void;
    onrecord: () => void;
    onoverdub: () => void;
    onstop: () => void;
    onclear: () => void;
  }

  let {
    enabled, wave, volume, adsr, bpm, pendingBpm, playing, recordState, armedMode,
    onenable, onwave, onvolume, onadsr, onbpm, onplay, onrecord, onoverdub, onstop, onclear,
  }: Props = $props();

  const waves: WaveShape[] = ['sine', 'square', 'sawtooth'];
  const waveLabel: Record<WaveShape, string> = {
    sine: '正弦', square: '方波', sawtooth: '锯齿',
  };
  const status = $derived(
    recordState === 'recording' ? '● 录制中'
      : recordState === 'armed' && armedMode === 'record' ? '● 等待录制（下一圈）'
      : recordState === 'armed' && armedMode === 'overdub' ? '● 等待叠录（下一圈）'
      : playing ? '播放中' : '已停止',
  );
</script>

<section class="panel">
  <div class="row top">
    <button class="enable" class:on={enabled} onclick={onenable}>
      {enabled ? '音频已启用' : '点击启用音频'}
    </button>
    <div class="status" class:rec={recordState !== 'idle'}>{status}</div>
  </div>

  <div class="row">
    <fieldset class="group" disabled={!enabled}>
      <legend>波形</legend>
      <div class="seg">
        {#each waves as w (w)}
          <button class:sel={wave === w} onclick={() => onwave(w)}>{waveLabel[w]}</button>
        {/each}
      </div>
    </fieldset>

    <fieldset class="group" disabled={!enabled}>
      <legend>总音量 {Math.round(volume * 100)}%</legend>
      <input type="range" min="0" max="1" step="0.01" value={volume}
             oninput={(e) => onvolume(Number(e.currentTarget.value))} />
    </fieldset>

    <fieldset class="group" disabled={!enabled}>
      <legend>速度 BPM</legend>
      <input class="bpm" type="number" min="40" max="200" value={bpm}
             onchange={(e) => onbpm(Number(e.currentTarget.value))} />
      <input type="range" min="40" max="200" step="1" value={pendingBpm ?? bpm}
             oninput={(e) => onbpm(Number(e.currentTarget.value))} />
      {#if pendingBpm !== null && pendingBpm !== bpm}
        <span class="pending">待生效 {pendingBpm}（下一圈）</span>
      {/if}
    </fieldset>
  </div>

  <div class="row">
    <fieldset class="group adsr" disabled={!enabled}>
      <legend>包络 ADSR</legend>
      <label>起音 <b>{adsr.attack.toFixed(2)}s</b>
        <input type="range" min="0" max="2" step="0.01" value={adsr.attack}
               oninput={(e) => onadsr({ attack: Number(e.currentTarget.value) })} />
      </label>
      <label>衰减 <b>{adsr.decay.toFixed(2)}s</b>
        <input type="range" min="0" max="2" step="0.01" value={adsr.decay}
               oninput={(e) => onadsr({ decay: Number(e.currentTarget.value) })} />
      </label>
      <label>保持 <b>{Math.round(adsr.sustain * 100)}%</b>
        <input type="range" min="0" max="1" step="0.01" value={adsr.sustain}
               oninput={(e) => onadsr({ sustain: Number(e.currentTarget.value) })} />
      </label>
      <label>释音 <b>{adsr.release.toFixed(2)}s</b>
        <input type="range" min="0.01" max="3" step="0.01" value={adsr.release}
               oninput={(e) => onadsr({ release: Number(e.currentTarget.value) })} />
      </label>
    </fieldset>
  </div>

  <div class="row transport">
    <button onclick={onplay} disabled={!enabled} class:sel={playing && recordState === 'idle'}>▶ 播放</button>
    <button onclick={onrecord} disabled={!enabled} class:rec-on={recordState !== 'idle' && armedMode === 'record'}>● 录制</button>
    <button onclick={onoverdub} disabled={!enabled} class:rec-on={armedMode === 'overdub'}>◐ 叠录</button>
    <button onclick={onstop}>■ 停止</button>
    <button onclick={onclear} class="danger">✕ 清空</button>
  </div>
</section>

<style>
  .panel { display: flex; flex-direction: column; gap: 10px; }
  .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .top { justify-content: space-between; }
  .enable {
    padding: 10px 22px; font-size: 15px; font-weight: 700; border-radius: 8px;
    background: #2c3142; color: #e8ecff; border: 1px solid #4a5168; cursor: pointer;
  }
  .enable.on { background: #1f7a4d; border-color: #2ea86a; }
  .status { font-weight: 600; color: #9aa3c0; }
  .status.rec { color: #ff6b6b; }
  .group { border: 1px solid #3a405a; border-radius: 8px; padding: 8px 12px; display: flex; gap: 10px; align-items: center; }
  .group:disabled { opacity: 0.55; }
  legend { font-size: 12px; color: #9aa3c0; padding: 0 4px; }
  .seg { display: flex; gap: 4px; }
  button { cursor: pointer; }
  .seg button, .transport button {
    padding: 8px 14px; border-radius: 6px; background: #2c3142; color: #dfe4ff;
    border: 1px solid #444b66;
  }
  .seg button.sel, .transport button.sel { background: #3456a0; border-color: #5a82dd; }
  .transport button.rec-on { background: #a03030; border-color: #e05050; }
  .transport button.danger { border-color: #8a4040; color: #ffb0b0; }
  .pending { color: #ffc66b; font-size: 12px; }
  .bpm { width: 70px; background: #22252f; color: #e8ecff; border: 1px solid #444b66; border-radius: 4px; padding: 4px 6px; }
  .adsr label { display: flex; flex-direction: column; font-size: 12px; color: #9aa3c0; gap: 4px; }
</style>
