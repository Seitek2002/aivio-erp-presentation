import * as THREE from 'three';
import { floorTop, MAIN, slabOffset, FLOORS } from './building.js';
import { materials, imageTexture, screenMaterial } from './materials.js';
import { person, hammering, welding, painting, reaching, carrying, tying, surveying, tool, weldingMask } from './people.js';
import { box, cyl, smooth, lerp, rng, mergeSafe, outline } from './geo.js';
import { Kit } from './props.js';

/*
  Construction (slide 8). A detailed tower crane swings a pallet of blocks onto the open deck of
  floor 11; nine workers weld, nail formwork, paint, tie rebar, survey, carry planks and receive
  the load under two floodlight towers. Scaffolding hugs the façade, a mixer truck waits below.
*/

export const DECK = floorTop(11);
const CRANE = new THREE.Vector3(25, 0, -17);
const DROP = new THREE.Vector3(5, DECK, -2);
const PICK = new THREE.Vector3(31, 0, -6);
const JIB_Y = 66;
const T = 16;

const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
/** cylinder geometry spanning two points */
function strut(a, b, r = 0.05, seg = 6) {
  const d = v1.subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  q4.setFromUnitVectors(up, d.normalize());
  m4.compose(v2.addVectors(a, b).multiplyScalar(0.5), q4, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m4);
  return g;
}
/** instanced unit cylinders spanning point pairs */
function strutsInstanced(pairs, r, mat, seg = 6) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, seg, 1);
  const mesh = new THREE.InstancedMesh(geo, mat, pairs.length);
  pairs.forEach(([a, b], i) => {
    const d = v1.subVectors(b, a);
    const len = d.length();
    q4.setFromUnitVectors(up, d.normalize());
    m4.compose(v2.addVectors(a, b).multiplyScalar(0.5), q4, new THREE.Vector3(r, len, r));
    mesh.setMatrixAt(i, m4);
  });
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** cylinder lying along an axis, rotated before it is moved into place */
const rc = (r, h, ax, x, y, z, seg = 16) => { const g = new THREE.CylinderGeometry(r, r, h, seg); if (ax === 'x') g.rotateZ(Math.PI / 2); if (ax === 'z') g.rotateX(Math.PI / 2); g.translate(x, y, z); return g; };

function shadowAll(obj) {
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return obj;
}

