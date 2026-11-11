import * as THREE from 'three';
import { materials } from './materials.js';
import { box, cyl, rng, mergeSafe } from './geo.js';

/*
  Detailed stylised figures (architectural-visualisation style): turned silhouettes for torso
  and limbs, ball joints, hands with fingers, shoes, heads with nose / ears / hair, and outfits —
  business suit, office shirt, construction worker (overalls, hi-vis vest with reflective
  strips, helmet, gloves, boots, tool belt) and a coat for passers-by.
  Joints are plain groups, so poses and work motions are per-frame rotations.
  The figure faces +z; feet on y = 0 when standing.
*/

const SEG = 18;
const mats = new Map();
const mat = (key, opts) => {
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial(opts));
  return mats.get(key);
};

const SKIN = () => mat('skin', { color: 0xe4dcd0, roughness: 0.55 });
const PALETTE = {
  shirts: [0xf2f1ec, 0xb9cbe0, 0xc7d1bd, 0xe2d3bf, 0x9fb3c8, 0xe9e4f0],
  trousers: [0x2b2f36, 0x3b3f45, 0x5a5348, 0x23272e, 0x6b6257],
  hair: [0x1d1915, 0x2f241b, 0x5b4632, 0x8a6a45, 0x161616, 0x3e3e3e],
  coats: [0xa77b50, 0x3c4048, 0x6b4a36, 0x1f2a36],
};

/** Lathe from a profile [[radius, y], …] (y descending for hanging limbs). */
function lathe(profile, sz = 1, sx = 1) {
  // LatheGeometry faces outwards only for profiles ordered bottom → top
  const pts = profile[0][1] > profile[profile.length - 1][1] ? [...profile].reverse() : profile;
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), SEG);
  g.scale(sx, 1, sz);
  return g;
}

function sphere(r, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.SphereGeometry(r, 16, 12);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}

function capsule(r, len, x = 0, y = 0, z = 0) {
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  g.translate(x, y, z);
  return g;
}

/** A hand hanging from the wrist: palm, four fingers and a thumb; `grip` curls them. */
function handGeometry(grip = 0.3, side = 1) {
  const parts = [];
  const palm = new THREE.BoxGeometry(0.078, 0.085, 0.03, 2, 2, 1);
  palm.translate(0, -0.05, 0);
  parts.push(palm);
  parts.push(sphere(0.03, 0, -0.012, 0, 1.25, 0.6, 0.7));
  const fingerLen = [0.062, 0.07, 0.066, 0.054];
  fingerLen.forEach((len, i) => {
    const f = capsule(0.0085, len, 0, -len / 2, 0);
    // curl around the knuckle line
    f.rotateX(grip * 1.35);
    f.translate(-0.028 + i * 0.0187, -0.094, 0.004);
    parts.push(f);
  });
  const th = capsule(0.01, 0.045, 0, -0.022, 0);
  th.rotateZ(side * (0.7 - grip * 0.2));
  th.rotateX(grip * 0.9);
  th.translate(side * -0.042, -0.038, 0.012);
  parts.push(th);
  return mergeSafe(parts);
}

function shoeGeometry(boot = false) {
  const parts = [];
  const upper = capsule(0.046, 0.15, 0, 0, 0);
  upper.rotateX(Math.PI / 2);
  upper.scale(1.05, boot ? 1.05 : 0.72, 1);
  upper.translate(0, -0.03, 0.055);
  parts.push(upper);
  if (boot) parts.push(cyl(0.05, 0.052, 0.12, 0, 0.01, 0, 14));
  return mergeSafe(parts);
}

function soleGeometry() {
  const s = new THREE.BoxGeometry(0.1, 0.022, 0.27);
  s.translate(0, -0.06, 0.055);
  return s;
}

/**
 * @param {object} o
 *   outfit: 'suit' | 'office' | 'worker' | 'casual'
 *   seed: varies colours, hair, build
 *   hat / vest / headset: overrides; foreman: white helmet; grip: hand curl 0..1
 */
