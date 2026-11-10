import * as THREE from 'three';
import { box, cyl, rng, mergeSafe } from './geo.js';
import { materials, screenMaterial } from './materials.js';

/** Collects geometries per material and emits one mesh per material. */
export class Kit {
  constructor() { this.parts = new Map(); }
  add(mat, geo) { if (!this.parts.has(mat)) this.parts.set(mat, []); this.parts.get(mat).push(geo); return this; }
  build(group = new THREE.Group()) {
    for (const [mat, geos] of this.parts) group.add(new THREE.Mesh(mergeSafe(geos), mat));
    return group;
  }
}

const rot = (g, x = 0, y = 0, z = 0) => { g.rotateX(x); g.rotateY(y); g.rotateZ(z); return g; };

export function desk(w = 2.6, d = 1.1) {
  const M = materials();
  const k = new Kit();
  k.add(M.walnut, box(w, 0.055, d, 0, 0.745, 0));
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.22);
    k.add(M.bronze, box(0.05, 0.69, 0.05, x, 0.37, d / 2 - 0.12));
    k.add(M.bronze, box(0.05, 0.69, 0.05, x, 0.37, -d / 2 + 0.12));
    k.add(M.bronze, box(0.05, 0.04, d - 0.2, x, 0.02, 0));
    k.add(M.bronze, box(0.05, 0.04, d - 0.2, x, 0.7, 0));
  }
  return k.build();
}

export function execChair() {
  const M = materials();
  const k = new Kit();
  k.add(M.leather, box(0.56, 0.11, 0.54, 0, 0.5, 0));
  k.add(M.leather, rot(box(0.54, 0.78, 0.09, 0, 0.42, 0), -0.14).translate(0, 0.55, -0.27));
  k.add(M.leather, box(0.07, 0.06, 0.4, -0.3, 0.68, 0.02));
  k.add(M.leather, box(0.07, 0.06, 0.4, 0.3, 0.68, 0.02));
  k.add(M.blackSteel, cyl(0.035, 0.035, 0.36, 0, 0.27, 0, 10));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.add(M.blackSteel, rot(box(0.05, 0.035, 0.34, 0, 0, 0.17), 0, a).translate(0, 0.07, 0));
  }
  return k.build();
}

export function meetingChair() {
  const M = materials();
  const k = new Kit();
  k.add(M.fabric, box(0.48, 0.08, 0.46, 0, 0.46, 0));
  k.add(M.fabric, rot(box(0.46, 0.44, 0.06), -0.1).translate(0, 0.72, -0.22));
  for (const [x, z] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) k.add(M.bronze, cyl(0.014, 0.014, 0.44, x, 0.22, z, 8));
  return k.build();
}

export function monitor(w, h, map) {
  const M = materials();
  const g = new THREE.Group();
  const bezel = new THREE.Mesh(box(w + 0.018, h + 0.018, 0.022), M.blackSteel);
  const mat = screenMaterial(map);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  screen.position.z = 0.0115;
  g.add(bezel, screen);
  return { group: g, screen, mat };
}

export function laptop(mapA, mapB) {
  const M = materials();
  const g = new THREE.Group();
  const k = new Kit();
  k.add(M.steel, box(0.34, 0.016, 0.235, 0, 0.008, 0));
  k.add(M.blackSteel, box(0.3, 0.002, 0.11, 0, 0.0165, -0.03));
  k.add(M.blackSteel, box(0.11, 0.002, 0.065, 0, 0.0165, 0.075));
  k.build(g);
  const lid = new THREE.Group();
  lid.position.set(0, 0.016, -0.1175);
  const shell = new THREE.Mesh(box(0.34, 0.222, 0.007, 0, 0.111, -0.0035), M.steel);
  const mat = screenMaterial(mapA, { mapB });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.318, 0.199), mat);
  screen.position.set(0, 0.113, 0.0006);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(0.334, 0.216), M.blackSteel);
  bezel.position.set(0, 0.111, 0.0002);
  lid.add(shell, bezel, screen);
  g.add(lid);
  return {
    group: g, lid, screen, mat,
    setOpen(t) { lid.rotation.x = THREE.MathUtils.lerp(Math.PI / 2 - 0.02, -0.3, t); },
  };
}

export function plant(h = 1.4, seed = 1) {
  const M = materials();
  const r = rng(seed);
  const k = new Kit();
  k.add(M.ceramic, cyl(0.22, 0.17, 0.42, 0, 0.21, 0, 20));
  k.add(M.darkBronze, cyl(0.2, 0.2, 0.02, 0, 0.42, 0, 20));
  k.add(M.rebar, cyl(0.02, 0.03, h * 0.55, 0, 0.42 + h * 0.27, 0, 6));
  for (let i = 0; i < 9; i++) {
    const l = new THREE.IcosahedronGeometry(0.16 + r() * 0.12, 0);
    l.scale(1, 0.6, 1);
    l.translate((r() - 0.5) * 0.55, 0.42 + h * (0.45 + r() * 0.55), (r() - 0.5) * 0.55);
    k.add(M.leaf, l);
  }
  return k.build();
}

