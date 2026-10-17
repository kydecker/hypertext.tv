/** Pixels per wheel "line" when the wheel reports lines instead of pixels */
const WHEEL_LINE_HEIGHT = 16;
/** Lifting a finger after holding still this long (ms) doesn't fling */
const FLING_HOLD_TIMEOUT = 100;
/** Fling velocity kept per 16ms frame */
const FLING_FRICTION = 0.95;
/** Fling stops below this velocity (px/ms) */
const FLING_MIN_VELOCITY = 0.02;
/** Drags further than this (px) don't count as a tap */
const TAP_MAX_DISTANCE = 10;

/**
 * Loops `content` vertically inside `container` using a CSS transform
 * animation (see the `marquee` keyframes in styles/index.css), so scrolling
 * runs on the compositor with no per-frame JavaScript.
 *
 * The content is cloned once so the animation can loop seamlessly by
 * translating both copies up by exactly one copy's height.
 *
 * Manual scrolling (wheel, trackpad and touch) seeks the animation rather than
 * scrolling the container, so it wraps around the loop for free.
 */
export function marquee(container: HTMLElement, content: HTMLElement) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => {};
  }

  content.setAttribute("data-marquee-item", "");
  const cloned = content.cloneNode(true) as HTMLElement;
  cloned.setAttribute("aria-hidden", "true");
  // Keep the clone clickable (it's on screen half the time) but out of the
  // tab order so keyboard and screen reader users only see one copy
  for (const el of cloned.querySelectorAll("a[href], [tabindex]")) {
    el.setAttribute("tabindex", "-1");
  }
  content.insertAdjacentElement("afterend", cloned);
  container.setAttribute("data-marquee", "");

  // The loop distance (and therefore the duration) is the content's height
  let distance = 0;
  let animations: Animation[] | null = null;
  const resizeObserver = new ResizeObserver(([entry]) => {
    distance = entry.borderBoxSize[0].blockSize;
    container.style.setProperty("--marquee-distance", `${distance}`);
    animations = null;
  });
  resizeObserver.observe(content);

  // Moves both copies to the time returned by `getTime`, wrapping either way
  const seek = (getTime: (time: number, duration: number) => number) => {
    animations ??= [...content.getAnimations(), ...cloned.getAnimations()];
    const [first] = animations;
    const duration = first?.effect?.getComputedTiming().duration;
    const time = first?.currentTime;
    if (typeof duration !== "number" || typeof time !== "number" || !distance) {
      return;
    }

    const next = getTime(time, duration) % duration;
    for (const animation of animations) {
      animation.currentTime = (next + duration) % duration;
    }
  };
  const seekTo = (offset: number) =>
    seek((_, duration) => (offset / distance) * duration);
  const seekBy = (delta: number) =>
    seek((time, duration) => time + (delta / distance) * duration);
  const setPaused = (paused: boolean) => {
    for (const animation of animations ?? []) {
      if (paused) animation.pause();
      else animation.play();
    }
  };

  const listeners = new AbortController();
  const { signal } = listeners;

  // When a row receives keyboard focus, move the loop so that it's in view
  container.addEventListener(
    "focusin",
    (e) => {
      const focused = e.target as HTMLElement;
      if (!content.contains(focused) || !focused.matches(":focus-visible")) {
        return;
      }

      // Both copies are translated equally, so this is the untransformed offset
      seekTo(
        focused.getBoundingClientRect().top -
          content.getBoundingClientRect().top,
      );
    },
    { signal },
  );

  container.addEventListener(
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
    { passive: true, signal },
  );

  // Touch drags hold the loop under the finger, then fling with momentum
  let drag: { id: number; y: number; time: number } | null = null;
  let velocity = 0;
  let dragged = 0;
  let flingFrame = 0;

  container.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType !== "touch" || drag) return;
      cancelAnimationFrame(flingFrame);
      seekBy(0); // Make sure the animations are cached before pausing them
      setPaused(true);
      drag = { id: e.pointerId, y: e.clientY, time: e.timeStamp };
      velocity = 0;
      dragged = 0;
    },
    { signal },
  );

  container.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerId !== drag?.id) return;
      const delta = drag.y - e.clientY;
      const elapsed = e.timeStamp - drag.time;
      seekBy(delta);
      dragged += Math.abs(delta);
      if (elapsed > 0) velocity = delta / elapsed;
      drag = { ...drag, y: e.clientY, time: e.timeStamp };
    },
    { signal },
  );

  const handlePointerUp = (e: PointerEvent) => {
    if (e.pointerId !== drag?.id) return;
    if (e.timeStamp - drag.time > FLING_HOLD_TIMEOUT) velocity = 0;
    drag = null;

    let last = performance.now();
    const fling = (now: number) => {
      const elapsed = now - last;
      last = now;
      velocity *= FLING_FRICTION ** (elapsed / 16);
      seekBy(velocity * elapsed);

      if (Math.abs(velocity) > FLING_MIN_VELOCITY) {
        flingFrame = requestAnimationFrame(fling);
      } else {
        setPaused(false);
      }
    };
    flingFrame = requestAnimationFrame(fling);
  };
  container.addEventListener("pointerup", handlePointerUp, { signal });
  container.addEventListener("pointercancel", handlePointerUp, { signal });

  // A drag ends with a click on whatever is under the finger, so swallow it
  container.addEventListener(
    "click",
    (e) => {
      if (dragged > TAP_MAX_DISTANCE) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true, signal },
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