export function person(o = {}) {
  const M = materials();
  const r = rng((o.seed ?? 1) * 7919 + 13);
  const outfit = o.outfit || (o.hat || o.vest ? 'worker' : 'office');
  const worker = outfit === 'worker';
  const female = o.female ?? (!worker && r() < 0.45);
  const build = 0.94 + r() * 0.12;
  const skin = SKIN();
  const pick = arr => arr[Math.floor(r() * arr.length)];

  // ---- materials for this figure ----
  let top, bottom, sleeve, shoe;
  if (outfit === 'suit') {
    top = mat('suit', { color: 0x1f2633, roughness: 0.62 });
    bottom = top; sleeve = top;
    shoe = mat('leather', { color: 0x141210, roughness: 0.28 });
  } else if (worker) {
    top = mat('overalls', { color: 0x2b3a52, roughness: 0.85 });
    bottom = top; sleeve = top;
    shoe = mat('boots', { color: 0x4a3423, roughness: 0.7 });
  } else if (outfit === 'casual') {
    const c = pick(PALETTE.coats);
    top = mat('coat' + c, { color: c, roughness: 0.8 });
    sleeve = top;
    const t = pick(PALETTE.trousers);
    bottom = mat('trou' + t, { color: t, roughness: 0.8 });
    shoe = mat('shoeDark', { color: 0x1c1a18, roughness: 0.4 });
  } else {
    const c = o.shirt ?? pick(PALETTE.shirts);
    top = mat('shirt' + c, { color: c, roughness: 0.72 });
    sleeve = top;
    const t = pick(PALETTE.trousers);
    bottom = mat('trou' + t, { color: t, roughness: 0.8 });
    shoe = mat(r() < 0.5 ? 'shoeBrown' : 'shoeDark', { color: r() < 0.5 ? 0x5a3a22 : 0x1c1a18, roughness: 0.38 });
  }
  const glove = worker ? mat('glove', { color: 0x3a3c38, roughness: 0.9 }) : skin;
  const sole = mat('sole', { color: 0x111111, roughness: 0.9 });

  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.97; root.add(hips);
  const add = (parent, geo, m, cast = true) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh; };

  // ---- pelvis ----
  const hipW = female ? 1.08 : 1;
  add(hips, lathe([[0.001, 0.12], [0.13, 0.11], [0.155, 0.05], [0.16, -0.02], [0.14, -0.09], [0.001, -0.11]], 0.66, hipW * build), bottom);
  if (outfit === 'suit' || outfit === 'office') add(hips, lathe([[0.149, 0.105], [0.151, 0.07]], 0.67, build), mat('belt', { color: 0x15120f, roughness: 0.4 }));

  // ---- spine / torso ----
  const spine = new THREE.Group(); spine.position.y = 0.08; hips.add(spine);
  const chest = female ? 0.152 : 0.172;
  const torsoProfile = [[0.001, 0.5], [0.05, 0.5], [0.07, 0.48], [0.135, 0.45], [chest, 0.38], [chest - 0.004, 0.3], [0.142, 0.2], [0.135, 0.12], [0.14, 0.04], [0.142, 0.0], [0.001, -0.01]];
  add(spine, lathe(torsoProfile, 0.62, build), top);
  if (female && !worker) add(spine, sphere(0.06, 0, 0.33, 0.07, 1.6, 0.9, 0.9), top);
  if (outfit === 'suit') {
    // shirt front, collar and tie
    const shirt = mat('whiteShirt', { color: 0xf3f2ee, roughness: 0.6 });
    const front = new THREE.PlaneGeometry(0.07, 0.2); front.translate(0, 0.38, 0.105);
    add(spine, front, shirt, false);
    add(spine, lathe([[0.052, 0.52], [0.06, 0.48], [0.062, 0.46]], 0.85), shirt);
    const tie = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.012, 0.47, 0.108), new THREE.Vector3(0.012, 0.47, 0.108), new THREE.Vector3(0.024, 0.28, 0.112), new THREE.Vector3(0, 0.25, 0.114), new THREE.Vector3(-0.024, 0.28, 0.112)]);
    tie.setIndex([0, 1, 2, 0, 2, 4, 2, 3, 4]); tie.computeVertexNormals();
    add(spine, tie, mat('tie', { color: 0x6d1f2a, roughness: 0.45, side: THREE.DoubleSide }), false);
    // lapels
    for (const s of [-1, 1]) {
      const lap = new THREE.BoxGeometry(0.05, 0.2, 0.012); lap.rotateZ(s * 0.32); lap.translate(s * 0.05, 0.38, 0.106);
      add(spine, lap, top, false);
    }
    add(spine, box(0.012, 0.012, 0.012, 0.0, 0.2, 0.108), mat('button', { color: 0x0b0b0b }), false);
  }
  if (outfit === 'office') add(spine, lathe([[0.05, 0.51], [0.058, 0.47], [0.06, 0.46]], 0.85), top);
  if (outfit === 'casual') {
    // coat skirt below the waist and a scarf
    add(hips, lathe([[0.16, 0.08], [0.172, -0.05], [0.19, -0.32]], 0.7, build), top);
    add(spine, new THREE.TorusGeometry(0.068, 0.028, 8, 20).rotateX(Math.PI / 2).translate(0, 0.48, 0.005), mat('scarf', { color: 0xb8a27e, roughness: 0.9 }));
  }
  if (worker && o.vest !== false) {
    const vest = mat('vest', { color: 0xff7a2f, roughness: 0.7 });
    const refl = mat('reflective', { color: 0xd9dcd8, roughness: 0.25, metalness: 0.6, emissive: 0x2a2a2a });
    add(spine, lathe([[0.001, 0.45], [0.075, 0.46], [0.14, 0.44], [chest + 0.014, 0.38], [chest + 0.01, 0.28], [0.152, 0.16], [0.152, 0.04], [0.001, 0.03]], 0.64, build), vest);
    for (const y of [0.13, 0.27]) add(spine, lathe([[chest + 0.017, y + 0.02], [chest + 0.017, y - 0.012]], 0.65, build), refl, false);
    // shoulder straps reflective
    for (const s of [-1, 1]) add(spine, box(0.025, 0.012, 0.21, s * 0.07, 0.455, 0), refl, false);
    // tool belt with pouches
    const leather = mat('toolbelt', { color: 0x5b3b22, roughness: 0.6 });
    add(hips, lathe([[0.158, 0.1], [0.16, 0.06]], 0.69, build), leather);
    for (const [x, z] of [[0.13, 0.05], [-0.13, 0.05], [0.12, -0.06]]) add(hips, box(0.06, 0.09, 0.05, x, 0.02, z), leather);
    add(hips, cyl(0.012, 0.012, 0.16, 0.16, -0.04, 0.02, 8), mat('hammerHandle', { color: 0x8a6239 }));
  }

  // ---- neck & head ----
  const neck = new THREE.Group(); neck.position.y = 0.5; spine.add(neck);
  add(neck, cyl(0.042, 0.047, 0.1, 0, 0.04, 0, 14), skin);
  const head = new THREE.Group(); head.position.y = 0.1; neck.add(head);
  add(head, mergeSafe([
    sphere(0.098, 0, 0.1, -0.005, 0.9, 1.05, 1.02),
    sphere(0.072, 0, 0.045, 0.018, 0.92, 0.85, 1.0),
    (() => { const n = new THREE.ConeGeometry(0.016, 0.042, 10); n.rotateX(Math.PI / 2); n.translate(0, 0.085, 0.104); return n; })(),
    sphere(0.022, 0.088, 0.09, -0.005, 0.38, 1.0, 0.72),
    sphere(0.022, -0.088, 0.09, -0.005, 0.38, 1.0, 0.72),
    sphere(0.06, 0, 0.13, 0.05, 1.3, 0.28, 0.6),  // brow line
  ]), skin);
  const hasHat = o.hat ?? worker;
  if (!hasHat) {
    const style = o.hair || (female ? (r() < 0.5 ? 'bun' : 'long') : (r() < 0.12 ? 'none' : 'short'));
    const hairMat = mat('hair' + style + (o.seed ?? 1) % 6, { color: PALETTE.hair[(o.seed ?? 1) % PALETTE.hair.length], roughness: 0.75 });
    const cap = new THREE.SphereGeometry(0.104, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.56);
    cap.scale(0.92, 1.06, 1.06);
    cap.rotateX(-0.25);
    cap.translate(0, 0.112, -0.012);
    if (style === 'short') add(head, cap, hairMat);
    if (style === 'bun') add(head, mergeSafe([cap, sphere(0.045, 0, 0.16, -0.09)]), hairMat);
    if (style === 'long') {
      const back = new THREE.CylinderGeometry(0.095, 0.085, 0.22, 16, 1, true, Math.PI * 0.55, Math.PI * 0.9);
      back.translate(0, 0.02, -0.01);
      add(head, mergeSafe([cap, back]), hairMat);
    }
  } else {
    const helmetColor = o.foreman ? 0xf3f1ea : 0xd6f12b;
    const helm = mat('helmet' + helmetColor, { color: helmetColor, roughness: 0.32 });
    const dome = new THREE.SphereGeometry(0.122, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(0.96, 0.92, 1.04);
    dome.translate(0, 0.13, -0.005);
    const brim = new THREE.CylinderGeometry(0.132, 0.14, 0.014, 24);
    brim.scale(1, 1, 1.12);
    brim.translate(0, 0.128, 0.012);
    const peak = new THREE.BoxGeometry(0.12, 0.012, 0.05); peak.translate(0, 0.126, 0.13);
    const ridge = new THREE.BoxGeometry(0.022, 0.02, 0.2); ridge.translate(0, 0.245, 0);
    add(head, mergeSafe([dome, brim, peak, ridge]), helm);
  }
  if (o.headset) {
    const blk = M.blackSteel;
    add(head, new THREE.TorusGeometry(0.104, 0.009, 8, 24, Math.PI).translate(0, 0.11, 0), blk);
    for (const s of [-1, 1]) { const cup = new THREE.CylinderGeometry(0.036, 0.036, 0.028, 14); cup.rotateZ(Math.PI / 2); cup.translate(s * 0.098, 0.09, 0); add(head, cup, blk); }
    const boom = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.1, 0.08, 0), new THREE.Vector3(0.1, 0.03, 0.07), new THREE.Vector3(0.04, 0.035, 0.11)), 10, 0.005, 6);
    add(head, boom, blk);
    add(head, sphere(0.012, 0.035, 0.035, 0.112), blk);
  }

  // ---- arms ----
  const grip = o.grip ?? (worker ? 0.85 : 0.35);
  const arm = side => {
    const sh = new THREE.Group(); sh.position.set(side * 0.185 * build, 0.42, 0); spine.add(sh);
    add(sh, sphere(0.062, 0, 0, 0), sleeve);
    add(sh, lathe([[0.055, 0.0], [0.052, -0.08], [0.046, -0.2], [0.042, -0.28]]), sleeve);
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    add(el, sphere(0.043, 0, 0, 0), sleeve);
    const forearmMat = outfit === 'office' && side < 0 && r() < 0.5 ? skin : sleeve; // rolled sleeve now and then
    add(el, lathe([[0.042, 0.0], [0.044, -0.07], [0.036, -0.18], [0.03, -0.25]]), forearmMat);
    if (worker) add(el, lathe([[0.036, -0.2], [0.038, -0.26]]), glove);
    const hand = new THREE.Group(); hand.position.y = -0.255; el.add(hand);
    add(hand, handGeometry(grip, side), glove);
    return { sh, el, hand };
  };

  // ---- legs ----
  const leg = side => {
    const hp = new THREE.Group(); hp.position.set(side * 0.088 * hipW, -0.04, 0); hips.add(hp);
    add(hp, lathe([[0.08, 0.02], [0.084, -0.05], [0.07, -0.25], [0.055, -0.44]]), bottom);
    const kn = new THREE.Group(); kn.position.y = -0.45; hp.add(kn);
    add(kn, sphere(0.055, 0, 0, 0.004), bottom);
    add(kn, lathe([[0.053, 0.0], [0.055, -0.1], [0.044, -0.3], [0.038, -0.4]]), bottom);
    if (worker) add(kn, box(0.085, 0.1, 0.03, 0, -0.02, 0.05), mat('kneepad', { color: 0x161616, roughness: 0.6 }));
    const ankle = new THREE.Group(); ankle.position.y = -0.4; kn.add(ankle);
    add(ankle, shoeGeometry(worker), shoe);
    add(ankle, soleGeometry(), sole, false);
    return { hp, kn, ankle };
  };

  return { root, hips, spine, neck, head, l: arm(-1), r: arm(1), ll: leg(-1), rl: leg(1), worker };
}

