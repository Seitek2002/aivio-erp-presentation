import * as THREE from 'three';
import { LOBBY, FLOORS } from './building.js';
import { materials, imageTexture } from './materials.js';
import { appTexture } from './screens.js';
import { desk, meetingChair, monitor, plant, wallScreen, chandelier, paperSheet, pen, cup, tablet, turnstiles, faceTexture, Kit } from './props.js';
import { person, sit, talking, walking } from './people.js';
import { box, cyl, outline, smooth, lerp } from './geo.js';

/*
  Double-height lobby, visible through its glass from outside.
  Left: sales office (slide 5) — managers on calls, lines carry each call into AIVIO on the wall.
  Right: meeting table with the signed acceptance act (slide 6).
  Centre: turnstiles with Face ID at the entrance (slide 9).
*/

const H = FLOORS[0].h;

export function createLobby({ images, anchors }) {
  const M = materials();
  const root = new THREE.Group();
  const shellGroup = new THREE.Group();
  const group = new THREE.Group(); // furniture, people, devices — only drawn when the camera is close
  root.add(shellGroup, group);

  // ---------- shell ----------
  const k = new Kit();
  const ring = outline(LOBBY, 96, () => -0.05);
  const shape = new THREE.Shape(ring.map(p => new THREE.Vector2(p.x, -p.y)));
  const fl = new THREE.ShapeGeometry(shape); fl.rotateX(-Math.PI / 2); fl.translate(0, 0.012, 0);
  k.add(M.travert, fl);
  const ce = new THREE.ShapeGeometry(shape); ce.rotateX(Math.PI / 2); ce.translate(0, H - 0.04, 0);
  k.add(M.ceiling, ce);
  for (let x = -11; x <= 11; x += 1.1) k.add(M.walnut, box(0.08, 0.16, 13.4, x, H - 0.12, 0));
  k.add(M.walnutPanel, box(20, H - 0.05, 0.12, 0, H / 2, -6.9));
  k.add(M.bronze, box(20, 0.05, 0.14, 0, 0.6, -6.82));
  // reception
  const rec = new THREE.CylinderGeometry(2.4, 2.4, 1.1, 40, 1, false, -Math.PI * 0.32, Math.PI * 0.64);
  rec.translate(0, 0.55, -1.4);
  k.add(M.stone, rec);
  const recTop = new THREE.CylinderGeometry(2.46, 2.46, 0.05, 40, 1, false, -Math.PI * 0.32, Math.PI * 0.64);
  recTop.translate(0, 1.12, -1.4);
  k.add(M.bronze, recTop);
  k.build(shellGroup);

  const ch = chandelier(2.3);
  ch.position.set(0, H - 1.7, 0.6);
  shellGroup.add(ch);
  [[-12.2, 5.6, 1.8, 7], [12.2, 5.6, 1.8, 8], [-3.6, -6.2, 1.5, 9], [3.6, -6.2, 1.5, 10], [12, -4.8, 1.6, 11]].forEach(([x, z, h, s]) => {
    const p = plant(h, s); p.position.set(x, 0, z); p.scale.setScalar(1.25); group.add(p);
  });

  const sign = letters('ALA-TOO RESIDENCE', 5.6, 0.5);
  sign.position.set(0, 3.9, -6.82);
  shellGroup.add(sign);

  const receptionist = person({});
  receptionist.root.position.set(0, 0, -2.6);
  group.add(receptionist.root);

  // ---------- sales office ----------
  const call = imageTexture(images.call);
  const wall = wallScreen(6.4, 4.0, call);
  wall.group.position.set(-7.4, 3.3, -6.78);
  shellGroup.add(wall.group);
  const wallAnchor = new THREE.Object3D(); wallAnchor.position.set(1.6, 1.0, 0.05); wall.group.add(wallAnchor);
  anchors.set('wallScore', wallAnchor);
  const wallA2 = new THREE.Object3D(); wallA2.position.set(-1.9, -0.6, 0.05); wall.group.add(wallA2);
  anchors.set('wallSummary', wallA2);

  const managers = [];
  const seats = [];
  for (const z of [-2.2, 1.0]) for (const x of [-10.4, -7.4, -4.4]) seats.push([x, z]);
  seats.forEach(([x, z], i) => {
    const dk = desk(1.6, 0.8);
    dk.position.set(x, 0, z);
    group.add(dk);
    const m = monitor(0.56, 0.35, appTexture('call', i + 1));
    m.group.position.set(x, 1.02, z - 0.22);
    m.group.rotation.y = Math.PI;
    m.group.rotation.x = -0.05;
    // monitor faces the manager who sits on the +z side looking at -z: turn the screen to +z
    m.group.rotation.y = 0;
    group.add(m.group);
    const p = person({ headset: true, dark: i % 3 === 1 });
    sit(p, 0.48);
    p.root.position.set(x, 0, z + 0.78);
    p.root.rotation.y = Math.PI;
    group.add(p.root);
    const chair = meetingChair();
    chair.position.set(x, 0, z + 0.8);
    chair.rotation.y = Math.PI;
    group.add(chair);
    const head = new THREE.Object3D(); head.position.set(0.1, 0.12, 0); p.neck.add(head);
    managers.push({ p, head, phase: i * 1.37 });
    if (i === 4) anchors.set('manager', head);
  });

  // lines from each manager into the wall screen
  const lineMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uShow: { value: 0 }, uColor: { value: new THREE.Color(0xd6f12b).multiplyScalar(1.1) } },
    vertexShader: `attribute float aT; attribute float aSeed; varying float vT; varying float vSeed;
      void main(){ vT = aT; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; uniform float uShow; uniform vec3 uColor; varying float vT; varying float vSeed;
      void main(){
        float grow = step(vT, uShow * 1.02);
        float p = fract(vT * 1.6 - uTime * (0.45 + vSeed * 0.25) + vSeed * 3.0);
        float pulse = smoothstep(0.0, 0.05, p) * (1.0 - smoothstep(0.05, 0.22, p));
        float a = (0.18 + pulse * 1.2) * grow * smoothstep(0.0, 0.06, vT);
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }`,
  });
  const lines = new THREE.Group();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  group.updateMatrixWorld(true);
  managers.forEach((m, i) => {
    const a = m.p.root.position.clone().add(new THREE.Vector3(0, 1.45, 0));
    const b = new THREE.Vector3(-7.4 + (i % 3 - 1) * 1.6, 2.2 + Math.floor(i / 3) * 1.3, -6.7);
    const c = a.clone().lerp(b, 0.45).setY(5.6 - (i % 3) * 0.3);
    const curve = new THREE.QuadraticBezierCurve3(a, c, b);
    const pts = curve.getPoints(60);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(pts.map((_, j) => j / (pts.length - 1)), 1));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(pts.map(() => i / 6), 1));
    lines.add(new THREE.Line(geo, lineMat));
  });
  group.add(lines);

  // ---------- meeting table with documents ----------
  const table = desk(2.4, 1.1);
  table.position.set(7.6, 0, 2.2);
  group.add(table);
  [[6.9, 1.3, 0], [8.3, 1.3, 0], [6.9, 3.1, Math.PI], [8.3, 3.1, Math.PI]].forEach(([x, z, r]) => {
    const c = meetingChair(); c.position.set(x, 0, z); c.rotation.y = r; group.add(c);
  });
  const docs = new THREE.Group();
  docs.position.set(7.45, 0.775, 2.25);
  group.add(docs);
  const ddu = paperSheet(imageTexture(images.ddu), 0.21, 0.207);
  ddu.position.set(-0.09, 0.001, -0.06); ddu.rotation.y = 0.16;
  const act = paperSheet(imageTexture(images.doc), 0.21, 0.28);
  act.position.set(0.05, 0.003, 0.02); act.rotation.y = -0.07;
  const blank = paperSheet(null);
  blank.position.set(-0.2, 0.0005, -0.02); blank.rotation.y = 0.32;
  docs.add(blank, ddu, act);
  const p1 = pen(); p1.position.set(0.21, 0.007, 0.12); p1.rotation.y = 0.65; docs.add(p1);
  const c1 = cup(); c1.position.set(-0.46, 0, -0.34); docs.add(c1);
  const signedTex = signedTexture();
  const tab = tablet(signedTex, 0.25, 0.17);
  tab.group.position.set(0.3, 0.004, -0.2); tab.group.rotation.y = -0.22;
  docs.add(tab.group);
  // ЭЦП seal that lands on the act
  const sealMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd6f12b).multiplyScalar(1.8), transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
  const seal = new THREE.Group();
  const ringGeo = new THREE.RingGeometry(0.026, 0.031, 40); ringGeo.rotateX(-Math.PI / 2);
  const tick = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.012, 0, 0.001), new THREE.Vector3(-0.003, 0, 0.01), new THREE.Vector3(0.014, 0, -0.01)]);
  seal.add(new THREE.Mesh(ringGeo, sealMat), new THREE.Line(tick, new THREE.LineBasicMaterial({ color: new THREE.Color(0xd6f12b).multiplyScalar(1.8), transparent: true, toneMapped: false })));
  seal.position.set(0.055, 0.004, 0.09);
  act.add(seal);
  anchors.set('seal', seal);
  const dduA = new THREE.Object3D(); dduA.position.set(-0.05, 0.002, -0.08); ddu.add(dduA); anchors.set('ddu', dduA);
  const tabA = new THREE.Object3D(); tabA.position.set(0.05, 0.01, -0.03); tab.group.add(tabA); anchors.set('tablet', tabA);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd6f12b), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.position.set(0, -0.001, 0);
  act.add(glow);

  // ---------- turnstiles ----------
  const faceIdle = faceTexture('scan'), faceOk = faceTexture('ok');
  const ts = turnstiles(3, faceIdle);
  ts.group.position.set(0, 0, 3.6);
  group.add(ts.group);
  ts.terms.forEach(tm => { tm.mat.uniforms.uMapB.value = faceOk; });
  anchors.set('faceid', ts.terms[1].screen);
  const walker = person({ dark: true });
  group.add(walker.root);
  const walkerAnchor = new THREE.Object3D(); walkerAnchor.position.set(0, 0.25, 0); walker.neck.add(walkerAnchor);
  anchors.set('walker', walkerAnchor);

  let reveal = 0, signT = 0;
  return {
    group: root,
    detail: group,
    update(t, dt, s, near) {
      group.visible = near;
      if (!near) { wall.mat.uniforms.uReveal.value = 1; return; }
      const salesOn = s.sales;
      lines.visible = salesOn > 0.001;
      lineMat.uniforms.uTime.value = t;
      lineMat.uniforms.uShow.value = salesOn;
      reveal = salesOn > 0.95 ? Math.min(1, reveal + dt * 0.42) : Math.max(0, reveal - dt * 1.5);
      wall.mat.uniforms.uReveal.value = salesOn > 0.001 ? smooth(0, 1, reveal) : 1;
      managers.forEach(m => talking(m.p, t, m.phase));
      receptionist.neck.rotation.y = Math.sin(t * 0.4) * 0.4;

      // signing
      signT = s.sign > 0.95 ? Math.min(1, signT + dt * 0.8) : Math.max(0, signT - dt * 2);
      const st = smooth(0.15, 0.8, signT);
      sealMat.opacity = st;
      seal.scale.setScalar(lerp(2.2, 1, st));
      glow.material.opacity = Math.sin(st * Math.PI) * 0.35;
      tab.mat.uniforms.uOn.value = 0.2 + 0.8 * smooth(0.5, 1, signT);

      // turnstile loop: one person walks in through the middle lane
      const active = s.gate > 0.001;
      walker.root.visible = active;
      if (active) {
        const T = 7.5;
        const ph = (t % T) / T;
        const z = lerp(12, -1.5, ph);
        walker.root.position.set(0.05, 0, z);
        walker.root.rotation.y = Math.PI;
        const near = z - ts.group.position.z;
        const ok = near < 1.9 && near > -1.6;
        const scanning = near >= 1.9 && near < 3.4;
        walking(walker, t, 1);
        ts.setOpen(1, smooth(1.5, 0.9, near) * smooth(-1.6, -1.0, near));
        ts.terms[1].mat.uniforms.uMix.value = ok ? 1 : 0;
        ts.terms[1].mat.uniforms.uReveal.value = scanning ? (t * 1.2) % 1 : 1;
      } else {
        ts.setOpen(1, 0);
      }
    },
  };
}

