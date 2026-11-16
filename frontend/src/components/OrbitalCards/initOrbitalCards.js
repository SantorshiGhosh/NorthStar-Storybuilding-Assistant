const FRONT_ANGLE = 80;
const STAGGER = 0.2;
const START_SCALE = 0.25;
const CATCH_UP = 0.15;
const LERP = 0.12;
const TRIGGER = 0.25;
const DEPTH = 0.6;
const FOCUS_BOOST = 0.1;
const EXIT_SCALE = 0.85;
const EXIT_STAGGER = 0.4;
// Below this component width the ring grows past the viewport: two seats show, above and below the headline.
const NARROW = 560;
const NARROW_X = 0.94;
const NARROW_Y = 0.54;
const NARROW_FRONT = 90;
const RAD = Math.PI / 180;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (a, b, t) => a + (b - a) * t;
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => 1 + 2.25 * Math.pow(t - 1, 3) + 1.25 * Math.pow(t - 1, 2);
const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function initOrbitalCards(root, options) {
  const reducedMotion = root.ownerDocument.defaultView.matchMedia("(prefers-reduced-motion: reduce)");
  let cleanup = () => {};
  // Reduced motion can change while the page is open: undo the current mode and set up the other.
  const remount = () => {
    cleanup();
    cleanup = () => {};
    cleanup = mountMode(root, options, reducedMotion.matches);
  };
  reducedMotion.addEventListener("change", remount);
  try {
    remount();
  } catch (error) {
    reducedMotion.removeEventListener("change", remount);
    throw error;
  }
  return () => {
    reducedMotion.removeEventListener("change", remount);
    cleanup();
  };
}