export function sit(p, seatY = 0.5) {
  p.hips.position.y = seatY + 0.1;
  for (const L of [p.ll, p.rl]) { L.hp.rotation.x = -Math.PI / 2; L.kn.rotation.x = Math.PI / 2; }
  p.ll.hp.rotation.y = 0.08; p.rl.hp.rotation.y = -0.08;
}

export function idle(p, t, phase = 0) {
  const b = Math.sin(t * 1.4 + phase) * 0.012;
  p.spine.rotation.x = 0.02 + b;
  p.l.sh.rotation.x = 0.05 + b; p.r.sh.rotation.x = 0.05 - b;
  p.l.sh.rotation.z = 0.07; p.r.sh.rotation.z = -0.07;
  p.l.el.rotation.x = -0.15; p.r.el.rotation.x = -0.15;
  p.neck.rotation.y = Math.sin(t * 0.35 + phase) * 0.25;
}

export function typing(p, t, phase = 0, amount = 1) {
  const a = amount;
  p.l.sh.rotation.x = -0.7 * a; p.r.sh.rotation.x = -0.7 * a;
  p.l.el.rotation.x = -0.95 * a + Math.sin(t * 9 + phase) * 0.04 * a;
  p.r.el.rotation.x = -0.95 * a + Math.sin(t * 8 + phase + 1.3) * 0.04 * a;
  p.l.sh.rotation.z = 0.22 * a; p.r.sh.rotation.z = -0.22 * a;
  p.l.hand.rotation.x = -0.35 * a + Math.sin(t * 13 + phase) * 0.08 * a;
  p.r.hand.rotation.x = -0.35 * a + Math.sin(t * 12 + phase + 2) * 0.08 * a;
}

