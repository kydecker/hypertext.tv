const WHEEL_LINE_HEIGHT = 16;
const FLING_HOLD_MS = 100;
const FLING_FRICTION_PER_FRAME = 0.95;
const FLING_MIN_VELOCITY = 0.02; // px/ms
const TAP_MAX_DISTANCE = 10;

/**
 * Loops `content` and a clone of it with a CSS transform animation. Manual
 * scrolling seeks the animation instead of scrolling the container.
 */
export function marquee(container: HTMLElement, content: HTMLElement) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => {};
  }

  content.setAttribute("data-marquee-item", "");
  const cloned = content.cloneNode(true) as HTMLElement;
  cloned.setAttribute("aria-hidden", "true");
  // Clickable but unfocusable, so assistive tech only sees one copy
  for (const el of cloned.querySelectorAll("a[href], [tabindex]")) {
    el.setAttribute("tabindex", "-1");
  }
  content.insertAdjacentElement("afterend", cloned);
  container.setAttribute("data-marquee", "");

  let distance = 0;
  let animations: Animation[] | null = null;
  const getAnimations = () =>
    (animations ??= [...content.getAnimations(), ...cloned.getAnimations()]);

  const resizeObserver = new ResizeObserver(([entry]) => {
    distance = entry.borderBoxSize[0].blockSize;
    container.style.setProperty("--marquee-distance", `${distance}`);
    animations = null;
  });
  resizeObserver.observe(content);

  // Moves both copies `offset` pixels into the loop, wrapping either way
  const seekTo = (offset: number) => {
    const duration = Number(
      getAnimations()[0]?.effect?.getComputedTiming().duration,
    );
    if (!duration || !distance) return;
    const progress = (((offset / distance) % 1) + 1) % 1;
    for (const animation of getAnimations()) {
      animation.currentTime = progress * duration;
    }
  };
  const seekBy = (delta: number) => {
    const { progress } = getAnimations()[0]?.effect?.getComputedTiming() ?? {};
    seekTo((progress ?? 0) * distance + delta);
  };

  const listeners = new AbortController();
  const on = <K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (e: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ) =>
    container.addEventListener(type, listener, {
      ...options,
      signal: listeners.signal,
    });

  // Bring keyboard-focused rows into view
  on("focusin", (e) => {
    const focused = e.target as HTMLElement;
    if (!content.contains(focused) || !focused.matches(":focus-visible")) {
      return;
    }
    // Both copies share a transform, so this is the untransformed offset
    seekTo(
      focused.getBoundingClientRect().top - content.getBoundingClientRect().top,
    );
  });

  on(
    "wheel",
    (e) => {
      // Leave pinch-zoom and horizontal scrolling to the browser
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const scale =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? WHEEL_LINE_HEIGHT
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? container.clientHeight
            : 1;
      seekBy(e.deltaY * scale);
    },
    { passive: true },
  );

  let drag: { id: number; y: number; time: number } | null = null;
  let velocity = 0;
  let dragged = 0;
  let flingFrame = 0;

  on("pointerdown", (e) => {
    if (e.pointerType !== "touch" || drag) return;
    cancelAnimationFrame(flingFrame);
    for (const animation of getAnimations()) animation.pause();
    drag = { id: e.pointerId, y: e.clientY, time: e.timeStamp };
    velocity = dragged = 0;
  });

  on("pointermove", (e) => {
    if (e.pointerId !== drag?.id) return;
    const delta = drag.y - e.clientY;
    const elapsed = e.timeStamp - drag.time;
    seekBy(delta);
    dragged += Math.abs(delta);
    if (elapsed > 0) velocity = delta / elapsed;
    Object.assign(drag, { y: e.clientY, time: e.timeStamp });
  });

  const release = (e: PointerEvent) => {
    if (e.pointerId !== drag?.id) return;
    if (e.timeStamp - drag.time > FLING_HOLD_MS) velocity = 0;
    drag = null;

    let last = performance.now();
    const fling = (now: number) => {
      velocity *= FLING_FRICTION_PER_FRAME ** ((now - last) / 16);
      seekBy(velocity * (now - last));
      last = now;
      if (Math.abs(velocity) > FLING_MIN_VELOCITY) {
        flingFrame = requestAnimationFrame(fling);
      } else {
        for (const animation of getAnimations()) animation.play();
      }
    };
    flingFrame = requestAnimationFrame(fling);
  };
  on("pointerup", release);
  on("pointercancel", release);

  // Swallow the click that ends a drag
  on(
    "click",
    (e) => {
      if (dragged <= TAP_MAX_DISTANCE) return;
      e.preventDefault();
      e.stopPropagation();
    },
    { capture: true },
  );

  return () => {
    listeners.abort();
    resizeObserver.disconnect();
    cancelAnimationFrame(flingFrame);
    container.removeAttribute("data-marquee");
    container.style.removeProperty("--marquee-distance");
    content.removeAttribute("data-marquee-item");
    cloned.remove();
  };
}
