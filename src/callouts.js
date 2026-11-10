import * as THREE from 'three';
import gsap from 'gsap';
import { SLIDES } from './slides.js';

const GEO = {
  desk: { dx1: 30, dy: -30, dx2: 76 },
  mob: { dx1: 16, dy: -18, dx2: 38 },
  nodeDesk: { dx1: 14, dy: -22, dx2: 46 },
  nodeMob: { dx1: 10, dy: -22, dx2: 24 },
};

export function createCallouts(container, stage) {
  const { building, world } = stage;
  const tmp = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const sets = [];
  let active = new Set();
  let mobile = stage.portrait();

  function resolveApt(id) {
    const a = building.aptById(id);
    return { floor: a.floor, p: [a.pos.x, a.pos.y, a.pos.z], n: [a.normal.x, a.normal.y, a.normal.z] };
  }

  function make(spec, isNode) {
    let s = spec;
    if (spec.aptId != null) s = { ...spec, ...resolveApt(spec.aptId) };
    const side = s.side || 'r';
    const el = document.createElement('div');
    el.className = `co co-${side} tone-${s.tone || 'lime'}${isNode ? ' co-node' : ''}`;
    el.innerHTML = `
      <div class="co-in">
        <svg class="co-line" width="1" height="1"><path /></svg>
        <i class="co-dot"></i>
        <div class="co-body"><div class="co-text"><b></b>${s.text ? '<span></span>' : ''}</div></div>
      </div>`;
    el.querySelector('b').textContent = s.title;
    if (s.text) el.querySelector('span').textContent = s.text;
    el.style.opacity = '0';
    el.style.visibility = 'hidden';
    container.appendChild(el);
    const item = {
      el,
      path: el.querySelector('path'),
      dot: el.querySelector('.co-dot'),
      text: el.querySelector('.co-text'),
      side,
      pref: side,
      bw: 120,
      bh: 40,
      tick: 0,
      vis: 1,
      blocked: false,
      rect: null,
      isNode,
      mobileOk: s.m !== false,
      floor: s.floor,
      obj: s.at ? stage.anchors.get(s.at) : null,
      k: s.k || 0,
      until: s.until ?? null,
      local: s.p ? new THREE.Vector3(...s.p) : null,
      world: s.world ? new THREE.Vector3(...s.world) : s.pos ? s.pos.clone() : null,
      normal: s.n ? new THREE.Vector3(...s.n).normalize() : null,
      shown: 0,
      len: 0,
    };
    layout(item);
    return item;
  }

  function geo(item) {
    return item.isNode ? (mobile ? GEO.nodeMob : GEO.nodeDesk) : (mobile ? GEO.mob : GEO.desk);
  }

  function layout(item) {
    const g = geo(item);
    const d = item.side === 'l' ? -1 : 1;
    item.el.classList.toggle('co-l', item.side === 'l');
    item.el.classList.toggle('co-r', item.side !== 'l');
    item.path.setAttribute('d', `M0 0 L${d * g.dx1} ${g.dy} L${d * g.dx2} ${g.dy}`);
    item.len = Math.hypot(g.dx1, g.dy) + (g.dx2 - g.dx1);
    item.path.style.strokeDasharray = item.len;
  }

  // ---------- keep labels clear of the copy, product shots and screen edges ----------
  const slideEls = [...document.querySelectorAll('.slide')];
  let avoid = [];
  function measure(idx) {
    const s = slideEls[idx];
    avoid = [...s.querySelectorAll('.copy, .shot')]
      .filter(el => el.offsetParent !== null || getComputedStyle(el).display !== 'none')
      .map(el => el.getBoundingClientRect())
      .filter(r => r.width > 0);
    for (const item of sets[idx]) {
      item.bw = item.text.offsetWidth;
      item.bh = item.text.offsetHeight;
    }
  }
  function rectFor(item, side, x, y) {
    const g = geo(item);
    const left = side === 'l' ? x - g.dx2 - item.bw : x + g.dx2;
    return { left, right: left + item.bw, top: y + g.dy - item.bh / 2, bottom: y + g.dy + item.bh / 2 };
  }
  const hit = (a, b, px, py) => a.right > b.left - px && a.left < b.right + px && a.bottom > b.top - py && a.top < b.bottom + py;
  function fits(item, side, x, y, w, h, peers) {
    const r = rectFor(item, side, x, y);
    const edgeR = w - (mobile ? 8 : 64);
    if (r.left < 8 || r.right > edgeR || r.top < (mobile ? 56 : 70) || r.bottom > h - (mobile ? 8 : 64)) return false;
    for (const a of avoid) if (hit(r, a, 10, 6)) return false;
    for (const p of peers) if (p !== item && p.rect && !p.blocked && p.shown > 0.01 && hit(r, p.rect, 8, 4)) return false;
    return true;
  }
  function chooseSide(item, x, y, w, h, peers) {
    const pref = item.pref;
    const other = pref === 'l' ? 'r' : 'l';
    let side = null;
    if (fits(item, pref, x, y, w, h, peers)) side = pref;
    else if (fits(item, other, x, y, w, h, peers)) side = other;
    item.blocked = side === null;
    if (side && side !== item.side) { item.side = side; layout(item); }
    item.rect = item.blocked ? null : rectFor(item, item.side, x, y);
  }

  SLIDES.forEach(slide => {
    if (slide.callouts === 'nodes') {
      sets.push(world.nodes.anchors.map((n, i) => make({ ...n, side: Math.cos(n.a * Math.PI / 180) < -0.2 ? 'l' : 'r', text: n.text, tone: 'lime' }, true)));
    } else {
      sets.push(slide.callouts.map(c => make(c, false)));
    }
  });

  function anchorWorld(item, out) {
    if (item.obj) return item.obj.localToWorld(item.local ? out.copy(item.local) : out.set(0, 0, 0));
    if (item.world) return out.copy(item.world);
    const fl = building.floors[item.floor];
    return fl.localToWorld(out.copy(item.local));
  }

  stage.onFrame((camera, w, h) => {
    if (!active.size) return;
    for (const idx of active) {
      for (const item of sets[idx]) {
        if (item.shown <= 0.001 || (mobile && !item.mobileOk)) continue;
        anchorWorld(item, tmp);
        let face = 1;
        if (item.normal) {
          toCam.copy(camera.position).sub(tmp).normalize();
          face = THREE.MathUtils.smoothstep(toCam.dot(item.normal), -0.02, 0.22);
        }
        tmp.project(camera);
        const x = (tmp.x * 0.5 + 0.5) * w;
        const y = (-tmp.y * 0.5 + 0.5) * h;
        const behind = tmp.z > 1 ? 0 : 1;
        if (++item.tick % 6 === 0 || item.tick === 1) chooseSide(item, x, y, w, h, sets[idx]);
        item.vis += ((item.blocked ? 0 : 1) - item.vis) * 0.2;
        item.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        item.el.style.opacity = (item.shown * face * behind * item.vis).toFixed(3);
      }
    }
  });

  function show(idx, delay = 0, key = 0) {
    active.add(idx);
    gsap.delayedCall(Math.max(0, delay - 0.05), () => measure(idx));
    sets[idx].filter(item => item.k === key).forEach((item, k) => {
      if (mobile && !item.mobileOk) { item.el.style.visibility = 'hidden'; return; }
      item.tick = 0;
      item.vis = 0;
      item.blocked = false;
      item.rect = null;
      item.el.style.visibility = 'visible';
      gsap.killTweensOf([item, item.path, item.dot, item.text]);
      const t = delay + k * 0.09;
      gsap.to(item, { shown: 1, duration: 0.35, delay: t, ease: 'power1.out' });
      gsap.fromTo(item.dot, { scale: 0 }, { scale: 1, duration: 0.5, delay: t, ease: 'back.out(2.2)' });
      gsap.fromTo(item.path, { strokeDashoffset: item.len }, { strokeDashoffset: 0, duration: 0.6, delay: t + 0.08, ease: 'power2.inOut' });
      gsap.fromTo(item.text, { opacity: 0, x: item.side === 'l' ? 10 : -10 }, { opacity: 1, x: 0, duration: 0.6, delay: t + 0.35, ease: 'power3.out' });
    });
  }

  function hide(idx, key = null) {
    sets[idx].filter(item => key === null || item.until === key).forEach(item => {
      gsap.killTweensOf([item, item.path, item.dot, item.text]);
      gsap.to(item, {
        shown: 0, duration: 0.3, ease: 'power1.in',
        onComplete: () => { item.el.style.visibility = 'hidden'; item.el.style.opacity = '0'; },
      });
    });
    gsap.delayedCall(0.32, () => {
      if (sets[idx].every(i => i.shown <= 0.001)) active.delete(idx);
    });
  }

  function relayout() {
    const m = stage.portrait();
    if (m === mobile) return;
    mobile = m;
    sets.flat().forEach(layout);
  }
  window.addEventListener('resize', relayout);

  async function prewarm(frames) {
    const all = sets.flat();
    all.forEach(i => { i.el.style.visibility = 'visible'; i.el.style.opacity = '1'; });
    await frames(3);
    all.forEach(i => { i.el.style.visibility = 'hidden'; i.el.style.opacity = '0'; });
  }

  return { show, hide, prewarm, count: (idx, key) => sets[idx].filter(i => key == null || i.k === key).length };
}
