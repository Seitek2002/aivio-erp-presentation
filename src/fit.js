/*
  Phone layout: a product shot sits between the top bar and the slide copy, which is
  anchored to the bottom and grows upwards. The free band differs per slide and per
  screen, so it is measured here and handed to CSS as --shot-top / --shot-room.
  If the band is too small for the shot to read, the shot is hidden (.is-squeezed).
*/

const PORTRAIT = '(max-aspect-ratio: 9/10), (max-width: 760px)';
const GAP = 18;          // space between the shot and the first line of copy
const MIN_ROOM = { 'shot-call': 120, 'shot-doc': 150, 'shot-phone': 190 };
const ROTATION_PAD = { 'shot-doc': 16 }; // rotated card grows a little taller

export function createShotFit() {
  const mq = matchMedia(PORTRAIT);
  const topbar = document.querySelector('.topbar');
  const shots = [...document.querySelectorAll('.slide .shot')].map(fig => ({
    fig,
    copy: fig.closest('.slide').querySelector('.copy'),
    kind: [...fig.classList].find(c => c in MIN_ROOM),
  }));

  function clear() {
    for (const { fig } of shots) {
      fig.style.removeProperty('--shot-top');
      fig.style.removeProperty('--shot-room');
      fig.classList.remove('is-squeezed');
    }
  }

  function fit() {
    if (!mq.matches) { clear(); return; }
    const top = Math.round(topbar.getBoundingClientRect().bottom) + 4;
    for (const s of shots) {
      if (!s.kind) continue;
      // offsetTop ignores the transforms of enter/leave animations, so this is the resting position
      const copyTop = s.copy.offsetTop;
      const room = copyTop - GAP - top - (ROTATION_PAD[s.kind] || 0);
      const squeezed = room < MIN_ROOM[s.kind];
      s.fig.classList.toggle('is-squeezed', squeezed);
      s.fig.style.setProperty('--shot-top', `${top}px`);
      s.fig.style.setProperty('--shot-room', `${Math.max(0, room)}px`);
    }
  }

  let raf = 0, late = 0;
  // second pass: titles re-split into lines shortly after a resize, which can change copy height
  const schedule = () => {
    cancelAnimationFrame(raf); clearTimeout(late);
    raf = requestAnimationFrame(fit);
    late = setTimeout(fit, 260);
  };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));
  mq.addEventListener?.('change', schedule);

  fit();
  return { fit };
}