/** Talking on a headset: one hand gestures, head nods, weight shifts. */
export function talking(p, t, phase = 0) {
  typing(p, t, phase, 0.55);
  const g = Math.max(0, Math.sin(t * 0.9 + phase));
  p.r.sh.rotation.x = -0.6 - g * 0.6;
  p.r.sh.rotation.z = -0.25 - g * 0.15;
  p.r.el.rotation.x = -1.25 - Math.sin(t * 2.6 + phase) * 0.25 * g;
  p.r.hand.rotation.z = Math.sin(t * 3.1 + phase) * 0.3 * g;
  p.neck.rotation.x = Math.sin(t * 1.7 + phase) * 0.07;
  p.neck.rotation.y = Math.sin(t * 0.6 + phase) * 0.14;
  p.spine.rotation.x = 0.06 + Math.sin(t * 0.8 + phase) * 0.03;
  p.spine.rotation.y = Math.sin(t * 0.45 + phase) * 0.05;
}

export function hammering(p, t, phase = 0) {
  p.hips.position.y = 0.52;
  p.ll.hp.rotation.x = -1.45; p.ll.kn.rotation.x = 1.5;
  p.rl.hp.rotation.x = 0.2; p.rl.kn.rotation.x = 1.42;
  p.rl.ankle.rotation.x = 0.9;
  p.spine.rotation.x = 0.5;
  // sharp strike, slow lift
  const c = ((t * 1.6 + phase) % 1);
  const s = c < 0.75 ? -1 + (c / 0.75) * 2 : 1 - ((c - 0.75) / 0.25) * 2;
  p.r.sh.rotation.x = -1.25 - s * 0.7;
  p.r.el.rotation.x = -0.45 - (s + 1) * 0.38;
  p.l.sh.rotation.x = -0.95; p.l.el.rotation.x = -0.55; p.l.sh.rotation.z = 0.15;
  p.neck.rotation.x = 0.35;
}

