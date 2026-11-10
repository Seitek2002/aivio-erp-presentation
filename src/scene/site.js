import * as THREE from 'three';
import { floorTop } from './building.js';
import { materials, imageTexture, screenMaterial } from './materials.js';
import { person, hammering, welding, painting, reaching, tool } from './people.js';
import { box, cyl, smooth, lerp, rng } from './geo.js';
import { Kit } from './props.js';

/*
  Construction (slide 8): a tower crane swings a pallet of blocks onto the open deck of
  floor 11, two workers receive it, others weld rebar, nail formwork and paint a wall.
*/

export const DECK = floorTop(11);
const CRANE = new THREE.Vector3(25, 0, -17);
const DROP = new THREE.Vector3(5, DECK, -2);
const PICK = new THREE.Vector3(31, 0, -6);
const JIB_Y = 66;
const T = 16;

export function createSite({ images, anchors }) {
  const M = materials();
  const group = new THREE.Group();

  // ---------- crane ----------
  const crane = new THREE.Group();
  crane.position.copy(CRANE);
  const paint = new THREE.MeshStandardMaterial({ color: 0xd2e62e, roughness: 0.5, metalness: 0.25 });
  const mk = new Kit();
  const s = 1.1;
  for (const [x, z] of [[-s, -s], [s, -s], [s, s], [-s, s]]) mk.add(paint, box(0.18, JIB_Y, 0.18, x, JIB_Y / 2, z));
  for (let y = 1.5; y < JIB_Y; y += 2.2) {
    mk.add(paint, box(2.2, 0.1, 0.1, 0, y, s)); mk.add(paint, box(2.2, 0.1, 0.1, 0, y, -s));
    mk.add(paint, box(0.1, 0.1, 2.2, s, y, 0)); mk.add(paint, box(0.1, 0.1, 2.2, -s, y, 0));
  }
  mk.add(M.blackSteel, box(5, 1.2, 5, 0, 0.6, 0));
  mk.build(crane);
  const jib = new THREE.Group();
  jib.position.y = JIB_Y;
  const jk = new Kit();
  jk.add(paint, box(44, 0.2, 0.2, 14, 0.2, 0.7)); jk.add(paint, box(44, 0.2, 0.2, 14, 0.2, -0.7)); jk.add(paint, box(44, 0.2, 0.2, 14, 1.6, 0));
  jk.add(paint, box(14, 0.2, 0.2, -11, 0.2, 0.6)); jk.add(paint, box(14, 0.2, 0.2, -11, 0.2, -0.6));
  jk.add(paint, box(0.3, 6, 0.3, 0, 3, 0));
  for (let x = -16; x < 36; x += 2.4) jk.add(paint, box(0.08, 1.6, 0.08, x, 0.9, 0.35));
  jk.add(M.blackSteel, box(4, 2.4, 2.2, -15, -0.6, 0));
  jk.add(M.blackSteel, box(2.2, 2, 2, 1.6, -1.2, 1.4));
  jk.build(jib);
  crane.add(jib);
  const trolley = new THREE.Group();
  trolley.add(new THREE.Mesh(box(1.2, 0.5, 1.4, 0, -0.1, 0), M.blackSteel));
  jib.add(trolley);
  group.add(crane);

  // cable: unit cylinder scaled every frame — no vertex buffer is rewritten per frame
  const cable = new THREE.Mesh(cyl(0.025, 0.025, 1, 0, -0.5, 0, 6), M.steel);
  group.add(cable);
  const hook = new THREE.Mesh(box(0.7, 1.0, 0.7), M.blackSteel);
  group.add(hook);

  const pallet = new THREE.Group();
  const pk = new Kit();
  pk.add(M.plywood, box(1.6, 0.14, 1.2, 0, 0.07, 0));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) pk.add(M.concrete, box(0.5, 0.25, 0.55, -0.52 + i * 0.52, 0.27, -0.28 + j * 0.56));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) pk.add(M.concrete, box(0.5, 0.25, 0.55, -0.52 + i * 0.52, 0.53, -0.28 + j * 0.56));
  pk.build(pallet);
  group.add(pallet);
  const slingPts = [];
  for (const [x, z] of [[-0.7, 0.5], [0.7, 0.5], [-0.7, -0.5], [0.7, -0.5]]) slingPts.push(new THREE.Vector3(x, 0.66, z), new THREE.Vector3(0, 1.35 - 0.5, 0));
  const slings = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(slingPts), new THREE.LineBasicMaterial({ color: 0xffb02e }));
  pallet.add(slings);
  const stock = new THREE.Group();
  for (let i = 0; i < 3; i++) { const p = pallet.clone(); p.remove(p.children.find(c => c.isLineSegments)); p.position.set(PICK.x + 2 + i * 1.8, 0, PICK.z + 2.2); stock.add(p); }
  group.add(stock);
  const stockRef = stock;
  anchors.set('pallet', pallet);

  // ---------- deck props ----------
  const deck = new THREE.Group();
  deck.position.y = DECK;
  const dk = new Kit();
  const r = rng(21);
  for (const x of [-10, -4, 4, 10]) for (const z of [-5, 5]) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      dk.add(M.rebar, cyl(0.014, 0.014, 1.3 + r() * 0.3, x + Math.cos(a) * 0.2, 0.7, z + Math.sin(a) * 0.2, 5));
    }
    dk.add(M.plywood, box(0.6, 0.9, 0.04, x, 0.45, z + 0.32));
  }
  dk.add(M.plywood, box(1.4, 0.7, 1.2, -6.2, 0.35, 2.2));
  dk.add(M.plywood, box(2.4, 0.04, 1.2, -6.2, 0.72, 2.2));
  dk.add(M.concrete, box(1.8, 0.8, 1.0, -9.4, 0.4, -1.2));
  dk.add(M.concrete, box(2.8, 2.3, 0.22, 9.2, 1.15, 3.8));
  dk.build(deck);
  const paintMat = new THREE.MeshStandardMaterial({ color: 0xece7da, roughness: 0.6 });
  const painted = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.2), paintMat);
  painted.position.set(7.8, 1.15, 3.92);
  deck.add(painted);
  group.add(deck);

  // ---------- crew ----------
  const crew = [];
  const add = (opts, x, z, ry) => {
    const p = person({ hat: true, vest: true, ...opts });
    p.root.position.set(x, 0, z);
    p.root.rotation.y = ry;
    deck.add(p.root);
    crew.push(p);
    return p;
  };
  const welder = add({}, -4.7, -4.6, Math.PI / 2);
  welder.r.hand.add(tool('torch'));
  const hammerer = add({}, -6.2, 3.5, Math.PI);
  hammerer.r.hand.add(tool('hammer'));
  const painter = add({}, 8.6, 4.7, Math.PI);
  const roller = tool('roller');
  painter.r.hand.add(roller);
  const recvA = add({}, 3.6, -0.6, 2.3);
  const recvB = add({}, 6.6, -3.1, -0.6);
  const foreman = add({ vest: false }, 0.6, 2.8, -0.5);
  const tabTex = imageTexture(images.gantt);
  const tab = new THREE.Group();
  tab.add(new THREE.Mesh(box(0.3, 0.012, 0.2), M.blackSteel));
  const tabScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.175).rotateX(-Math.PI / 2), screenMaterial(tabTex));
  tabScreen.position.y = 0.007;
  tab.add(tabScreen);
  tab.rotation.x = 0.9;
  tab.position.set(0, 1.22, 0.32);
  foreman.root.add(tab);
  foreman.l.sh.rotation.x = -1.0; foreman.l.el.rotation.x = -0.9; foreman.r.sh.rotation.x = -0.9; foreman.r.el.rotation.x = -1.0;
  foreman.neck.rotation.x = 0.45;
  anchors.set('foreman', tab);
  const deckEdge = new THREE.Object3D(); deckEdge.position.set(14.6, 0.2, 6.5); deck.add(deckEdge);
  anchors.set('deckEdge', deckEdge);
  const welderA = new THREE.Object3D(); welderA.position.set(0, 0.2, 0); welder.neck.add(welderA);
  anchors.set('welder', welderA);

  // ---------- welding sparks ----------
  // sparks are simulated in the vertex shader from static random velocities: nothing is
  // uploaded per frame (rewriting a buffer the GPU is still using stalls the whole pipeline)
  const NS = 160;
  const sr = rng(77);
  const seeds = new Float32Array(NS * 4);
  for (let i = 0; i < NS; i++) {
    const a = sr() * Math.PI * 2, v = 0.8 + sr() * 2.2;
    seeds.set([Math.cos(a) * v, 1 + sr() * 2.2, Math.sin(a) * v, sr()], i * 4);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NS * 3), 3));
  sparkGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));
  const sparkMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uTip: { value: new THREE.Vector3() }, uOn: { value: 0 }, uFloor: { value: DECK }, uScale: { value: 1300 } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime; uniform vec3 uTip; uniform float uOn; uniform float uFloor; uniform float uScale;
      varying float vLife;
      void main() {
        float life = 0.35 + aSeed.w * 0.5;
        float t = mod(uTime + aSeed.w * 7.0, life);
        vec3 p = uTip + aSeed.xyz * t + vec3(0.0, -4.9 * t * t, 0.0);
        p.y = max(p.y, uFloor + 0.01);
        vLife = (1.0 - t / life) * uOn;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uOn > 0.0 ? clamp(0.05 * uScale / -mv.z, 1.0, 6.0) : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      varying float vLife;
      void main() {
        float d = 1.0 - smoothstep(0.2, 0.5, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vec3(3.0, 2.1, 0.95) * vLife * d, vLife * d);
      }`,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  group.add(sparks);
  const arc = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.85, 1).multiplyScalar(6), toneMapped: false }));
  group.add(arc);
  const tip = new THREE.Vector3();
  const torchTip = new THREE.Object3D(); torchTip.position.set(0, -0.2, 0.17); welder.r.hand.add(torchTip);

  // ---------- animation ----------
  const tmp = new THREE.Vector3();
  const angleTo = p => Math.atan2(-(p.z - CRANE.z), p.x - CRANE.x);
  const A_PICK = angleTo(PICK), A_DROP = angleTo(DROP);
  const R_PICK = Math.hypot(PICK.x - CRANE.x, PICK.z - CRANE.z), R_DROP = Math.hypot(DROP.x - CRANE.x, DROP.z - CRANE.z);
  const HIGH = DECK + 9;
  let jobT = 0, wasActive = false;

  function cycle(t) {
    // returns jib angle, trolley radius, hook height, pallet state ('hook' | 'deck' | 'gone')
    const ph = t % T;
    const seg = (a, b) => smooth(a, b, ph);
    let ang, rad, y, carry = 'hook';
    if (ph < 3.5) { const e = seg(0, 3.5); ang = lerp(A_PICK, A_DROP, e); rad = lerp(R_PICK, R_DROP, e); y = HIGH; }
    else if (ph < 6.5) { ang = A_DROP; rad = R_DROP; y = lerp(HIGH, DECK + 1.35, seg(3.5, 6.5)); }
    else if (ph < 9) { ang = A_DROP; rad = R_DROP; y = lerp(DECK + 1.35, HIGH, seg(7.2, 9)); carry = 'deck'; }
    else if (ph < 12.5) { const e = seg(9, 12.5); ang = lerp(A_DROP, A_PICK, e); rad = lerp(R_DROP, R_PICK, e); y = HIGH; carry = ph < 11 ? 'deck' : 'gone'; }
    else if (ph < 14) { ang = A_PICK; rad = R_PICK; y = lerp(HIGH, 1.35, seg(12.5, 14)); carry = 'gone'; }
    else { ang = A_PICK; rad = R_PICK; y = lerp(1.35, HIGH, seg(14.2, 16)); }
    return { ang, rad, y, carry, ph };
  }

  return {
    group,
    update(t, dt, s) {
      const active = s.crew > 0.001;
      group.visible = active || s.crane > 0.001;
      stockRef.visible = s.yard > 0.001;
      deck.visible = active;
      if (!group.visible) { wasActive = false; return; }
      if (active && !wasActive) jobT = 0.8; // start each visit mid-swing towards the tower
      wasActive = active;
      jobT += dt;
      crane.position.y = -80 + 80 * s.crane;
      const c = cycle(jobT);
      jib.rotation.y = c.ang;
      trolley.position.x = c.rad;
      trolley.updateMatrixWorld();
      jib.updateMatrixWorld();
      const top = trolley.getWorldPosition(tmp);
      const hx = top.x, hz = top.z;
      const hy = c.y + (crane.position.y);
      hook.position.set(hx, hy, hz);
      cable.position.set(hx, top.y - 0.3, hz);
      cable.scale.set(1, Math.max(0.01, top.y - 0.3 - (hy + 0.5)), 1);

      if (c.carry === 'hook') {
        pallet.visible = true; pallet.scale.setScalar(1);
        pallet.position.set(hx, hy - 1.35, hz);
        pallet.rotation.y = c.ang + 0.6;
      } else if (c.carry === 'deck') {
        pallet.visible = true;
        pallet.position.set(DROP.x, DECK, DROP.z);
        const shrink = c.ph > 10 ? smooth(11, 10, c.ph) : 1;
        pallet.scale.setScalar(Math.max(0.001, shrink));
      } else pallet.visible = false;
      slings.visible = c.carry === 'hook';

      if (!active) return;
      // receivers reach for the load as it comes down
      const near = c.carry === 'hook' && hy - DECK < 6 ? smooth(6, 2, hy - DECK) : 0;
      reaching(recvA, t, near, 0); reaching(recvB, t, near, 1.3);
      hammering(hammerer, t);
      painting(painter, t);
      welding(welder, t);
      painted.scale.x = 0.4 + ((t * 0.05) % 1) * 1.8;
      painted.position.x = 7.8 + (painted.scale.x - 1) * 0.5;

      // sparks: bursts while the torch is on
      const on = (t % 2.6) < 1.8;
      torchTip.getWorldPosition(tip);
      arc.position.copy(tip);
      arc.visible = on;
      arc.scale.setScalar(on ? 0.8 + Math.random() * 0.6 : 0.001);
      sparkMat.uniforms.uTime.value = t;
      sparkMat.uniforms.uTip.value.copy(tip);
      sparkMat.uniforms.uOn.value = on ? 1 : 0;
    },
  };
}