export function createSite({ images, anchors }) {
  const M = materials();
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xd2e62e, roughness: 0.45, metalness: 0.3 });
  const dark = M.blackSteel;
  const concreteM = M.concrete;

  // =================== crane ===================
  const crane = new THREE.Group();
  crane.position.copy(CRANE);
  const ck = new Kit();
  // footing and ballast
  ck.add(concreteM, box(7, 1.2, 7, 0, 0.6, 0));
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) ck.add(concreteM, box(2.6, 1.0, 2.6, x, 1.7, z));
  // mast: four chords + horizontals + diagonals on every face
  const s = 0.9, SEC = 2.5;
  const mastStruts = [];
  for (const [x, z] of [[-s, -s], [s, -s], [s, s], [-s, s]]) ck.add(paint, box(0.18, JIB_Y - 2, 0.18, x, 2 + (JIB_Y - 2) / 2, z));
  for (let y = 2.2; y < JIB_Y - 1; y += SEC) {
    const faces = [[V(-s, 0, s), V(s, 0, s)], [V(s, 0, s), V(s, 0, -s)], [V(s, 0, -s), V(-s, 0, -s)], [V(-s, 0, -s), V(-s, 0, s)]];
    for (const [a, b] of faces) {
      mastStruts.push([a.clone().setY(y), b.clone().setY(y)]);
      mastStruts.push([a.clone().setY(y), b.clone().setY(y + SEC)]);
    }
  }
  crane.add(strutsInstanced(mastStruts, 0.045, paint));
  // climbing ladder inside the mast
  ck.add(dark, box(0.04, JIB_Y - 4, 0.04, 0.35, JIB_Y / 2, 0.6));
  ck.add(dark, box(0.04, JIB_Y - 4, 0.04, -0.35, JIB_Y / 2, 0.6));
  ck.build(crane);

  const jib = new THREE.Group();
  jib.position.y = JIB_Y;
  const jk = new Kit();
  jk.add(dark, cyl(1.4, 1.4, 0.6, 0, 0.3, 0, 24)); // slewing ring
  // cab with glazing
  const cabGlass = new THREE.MeshStandardMaterial({ color: 0x223038, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.6 });
  jk.add(paint, box(2.3, 2.2, 2.2, 1.6, 1.0, 1.9));
  jk.add(cabGlass, box(2.32, 1.1, 2.0, 1.75, 1.35, 1.95));
  // tower head (A-frame)
  const apex = V(0, 8, 0);
  const headStruts = [[V(-0.9, 0.6, -0.9), apex], [V(0.9, 0.6, -0.9), apex], [V(0.9, 0.6, 0.9), apex], [V(-0.9, 0.6, 0.9), apex]];
  // jib: triangular truss out along +x
  const L = 50, CJ = 15;
  const jibStruts = [];
  const chordA = x => V(x, 0.2, 0.85), chordB = x => V(x, 0.2, -0.85), chordT = x => V(x, 2.0, 0);
  jibStruts.push([chordA(1), chordA(L)], [chordB(1), chordB(L)], [chordT(1), chordT(L - 2)]);
  for (let x = 1; x < L - 1; x += 2) {
    jibStruts.push([chordA(x), chordT(x + 1)], [chordT(x + 1), chordA(x + 2)], [chordB(x), chordT(x + 1)], [chordT(x + 1), chordB(x + 2)], [chordA(x), chordB(x)]);
  }
  // counter-jib with walkway
  jibStruts.push([V(-1, 0.2, 0.8), V(-CJ, 0.2, 0.8)], [V(-1, 0.2, -0.8), V(-CJ, 0.2, -0.8)]);
  for (let x = -1; x > -CJ; x -= 2.5) jibStruts.push([V(x, 0.2, 0.8), V(x, 0.2, -0.8)], [V(x, 0.2, 0.8), V(x - 2.5, 0.2, -0.8)]);
  // pendant ties
  const ties = [[apex, chordT(32)], [apex, chordT(16)], [apex, V(-CJ + 1, 0.4, 0.7)], [apex, V(-CJ + 1, 0.4, -0.7)]];
  jib.add(strutsInstanced([...headStruts, ...jibStruts], 0.07, paint));
  jib.add(strutsInstanced(ties, 0.035, dark));
  jk.add(new THREE.MeshStandardMaterial({ color: 0x45484a, roughness: 0.6, metalness: 0.7 }), box(CJ - 2, 0.06, 1.4, -CJ / 2 - 0.5, 0.25, 0));
  for (let i = 0; i < 4; i++) jk.add(concreteM, box(1.0, 2.6, 2.0, -CJ + 1.2 + i * 1.1, -1.0, 0));
  jk.add(dark, rc(0.7, 1.6, 'z', -5, 1.0, 0, 18));
  jk.add(dark, box(2.0, 1.4, 1.6, -7, 1.0, 0));
  jk.build(jib);
  // aviation lights
  const redMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.08, 0.05).multiplyScalar(4), toneMapped: false });
  const redLights = [V(L, 0.6, 0), V(-CJ, 0.8, 0), V(0, 8.2, 0)].map(p => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), redMat); m.position.copy(p); jib.add(m); return m; });
  crane.add(jib);

  const trolley = new THREE.Group();
  const tk = new Kit();
  tk.add(dark, box(1.6, 0.3, 1.9, 0, -0.1, 0));
  for (const [x, z] of [[-0.6, 0.85], [0.6, 0.85], [-0.6, -0.85], [0.6, -0.85]]) tk.add(M.steel, rc(0.16, 0.08, 'z', x, 0.15, z, 14));
  for (const z of [-0.25, 0.25]) tk.add(M.steel, rc(0.25, 0.06, 'z', 0, -0.35, z, 18));
  tk.build(trolley);
  jib.add(trolley);
  group.add(crane);

  // hoist ropes (4 falls) and hook block
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8d9087, roughness: 0.4, metalness: 0.8 });
  const ropes = [-0.25, 0.25].flatMap(z => [-0.12, 0.12].map(x => { const m = new THREE.Mesh(cyl(0.018, 0.018, 1, 0, -0.5, 0, 6), ropeMat); m.userData.off = [x, z]; group.add(m); return m; }));
  const hook = new THREE.Group();
  const hk = new Kit();
  hk.add(paint, box(0.9, 0.9, 0.5, 0, 0, 0));
  for (const z of [-0.18, 0.18]) hk.add(M.steel, rc(0.3, 0.08, 'z', 0, 0.1, z, 18));
  hk.add(dark, cyl(0.07, 0.07, 0.4, 0, -0.6, 0, 10));
  hk.add(dark, new THREE.TorusGeometry(0.18, 0.05, 10, 24, Math.PI * 1.5).rotateZ(Math.PI * 0.75).translate(0, -0.95, 0));
  hk.build(hook);
  group.add(hook);

  // pallet of blocks with slings
  const pallet = new THREE.Group();
  const pk = new Kit();
  pk.add(M.plywood, box(1.6, 0.06, 1.2, 0, 0.12, 0));
  for (let i = 0; i < 3; i++) pk.add(M.plywood, box(1.6, 0.09, 0.1, 0, 0.045, -0.5 + i * 0.5));
  const blockMat = new THREE.MeshStandardMaterial({ color: 0xb7b2a6, roughness: 0.95 });
  for (let l = 0; l < 3; l++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) pk.add(blockMat, box(0.49, 0.24, 0.54, -0.52 + i * 0.52, 0.27 + l * 0.25, -0.28 + j * 0.56));
  pk.add(new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.2, transparent: true, opacity: 0.35 }), box(1.62, 0.76, 1.16, 0, 0.53, 0));
  pk.build(pallet);
  shadowAll(pallet);
  group.add(pallet);
  const slingPts = [];
  for (const [x, z] of [[-0.7, 0.5], [0.7, 0.5], [-0.7, -0.5], [0.7, -0.5]]) slingPts.push(V(x, 0.92, z), V(0, 1.35 - 0.2, 0));
  const slings = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(slingPts), new THREE.LineBasicMaterial({ color: 0xffb02e }));
  pallet.add(slings);
  const stock = new THREE.Group();
  for (let i = 0; i < 4; i++) { const p = pallet.clone(); p.remove(p.children.find(c => c.isLineSegments)); p.position.set(PICK.x + 2 + (i % 2) * 1.9, (i > 1 ? 0.92 : 0), PICK.z + 2.2); stock.add(p); }
  group.add(stock);
  anchors.set('pallet', pallet);

  // =================== mixer truck ===================
  const truck = new THREE.Group();
  truck.position.set(37, 0, 6);
  truck.rotation.y = -0.4;
  const trk = new Kit();
  const cabPaint = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.35, metalness: 0.2 });
  trk.add(dark, box(2.4, 0.5, 8.4, 0, 0.9, 0));
  trk.add(cabPaint, box(2.5, 2.1, 2.1, 0, 2.05, 3.4));
  trk.add(cabGlass, box(2.3, 0.9, 0.06, 0, 2.5, 4.46));
  trk.add(cabGlass, box(2.52, 0.8, 1.2, 0, 2.5, 3.6));
  for (const z of [3.2, -0.8, -2.4]) for (const x of [-1.15, 1.15]) trk.add(M.blackSteel, rc(0.52, 0.42, 'x', x, 0.55, z, 20));
  trk.add(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.8).multiplyScalar(3), toneMapped: false }), box(0.3, 0.16, 0.05, -0.9, 1.25, 4.47));
  trk.add(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.8).multiplyScalar(3), toneMapped: false }), box(0.3, 0.16, 0.05, 0.9, 1.25, 4.47));
  trk.add(dark, box(0.3, 0.9, 0.3, 0, 2.2, -4.2));
  trk.build(truck);
  const drum = new THREE.Group();
  drum.position.set(0, 2.6, -1.0);
  drum.rotation.x = -0.18;
  const drumGeo = new THREE.LatheGeometry([[0.4, -2.9], [1.25, -1.6], [1.35, -0.2], [1.2, 1.2], [0.55, 2.6]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  drumGeo.rotateX(Math.PI / 2);
  drum.add(new THREE.Mesh(drumGeo, new THREE.MeshStandardMaterial({ color: 0xe6e2d8, roughness: 0.4, metalness: 0.2 })));
  for (let i = 0; i < 6; i++) {
    const stripe = new THREE.TorusGeometry(1.31, 0.05, 6, 40, Math.PI * 0.7);
    stripe.rotateZ(i * 1.05);
    stripe.translate(0, 0, -0.9 + (i % 3) * 0.6);
    drum.add(new THREE.Mesh(stripe, paint));
  }
  truck.add(drum);
  shadowAll(truck);
  group.add(truck);

  // =================== scaffolding on the right façade, floors 8–11 ===================
  const scaff = [];
  const sx0 = 18.4, sx1 = 19.4;
  const y0 = FLOORS[8].y, y1 = DECK + 2;
  for (let z = -7; z <= 7.01; z += 2) for (const x of [sx0, sx1]) scaff.push([V(x, y0, z), V(x, y1, z)]);
  for (let y = y0 + 0.3; y <= y1; y += 2) {
    for (const x of [sx0, sx1]) scaff.push([V(x, y, -7), V(x, y, 7)]);
    for (let z = -7; z <= 7.01; z += 2) scaff.push([V(sx0, y, z), V(sx1, y, z)]);
  }
  for (let y = y0 + 0.3; y < y1 - 2; y += 2) for (let z = -7; z < 7; z += 4) scaff.push([V(sx1, y, z), V(sx1, y + 2, z + 2)]);
  const scaffMesh = strutsInstanced(scaff, 0.024, M.steel);
  group.add(scaffMesh);
  const boards = new Kit();
  for (let y = y0 + 0.33; y <= y1; y += 2) boards.add(M.plywood, box(1.0, 0.04, 14, (sx0 + sx1) / 2, y, 0));
  const net = new THREE.MeshStandardMaterial({ color: 0x2f6a3a, roughness: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  boards.add(net, new THREE.PlaneGeometry(14, y1 - y0).rotateY(Math.PI / 2).translate(sx1 + 0.15, (y0 + y1) / 2, 0));
  const boardMesh = shadowAll(boards.build());
  group.add(boardMesh);

  // =================== deck ===================
  const deck = new THREE.Group();
  deck.position.y = DECK;
  const dk = new Kit();
  const r = rng(21);
  const rebarM = M.rebar;
  // rebar mats (two layers, 20 cm grid)
  const mats = [];
  const mat = (x0, x1, z0, z1) => {
    for (let x = x0; x <= x1 + 1e-3; x += 0.2) mats.push([V(x, 0.12, z0), V(x, 0.12, z1)]);
    for (let z = z0; z <= z1 + 1e-3; z += 0.2) mats.push([V(x0, 0.15, z), V(x1, 0.15, z)]);
  };
  mat(-10.5, -2.5, -6.5, -1.5);
  mat(8.5, 13.5, -5.5, 0.5);
  deck.add(strutsInstanced(mats, 0.007, rebarM, 4));
  // column cages and formwork
  const cages = [];
  const cols = [[-10, -5], [-4, -5], [4, -5], [10, -5], [-10, 5], [-4, 5], [4, 5], [10, 5]];
  const stirrups = new THREE.TorusGeometry(0.23, 0.006, 4, 16);
  stirrups.rotateX(Math.PI / 2);
  const stirrupPos = [];
  cols.forEach(([x, z], i) => {
    if (i % 2 === 0) {
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; cages.push([V(x + Math.cos(a) * 0.22, 0, z + Math.sin(a) * 0.22), V(x + Math.cos(a) * 0.22, 2.6 + r() * 0.3, z + Math.sin(a) * 0.22)]); }
      for (let y = 0.2; y < 2.6; y += 0.2) stirrupPos.push([x, y, z]);
    } else {
      dk.add(M.plywood, box(0.62, 3.0, 0.62, x, 1.5, z));
      for (let y = 0.4; y < 3; y += 0.6) dk.add(dark, box(0.7, 0.06, 0.7, x, y, z));
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.78; cages.push([V(x + Math.cos(a) * 0.15, 3.0, z + Math.sin(a) * 0.15), V(x + Math.cos(a) * 0.15, 3.6, z + Math.sin(a) * 0.15)]); }
      // push-pull props
      dk.add(M.steel, strut(V(x, 2.2, z), V(x + 1.8, 0.02, z + 0.4), 0.03));
      dk.add(M.steel, strut(V(x, 2.2, z), V(x - 0.4, 0.02, z + 1.8), 0.03));
    }
  });
  deck.add(strutsInstanced(cages, 0.012, rebarM, 5));
  const stirMesh = new THREE.InstancedMesh(stirrups, rebarM, stirrupPos.length);
  stirrupPos.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); stirMesh.setMatrixAt(i, m4); });
  deck.add(stirMesh);
  // wall formwork with props
  dk.add(M.plywood, box(3.6, 2.6, 0.08, -6.2, 1.3, 1.6));
  dk.add(M.plywood, box(3.6, 2.6, 0.08, -6.2, 1.3, 1.92));
  for (const x of [-7.6, -6.2, -4.8]) { dk.add(dark, box(0.08, 2.6, 0.12, x, 1.3, 1.5)); dk.add(M.steel, strut(V(x, 2.0, 1.5), V(x, 0.02, -0.2), 0.03)); }
  // block wall being painted
  dk.add(new THREE.MeshStandardMaterial({ color: 0x9f9a8f, roughness: 0.95 }), box(2.8, 2.3, 0.22, 9.2, 1.15, 3.8));
  // stacks: plywood sheets, rebar bundle, cement bags
  for (let k = 0; k < 10; k++) dk.add(M.plywood, box(2.44, 0.018, 1.22, -9.4 + (r() - 0.5) * 0.04, 0.12 + k * 0.02, -0.4));
  dk.add(M.plywood, box(2.2, 0.1, 1.1, -9.4, 0.05, -0.4));
  const bundle = [];
  for (let k = 0; k < 40; k++) { const zz = 1.3 + (k % 8) * 0.035, yy = 0.08 + Math.floor(k / 8) * 0.035; bundle.push([V(-12.5, yy, zz), V(-6.5, yy, zz)]); }
  deck.add(strutsInstanced(bundle, 0.012, rebarM, 5));
  const bagMat = new THREE.MeshStandardMaterial({ color: 0xcbbd9b, roughness: 1 });
  for (let k = 0; k < 12; k++) { const bag = box(0.62, 0.15, 0.4, 0, 0, 0); bag.rotateY((r() - 0.5) * 0.1); bag.translate(12 + (k % 2) * 0.64, 0.2 + Math.floor(k / 4) * 0.16, 2.2 + (Math.floor(k / 2) % 2) * 0.42); dk.add(bagMat, bag); }
  dk.add(M.plywood, box(1.4, 0.12, 1.0, 12.3, 0.06, 2.4));
  // welding machine, wheelbarrow, ladder, buckets
  dk.add(new THREE.MeshStandardMaterial({ color: 0x2a5aa8, roughness: 0.5, metalness: 0.4 }), box(0.6, 0.55, 0.8, -6.3, 0.3, -3.2));
  dk.add(dark, box(0.4, 0.05, 0.4, -6.3, 0.6, -3.2));
  const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-6.0, 0.35, -3.0), V(-5.6, 0.02, -3.6), V(-5.0, 0.02, -4.1), V(-4.55, 0.55, -4.55)]), 30, 0.012, 6);
  dk.add(dark, cable);
  const barrow = new Kit();
  barrow.add(paint, (() => { const g = new THREE.CylinderGeometry(0.42, 0.28, 0.32, 16, 1, true); g.scale(1, 1, 1.4); return g; })());
  barrow.add(dark, rc(0.17, 0.06, 'x', 0, -0.18, 0.62, 14));
  barrow.add(dark, box(0.04, 0.04, 1.3, 0.25, -0.12, -0.25));
  barrow.add(dark, box(0.04, 0.04, 1.3, -0.25, -0.12, -0.25));
  const wb = barrow.build(); wb.position.set(1.8, 0.42, 4.2); wb.rotation.y = 0.7; deck.add(wb);
  const ladderK = new Kit();
  ladderK.add(M.steel, box(0.05, 3.2, 0.05, -0.22, 1.6, 0)); ladderK.add(M.steel, box(0.05, 3.2, 0.05, 0.22, 1.6, 0));
  for (let y = 0.3; y < 3.1; y += 0.3) ladderK.add(M.steel, box(0.44, 0.03, 0.03, 0, y, 0));
  const ladder = ladderK.build(); ladder.position.set(4, 0, -4.2); ladder.rotation.x = -0.25; deck.add(ladder);
  for (const [x, z] of [[-3, 3.6], [-2.6, 3.9], [11.2, 4.9]]) dk.add(new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6 }), cyl(0.15, 0.12, 0.3, x, 0.15, z, 14));
  // edge protection: posts, two rails and a toe board along the deck edge
  const edge = outline(MAIN, 120, s => slabOffset(s, 11) - 0.12);
  const rails = [];
  for (let i = 0; i < edge.length; i += 3) {
    const p = edge[i];
    rails.push([V(p.x, 0, p.y), V(p.x, 1.1, p.y)]);
  }
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], b = edge[(i + 1) % edge.length];
    rails.push([V(a.x, 1.1, a.y), V(b.x, 1.1, b.y)], [V(a.x, 0.55, a.y), V(b.x, 0.55, b.y)]);
  }
  deck.add(strutsInstanced(rails, 0.022, new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.45 }), 5));
  dk.build(deck);
  shadowAll(deck);

  // floodlight towers with real lights
  const flood = [];
  for (const [x, z, ry] of [[13.5, 6.5, -2.4], [-13.5, -6.5, 0.7]]) {
    const ft = new THREE.Group();
    ft.position.set(x, 0, z);
    ft.rotation.y = ry;
    const fk = new Kit();
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; fk.add(dark, strut(V(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8), V(0, 2.2, 0), 0.03)); }
    fk.add(dark, cyl(0.04, 0.04, 2.4, 0, 3.2, 0, 8));
    fk.add(dark, box(1.4, 0.06, 0.06, 0, 4.35, 0));
    fk.build(ft);
    for (const lx of [-0.5, 0.5]) {
      const head = new THREE.Group();
      head.position.set(lx, 4.35, 0.05);
      head.rotation.x = 0.55;
      head.add(new THREE.Mesh(box(0.45, 0.32, 0.18), dark));
      head.add(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.27).translate(0, 0, 0.092), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.96, 0.86).multiplyScalar(6), toneMapped: false })));
      ft.add(head);
    }
    const spot = new THREE.SpotLight(0xfff1d6, 0, 46, 0.85, 0.55, 1.4);
    spot.position.set(0, 4.4, 0.2);
    spot.target.position.set(0, 0, 6);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.02;
    ft.add(spot, spot.target);
    deck.add(ft);
    flood.push(spot);
  }

  // =================== crew ===================
  const crew = [];
  let seed = 40;
  const add = (opts, x, z, ry) => {
    const p = person({ outfit: 'worker', seed: seed++, ...opts });
    p.root.position.set(x, 0, z);
    p.root.rotation.y = ry;
    deck.add(p.root);
    crew.push(p);
    return p;
  };
  const welder = add({}, -4.65, -4.55, Math.PI / 2);
  welder.r.hand.add(tool('torch'));
  welder.head.add(weldingMask());
  const hammerer = add({}, -6.2, 3.35, Math.PI);
  hammerer.r.hand.add(tool('hammer'));
  const painter = add({}, 8.6, 4.75, Math.PI);
  painter.r.hand.add(tool('roller'));
  const recvA = add({}, 3.6, -0.6, 2.3);
  const recvB = add({}, 6.6, -3.1, -0.97);
  const tier = add({}, -6.4, -3.6, 0.2);
  const surveyor = add({}, 10.6, -1.9, 0.1);
  const carrier = add({}, -2, 4.6, Math.PI / 2);
  const plank = tool('plank');
  plank.rotation.set(0, 0, 0);
  carrier.r.hand.add(plank);
  const foreman = add({ foreman: true }, 0.6, 2.8, -0.5);
  // surveyor's tripod and instrument
  const tri = new Kit();
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; tri.add(new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.5 }), strut(V(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4), V(0, 1.35, 0), 0.015)); }
  tri.add(dark, box(0.2, 0.16, 0.3, 0, 1.45, 0));
  tri.add(M.steel, rc(0.035, 0.26, 'z', 0, 1.45, 0.05, 12));
  const tripod = shadowAll(tri.build()); tripod.position.set(10.6, 0, -1.1); deck.add(tripod);
  // tag line from receiver A to the load
  const tagMat = new THREE.MeshStandardMaterial({ color: 0xff3b2f, roughness: 0.6 });
  const tagLine = new THREE.Mesh(cyl(0.008, 0.008, 1, 0, -0.5, 0, 5), tagMat);
  group.add(tagLine);
  const recvHand = new THREE.Object3D(); recvHand.position.set(0, -0.1, 0); recvA.l.hand.add(recvHand);
  // foreman's tablet with the Gantt chart
  const tabTex = imageTexture(images.gantt);
  const tab = new THREE.Group();
  tab.add(new THREE.Mesh(box(0.3, 0.012, 0.2), dark));
  const tabScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.175).rotateX(-Math.PI / 2), screenMaterial(tabTex));
  tabScreen.position.y = 0.007;
  tab.add(tabScreen);
  tab.rotation.x = 0.9;
  tab.position.set(0, 1.24, 0.34);
  foreman.root.add(tab);
  foreman.l.sh.rotation.x = -1.0; foreman.l.el.rotation.x = -0.9; foreman.r.sh.rotation.x = -0.9; foreman.r.el.rotation.x = -1.0;
  foreman.neck.rotation.x = 0.45;
  anchors.set('foreman', tab);
  const deckEdge = new THREE.Object3D(); deckEdge.position.set(14.6, 0.2, 6.5); deck.add(deckEdge);
  anchors.set('deckEdge', deckEdge);
  const welderA = new THREE.Object3D(); welderA.position.set(0, 0.3, 0); welder.neck.add(welderA);
  anchors.set('welder', welderA);

  const painted = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.3), new THREE.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.6 }));
  painted.position.set(7.8, 1.15, 3.915);
  painted.receiveShadow = true;
  deck.add(painted);
  group.add(deck);

  // =================== welding sparks (GPU-simulated) + arc light ===================
  const NS = 220;
  const sr = rng(77);
  const seeds = new Float32Array(NS * 4);
  for (let i = 0; i < NS; i++) { const a = sr() * Math.PI * 2, v = 0.8 + sr() * 2.4; seeds.set([Math.cos(a) * v, 1 + sr() * 2.2, Math.sin(a) * v, sr()], i * 4); }
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
  const arc = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.85, 1).multiplyScalar(8), toneMapped: false }));
  group.add(arc);
  const arcLight = new THREE.PointLight(0xa8c8ff, 0, 7, 2);
  group.add(arcLight);
  const tip = new THREE.Vector3();
  const torchTip = new THREE.Object3D(); torchTip.position.set(0, -0.2, 0.17); welder.r.hand.add(torchTip);

  // =================== animation ===================
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const angleTo = p => Math.atan2(-(p.z - CRANE.z), p.x - CRANE.x);
  const A_PICK = angleTo(PICK), A_DROP = angleTo(DROP);
  const R_PICK = Math.hypot(PICK.x - CRANE.x, PICK.z - CRANE.z), R_DROP = Math.hypot(DROP.x - CRANE.x, DROP.z - CRANE.z);
  const HIGH = DECK + 9;
  let jobT = 0, wasActive = false;

  function cycle(t) {
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
      deck.visible = active;
      scaffMesh.visible = boardMesh.visible = active;
      stock.visible = truck.visible = s.yard > 0.001;
      for (const f of flood) f.intensity = 70 * s.crew;
      if (!group.visible) { wasActive = false; arcLight.intensity = 0; return; }
      if (active && !wasActive) jobT = 2.6;
      wasActive = active;
      jobT += dt;
      crane.position.y = -80 + 80 * s.crane;
      const c = cycle(jobT);
      jib.rotation.y = c.ang;
      trolley.position.x = c.rad;
      const blink = (t % 1.4) < 0.5;
      redLights.forEach(m => { m.visible = blink; });
      drum.rotation.z = t * 0.8;
      trolley.updateMatrixWorld(); jib.updateMatrixWorld();
      const top = trolley.getWorldPosition(tmp);
      const hx = top.x, hz = top.z;
      const hy = c.y + crane.position.y;
      hook.position.set(hx, hy, hz);
      hook.rotation.y = c.ang;
      const ropeLen = Math.max(0.01, top.y - 0.5 - (hy + 0.45));
      ropes.forEach(rp => { const [ox, oz] = rp.userData.off; rp.position.set(hx + ox, top.y - 0.5, hz + oz); rp.scale.set(1, ropeLen, 1); });

      if (c.carry === 'hook') {
        pallet.visible = true; pallet.scale.setScalar(1);
        pallet.position.set(hx, hy - 1.35 - 0.2, hz);
        pallet.rotation.y = c.ang + 0.6;
      } else if (c.carry === 'deck') {
        pallet.visible = true;
        pallet.position.set(DROP.x, DECK, DROP.z);
        const shrink = c.ph > 10 ? smooth(11, 10, c.ph) : 1;
        pallet.scale.setScalar(Math.max(0.001, shrink));
      } else pallet.visible = false;
      slings.visible = c.carry === 'hook';

      if (!active) { arcLight.intensity = 0; return; }
      const near = c.carry === 'hook' && hy - DECK < 7 ? smooth(7, 2.2, hy - DECK) : 0;
      reaching(recvA, t, near, 0); reaching(recvB, t, near, 1.3);
      // tag line from receiver A's hand to the pallet corner while the load comes down
      if (near > 0.05) {
        tagLine.visible = true;
        const a = recvHand.getWorldPosition(tmp2);
        const b = tmp.set(pallet.position.x + 0.7, pallet.position.y + 0.4, pallet.position.z + 0.5);
        tagLine.position.copy(b);
        tagLine.scale.set(1, a.distanceTo(b), 1);
        tagLine.quaternion.setFromUnitVectors(up, v1.subVectors(b, a).normalize());
      } else tagLine.visible = false;
      hammering(hammerer, t);
      painting(painter, t);
      welding(welder, t);
      tying(tier, t);
      surveying(surveyor, t);
      // carrier walks the plank back and forth along the formwork
      const cp = (t * 0.12) % 2;
      const leg = cp < 1 ? cp : 2 - cp;
      carrier.root.position.set(lerp(-1.5, -10, smooth(0, 1, leg)), 0, 4.6);
      carrier.root.rotation.y = cp < 1 ? -Math.PI / 2 : Math.PI / 2;
      carrying(carrier, t);
      foreman.neck.rotation.y = Math.sin(t * 0.5) * 0.3;
      painted.scale.x = 0.4 + ((t * 0.05) % 1) * 1.8;
      painted.position.x = 7.8 + (painted.scale.x - 1) * 0.5;

      const on = (t % 2.6) < 1.8;
      torchTip.getWorldPosition(tip);
      arc.position.copy(tip);
      arc.visible = on;
      arc.scale.setScalar(on ? 0.8 + Math.random() * 0.6 : 0.001);
      arcLight.position.copy(tip).y += 0.25;
      arcLight.intensity = on ? 6 + Math.random() * 6 : 0;
      sparkMat.uniforms.uTime.value = t;
      sparkMat.uniforms.uTip.value.copy(tip);
      sparkMat.uniforms.uOn.value = on ? 1 : 0;
    },
  };
}
