import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/geologica/wght.css';
import './style.css';
import gsap from 'gsap';
import { createPreloader } from './preloader.js';
import { createStage } from './scene/stage.js';
import { createCallouts } from './callouts.js';
import { createDeck } from './deck.js';
import { SLIDES } from './slides.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
gsap.config({ force3D: true });
gsap.ticker.lagSmoothing(500, 33);

const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

async function boot() {
  const pre = createPreloader();
  pre.set(4);

  // 1. fonts
  const sample = 'AIVIO ERP Застройщик 0123456789';
  const fontJobs = [
    '300 40px "Geologica Variable"', '500 16px "Geologica Variable"', '250 120px "Geologica Variable"',
    '400 16px "Inter Variable"', '500 16px "Inter Variable"',
  ].map(f => document.fonts.load(f, sample).catch(() => {}));

  // 2. product screenshots — fully decoded before they can appear
  const imgs = [...document.querySelectorAll('.slide img')];
  let loaded = 0;
  const step = () => { loaded++; pre.set(8 + (loaded / imgs.length) * 46, 'Загружаем экраны системы'); };
  const imgJobs = imgs.map(img => {
    img.loading = 'eager';
    const p = img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; });
    return p.then(() => img.decode?.().catch(() => {})).then(step);
  });

  await Promise.all(fontJobs);
  pre.set(12);
  await nextFrame();

  // 3. scene
  const stage = createStage(document.getElementById('scene'));
  pre.set(30, 'Собираем 3D-модель жилого комплекса');
  await Promise.all(imgJobs);
  await nextFrame();

  // 4. compile shaders & upload buffers for every slide state, so nothing hitches later
  pre.set(62, 'Готовим сцену');
  const states = SLIDES.map(s => ({ ...s.state }));
  await stage.warmup(states);
  pre.set(84);

  // 5. ui
  const callouts = createCallouts(document.getElementById('callouts'), stage);
  const deck = createDeck({ stage, callouts, reduced });
  const frames = async n => { for (let k = 0; k < n; k++) await nextFrame(); };
  await deck.prewarm(frames);
  await callouts.prewarm(frames);
  pre.set(92);

  // a couple of real frames before the curtain opens
  const first = (() => { const n = parseInt(location.hash.slice(1), 10); return n >= 1 && n <= SLIDES.length ? n - 1 : 0; })();
  const target = deck.targetState(first);
  Object.assign(stage.state, target, { build: 0, ghost: 0 });
  stage.start();
  await nextFrame();
  await nextFrame();

  await pre.complete();

  pre.exit(() => {
    deck.start(reduced ? 0.2 : 0.75);
    // the tower rises out of its lime blueprint
    const s = stage.state;
    gsap.killTweensOf(s, 'build,ghost');
    s.build = 0;
    s.ghost = 0;
    const intro = gsap.timeline();
    intro.to(s, { ghost: 0.75, duration: 0.6, ease: 'power1.out' }, 0);
    intro.to(s, { build: target.build, duration: reduced ? 0.8 : 2.8, ease: 'power2.inOut' }, 0.2);
    intro.to(s, { ghost: target.ghost, duration: 0.9, ease: 'power1.inOut' }, reduced ? 0.8 : 2.4);
  });
}

boot();
