import * as THREE from 'three';
import { materials } from './materials.js';
import { box, cyl } from './geo.js';

/*
  Faceless architectural-model figures. Joints are plain groups so poses and work
  motions are cheap per-frame rotations. Figure faces +z; feet at y = 0 when standing.
*/

const capsule = (r, len) => {
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  g.translate(0, -len / 2 - r * 0.4, 0); // hangs down from its joint
  return g;
};

export function person({ hat = false, vest = false, headset = false, dark = false } = {}) {
  const M = materials();
  const skin = dark ? M.mannequinDark : M.mannequin;
  const body = vest ? M.vest : skin;
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const spine = new THREE.Group(); hips.add(spine);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.36, 4, 12), body);
  torso.position.y = 0.3; torso.scale.set(1, 1, 0.72);
  spine.add(torso);
  const neck = new THREE.Group(); neck.position.y = 0.6; spine.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 12), skin);
  head.position.y = 0.13; head.scale.set(0.92, 1.08, 0.98);
  neck.add(head);
  if (hat) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.hardHat);
    h.position.y = 0.17; neck.add(h);
    const brim = new THREE.Mesh(cyl(0.15, 0.15, 0.012, 0, 0.17, 0.02, 18), M.hardHat);
    neck.add(brim);
  }
  if (headset) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.01, 6, 20, Math.PI), M.blackSteel);
    band.position.y = 0.15; band.rotation.z = 0; neck.add(band);
    const mic = new THREE.Mesh(box(0.01, 0.01, 0.12, 0.09, 0.08, 0.06), M.blackSteel);
    neck.add(mic);
    for (const s of [-1, 1]) neck.add(new THREE.Mesh(cyl(0.035, 0.035, 0.03, s * 0.105, 0.13, 0, 12).rotateZ(Math.PI / 2), M.blackSteel));
  }
  const arm = side => {
    const sh = new THREE.Group(); sh.position.set(side * 0.21, 0.52, 0); spine.add(sh);
    sh.add(new THREE.Mesh(capsule(0.052, 0.22), body === M.vest ? skin : body));
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    el.add(new THREE.Mesh(capsule(0.045, 0.2), skin));
    const hand = new THREE.Group(); hand.position.y = -0.29; el.add(hand);
    return { sh, el, hand };
  };
  const leg = side => {
    const hp = new THREE.Group(); hp.position.set(side * 0.095, 0, 0); hips.add(hp);
    hp.add(new THREE.Mesh(capsule(0.072, 0.34), skin));
    const kn = new THREE.Group(); kn.position.y = -0.45; hp.add(kn);
    kn.add(new THREE.Mesh(capsule(0.058, 0.34), skin));
    return { hp, kn };
  };
  const p = { root, hips, spine, neck, l: arm(-1), r: arm(1), ll: leg(-1), rl: leg(1) };
  return p;
}

export function sit(p, seatY = 0.5) {
  p.hips.position.y = seatY + 0.04;
  for (const L of [p.ll, p.rl]) { L.hp.rotation.x = -Math.PI / 2; L.kn.rotation.x = Math.PI / 2; }
}

export function typing(p, t, phase = 0, amount = 1) {
  const a = amount;
  p.l.sh.rotation.x = -0.75 * a; p.r.sh.rotation.x = -0.75 * a;
  p.l.el.rotation.x = -0.9 * a + Math.sin(t * 9 + phase) * 0.05 * a;
  p.r.el.rotation.x = -0.9 * a + Math.sin(t * 8 + phase + 1.3) * 0.05 * a;
  p.l.sh.rotation.z = 0.18 * a; p.r.sh.rotation.z = -0.18 * a;
}

/** Talking on a headset: one hand gestures, head nods. */
export function talking(p, t, phase = 0) {
  typing(p, t, phase, 0.55);
  const g = Math.max(0, Math.sin(t * 0.9 + phase));
  p.r.sh.rotation.x = -0.6 - g * 0.55;
  p.r.el.rotation.x = -1.2 - Math.sin(t * 2.6 + phase) * 0.25 * g;
  p.neck.rotation.x = Math.sin(t * 1.7 + phase) * 0.07;
  p.neck.rotation.y = Math.sin(t * 0.6 + phase) * 0.12;
  p.spine.rotation.x = 0.06 + Math.sin(t * 0.8 + phase) * 0.03;
}

