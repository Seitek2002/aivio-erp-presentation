import * as THREE from 'three';
import { rng, box, cyl, roundedRect, outline, slabFromOutline, ribbon, mergeSafe } from './geo.js';
import { materials } from './materials.js';

/*
  Premium residential tower modelled after the demo project "Ала-Тоо Residence".
  14 floors: a double-height glazed lobby behind a bronze colonnade, 12 apartment floors with
  flowing limestone balconies (each slab ripples a little further round than the one below),
  and a top floor with the developer's office under a bronze crown with a lime light line.
*/

export const SLAB = 0.32;
export const MAIN = roundedRect(15, 9, 5);
export const LOBBY = roundedRect(13.4, 7.4, 3.4);
export const FLOORS = [];
{
  let y = 0;
  for (let i = 0; i < 14; i++) {
    const h = i === 0 ? 6.4 : i === 13 ? 4.2 : 3.4;
    FLOORS.push({ i, y, h, lobby: i === 0, top: i === 13 });
    y += h;
  }
}
export const TOP = FLOORS[13].y + FLOORS[13].h + SLAB;
export const floorMid = i => FLOORS[i].y + FLOORS[i].h * 0.55;
export const floorTop = i => FLOORS[i].y + SLAB; // walking surface of floor i

const PANELS = 56;
const APT_PANELS = 4;
const APT_SHIFT = 2; // apartments are centred on the front of the building
const PW = MAIN.P / PANELS;

/** Balcony depth: a slow wave travelling round the tower, shifted floor by floor. */
export function slabOffset(s, i) {
  if (i === 14) return 1.5; // roof
  const wave = 0.5 + 0.5 * Math.sin((2 * Math.PI * s) / (MAIN.P / 4) + i * 0.72);
  let d = 0.85 + 1.55 * wave;
  if (i === 1) { // canopy over the entrance
    const sf = ((s + MAIN.P / 2) % MAIN.P) - MAIN.P / 2;
    d = 1.9 + 3.6 * Math.exp(-((sf / 5.5) ** 2));
  }
  return d;
}

// demo apartments shown on the laptop's шахматка, pinned to real facade cells
export const FOCUS = {
  1131: { floor: 12, apt: 13, state: 2 },
  1122: { floor: 11, apt: 0, state: 0 },
  1125: { floor: 11, apt: 1, state: 1 },
};
const forced = new Map(Object.values(FOCUS).map(f => [f.floor * 100 + f.apt, f.state]));