export function floorLamp() {
  const M = materials();
  const k = new Kit();
  k.add(M.stone, cyl(0.2, 0.22, 0.06, 0, 0.03, 0, 20));
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, 2.3, 0.2), new THREE.Vector3(0, 1.95, 1.2));
  k.add(M.bronze, new THREE.TubeGeometry(curve, 24, 0.015, 6));
  const shade = new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  shade.translate(0, 1.88, 1.2);
  k.add(M.darkBronze, shade);
  k.add(M.warmLight, cyl(0.17, 0.17, 0.01, 0, 1.88, 1.2, 20));
  return k.build();
}

export function sofa(w = 2.2) {
  const M = materials();
  const k = new Kit();
  k.add(M.fabric, box(w, 0.38, 0.9, 0, 0.27, 0));
  k.add(M.fabric, box(w, 0.42, 0.18, 0, 0.62, -0.36));
  k.add(M.fabric, box(0.18, 0.28, 0.9, -w / 2 + 0.09, 0.56, 0));
  k.add(M.fabric, box(0.18, 0.28, 0.9, w / 2 - 0.09, 0.56, 0));
  k.add(M.bronze, box(w - 0.1, 0.06, 0.8, 0, 0.05, 0));
  return k.build();
}

export function shelfWall(w = 5, h = 3.6, seed = 2) {
  const M = materials();
  const r = rng(seed);
  const k = new Kit();
  k.add(M.walnutPanel, box(w, h, 0.06, 0, h / 2, 0));
  const tones = [M.paper, M.leather, M.fabric, M.ceramic, M.darkBronze];
  for (let row = 0; row < 4; row++) {
    const y = 0.55 + row * 0.72;
    k.add(M.walnut, box(w - 0.4, 0.035, 0.32, 0, y, 0.16));
    k.add(M.softLight, box(w - 0.5, 0.012, 0.012, 0, y - 0.025, 0.29));
    let x = -w / 2 + 0.35;
    while (x < w / 2 - 0.5) {
      if (r() < 0.55) {
        const n = 3 + Math.floor(r() * 6);
        for (let b = 0; b < n && x < w / 2 - 0.4; b++) {
          const bh = 0.22 + r() * 0.12;
          k.add(tones[Math.floor(r() * tones.length)], box(0.035, bh, 0.22, x, y + bh / 2 + 0.02, 0.15));
          x += 0.04;
        }
      } else if (r() < 0.5) {
        k.add(M.ceramic, cyl(0.07, 0.09, 0.26, x + 0.1, y + 0.15, 0.15, 14));
        x += 0.3;
      }
      x += 0.18 + r() * 0.3;
    }
  }
  return k.build();
}

export function artwork(w, h) {
  const M = materials();
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.round(512 * h / w);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, c.width, c.height);
  grd.addColorStop(0, '#2b2a26'); grd.addColorStop(0.55, '#6d5a43'); grd.addColorStop(1, '#d8c19a');
  g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(214,241,43,0.85)';
  g.beginPath(); g.arc(c.width * 0.68, c.height * 0.38, c.height * 0.16, 0, 7); g.fill();
  g.strokeStyle = 'rgba(240,232,215,0.5)'; g.lineWidth = 3;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, c.height * (0.62 + i * 0.05)); g.bezierCurveTo(c.width * 0.3, c.height * (0.5 + i * 0.04), c.width * 0.6, c.height * (0.8 + i * 0.03), c.width, c.height * (0.6 + i * 0.05)); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(box(w + 0.08, h + 0.08, 0.04), M.darkBronze));
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
  art.position.z = 0.021;
  grp.add(art);
  return grp;
}