export function welding(p, t) {
  p.hips.position.y = 0.44;
  p.ll.hp.rotation.x = -1.9; p.ll.kn.rotation.x = 2.2;
  p.rl.hp.rotation.x = -1.6; p.rl.kn.rotation.x = 2.3;
  p.ll.ankle.rotation.x = -0.3; p.rl.ankle.rotation.x = -0.6;
  p.spine.rotation.x = 0.55;
  p.r.sh.rotation.x = -0.95 + Math.sin(t * 1.3) * 0.05; p.r.el.rotation.x = -0.55;
  p.r.hand.rotation.z = Math.sin(t * 7) * 0.05;
  p.l.sh.rotation.x = -1.05; p.l.el.rotation.x = -0.85;
  p.neck.rotation.x = 0.4;
}

export function painting(p, t, phase = 0) {
  const s = Math.sin(t * 2.2 + phase);
  p.r.sh.rotation.x = -2.0 - s * 0.55;
  p.r.el.rotation.x = -0.35 + s * 0.2;
  p.l.sh.rotation.x = -1.6 - s * 0.45; p.l.el.rotation.x = -0.45 + s * 0.15;
  p.l.sh.rotation.z = -0.25; p.r.sh.rotation.z = 0.12;
  p.spine.rotation.x = -0.05 + s * 0.04;
  p.neck.rotation.x = -0.25 - s * 0.15;
  p.ll.hp.rotation.x = 0.1; p.rl.hp.rotation.x = -0.15; p.rl.kn.rotation.x = 0.15;
}

