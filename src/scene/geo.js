import * as THREE from 'three';

/** Deterministic PRNG so the model looks the same on every visit. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

export function cyl(rt, rb, h, x = 0, y = 0, z = 0, seg = 16) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y, z);
  return g;
}

/**
 * Rounded rectangle in the XZ plane, parametrised by arc length.
 * s = 0 is the middle of the front (+z) side; s grows towards +x (clockwise seen from above).
 */
export function roundedRect(A, B, R) {
  const sx = A - R, sz = B - R;
  const arc = Math.PI * R / 2;
  // segments in order starting from front-centre
  const segs = [
    { len: sx, f: t => [t * sx, B, 0, 1] },                                   // front, right half
    { len: arc, f: t => { const a = Math.PI / 2 - t * Math.PI / 2; return [sx + R * Math.cos(a), sz + R * Math.sin(a), Math.cos(a), Math.sin(a)]; } },
    { len: 2 * sz, f: t => [A, sz - t * 2 * sz, 1, 0] },                      // right
    { len: arc, f: t => { const a = -t * Math.PI / 2; return [sx + R * Math.cos(a), -sz + R * Math.sin(a), Math.cos(a), Math.sin(a)]; } },
    { len: 2 * sx, f: t => [sx - t * 2 * sx, -B, 0, -1] },                    // back
    { len: arc, f: t => { const a = -Math.PI / 2 - t * Math.PI / 2; return [-sx + R * Math.cos(a), -sz + R * Math.sin(a), Math.cos(a), Math.sin(a)]; } },
    { len: 2 * sz, f: t => [-A, -sz + t * 2 * sz, -1, 0] },                   // left
    { len: arc, f: t => { const a = Math.PI - t * Math.PI / 2; return [-sx + R * Math.cos(a), sz + R * Math.sin(a), Math.cos(a), Math.sin(a)]; } },
    { len: sx, f: t => [-sx + t * sx, B, 0, 1] },                             // front, left half
  ];
  const P = segs.reduce((a, s) => a + s.len, 0);
  /** point at arc length s → {x, z, nx, nz} */
  function at(s) {
    s = ((s % P) + P) % P;
    for (const seg of segs) {
      if (s <= seg.len || seg === segs[segs.length - 1]) {
        const [x, z, nx, nz] = seg.f(seg.len ? Math.min(1, s / seg.len) : 0);
        return { x, z, nx, nz };
      }
      s -= seg.len;
    }
    return null;
  }
  return { P, at, A, B, R };
}

/** Closed outline offset outward from a rounded rect by d(s). */
export function outline(rr, n, d) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const s = (i / n) * rr.P;
    const p = rr.at(s);
    const off = d(s);
    pts.push(new THREE.Vector2(p.x + p.nx * off, p.z + p.nz * off));
  }
  return pts;
}

/** Extruded horizontal slab from an outline (XZ), bottom at y. */
export function slabFromOutline(pts, thickness, y) {
  // Shape is drawn in XY, then rotated so Y→-Z (keeps outward winding)
  const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, -p.y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, steps: 1, curveSegments: 1,
    bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Vertical ribbon (quads) following a closed outline — railings, bands. */
export function ribbon(pts, y0, h, inset = 0) {
  const pos = [], nrm = [], uv = [], idx = [];
  const n = pts.length;
  let acc = 0;
  for (let i = 0; i <= n; i++) {
    const a = pts[i % n], b = pts[(i + 1) % n], c = pts[(i - 1 + n) % n];
    const tx = b.x - c.x, tz = b.y - c.y;
    const l = Math.hypot(tx, tz) || 1;
    const nx = -tz / l, nz = tx / l; // outward for our traversal (front-centre → +x)
    const x = a.x - nx * inset, z = a.y - nz * inset;
    if (i > 0) acc += Math.hypot(a.x - pts[i - 1].x, a.y - pts[i - 1].y);
    pos.push(x, y0, z, x, y0 + h, z);
    nrm.push(nx, 0, nz, nx, 0, nz);
    uv.push(acc / 4, 0, acc / 4, 1);
    if (i < n) {
      const o = i * 2;
      idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = x => Math.min(1, Math.max(0, x));

/** mergeGeometries that tolerates mixed indexed / non-indexed inputs and missing uvs. */
import { mergeGeometries as _merge } from 'three/addons/utils/BufferGeometryUtils.js';
export function mergeSafe(geos) {
  const mixed = geos.some(g => g.index) && geos.some(g => !g.index);
  const names = ['position', 'normal', 'uv'];
  const list = geos.map(g => {
    let x = mixed && g.index ? g.toNonIndexed() : g;
    if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
    if (!x.attributes.normal) x.computeVertexNormals();
    for (const k of Object.keys(x.attributes)) if (!names.includes(k)) x.deleteAttribute(k);
    for (const k of Object.keys(x.morphAttributes)) delete x.morphAttributes[k];
    return x;
  });
  return _merge(list);
}
