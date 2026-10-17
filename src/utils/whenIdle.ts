const requestIdle =
  window.requestIdleCallback ?? ((callback) => setTimeout(callback, 1));

export function whenIdle(callback: () => unknown): () => void {
  let disposed = false;
  let cleanup: unknown;

  const run = () =>
    requestIdle(
      async () => {
        if (disposed) return;
        cleanup = await callback();
        if (disposed && typeof cleanup === "function") cleanup();
      },
      { timeout: 2000 },
    );

  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });

  return () => {
    disposed = true;
    if (typeof cleanup === "function") cleanup();
  };
}