export function reaching(p, t, amount, phase = 0) {
  const s = Math.sin(t * 1.6 + phase) * 0.06;
  p.l.sh.rotation.x = -0.25 - amount * 2.35 + s; p.r.sh.rotation.x = -0.25 - amount * 2.35 - s;
  p.l.sh.rotation.z = amount * 0.25; p.r.sh.rotation.z = -amount * 0.25;
  p.l.el.rotation.x = -0.4 * (1 - amount) - 0.1; p.r.el.rotation.x = -0.4 * (1 - amount) - 0.1;
  p.neck.rotation.x = -0.5 * amount;
  p.ll.hp.rotation.x = 0.12; p.rl.hp.rotation.x = -0.2; p.rl.kn.rotation.x = 0.25;
}

export function walking(p, t, speed = 1) {
  const w = t * 5.2 * speed;
  const s = Math.sin(w);
  p.ll.hp.rotation.x = s * 0.45; p.rl.hp.rotation.x = -s * 0.45;
  p.ll.kn.rotation.x = Math.max(0, -Math.sin(w - 0.9)) * 0.75; p.rl.kn.rotation.x = Math.max(0, Math.sin(w - 0.9)) * 0.75;
  p.ll.ankle.rotation.x = Math.max(0, Math.sin(w + 0.6)) * -0.35; p.rl.ankle.rotation.x = Math.max(0, -Math.sin(w + 0.6)) * -0.35;
  p.l.sh.rotation.x = -s * 0.38; p.r.sh.rotation.x = s * 0.38;
  p.l.sh.rotation.z = 0.06; p.r.sh.rotation.z = -0.06;
  p.l.el.rotation.x = -0.28 - Math.max(0, s) * 0.2; p.r.el.rotation.x = -0.28 - Math.max(0, -s) * 0.2;
  p.spine.rotation.y = s * 0.07;
  p.hips.rotation.y = -s * 0.06;
  p.hips.position.y = 0.97 + Math.abs(Math.cos(w)) * 0.025;
}

/** Carrying a plank / rebar on the right shoulder while walking. */
export function carrying(p, t, speed = 0.8) {
  walking(p, t, speed);
  p.r.sh.rotation.x = -2.6; p.r.sh.rotation.z = -0.35; p.r.el.rotation.x = -1.9;
  p.l.sh.rotation.x = -0.2 + Math.sin(t * 5.2 * speed) * 0.25;
  p.neck.rotation.z = 0.12;
}