function letters(text, w, h) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = Math.round(2048 * h / w);
  const g = c.getContext('2d');
  g.font = `300 ${Math.round(c.height * 0.62)}px "Geologica Variable", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = '34px';
  const grd = g.createLinearGradient(0, 0, 0, c.height);
  grd.addColorStop(0, '#f3d9a8'); grd.addColorStop(1, '#a77b48');
  g.fillStyle = grd;
  g.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.5, 1.4, 1.25) }));
  m.position.z = 0.08;
  return m;
}

function signedTexture() {
  const c = document.createElement('canvas');
  c.width = 500; c.height = 340;
  const g = c.getContext('2d');
  g.fillStyle = '#151711'; g.fillRect(0, 0, 500, 340);
  g.fillStyle = '#d6f12b'; g.beginPath(); g.roundRect(28, 28, 44, 44, 10); g.fill();
  g.fillStyle = '#151711';
  [[38, 50, 6, 14], [48, 40, 6, 24], [58, 45, 6, 19]].forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
  g.fillStyle = '#ecebe3'; g.font = '600 26px "Inter Variable", sans-serif';
  g.fillText('AIVIO ЭДО', 90, 58);
  g.fillStyle = '#5ed177'; g.font = '700 30px "Inter Variable", sans-serif';
  g.fillText('✓ Подписано ЭЦП', 28, 140);
  g.fillStyle = '#a8ada2'; g.font = '500 21px "Inter Variable", sans-serif';
  g.fillText('Инфоком · KG-2026-48712', 28, 186);
  g.fillText('Штамп времени TSA 14:13', 28, 222);
  g.fillStyle = '#d6f12b'; g.fillText('⇄ Выгружено в 1С', 28, 282);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
