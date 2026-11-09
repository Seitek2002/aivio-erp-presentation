import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/*
  Procedural residential tower modelled after the demo project "Ала-Тоо Residence":
  14 floors — glazed lobby, 11 typical floors, a club floor and a set-back penthouse.
  Every floor is its own group so the tower can be "exploded" floor by floor.
*/

export const SLAB = 0.32;
export const FLOORS = [];
{
  let y = 0;
  for (let i = 0; i < 14; i++) {
    const lobby = i === 0;
    const pent = i === 13;
    const h = lobby ? 4.8 : pent ? 3.8 : 3.3;
    FLOORS.push({ i, y, h, w: pent ? 20 : 30, d: pent ? 12 : 16, ox: pent ? -3 : 0, lobby, pent });
    y += h;
  }
}
export const TOP = FLOORS[13].y + FLOORS[13].h + SLAB;
export const floorMid = i => FLOORS[i].y + FLOORS[i].h * 0.55;

// apartment status for the facade "шахматка": 0 free, 1 booked, 2 sold, -1 non-residential
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIDES = [
  { n: [0, 0, 1], r: [1, 0, 0], long: true },
  { n: [1, 0, 0], r: [0, 0, -1], long: false },
  { n: [0, 0, -1], r: [-1, 0, 0], long: true },
  { n: [-1, 0, 0], r: [0, 0, 1], long: false },
];

class QuadBuffer {
  constructor() { this.p = []; this.n = []; this.uv = []; this.idx = []; this.attr = {}; this.count = 0; }
  quad(c, r, u, nrm, w, h, attrs) {
    const hw = w / 2, hh = h / 2;
    const pts = [[-hw, -hh, 0, 0], [hw, -hh, 1, 0], [hw, hh, 1, 1], [-hw, hh, 0, 1]];
    for (const [a, b, s, t] of pts) {
      this.p.push(c.x + r.x * a + u.x * b, c.y + r.y * a + u.y * b, c.z + r.z * a + u.z * b);
      this.n.push(nrm.x, nrm.y, nrm.z);
      this.uv.push(s, t);
      for (const k in attrs) (this.attr[k] ||= []).push(attrs[k]);
    }
    const o = this.count;
    this.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    this.count += 4;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    for (const k in this.attr) g.setAttribute(k, new THREE.Float32BufferAttribute(this.attr[k], 1));
    g.setIndex(this.idx);
    return g;
  }
}

function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

const GLASS_VERT = /* glsl */ `
  attribute float aState;
  attribute float aLit;
  attribute float aSeed;
  attribute float aFloor;
  varying vec2 vUv;
  varying vec3 vW;
  varying vec3 vN;
  varying float vState;
  varying float vLit;
  varying float vSeed;
  varying float vFloor;
  #include <clipping_planes_pars_vertex>
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vState = aState; vLit = aLit; vSeed = aSeed; vFloor = aFloor;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <clipping_planes_vertex>
  }
`;

