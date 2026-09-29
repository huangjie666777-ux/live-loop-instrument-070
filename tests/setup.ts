// Node 测试环境下的最小动画帧 polyfill（合成器与调度器仅在浏览器使用）
let rafId = 0;
(globalThis as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame =
  ((cb: FrameRequestCallback): number => {
    void cb;
    rafId += 1;
    return rafId;
  }) as typeof requestAnimationFrame;
(globalThis as { cancelAnimationFrame?: typeof cancelAnimationFrame }).cancelAnimationFrame =
  (() => {}) as typeof cancelAnimationFrame;