function mountMode(root, { radiusX: radiusXcqw = 39, radiusY: radiusYcqw = 17, steps, entry, exitStart, scatter, farBlur, farFade }, reduced) {
  const host = root.ownerDocument.defaultView;
  const stage = root.querySelector(".velox-orbital-cards__stage");
  const center = root.querySelector(".velox-orbital-cards__center");
  const cards = [...root.querySelectorAll(".velox-orbital-cards__card")];
  const count = cards.length;
  const step = 360 / count;
  // The ring's rotation when the exit begins: each card's place in the departure order is fixed up front.
  const rotAtExit = -steps * step;
  const abort = new AbortController();
  const { signal } = abort;
  const observers = [];
  let raf = 0;
  const dispose = () => {
    abort.abort();
    observers.forEach(observer => observer.disconnect());
    host.cancelAnimationFrame(raf);
    raf = 0;
    for (const card of cards) card.removeAttribute("style");
    center.removeAttribute("style");
  };

  let radiusX = 0;
  let radiusY = 0;
  let cardHalfHeight = 0;
  let depthRange = DEPTH;
  let focusBoost = FOCUS_BOOST;
  let frontAngle = FRONT_ANGLE;

  // The breakpoint follows the component's width; the ring is laid out against the stage.
  const measure = () => {
    const width = root.clientWidth || 1;
    const ring = stage.clientWidth || width;
    const stageH = stage.clientHeight || host.innerHeight || 800;
    const narrow = width < NARROW;

    // Every card is offset by the first card's half height, keeping true center alignment
    cardHalfHeight = (cards[0]?.offsetHeight ?? 0) / 2 || 85;

    // Radius X maintains clear clearance around the center headline container
    radiusX = ring * (narrow ? NARROW_X : (radiusXcqw || 44) / 100);

    // Radius Y is bounded dynamically by the stage height and card scale to guarantee cards never clip top/bottom
    const maxSafeY = (stageH / 2) - (cardHalfHeight * 1.35) - 20;
    const targetY = Math.min(ring * ((radiusYcqw || 16) / 100), stageH * 0.28);
    radiusY = narrow ? ring * NARROW_Y : Math.max(75, Math.min(targetY, maxSafeY));

    depthRange = narrow ? 0 : DEPTH;
    focusBoost = narrow ? 0 : FOCUS_BOOST;
    frontAngle = narrow ? NARROW_FRONT : FRONT_ANGLE;
  };

  let target = 0;
  let current = 0;
  let intro = 0;
  let onScreen = false;
  let introActive = false;
  let fullyOut = true;
  let last = 0;
  const readScroll = () => {
    const rect = root.getBoundingClientRect();
    const viewport = host.innerHeight || 1;
    introActive = rect.top <= viewport * TRIGGER && rect.bottom > 0;
    fullyOut = rect.bottom <= 0 || rect.top >= viewport;
    const travel = root.offsetHeight - viewport;
    target = travel <= 0 ? 0 : clamp(-rect.top / travel, 0, 1);
  };

  // p: smoothed scroll progress; it: intro progress; seat (reduced motion only): a whole seat, no exit.
  const paint = (p, it, seat) => {
    const seats = seat ?? (p / exitStart) * steps;
    const ringRot = -seats * step;
    const exit = seat === undefined ? clamp((p - exitStart) / (1 - exitStart), 0, 1) : 0;
    for (let i = 0; i < count; i++) {
      const t = clamp((it - (i / (count - 1)) * STAGGER) / (1 - STAGGER), 0, 1);
      const spread = easeOutBack(t);
      const appear = easeOutCubic(clamp(t * 1.7, 0, 1));
      const angle = (frontAngle + i * step + ringRot) * RAD;
      // Exit order follows the ring: the front card leaves first and the ones behind it peel off in turn.
      const order = ((((i * step + rotAtExit) % 360) + 360) % 360) / step;
      const et = clamp((exit - (order / (count - 1)) * EXIT_STAGGER) / (1 - EXIT_STAGGER), 0, 1);
      const exitT = et * et * et;
      const exitMul = 1 + (scatter - 1) * exitT;
      const x = Math.cos(angle) * radiusX * spread * exitMul;
      const y = Math.sin(angle) * radiusY * spread * exitMul;
      const depth = (Math.sin(angle) + 1) / 2;
      const focus = Math.pow(depth, 8);
      const ringScale = (1 - depthRange / 2) + depthRange * depth + focusBoost * focus;
      const scale = mix(START_SCALE, ringScale, clamp(spread, 0, 1)) * mix(1, EXIT_SCALE, exitT);
      const blur = farBlur * (1 - depth) * (1 - focus) * appear;
      const opacity = appear * (1 - farFade * (1 - depth) * (1 - focus)) * (1 - exitT);
      const card = cards[i];
      card.style.transform = `translate3d(${x.toFixed(2)}px, ${(y - cardHalfHeight).toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
      card.style.opacity = opacity.toFixed(3);
      card.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
      card.style.zIndex = String(Math.round(depth * 100));
    }
    const headIn = easeInOutCubic(clamp(it * 1.2, 0, 1));
    const headOut = easeInOutCubic(exit);
    center.style.transform = `translate(-50%, -50%) scale(${(mix(0.92, 1, headIn) * mix(1, 0.96, headOut)).toFixed(3)})`;
    center.style.opacity = (mix(0.35, 1, headIn) * (1 - headOut)).toFixed(3);
  };

  const frame = now => {
    raf = 0;
    if (signal.aborted) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    // Fully away resets the intro, so the next arrival plays from nothing.
    if (fullyOut) intro = 0;
    else intro = clamp(intro + (introActive ? 1 : -1) * dt / entry, 0, 1);
    current += (target - current) * LERP;
    if (Math.abs(target - current) < 0.0002) current = target;
    // Scrolling also pushes the intro along, so the orbit never waits for the entry to finish.
    paint(current, Math.max(intro, clamp(current / CATCH_UP, 0, 1)));
    if (onScreen) raf = host.requestAnimationFrame(frame);
  };

  try {
    if (reduced) {
      // The formed ring stands still; scrolling steps it one whole seat at a time, with no exit.
      const still = () => {
        readScroll();
        paint(0, 1, Math.round(target * (count - 1)));
      };
      const resize = () => {
        measure();
        still();
      };
      host.addEventListener("scroll", still, { passive: true, signal });
      host.addEventListener("resize", resize, { signal });
      const resizeObserver = new ResizeObserver(resize);
      observers.push(resizeObserver);
      resizeObserver.observe(root);
      cards.forEach(card => resizeObserver.observe(card));
      resize();
      return dispose;
    }
    const resize = () => {
      measure();
      readScroll();
    };
    host.addEventListener("scroll", readScroll, { passive: true, signal });
    host.addEventListener("resize", resize, { signal });
    const resizeObserver = new ResizeObserver(resize);
    observers.push(resizeObserver);
    resizeObserver.observe(root);
    resizeObserver.observe(stage);
    cards.forEach(card => resizeObserver.observe(card));
    const observer = new IntersectionObserver(([entryRecord]) => {
      onScreen = entryRecord.isIntersecting;
      if (!onScreen || raf || signal.aborted) return;
      readScroll();
      last = performance.now();
      raf = host.requestAnimationFrame(frame);
    });
    observers.push(observer);
    observer.observe(root);
    resize();
    paint(0, 0);
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