const GLASS_FRAG = /* glsl */ `
  uniform float uNight;
  uniform float uChess;
  uniform float uBuild;
  uniform float uFill;
  uniform float uFillAmt;
  uniform float uHiFloor;
  uniform float uHi;
  uniform float uDim;
  uniform float uTime;
  uniform vec3 uFree;
  uniform vec3 uBooked;
  uniform vec3 uSold;
  uniform vec3 uLime;
  uniform vec3 uWarm;
  varying vec2 vUv;
  varying vec3 vW;
  varying vec3 vN;
  varying float vState;
  varying float vLit;
  varying float vSeed;
  varying float vFloor;
  #include <clipping_planes_pars_fragment>

  vec3 sky(vec3 r) {
    float t = clamp(r.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = mix(vec3(0.012, 0.014, 0.011), vec3(0.16, 0.19, 0.2), smoothstep(0.38, 0.8, t));
    c += vec3(0.55, 0.42, 0.28) * pow(max(dot(r, normalize(vec3(-0.55, 0.12, 0.8))), 0.0), 24.0) * 0.5;
    return c;
  }

  void main() {
    #include <clipping_planes_fragment>
    if (vW.y > uBuild) discard;
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    float ndv = max(dot(N, V), 0.0);
    float fres = pow(1.0 - ndv, 3.0);
    vec3 R = reflect(-V, N);

    // window frame: transom + jambs
    float fx = min(vUv.x, 1.0 - vUv.x);
    float frame = 1.0 - smoothstep(0.012, 0.03, fx);
    frame = max(frame, 1.0 - smoothstep(0.004, 0.012, abs(vUv.y - 0.86)));

    // interior light
    float on = step(1.0 - uNight * 0.46, vLit);
    float ceil = mix(0.55, 1.0, smoothstep(0.1, 0.95, vUv.y));
    float curtain = 0.75 + 0.25 * step(0.5, fract(vSeed * 7.0 + vUv.x * (1.0 + floor(vSeed * 3.0))));
    vec3 warm = uWarm * mix(0.75, 1.15, vSeed);
    vec3 interior = warm * on * ceil * curtain * (0.55 + 0.6 * uNight);

    vec3 glass = vec3(0.018, 0.024, 0.026);
    vec3 refl = sky(R);
    vec3 col = mix(glass + interior, refl, 0.22 + 0.6 * fres);
    col += interior * 0.35;

    // apartment status (шахматка)
    if (uChess > 0.001) {
      vec3 sc = vState < -0.5 ? vec3(0.06) : (vState < 0.5 ? uFree : (vState < 1.5 ? uBooked : uSold));
      float edge = smoothstep(0.03, 0.08, fx) * smoothstep(0.02, 0.07, min(vUv.y, 1.0 - vUv.y));
      vec3 cc = sc * mix(0.55, 1.0, edge) * (0.9 + 0.2 * vUv.y);
      col = mix(col, cc, uChess);
    }

    // floor highlight
    float hi = uHi * (1.0 - step(0.5, abs(vFloor - uHiFloor)));
    col = mix(col, uLime * (0.65 + 0.35 * vUv.y), hi * 0.85);

    // budget fill
    float below = 1.0 - smoothstep(-0.05, 0.05, vW.y - uFill);
    float surface = 1.0 - smoothstep(0.0, 0.35, abs(vW.y - uFill));
    col = mix(col, mix(col, uLime * 0.6, 0.65), below * uFillAmt);
    col += uLime * surface * uFillAmt * 0.9;

    col = mix(col, col * 0.4 + vec3(0.02), frame * 0.85);
    col *= uDim;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createBuilding() {
  const root = new THREE.Group();
  root.name = 'building';

  const buildPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 999);
  const ghostPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 999);

  const concrete = new THREE.MeshStandardMaterial({ color: 0xcfcabd, roughness: 0.85, metalness: 0, clippingPlanes: [buildPlane] });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3c34, roughness: 0.5, metalness: 0.45, clippingPlanes: [buildPlane] });
  const railing = new THREE.MeshBasicMaterial({ color: 0x9db0b4, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: [buildPlane] });
  const accent = new THREE.MeshBasicMaterial({ color: 0xd6f12b, toneMapped: false, clippingPlanes: [buildPlane] });

  const glassUniforms = {
    uNight: { value: 1 },
    uChess: { value: 0 },
    uBuild: { value: 999 },
    uFill: { value: -10 },
    uFillAmt: { value: 0 },
    uHiFloor: { value: -10 },
    uHi: { value: 0 },
    uDim: { value: 1 },
    uTime: { value: 0 },
    uFree: { value: new THREE.Color(0xc4e62a) },
    uBooked: { value: new THREE.Color(0xff9a1f) },
    uSold: { value: new THREE.Color(0x3a3d36) },
    uLime: { value: new THREE.Color(0xd6f12b) },
    uWarm: { value: new THREE.Color(0xffc988) },
  };
  const glass = new THREE.ShaderMaterial({
    uniforms: glassUniforms,
    vertexShader: GLASS_VERT,
    fragmentShader: GLASS_FRAG,
    clipping: true,
    clippingPlanes: [buildPlane],
    toneMapped: false,
  });

  const floors = [];
  const ghostSegs = [];
  const apartments = []; // anchors for labels {floor, side, pos, normal, state}
  const rand = rng(1141);

  for (const F of FLOORS) {
    const g = new THREE.Group();
    g.position.y = F.y;
    g.userData.baseY = F.y;
    const solid = [];
    const dark = [];
    const rail = [];
    const glassBuf = new QuadBuffer();
    const { w, d, h, ox } = F;
    const finW = F.lobby ? 0.4 : 0.16;
    const finD = F.lobby ? 0.45 : 0.36;

    // floor slab with a thin shadow gap
    solid.push(box(w + 0.7, SLAB, d + 0.7, ox, SLAB / 2, 0));
    if (F.i === 12 || F.i === 13) solid.push(box(w + 0.7, SLAB - 0.04, d + 0.7, ox, h + (SLAB - 0.04) / 2, 0));

    const panelH = h - SLAB;
    const cy = SLAB + panelH / 2;

    SIDES.forEach((S, si) => {
      const L = S.long ? w : d;
      const depth = S.long ? d : w;
      const n = new THREE.Vector3(...S.n);
      const r = new THREE.Vector3(...S.r);
      const up = new THREE.Vector3(0, 1, 0);
      const bays = F.lobby ? Math.round(L / 3.75) : Math.max(3, Math.round(L / 3));
      const bw = L / bays;
      const face = new THREE.Vector3(ox, 0, 0).addScaledVector(n, depth / 2);
      const aptStates = [];
      for (let k = 0; k < bays; k++) {
        const apt = Math.floor(k / 2);
        if (aptStates[apt] === undefined) {
          const v = rand();
          aptStates[apt] = F.lobby ? -1 : v < 0.58 ? 0 : v < 0.75 ? 1 : 2;
        }
        const along = -L / 2 + bw * (k + 0.5);
        const c = face.clone().addScaledVector(r, along).addScaledVector(n, -0.18);
        c.y = cy;
        glassBuf.quad(c, r, up, n, bw - finW, panelH, {
          aState: aptStates[apt],
          aLit: F.lobby ? 1 : rand(),
          aSeed: rand(),
          aFloor: F.i,
        });
        if (k % 2 === 0 && !F.lobby) {
          const ac = face.clone().addScaledVector(r, -L / 2 + bw * (k + 1)).addScaledVector(n, 0.4);
          ac.y = cy; // floor-local; resolved through the floor group's matrix
          apartments.push({ floor: F.i, side: si, pos: ac, normal: n.clone(), state: aptStates[apt] });
        }
      }
      // fins
      for (let k = 0; k <= bays; k++) {
        const p = face.clone().addScaledVector(r, -L / 2 + bw * k).addScaledVector(n, finD / 2 - 0.2);
        const fw = S.long ? finW : finD;
        const fd = S.long ? finD : finW;
        dark.push(box(fw, panelH, fd, p.x, cy, p.z));
      }
      // balconies on long sides of typical floors
      if (S.long && !F.lobby && !F.pent) {
        for (let k = 0; k + 1 < bays; k += 2) {
          if ((k / 2 + F.i + si) % 2 !== 0) continue;
          const along = -L / 2 + bw * (k + 1);
          const bwid = bw * 2 - 0.35;
          const p = face.clone().addScaledVector(r, along).addScaledVector(n, 0.85);
          solid.push(box(S.long ? bwid : 1.7, 0.2, S.long ? 1.7 : bwid, p.x, 0.1, p.z));
          const rp = face.clone().addScaledVector(r, along).addScaledVector(n, 1.66);
          const railGeo = new THREE.PlaneGeometry(bwid, 1.05);
          railGeo.lookAt(n);
          railGeo.translate(rp.x, 0.2 + 0.525, rp.z);
          rail.push(railGeo);
          dark.push(box(S.long ? bwid : 0.06, 0.06, S.long ? 0.06 : bwid, rp.x, 1.27, rp.z));
        }
      }
    });

    // terrace railing on the club floor roof
    if (F.i === 12) {
      const y = h + 0.3;
      const e = 0.3;
      for (const [len, x, z, rot] of [[w + 0.4, 0, d / 2 + e, 0], [w + 0.4, 0, -d / 2 - e, Math.PI], [d + 0.4, w / 2 + e, 0, Math.PI / 2], [d + 0.4, -w / 2 - e, 0, -Math.PI / 2]]) {
        const rg = new THREE.PlaneGeometry(len, 1.0);
        rg.rotateY(rot);
        rg.translate(x, y + 0.5, z);
        rail.push(rg);
      }
    }

    // lobby: canopy + accent strip
    if (F.lobby) {
      solid.push(box(13, 0.36, 4.2, 0, 4.25, d / 2 + 2.1));
      const strip = new THREE.Mesh(new THREE.BoxGeometry(13, 0.06, 0.06), accent);
      strip.position.set(0, 4.05, d / 2 + 4.2);
      g.add(strip);
    }

    // penthouse crown
    if (F.pent) {
      const cyTop = h + SLAB;
      const frameH = 2.6;
      const cw = w + 2.4, cd = d + 2.4;
      for (const [x, z] of [[-cw / 2, -cd / 2], [cw / 2, -cd / 2], [cw / 2, cd / 2], [-cw / 2, cd / 2]]) dark.push(box(0.35, frameH, 0.35, ox + x, cyTop + frameH / 2, z));
      dark.push(box(cw + 0.35, 0.35, 0.35, ox, cyTop + frameH, cd / 2));
      dark.push(box(cw + 0.35, 0.35, 0.35, ox, cyTop + frameH, -cd / 2));
      dark.push(box(0.35, 0.35, cd + 0.35, ox + cw / 2, cyTop + frameH, 0));
      dark.push(box(0.35, 0.35, cd + 0.35, ox - cw / 2, cyTop + frameH, 0));
      const crown = new THREE.Mesh(mergeGeometries([
        box(cw, 0.07, 0.07, ox, cyTop + frameH - 0.24, cd / 2 + 0.2),
        box(cw, 0.07, 0.07, ox, cyTop + frameH - 0.24, -cd / 2 - 0.2),
        box(0.07, 0.07, cd, ox + cw / 2 + 0.2, cyTop + frameH - 0.24, 0),
        box(0.07, 0.07, cd, ox - cw / 2 - 0.2, cyTop + frameH - 0.24, 0),
      ]), accent);
      g.add(crown);
      // rooftop plant room
      solid.push(box(6, 2.2, 4.5, ox + 4, cyTop + 1.1, -1.5));
    }

    const solidMesh = new THREE.Mesh(mergeGeometries(solid), concrete);
    const darkMesh = new THREE.Mesh(mergeGeometries(dark), metal);
    const glassMesh = new THREE.Mesh(glassBuf.geometry(), glass);
    g.add(glassMesh, darkMesh, solidMesh);
    if (rail.length) {
      const railMesh = new THREE.Mesh(mergeGeometries(rail), railing);
      railMesh.renderOrder = 2;
      g.add(railMesh);
    }
    root.add(g);
    floors.push(g);

    // blueprint ghost: outlines and column lines
    const y0 = F.y, y1 = F.y + h;
    const hw = w / 2 + 0.35, hd = d / 2 + 0.35;
    const rect = yy => [[ox - hw, yy, -hd], [ox + hw, yy, -hd], [ox + hw, yy, -hd], [ox + hw, yy, hd], [ox + hw, yy, hd], [ox - hw, yy, hd], [ox - hw, yy, hd], [ox - hw, yy, -hd]];
    ghostSegs.push(...rect(y0), ...rect(y0 + SLAB));
    if (F.i === 12 || F.i === 13) ghostSegs.push(...rect(y1));
    const stepX = w / Math.max(3, Math.round(w / 3));
    for (let x = -w / 2; x <= w / 2 + 0.01; x += stepX * 2) {
      ghostSegs.push([ox + x, y0, hd], [ox + x, y1, hd], [ox + x, y0, -hd], [ox + x, y1, -hd]);
    }
    for (const z of [-d / 2, 0, d / 2]) ghostSegs.push([ox - hw, y0, z], [ox - hw, y1, z], [ox + hw, y0, z], [ox + hw, y1, z]);
  }

  const ghostGeo = new THREE.BufferGeometry();
  ghostGeo.setAttribute('position', new THREE.Float32BufferAttribute(ghostSegs.flat(), 3));
  const ghostMat = new THREE.LineBasicMaterial({ color: 0xd6f12b, transparent: true, opacity: 0, depthWrite: false, clippingPlanes: [ghostPlane], toneMapped: false });
  const ghost = new THREE.LineSegments(ghostGeo, ghostMat);
  ghost.renderOrder = 3;
  root.add(ghost);

  const crane = createCrane();
  crane.position.set(21, -80, -13);
  root.add(crane);

  const api = {
    root,
    floors,
    apartments,
    crane,
    glassUniforms,
    materials: { concrete, metal, railing, accent, glass, ghostMat },
    setBuild(y, glassLag = 0) {
      buildPlane.constant = y;
      ghostPlane.constant = -y + 0.02;
      glassUniforms.uBuild.value = y - glassLag;
    },
    setExplode(e, twist) {
      for (let i = 0; i < floors.length; i++) {
        const g = floors[i];
        const t = i / 13;
        g.position.y = g.userData.baseY + e * i * 2.6;
        g.rotation.y = e * twist * Math.sin(i * 1.7) * 0.22;
        g.position.x = e * Math.sin(i * 2.3) * 1.6;
        g.position.z = e * Math.cos(i * 1.3) * 1.2 * t;
      }
    },
    setGhost(o) { ghostMat.opacity = o; ghost.visible = o > 0.001; },
    setCrane(v, time) {
      crane.position.y = -80 + 80 * v;
      crane.visible = v > 0.001;
      crane.userData.jib.rotation.y = -0.6 + Math.sin(time * 0.12) * 0.5;
    },
  };
  return api;
}

function createCrane() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xd6f12b, roughness: 0.6, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d26, roughness: 0.7 });
  const H = 66;
  const parts = [];
  const s = 1.1;
  for (const [x, z] of [[-s, -s], [s, -s], [s, s], [-s, s]]) parts.push(box(0.16, H, 0.16, x, H / 2, z));
  for (let y = 1.5; y < H; y += 2.2) {
    parts.push(box(2.2, 0.1, 0.1, 0, y, s), box(2.2, 0.1, 0.1, 0, y, -s), box(0.1, 0.1, 2.2, s, y, 0), box(0.1, 0.1, 2.2, -s, y, 0));
  }
  const mast = new THREE.Mesh(mergeGeometries(parts), mat);
  g.add(mast);
  const base = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 5), dark);
  base.position.y = 0.6;
  g.add(base);

  const jib = new THREE.Group();
  jib.position.y = H;
  const jparts = [
    box(44, 0.18, 0.18, 14, 0.2, 0.7), box(44, 0.18, 0.18, 14, 0.2, -0.7), box(44, 0.18, 0.18, 14, 1.6, 0),
    box(14, 0.18, 0.18, -11, 0.2, 0.6), box(14, 0.18, 0.18, -11, 0.2, -0.6),
    box(0.3, 6, 0.3, 0, 3, 0),
  ];
  for (let x = -16; x < 36; x += 2.4) jparts.push(box(0.08, 1.6, 0.08, x, 0.9, 0.35));
  jib.add(new THREE.Mesh(mergeGeometries(jparts), mat));
  const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 2.2), dark);
  counter.position.set(-15, -0.6, 0);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 2), dark);
  cab.position.set(1.6, -1.2, 1.4);
  const trolley = new THREE.Group();
  trolley.position.set(24, 0, 0);
  const cableGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -26, 0)]);
  trolley.add(new THREE.Line(cableGeo, new THREE.LineBasicMaterial({ color: 0x9a9d92 })));
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.8), dark);
  hook.position.y = -26.6;
  trolley.add(hook);
  const load = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.6, 1.4), new THREE.MeshStandardMaterial({ color: 0x6f7368, roughness: 0.9 }));
  load.position.y = -28;
  trolley.add(load);
  jib.add(counter, cab, trolley);
  g.add(jib);
  g.userData.jib = jib;
  return g;
}