class Quads {
  constructor() { this.p = []; this.n = []; this.uv = []; this.idx = []; this.attr = {}; this.count = 0; }
  quad(a, b, y0, y1, nrm, attrs) {
    const pts = [[a.x, y0, a.z, 0, 0], [b.x, y0, b.z, 1, 0], [b.x, y1, b.z, 1, 1], [a.x, y1, a.z, 0, 1]];
    for (const [x, y, z, u, v] of pts) {
      this.p.push(x, y, z); this.n.push(nrm.x, 0, nrm.z); this.uv.push(u, v);
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

const GLASS_VERT = /* glsl */ `
  attribute float aState; attribute float aLit; attribute float aSeed; attribute float aFloor; attribute float aApt; attribute float aSub;
  varying vec2 vUv; varying vec3 vW; varying vec3 vN;
  varying float vState; varying float vLit; varying float vSeed; varying float vFloor; varying float vApt; varying float vSub;
  #include <clipping_planes_pars_vertex>
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vState = aState; vLit = aLit; vSeed = aSeed; vFloor = aFloor; vApt = aApt; vSub = aSub;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <clipping_planes_vertex>
  }
`;

const GLASS_FRAG = /* glsl */ `
  uniform float uNight, uChess, uBuild, uFill, uFillAmt, uDim, uTime, uFocusAmt, uLobby;
  uniform vec3 uFocus;
  uniform vec2 uOpenA, uOpenB;
  uniform vec3 uFree, uBooked, uSold, uLime, uWarm;
  uniform float uPW, uRoomH;
  varying vec2 vUv; varying vec3 vW; varying vec3 vN;
  varying float vState; varying float vLit; varying float vSeed; varying float vFloor; varying float vApt; varying float vSub;
  #include <clipping_planes_pars_fragment>

  vec3 sky(vec3 r) {
    float t = clamp(r.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = mix(vec3(0.010, 0.011, 0.010), vec3(0.11, 0.13, 0.15), smoothstep(0.42, 0.85, t));
    c += vec3(0.55, 0.36, 0.18) * pow(1.0 - abs(r.y), 18.0) * 0.35;          // warm city glow on the horizon
    c += vec3(0.9, 0.7, 0.45) * pow(max(dot(r, normalize(vec3(-0.55, 0.1, 0.83))), 0.0), 40.0) * 0.4;
    return c;
  }
  float openAt(vec2 o) {
    float band = 1.0 - smoothstep(1.6, 2.6, abs(vW.y - o.x));
    float near = 1.0 - smoothstep(5.0, 20.0, distance(cameraPosition, vW));
    return band * near * o.y;
  }

  void main() {
    #include <clipping_planes_fragment>
    if (vW.y > uBuild) discard;
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 R = reflect(-V, N);

    float lobby = step(vFloor, 0.5);
    // interior light: warm cove at the ceiling, sheer curtains, a few cooler screens
    float on = max(step(1.0 - uNight * 0.44, vLit), lobby);
    float isFocus = (1.0 - step(0.5, abs(vApt - uFocus.x))) + (1.0 - step(0.5, abs(vApt - uFocus.y))) + (1.0 - step(0.5, abs(vApt - uFocus.z)));
    on *= mix(1.0, isFocus, uFocusAmt);
    float cove = smoothstep(0.88, 0.97, vUv.y) * (1.0 - smoothstep(0.97, 1.0, vUv.y));
    float grad = mix(0.35, 0.95, smoothstep(0.0, 0.9, vUv.y));
    float curtain = 0.78 + 0.22 * sin(vUv.x * 40.0 + vSeed * 20.0);
    vec3 warm = mix(uWarm, vec3(0.75, 0.82, 1.0), step(0.93, vSeed));
    vec3 interior = warm * on * (grad * curtain * 0.55 + cove * 1.6) * mix(0.8, 1.2, vSeed);
    interior *= mix(1.0, 1.45, lobby);

    // interior mapping: a ray-traced room (walls, floor, ceiling lamp, sofa, picture) behind the glass
    vec3 room = vec3(0.0);
    if (lobby < 0.5) {
      vec3 Rt = normalize(cross(vec3(0.0, 1.0, 0.0), N));
      vec3 vd = normalize(vW - cameraPosition);
      vec3 rd = vec3(dot(vd, Rt), vd.y, max(dot(vd, -N), 0.04));
      vec3 sz = vec3(uPW * 4.0, uRoomH, 5.5);
      vec3 p0 = vec3((vSub + vUv.x) * uPW, vUv.y * uRoomH, 0.0);
      vec3 tv = vec3(rd.x > 0.0 ? (sz.x - p0.x) / rd.x : -p0.x / min(rd.x, -1e-4),
                     rd.y > 0.0 ? (sz.y - p0.y) / rd.y : -p0.y / min(rd.y, -1e-4),
                     sz.z / rd.z);
      float t = min(tv.x, min(tv.y, tv.z));
      vec3 h = p0 + rd * t;
      vec3 wallC = mix(vec3(0.80, 0.72, 0.62), vec3(0.60, 0.65, 0.63), step(0.62, vSeed));
      wallC = mix(wallC, vec3(0.42, 0.36, 0.33), step(0.86, vSeed));
      vec3 c = wallC * 0.85;
      if (t == tv.z) {
        c = wallC;
        float sofa = step(h.y, 0.8) * step(sz.x * 0.22, h.x) * step(h.x, sz.x * 0.72);
        c = mix(c, mix(vec3(0.22, 0.2, 0.19), vec3(0.45, 0.38, 0.3), fract(vSeed * 13.0)), sofa);
        float pic = step(1.35, h.y) * step(h.y, 2.05) * step(sz.x * 0.38, h.x) * step(h.x, sz.x * 0.62);
        c = mix(c, vec3(0.12, 0.16, 0.2) + vec3(0.25, 0.15, 0.05) * fract(vSeed * 7.0), pic);
        float door = step(h.y, 2.1) * step(sz.x * 0.84, h.x) * step(h.x, sz.x * 0.97);
        c = mix(c, c * 0.6, door);
      } else if (t == tv.y) {
        c = rd.y < 0.0 ? vec3(0.34, 0.23, 0.15) * (0.85 + 0.15 * step(0.5, fract(h.x * 1.2))) : vec3(0.9, 0.87, 0.8);
      } else {
        float shelf = step(0.9, h.y) * step(h.y, 2.0) * step(1.2, h.z) * step(h.z, 3.4);
        c = mix(c, vec3(0.3, 0.22, 0.16), shelf * step(0.5, vSeed));
      }
      float lampD = length(h.xz - vec2(sz.x * 0.5, sz.z * 0.5));
      float light = (0.3 + 1.2 * exp(-lampD * 0.32)) * (0.55 + 0.45 * h.y / sz.y);
      vec3 roomLit = c * warm * light * (0.85 + 0.45 * uNight);
      if (t == tv.y && rd.y > 0.0) roomLit += warm * exp(-lampD * 1.4) * 2.4;
      vec3 roomDark = c * vec3(0.018, 0.022, 0.028) * (1.0 + 0.5 * vUv.y);
      room = mix(roomDark, roomLit, on);
      // sheer curtains gathered at the sides of each window
      float drape = smoothstep(0.82, 1.0, abs(vUv.x * 2.0 - 1.0)) * (0.7 + 0.3 * sin(vUv.x * 90.0));
      room = mix(room, vec3(0.86, 0.8, 0.7) * mix(0.06, 0.9, on) * grad, drape * 0.75);
    }

    vec3 glass = vec3(0.016, 0.017, 0.018);
    vec3 inner = lobby > 0.5 ? interior : room + interior * 0.12;
    vec3 col = mix(glass + inner, sky(R), 0.14 + 0.6 * fres);
    col += inner * 0.2;

    float fx = min(vUv.x, 1.0 - vUv.x);
    float frame = 1.0 - smoothstep(0.006, 0.02, fx);
    frame = max(frame, (1.0 - smoothstep(0.003, 0.008, abs(vUv.y - 0.08))) * (1.0 - lobby));
    frame = max(frame, (1.0 - smoothstep(0.002, 0.005, abs(fract(vUv.y * 3.0) - 0.0))) * lobby);

    if (uChess > 0.001) {
      vec3 sc = vState < -0.5 ? vec3(0.04) : (vState < 0.5 ? uFree : (vState < 1.5 ? uBooked : uSold));
      col = mix(col, sc * 0.8, uChess);
    }
    // the apartments picked on the laptop glow in their status colour
    if (uFocusAmt > 0.001 && isFocus > 0.5) {
      vec3 sc = vState < 0.5 ? uFree : (vState < 1.5 ? uBooked : vec3(1.0, 0.93, 0.82));
      float pulse = 0.85 + 0.15 * sin(uTime * 2.4 + vApt);
      col = mix(col, sc * (0.6 + 1.1 * grad) * pulse, uFocusAmt * 0.92);
    }
    // budget level
    float below = 1.0 - smoothstep(-0.05, 0.05, vW.y - uFill);
    float surface = 1.0 - smoothstep(0.0, 0.35, abs(vW.y - uFill));
    col = mix(col, mix(col, uLime * 0.55, 0.65), below * uFillAmt);
    col += uLime * surface * uFillAmt * 1.4;

    col = mix(col, col * 0.3 + vec3(0.03, 0.025, 0.02), frame * 0.9);
    col *= uDim;
    float open = max(openAt(uOpenA), openAt(uOpenB));
    float alpha = mix(1.0, 0.42, lobby * uLobby) * (1.0 - open);
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;

export function createBuilding() {
  const M = materials();
  const root = new THREE.Group();
  root.name = 'building';

  const buildPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 999);
  const ghostPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 999);
  const clip = [buildPlane];
  const stone = M.stone.clone(); stone.clippingPlanes = clip;
  const bronze = M.bronze.clone(); bronze.clippingPlanes = clip;
  const railGlass = M.railGlass.clone(); railGlass.clippingPlanes = clip; railGlass.side = THREE.FrontSide;
  const lime = M.lime.clone(); lime.clippingPlanes = clip;
  const warm = M.warmLight.clone(); warm.clippingPlanes = clip;
  const leafB = M.leaf.clone(); leafB.clippingPlanes = clip;

  const glassUniforms = {
    uNight: { value: 1 }, uChess: { value: 0 }, uBuild: { value: 999 }, uFill: { value: -10 }, uFillAmt: { value: 0 },
    uDim: { value: 1 }, uTime: { value: 0 }, uFocus: { value: new THREE.Vector3(-1, -1, -1) }, uFocusAmt: { value: 0 },
    uOpenA: { value: new THREE.Vector2(-100, 0) }, uOpenB: { value: new THREE.Vector2(-100, 0) }, uLobby: { value: 1 },
    uFree: { value: new THREE.Color(0xc4e62a) }, uBooked: { value: new THREE.Color(0xff9a1f) }, uSold: { value: new THREE.Color(0x3a3d36) },
    uLime: { value: new THREE.Color(0xd6f12b) }, uWarm: { value: new THREE.Color(0xffc483) },
    uPW: { value: PW }, uRoomH: { value: FLOORS[1].h - SLAB },
  };
  const glass = new THREE.ShaderMaterial({
    uniforms: glassUniforms, vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG,
    clipping: true, clippingPlanes: clip, toneMapped: false, transparent: false,
  });
  // only the lobby (see-through) and the office floor (camera flies in) need blending;
  // every other floor stays opaque so stacked facades are depth-rejected instead of overdrawn
  const glassOpen = glass.clone();
  glassOpen.uniforms = glassUniforms;
  glassOpen.clippingPlanes = clip;
  glassOpen.transparent = true;
  glassOpen.depthWrite = true;

  const rand = rng(1141);
  const floors = [];
  const apartments = [];
  const ghostSegs = [];

  for (const F of FLOORS) {
    const g = new THREE.Group();
    g.position.y = F.y;
    g.userData.baseY = F.y;
    const solid = [], metal = [], rail = [], lights = [], green = [];
    const quads = new Quads();
    const rr = F.lobby ? LOBBY : MAIN;
    const panelH = F.h - (F.lobby ? 0 : SLAB);
    const y0 = F.lobby ? 0 : SLAB;

    // slab (balcony) — lobby has none, its floor is the plaza
    if (!F.lobby) {
      const pts = outline(MAIN, 180, s => slabOffset(s, F.i));
      solid.push(slabFromOutline(pts, SLAB, 0));
      if (F.i <= 12) {
        rail.push(ribbon(pts, SLAB, 1.05, 0.08));
        metal.push(ribbon(pts, SLAB + 1.05, 0.05, 0.08));
      }
      // downlights in the soffit of this slab (they light the balcony below)
      if (F.i >= 2) {
        for (let k = 0; k < 180; k += 6) {
          const s0 = (k / 180) * MAIN.P;
          const p = MAIN.at(s0), d = slabOffset(s0, F.i) - 0.45;
          const disc = new THREE.CircleGeometry(0.075, 12);
          disc.rotateX(Math.PI / 2);
          disc.translate(p.x + p.nx * d, -0.004, p.z + p.nz * d);
          lights.push(disc);
        }
      }
      // planters with shrubs on the wide parts of the balcony
      if (F.i <= 12) {
        for (let k = 3; k < 180; k += 11) {
          const s0 = (k / 180) * MAIN.P;
          const d = slabOffset(s0, F.i);
          if (d < 1.7) continue;
          const p = MAIN.at(s0);
          const x = p.x + p.nx * (d - 0.55), z = p.z + p.nz * (d - 0.55);
          const pl = box(0.85, 0.38, 0.38);
          pl.rotateY(Math.atan2(p.nx, p.nz));
          pl.translate(x, SLAB + 0.19, z);
          solid.push(pl);
          for (let b = 0; b < 3; b++) {
            const bush = new THREE.IcosahedronGeometry(0.2 + rand() * 0.08, 1);
            bush.translate(x + (b - 1) * 0.26 * p.nz, SLAB + 0.5 + rand() * 0.1, z - (b - 1) * 0.26 * p.nx);
            green.push(bush);
          }
        }
      }
      if (F.i === 1) {
        // downlights under the canopy
        for (let k = -3; k <= 3; k++) lights.push(cyl(0.12, 0.12, 0.02, k * 1.6, -0.03, MAIN.B + 2.6, 12));
      }
    }
    if (F.top) {
      const roof = outline(MAIN, 180, s => slabOffset(s, 14));
      solid.push(slabFromOutline(roof, SLAB, F.h));
      // crown: bronze fins rising above the roof, a band, and a lime light line under it
      const crown = outline(MAIN, 180, () => 0.9);
      const ch = 3.2;
      for (let k = 0; k < PANELS; k += 2) {
        const p = MAIN.at(k * PW);
        const fin = box(0.12, ch, 0.42);
        fin.rotateY(Math.atan2(p.nx, p.nz));
        fin.translate(p.x + p.nx * 0.9, F.h + SLAB + ch / 2, p.z + p.nz * 0.9);
        metal.push(fin);
      }
      metal.push(ribbon(crown, F.h + SLAB + ch - 0.45, 0.45, 0));
      lights.push(ribbon(crown, F.h + SLAB + ch - 0.55, 0.07, -0.02));
      solid.push(box(7, 2.4, 5, 4, F.h + SLAB + 1.2, -2));
    }

    // glazing + mullions
    const panels = F.lobby ? 44 : PANELS;
    const pw = rr.P / panels;
    const aptStates = [], aptLit = [], aptSeed = [];
    for (let k = 0; k < panels; k++) {
      const a = rr.at(k * pw), b = rr.at((k + 1) * pw), m = rr.at((k + 0.5) * pw);
      const isDoor = F.lobby && Math.abs(m.x) < 2.6 && m.nz > 0.9;
      const nrm = { x: m.nx, z: m.nz };
      const apt = F.lobby ? -1 : Math.floor(((k + APT_SHIFT) % PANELS) / APT_PANELS);
      const id = F.lobby ? -1 : F.i * 100 + apt;
      if (!F.lobby && aptStates[apt] === undefined) {
        const v = rand();
        aptStates[apt] = forced.has(id) ? forced.get(id) : v < 0.56 ? 0 : v < 0.74 ? 1 : 2;
        aptLit[apt] = rand(); aptSeed[apt] = rand();
        const c = MAIN.at(((apt * APT_PANELS - APT_SHIFT + APT_PANELS / 2) % PANELS + PANELS) % PANELS * PW);
        apartments.push({ id, floor: F.i, apt, state: aptStates[apt], pos: new THREE.Vector3(c.x + c.nx * 0.2, y0 + panelH * 0.55, c.z + c.nz * 0.2), normal: new THREE.Vector3(c.nx, 0, c.nz) });
      }
      if (!isDoor) {
        quads.quad({ x: a.x, z: a.z }, { x: b.x, z: b.z }, y0, y0 + panelH - 0.02, nrm, {
          aState: F.lobby ? -1 : aptStates[apt], aLit: F.lobby ? 1 : aptLit[apt], aSeed: F.lobby ? rand() : aptSeed[apt], aFloor: F.i, aApt: id, aSub: F.lobby ? 0 : ((k + APT_SHIFT) % PANELS) % APT_PANELS,
        });
      }
      // mullion
      const mw = F.lobby ? 0.1 : 0.07;
      const mul = box(mw, panelH, F.lobby ? 0.18 : 0.26, 0, 0, 0);
      mul.rotateY(Math.atan2(a.nx, a.nz));
      mul.translate(a.x + a.nx * 0.08, y0 + panelH / 2, a.z + a.nz * 0.08);
      metal.push(mul);
    }

    if (F.lobby) {
      // colonnade on the line of the tower above
      for (let k = 0; k < 16; k++) {
        const p = MAIN.at((k / 16) * MAIN.P + MAIN.P / 32);
        metal.push(cyl(0.3, 0.3, F.h, p.x + p.nx * 0.6, F.h / 2, p.z + p.nz * 0.6, 20));
        lights.push(cyl(0.34, 0.34, 0.04, p.x + p.nx * 0.6, 0.03, p.z + p.nz * 0.6, 20));
      }
      // bronze portal around the entrance
      const z = LOBBY.B + 0.05;
      metal.push(box(0.3, 5.2, 0.5, -2.7, 2.6, z), box(0.3, 5.2, 0.5, 2.7, 2.6, z), box(5.7, 0.4, 0.5, 0, 5.2, z));
      lights.push(box(5.0, 0.05, 0.05, 0, 4.96, z + 0.24));
    }

    const add = (geos, mat, order) => {
      if (!geos.length) return null;
      const mesh = new THREE.Mesh(mergeSafe(geos), mat);
      if (order) mesh.renderOrder = order;
      g.add(mesh);
      return mesh;
    };
    add(solid, stone);
    add(green, leafB);
    add(metal, bronze);
    add(lights, F.top ? lime : warm);
    const glassMesh = new THREE.Mesh(quads.geometry(), F.lobby || F.top ? glassOpen : glass);
    glassMesh.renderOrder = 1;
    g.add(glassMesh);
    add(rail, railGlass, 2);
    root.add(g);
    floors.push(g);

    // blueprint outline for the construction slide
    const ring = outline(rr, 72, () => 0);
    for (const yy of [F.y, F.y + (F.lobby ? 0 : SLAB)]) {
      for (let k = 0; k < ring.length; k++) {
        const p = ring[k], q = ring[(k + 1) % ring.length];
        ghostSegs.push([p.x, yy, p.y], [q.x, yy, q.y]);
      }
    }
    for (let k = 0; k < PANELS; k += 4) {
      const p = rr.at((k / PANELS) * rr.P);
      ghostSegs.push([p.x, F.y, p.z], [p.x, F.y + F.h, p.z]);
    }
  }

  // entrance signage on the canopy
  const sign = createSign('ALA-TOO RESIDENCE');
  sign.position.set(0, FLOORS[1].y + SLAB + 0.55, MAIN.B + 5.2);
  root.add(sign);

  const ghostGeo = new THREE.BufferGeometry();
  ghostGeo.setAttribute('position', new THREE.Float32BufferAttribute(ghostSegs.flat(), 3));
  const ghostMat = new THREE.LineBasicMaterial({ color: 0xd6f12b, transparent: true, opacity: 0, depthWrite: false, clippingPlanes: [ghostPlane], toneMapped: false });
  const ghost = new THREE.LineSegments(ghostGeo, ghostMat);
  ghost.renderOrder = 3;
  root.add(ghost);

  const tmp = new THREE.Vector3();
  return {
    root, floors, apartments, glassUniforms,
    materials: { stone, bronze, glass, ghostMat },
    aptById: id => apartments.find(a => a.id === id),
    /** world position of an apartment's facade cell */
    aptWorld(id, out = tmp) {
      const a = apartments.find(x => x.id === id);
      return floors[a.floor].localToWorld(out.copy(a.pos));
    },
    setBuild(y, glassLag = 0) {
      // floors entirely above the build line are skipped, not clipped: clipping discards
      // per fragment, so unbuilt floors would still be rasterised in front of the camera
      for (const f of floors) f.visible = f.userData.baseY < y;
      buildPlane.constant = y;
      ghostPlane.constant = -y + 0.02;
      glassUniforms.uBuild.value = y - glassLag;
      sign.visible = y > FLOORS[1].y + 1;
    },
    setGhost(o) { ghostMat.opacity = o; ghost.visible = o > 0.001; },
  };
}

function createSign(text) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 192;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.font = '300 128px "Geologica Variable", "Inter Variable", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = '38px';
  const grd = g.createLinearGradient(0, 30, 0, 160);
  grd.addColorStop(0, '#f6dcae');
  grd.addColorStop(1, '#b88a52');
  g.fillStyle = grd;
  g.fillText(text, c.width / 2, c.height / 2 + 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.7, 1.55, 1.35) });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 0.98), mat);
  mesh.renderOrder = 4;
  return mesh;
}
