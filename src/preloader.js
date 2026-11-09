import gsap from 'gsap';

export function createPreloader() {
  const el = document.getElementById('preloader');
  const num = document.getElementById('preloaderNum');
  const bar = document.getElementById('preloaderBar');
  const note = document.getElementById('preloaderNote');
  const started = performance.now();
  let target = 0;
  let shown = 0;
  let done = null;
  let raf = 0;

  function tick() {
    raf = requestAnimationFrame(tick);
    // ease towards the real progress, never faster than the minimum show time allows
    const elapsed = (performance.now() - started) / 1000;
    const cap = Math.min(100, elapsed * 70);
    const goal = Math.min(target, cap);
    shown += (goal - shown) * 0.09 + (goal > shown ? 0.06 : 0);
    if (shown > goal) shown = goal;
    num.textContent = Math.floor(shown);
    bar.style.transform = `scaleX(${(shown / 100).toFixed(4)})`;
    if (done && shown >= 99.9) {
      num.textContent = '100';
      cancelAnimationFrame(raf);
      const fn = done;
      done = null;
      fn();
    }
  }
  raf = requestAnimationFrame(tick);

  return {
    set(p, text) {
      target = Math.max(target, Math.min(100, p));
      if (text) note.textContent = text;
    },
    /** Resolves when the counter reaches 100. */
    complete() {
      target = 100;
      return new Promise(r => { done = r; });
    },
    exit(onReveal) {
      const tl = gsap.timeline({ onComplete: () => el.remove() });
      tl.to(el.querySelectorAll('.preloader-mark, .preloader-note, .preloader-bar'), { opacity: 0, duration: 0.4, ease: 'power1.in' }, 0);
      tl.to(el.querySelector('.preloader-count'), { yPercent: -30, opacity: 0, duration: 0.6, ease: 'power3.in' }, 0);
      tl.call(onReveal, null, 0.35);
      tl.fromTo(el, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut' }, 0.3);
      return tl;
    },
  };
}