/** Crouched tying rebar: hands twist the wire. */
export function tying(p, t) {
  p.hips.position.y = 0.4;
  p.ll.hp.rotation.x = -2.0; p.ll.kn.rotation.x = 2.3; p.rl.hp.rotation.x = -1.8; p.rl.kn.rotation.x = 2.4;
  p.spine.rotation.x = 0.85;
  p.l.sh.rotation.x = -0.6; p.r.sh.rotation.x = -0.6; p.l.el.rotation.x = -0.3; p.r.el.rotation.x = -0.3;
  p.r.hand.rotation.y = Math.sin(t * 9) * 0.9;
  p.l.hand.rotation.y = Math.sin(t * 9 + 1) * 0.3;
  p.neck.rotation.x = 0.5;
}

/** Looking through a levelling instrument on a tripod. */
export function surveying(p, t) {
  p.spine.rotation.x = 0.32;
  p.neck.rotation.x = 0.15;
  p.r.sh.rotation.x = -1.2; p.r.el.rotation.x = -0.9; p.r.sh.rotation.z = 0.15;
  p.l.sh.rotation.x = -1.1 + Math.sin(t * 0.8) * 0.05; p.l.el.rotation.x = -1.0; p.l.sh.rotation.z = -0.15;
  p.ll.hp.rotation.x = 0.15; p.rl.hp.rotation.x = -0.15;
}

/** Tool meshes to put in a hand group. */
export function tool(kind) {
  const M = materials();
  const g = new THREE.Group();
  const wood = mat('toolWood', { color: 0x9a6b3c, roughness: 0.7 });
  const steel = M.steel;
  const add = (geo, m) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; g.add(mesh); return mesh; };
  if (kind === 'hammer') {
    add(cyl(0.012, 0.014, 0.32, 0, -0.13, 0.01, 8), wood);
    add(box(0.13, 0.035, 0.035, 0.01, -0.29, 0.01), steel);
    add(box(0.035, 0.03, 0.05, -0.065, -0.29, 0.01), steel);
  } else if (kind === 'torch') {
    const t = add(cyl(0.014, 0.011, 0.26, 0, -0.1, 0.04, 8), M.blackSteel);
    t.rotation.x = 0.9;
    add(cyl(0.006, 0.006, 0.05, 0, -0.2, 0.16, 6), steel);
  } else if (kind === 'roller') {
    add(cyl(0.012, 0.012, 0.7, 0, -0.3, 0, 8), M.blackSteel);
    const r = add(cyl(0.035, 0.035, 0.24, 0, -0.66, 0, 14), mat('rollerCover', { color: 0xe9e3d6, roughness: 0.95 }));
    r.rotation.z = Math.PI / 2;
    add(box(0.26, 0.012, 0.012, 0, -0.62, 0), steel);
  } else if (kind === 'level') {
    add(box(0.6, 0.05, 0.025, 0, -0.06, 0.03), mat('levelBody', { color: 0xf2c230, roughness: 0.4 }));
    add(box(0.05, 0.016, 0.026, 0, -0.035, 0.03), mat('levelVial', { color: 0x7fe08a, emissive: 0x1d5a24, roughness: 0.1 }));
  } else if (kind === 'plank') {
    add(box(0.18, 0.04, 2.6, 0, 0.08, 0.2), wood);
  } else if (kind === 'tablet') {
    add(box(0.24, 0.006, 0.17, 0, -0.04, 0.06), M.blackSteel);
  }
  return g;
}

/** Welding helmet that sits on top of the hard hat, visor down. */
export function weldingMask() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 10, -Math.PI * 0.45, Math.PI * 0.9, Math.PI * 0.3, Math.PI * 0.45), mat('mask', { color: 0x1d1e20, roughness: 0.5, side: THREE.DoubleSide }));
  shell.position.set(0, 0.1, 0.01);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.035), mat('maskGlass', { color: 0x203a2a, emissive: 0x0a2a14, roughness: 0.1 }));
  glass.position.set(0, 0.105, 0.135);
  g.add(shell, glass);
  return g;
}