export function hammering(p, t, phase = 0) {
  // kneeling on one knee
  p.hips.position.y = 0.5;
  p.ll.hp.rotation.x = -1.45; p.ll.kn.rotation.x = 1.5;
  p.rl.hp.rotation.x = 0.15; p.rl.kn.rotation.x = 1.45;
  p.spine.rotation.x = 0.45;
  const s = Math.sin(t * 5.2 + phase);
  p.r.sh.rotation.x = -1.3 - s * 0.75;
  p.r.el.rotation.x = -0.5 - (s + 1) * 0.35;
  p.l.sh.rotation.x = -0.9; p.l.el.rotation.x = -0.5;
}

export function welding(p, t) {
  p.hips.position.y = 0.42;
  p.ll.hp.rotation.x = -1.9; p.ll.kn.rotation.x = 2.2;
  p.rl.hp.rotation.x = -1.6; p.rl.kn.rotation.x = 2.3;
  p.spine.rotation.x = 0.55;
  p.r.sh.rotation.x = -0.95 + Math.sin(t * 1.3) * 0.06; p.r.el.rotation.x = -0.5;
  p.l.sh.rotation.x = -1.1; p.l.el.rotation.x = -0.8;
  p.neck.rotation.x = 0.35;
}

export function painting(p, t, phase = 0) {
  const s = Math.sin(t * 2.2 + phase);
  p.r.sh.rotation.x = -2.0 - s * 0.55;
  p.r.el.rotation.x = -0.35 + s * 0.2;
  p.l.sh.rotation.x = -0.3; p.l.el.rotation.x = -0.4;
  p.spine.rotation.x = -0.05 + s * 0.04;
  p.neck.rotation.x = -0.25 - s * 0.15;
}

export function reaching(p, t, amount, phase = 0) {
  const s = Math.sin(t * 1.6 + phase) * 0.06;
  p.l.sh.rotation.x = -0.25 - amount * 2.35 + s; p.r.sh.rotation.x = -0.25 - amount * 2.35 - s;
  p.l.sh.rotation.z = amount * 0.25; p.r.sh.rotation.z = -amount * 0.25;
  p.l.el.rotation.x = -0.4 * (1 - amount); p.r.el.rotation.x = -0.4 * (1 - amount);
  p.neck.rotation.x = -0.5 * amount;
}

export function walking(p, t, speed = 1) {
  const w = t * 5.2 * speed;
  const s = Math.sin(w);
  p.ll.hp.rotation.x = s * 0.42; p.rl.hp.rotation.x = -s * 0.42;
  p.ll.kn.rotation.x = Math.max(0, -Math.sin(w - 0.9)) * 0.7; p.rl.kn.rotation.x = Math.max(0, Math.sin(w - 0.9)) * 0.7;
  p.l.sh.rotation.x = -s * 0.35; p.r.sh.rotation.x = s * 0.35;
  p.l.el.rotation.x = -0.25; p.r.el.rotation.x = -0.25;
  p.hips.position.y = 0.95 + Math.abs(Math.cos(w)) * 0.025;
}

/** Tool meshes to put in a hand group. */
export function tool(kind) {
  const M = materials();
  const g = new THREE.Group();
  if (kind === 'hammer') {
    g.add(new THREE.Mesh(cyl(0.013, 0.013, 0.3, 0, -0.12, 0, 8), M.plywood));
    g.add(new THREE.Mesh(box(0.12, 0.04, 0.04, 0, -0.28, 0), M.blackSteel));
  } else if (kind === 'torch') {
    const t = new THREE.Mesh(cyl(0.016, 0.012, 0.26, 0, -0.1, 0.04, 8), M.blackSteel);
    t.rotation.x = 0.9;
    g.add(t);
    g.add(new THREE.Mesh(box(0.16, 0.12, 0.02, 0, 0.2, 0.12), M.blackSteel)); // face shield
  } else if (kind === 'roller') {
    g.add(new THREE.Mesh(cyl(0.012, 0.012, 0.5, 0, -0.22, 0, 8), M.blackSteel));
    const r = new THREE.Mesh(cyl(0.035, 0.035, 0.22, 0, -0.48, 0, 12), M.lime);
    r.rotation.z = Math.PI / 2;
    g.add(r);
  } else if (kind === 'tablet') {
    g.add(new THREE.Mesh(box(0.24, 0.006, 0.17, 0, -0.04, 0.06), M.blackSteel));
  }
  return g;
}
