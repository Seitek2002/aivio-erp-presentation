import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { SLIDES, OPEN } from './slides.js';
import { DEFAULT_STATE } from './scene/stage.js';

gsap.registerPlugin(SplitText);

const STATE_KEYS = Object.keys(DEFAULT_STATE);

export function createDeck({ stage, callouts, reduced }) {
  const slides = [...document.querySelectorAll('.slide')];
  const N = slides.length;
  const rail = document.getElementById('rail');
  const segs = document.getElementById('progressSegs');
  const counterNow = document.getElementById('counterNow');
  const counterName = document.getElementById('counterName');
  const hint = document.getElementById('hint');
  document.getElementById('counterAll').textContent = String(N).padStart(2, '0');
  if (matchMedia('(pointer: coarse)').matches) hint.querySelector('.hint-text').textContent = 'Свайп вверх';

  let current = -1;
  let lockUntil = 0;
  let sceneTween = null;
  let wasPortrait = stage.portrait();
  const slideTl = new Map();

  // ---------- split titles into masked lines ----------
  const splits = slides.map(s => {
    const t = s.querySelector('[data-split]');
    return t ? SplitText.create(t, { type: 'lines', mask: 'lines', linesClass: 'line', autoSplit: true }) : null;
  });
  const linesOf = i => (splits[i] ? splits[i].lines : []);
  const depthCache = slides.map(s => [...s.querySelectorAll('[data-depth]')]);
  const depthOf = i => depthCache[i];

  // Product shots never go fully transparent: at 0.002 the browser keeps their textures
  // rasterised, so a card never has to be decoded/rasterised in the middle of a transition.
  const hiddenOpacity = (k, el) => (el.classList.contains('shot-in') ? 0.002 : 0);

  // hidden start state
  slides.forEach((s, i) => {
    gsap.set(s, { autoAlpha: 0 });
    gsap.set(depthOf(i), { opacity: hiddenOpacity, y: 0 });
  });

  // ---------- navigation chrome ----------
  slides.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `${i + 1}. ${s.dataset.name}`);
    b.innerHTML = `<span>${s.dataset.name}</span><i></i>`;
    b.addEventListener('click', () => go(i, true));
    rail.appendChild(b);
    segs.appendChild(document.createElement('i'));
  });
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); go(+el.dataset.goto, true); });
  });

  function chrome(i) {
    [...rail.children].forEach((b, k) => b.classList.toggle('is-active', k === i));
    [...segs.children].forEach((b, k) => b.classList.toggle('is-done', k <= i));
    counterNow.textContent = String(i + 1).padStart(2, '0');
    counterName.textContent = slides[i].dataset.name;
    slides.forEach((s, k) => { s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); s.inert = k !== i; });
    if (history.replaceState) history.replaceState(null, '', `#${i + 1}`);
  }

  // ---------- scene state per slide ----------
  function targetState(i) {
    const sl = SLIDES[i];
    return { ...DEFAULT_STATE, ...sl.state, ...(stage.portrait() ? sl.mobile : null) };
  }
  /** keyframe j (0 = the slide state itself, 1.. = sl.then[j-1]) */
  function keyState(i, j) {
    const base = targetState(i);
    if (!j) return base;
    const step = SLIDES[i].then[j - 1];
    return { ...base, ...step.state, ...(stage.portrait() ? step.mobile : null) };
  }

  /** Camera and scene timeline for a slide, with its follow-up moves and callout cues. */
  function tweenScene(i, duration, prev, calloutAt) {
    stage.settleOrbit();
    stage.setOpen(prev >= 0 && SLIDES[prev].open ? OPEN[SLIDES[prev].open] : null, SLIDES[i].open ? OPEN[SLIDES[i].open] : null);
    sceneTween?.kill();
    const tl = gsap.timeline();
    sceneTween = tl;
    const steps = [0, ...(SLIDES[i].then || []).map((_, j) => j + 1)];
    let az = stage.state.az;
    let at = 0;
    steps.forEach(j => {
      const t = keyState(i, j);
      if (reduced) { t.orbit = 0; t.sway = 0; }
      let d = t.az - az;
      d = ((d + 540) % 360) - 180;
      t.az = az + d;
      az = t.az;
      const vars = {};
      for (const k of STATE_KEYS) vars[k] = t[k];
      const step = j ? SLIDES[i].then[j - 1] : null;
      const dur = j ? (reduced ? 0.6 : step.dur) : duration;
      at += j ? (reduced ? 0.2 : step.delay || 0) : 0;
      tl.to(stage.state, { ...vars, duration: dur, ease: 'power2.inOut', overwrite: j ? false : true }, at);
      const cue = j ? at + dur - 0.35 : calloutAt;
      if (callouts.count(i, j)) tl.call(() => callouts.show(i, 0, j), null, Math.max(0, cue));
      if (j) tl.call(() => callouts.hide(i, j), null, at + 0.05);
      at += dur;
    });
  }

  // ---------- slide in / out ----------
  function leave(i, dir) {
    slideTl.get(i)?.kill();
    const tl = gsap.timeline();
    const lines = linesOf(i);
    if (lines.length) tl.to(lines, { yPercent: -dir * 110, duration: 0.55, ease: 'power3.in', stagger: 0.035 }, 0);
    depthOf(i).forEach(el => {
      const d = +el.dataset.depth;
      tl.to(el, { y: -dir * (40 + d * 110), opacity: hiddenOpacity(0, el), duration: 0.62 + d * 0.04, ease: 'power3.in', force3D: true }, 0.03 * d);
    });
    tl.set(slides[i], { autoAlpha: 0 });
    tl.call(() => slides[i].classList.remove('is-active'));
    slideTl.set(i, tl);
    return tl;
  }

  function enter(i, dir, delay) {
    slideTl.get(i)?.kill();
    const s = slides[i];
    const tl = gsap.timeline({ delay });
    tl.call(() => s.classList.add('is-active'));
    tl.set(s, { autoAlpha: 1 });
    const lines = linesOf(i);
    if (lines.length) tl.fromTo(lines, { yPercent: dir * 110 }, { yPercent: 0, duration: 1.05, ease: 'expo.out', stagger: 0.075 }, 0);
    depthOf(i).forEach(el => {
      const d = +el.dataset.depth;
      tl.fromTo(el,
        { y: dir * (70 + d * 150), opacity: hiddenOpacity(0, el) },
        { y: 0, opacity: 1, duration: 1.15 + d * 0.08, ease: 'expo.out', force3D: true },
        0.1 + d * 0.07);
    });
    slideTl.set(i, tl);
    return tl;
  }

  function go(i, fromUser, introDelay = 0) {
    if (i < 0 || i >= N || i === current) return;
    const now = performance.now();
    if (!fromUser && now < lockUntil) return;
    lockUntil = now + (reduced ? 500 : 1150) + introDelay * 1000;
    const prev = current;
    const dir = prev < 0 ? 1 : i > prev ? 1 : -1;
    current = i;
    chrome(i);
    if (prev >= 0) {
      callouts.hide(prev);
      leave(prev, dir);
    }
    const far = prev >= 0 && (SLIDES[prev].open || SLIDES[i].open) && SLIDES[prev].open !== SLIDES[i].open;
    const dur = prev < 0 ? 0.01 : reduced ? 0.6 : far ? 2.2 : 1.7;
    tweenScene(i, dur, prev, prev < 0 ? introDelay + 1.9 : reduced ? 0.6 : dur - 0.25);
    enter(i, dir, prev < 0 ? introDelay : reduced ? 0.2 : 0.55);
    if (i > 0) gsap.to(hint, { autoAlpha: 0, duration: 0.4 });
  }

  // ---------- input ----------
  let lastWheel = 0, wheelAcc = 0, fresh = true;
  window.addEventListener('wheel', e => {
    e.preventDefault();
    const now = performance.now();
    const gap = now - lastWheel;
    lastWheel = now;
    if (gap > 220) { wheelAcc = 0; fresh = true; }
    if (now < lockUntil || !fresh) return;
    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    wheelAcc += e.deltaMode === 1 ? delta * 30 : delta;
    if (Math.abs(wheelAcc) > 36) {
      const dir = Math.sign(wheelAcc);
      wheelAcc = 0;
      fresh = false; // ignore the rest of this gesture (trackpad inertia)
      go(current + dir);
    }
  }, { passive: false });

  let ts = null;
  window.addEventListener('touchstart', e => {
    const t = e.touches[0];
    ts = { x: t.clientX, y: t.clientY, time: performance.now() };
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (e.target.closest('a, button')) return;
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', e => {
    if (!ts) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - ts.x, dy = t.clientY - ts.y;
    const dt = performance.now() - ts.time;
    ts = null;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const min = dt < 250 ? 24 : 48;
    if (Math.max(ax, ay) < min) return;
    if (ay >= ax) go(current + (dy < 0 ? 1 : -1));
    else go(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  window.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (['ArrowDown', 'ArrowRight', 'PageDown', ' ', 'Enter'].includes(k)) {
      if (k === 'Enter' && document.activeElement && document.activeElement !== document.body) return;
      e.preventDefault(); go(current + 1);
    } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); go(current - 1); }
    else if (k === 'Home') { e.preventDefault(); go(0, true); }
    else if (k === 'End') { e.preventDefault(); go(N - 1, true); }
  });

  window.addEventListener('hashchange', () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (n >= 1 && n <= N && n - 1 !== current) go(n - 1, true);
  });

  window.addEventListener('resize', () => {
    const p = stage.portrait();
    if (p !== wasPortrait && current >= 0) {
      wasPortrait = p;
      tweenScene(current, 0.6, current, 0.6);
    }
  });

  // ---------- pointer parallax on the copy & product shots ----------
  if (!reduced && matchMedia('(pointer: fine)').matches) {
    const p = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener('pointermove', e => {
      p.tx = e.clientX / innerWidth - 0.5;
      p.ty = e.clientY / innerHeight - 0.5;
    }, { passive: true });
    stage.onFrame(() => {
      p.x += (p.tx - p.x) * 0.06;
      p.y += (p.ty - p.y) * 0.06;
      if (current < 0) return;
      for (const el of depthOf(current)) {
        const d = +el.dataset.depth;
        el.style.translate = `${(-p.x * d * 9).toFixed(2)}px ${(-p.y * d * 7).toFixed(2)}px`;
      }
    });
  }

  return {
    get current() { return current; },
    /** Paint every slide once behind the preloader: decodes images, rasterises layers, fills glyph caches. */
    async prewarm(frames) {
      slides.forEach((s, i) => { gsap.set(s, { autoAlpha: 1 }); gsap.set(depthOf(i), { opacity: 1 }); });
      await frames(4);
      slides.forEach((s, i) => { gsap.set(s, { autoAlpha: 0 }); gsap.set(depthOf(i), { opacity: hiddenOpacity }); });
      await frames(1);
    },
    go,
    start(introDelay = 0) {
      const n = parseInt(location.hash.slice(1), 10);
      const first = n >= 1 && n <= N ? n - 1 : 0;
      go(first, true, introDelay);
      if (first === 0) gsap.to(hint, { autoAlpha: 1, duration: 0.8, delay: introDelay + 2.2 });
      return first;
    },
    targetState,
  };
}