export function wallScreen(w, h, map) {
  const M = materials();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(box(w + 0.08, h + 0.08, 0.06), M.blackSteel));
  const mat = screenMaterial(map, { brightness: 0.95 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  screen.position.z = 0.031;
  g.add(screen);
  return { group: g, screen, mat };
}

export function chandelier(r = 2.2) {
  const M = materials();
  const k = new Kit();
  for (let i = 0; i < 3; i++) {
    const t = new THREE.TorusGeometry(r - i * 0.55, 0.03, 8, 96);
    t.rotateX(Math.PI / 2);
    t.translate(0, -i * 0.38, 0);
    k.add(M.warmLight, t);
    const rim = new THREE.TorusGeometry(r - i * 0.55, 0.05, 8, 96);
    rim.rotateX(Math.PI / 2);
    rim.translate(0, -i * 0.38 + 0.06, 0);
    k.add(M.bronze, rim);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.add(M.bronze, cyl(0.006, 0.006, 1.6, Math.cos(a) * r, 0.8, Math.sin(a) * r, 4));
  }
  return k.build();
}

export function paperSheet(map, w = 0.21, h = 0.297) {
  const M = materials();
  const geo = new THREE.PlaneGeometry(w, h);
  geo.rotateX(-Math.PI / 2);
  const mat = map ? new THREE.MeshStandardMaterial({ map, roughness: 0.85 }) : M.paper;
  return new THREE.Mesh(geo, mat);
}

export function pen() {
  const M = materials();
  const k = new Kit();
  k.add(M.blackSteel, rot(cyl(0.0055, 0.0055, 0.14, 0, 0, 0, 10), 0, 0, Math.PI / 2));
  k.add(M.bronze, rot(cyl(0.006, 0.0035, 0.025, 0, 0, 0, 10), 0, 0, Math.PI / 2).translate(0.082, 0, 0));
  k.add(M.bronze, box(0.04, 0.002, 0.003, -0.04, 0.006, 0));
  return k.build();
}

export function cup() {
  const M = materials();
  const k = new Kit();
  k.add(M.ceramic, cyl(0.04, 0.032, 0.085, 0, 0.0425, 0, 18));
  k.add(M.ceramic, cyl(0.075, 0.07, 0.008, 0, 0.004, 0, 22));
  k.add(M.leather, cyl(0.036, 0.036, 0.002, 0, 0.083, 0, 18));
  return k.build();
}

export function tablet(map, w = 0.25, h = 0.17) {
  const M = materials();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(box(w + 0.014, 0.007, h + 0.014), M.blackSteel));
  const mat = screenMaterial(map);
  const geo = new THREE.PlaneGeometry(w, h);
  geo.rotateX(-Math.PI / 2);
  const screen = new THREE.Mesh(geo, mat);
  screen.position.y = 0.0036;
  g.add(screen);
  return { group: g, screen, mat };
}

/** Turnstile lane block: pedestals with glass flaps and Face ID terminals. */
export function turnstiles(lanes, faceMap) {
  const M = materials();
  const g = new THREE.Group();
  const k = new Kit();
  const lw = 0.92, L = 1.4;
  const flaps = [];
  const terms = [];
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe0e2, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
  for (let i = 0; i <= lanes; i++) {
    const x = (i - lanes / 2) * lw;
    k.add(M.steel, box(0.2, 1.0, L, x, 0.5, 0));
    k.add(M.blackSteel, box(0.21, 0.02, L + 0.01, x, 1.0, 0));
    k.add(M.lime, box(0.012, 0.012, L - 0.1, x + 0.1, 0.96, 0));
    k.add(M.lime, box(0.012, 0.012, L - 0.1, x - 0.1, 0.96, 0));
  }
  k.build(g);
  for (let i = 0; i < lanes; i++) {
    const cx = (i - (lanes - 1) / 2) * lw;
    const pair = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(cx + side * (lw / 2 - 0.1), 0.55, 0);
      const flap = new THREE.Mesh(box(0.34, 0.62, 0.012, -side * 0.17, 0.25, 0), glassMat);
      flap.renderOrder = 2;
      pivot.add(flap);
      pivot.userData.side = side;
      g.add(pivot);
      pair.push(pivot);
    }
    flaps.push(pair);
    // Face ID terminal on a post at the entry side (+z)
    const post = new THREE.Group();
    post.position.set(cx + lw / 2 - 0.1, 1.0, L / 2 - 0.12);
    post.add(new THREE.Mesh(cyl(0.012, 0.012, 0.28, 0, 0.14, 0, 8), M.blackSteel));
    post.add(new THREE.Mesh(box(0.11, 0.17, 0.02, 0, 0.34, 0), M.blackSteel));
    const mat = screenMaterial(faceMap, { brightness: 1.15 });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.15), mat);
    scr.position.set(0, 0.34, 0.0105);
    post.add(scr);
    post.rotation.y = -0.25;
    g.add(post);
    terms.push({ post, mat, screen: scr });
  }
  return {
    group: g, flaps, terms, laneWidth: lw,
    setOpen(lane, t) {
      for (const p of flaps[lane]) p.rotation.y = p.userData.side * t * 1.45;
    },
  };
}

/** Face ID terminal screen states drawn on canvas. */
export function faceTexture(state) {
  const c = document.createElement('canvas');
  c.width = 190; c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = '#0d0f0b'; g.fillRect(0, 0, c.width, c.height);
  const ok = state === 'ok';
  g.strokeStyle = ok ? '#5ed177' : '#d6f12b';
  g.lineWidth = 6;
  g.beginPath(); g.ellipse(95, 120, 52, 66, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = ok ? '#5ed177' : '#d6f12b';
  g.font = '700 22px "Inter Variable", sans-serif';
  g.textAlign = 'center';
  if (ok) {
    g.lineWidth = 9; g.beginPath(); g.moveTo(68, 122); g.lineTo(88, 142); g.lineTo(124, 100); g.stroke();
    g.fillText('Проход', 95, 232); g.font = '500 18px "Inter Variable", sans-serif'; g.fillText('07:48', 95, 262);
  } else {
    g.fillRect(40, 118, 110, 3);
    g.fillText('Face ID', 95, 232);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
