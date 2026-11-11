import * as THREE from 'three';
import { FLOORS, floorTop, FOCUS } from './building.js';
import { materials, imageTexture } from './materials.js';
import { appTexture, highlightTexture } from './screens.js';
import { desk, execChair, monitor, laptop, plant, floorLamp, sofa, shelfWall, artwork, Kit, keyboard, mouse, deskLamp, deskPhone, penCup, folderStack, pendant, vaseFlowers, cup } from './props.js';
import { person, sit } from './people.js';
import { box, smooth, lerp } from './geo.js';

/*
  The developer's office on the top floor (slides 2–4).
  Slide 2: six monitors, six unrelated programs. Slide 3: monitors go dark, one laptop opens.
  Slide 4: the laptop flies out of the window and hangs next to the tower showing the шахматка;
  lime lines run from its cells to the apartments that light up on the facade.
*/

const Y = floorTop(13);
const DESK = new THREE.Vector3(6, 0, 4.4);
// cells on tex-chess (u, v from the bottom) of the apartments in building FOCUS
const CELLS = {
  1131: { u0: 0.281, v0: 0.572, u1: 0.446, v1: 0.706, color: '#9aa096' },
  1122: { u0: 0.417, v0: 0.715, u1: 0.548, v1: 0.849, color: '#5ed177' },
  1125: { u0: 0.826, v0: 0.715, u1: 0.957, v1: 0.849, color: '#ff9a1f' },
};

export function createOffice({ building, images, anchors }) {
  const M = materials();
  const group = new THREE.Group();
  group.position.set(0, Y, 0);
  const H = FLOORS[13].h - 0.34;

  // ---------- room ----------
  const k = new Kit();
  const floorGeo = new THREE.PlaneGeometry(17, 11.6); floorGeo.rotateX(-Math.PI / 2); floorGeo.translate(6.5, 0.004, 3.2);
  k.add(M.floorWood, floorGeo);
  const ceil = new THREE.PlaneGeometry(17, 11.6); ceil.rotateX(Math.PI / 2); ceil.translate(6.5, H - 0.02, 3.2);
  k.add(M.ceiling, ceil);
  for (const z of [0.8, 3.4, 6.0]) k.add(M.warmLight, box(12, 0.02, 0.05, 6.5, H - 0.04, z));
  k.add(M.plaster, box(0.08, H, 11, -1.9, H / 2, 3.4));              // side partition (dark)
  k.add(M.bronze, box(0.06, H, 0.06, -1.86, H / 2, 8.9));
  const rug = new THREE.PlaneGeometry(4.6, 3.4); rug.rotateX(-Math.PI / 2); rug.translate(6, 0.012, 4.9);
  k.add(new THREE.MeshStandardMaterial({ color: 0x2a2621, roughness: 0.95 }), rug);
  k.build(group);

  const shelves = shelfWall(9.5, H, 4);
  shelves.position.set(5.2, 0, -2.5);
  group.add(shelves);
  const art = artwork(2.4, 1.5);
  art.position.set(12.2, 1.8, -2.44);
  group.add(art);

  const d = desk(2.9, 1.15);
  d.position.copy(DESK);
  group.add(d);
  const chair = execChair();
  chair.position.set(DESK.x, 0, DESK.z + 1.25);
  chair.rotation.y = Math.PI;
  group.add(chair);

  // desk details
  const TOPY = 0.773;
  const place = (obj, x, z, ry = 0, y = TOPY) => { obj.position.set(x, y, z); obj.rotation.y = ry; group.add(obj); return obj; };
  place(keyboard(), DESK.x - 0.78, DESK.z + 0.42, 0.12);
  place(mouse(), DESK.x - 0.4, DESK.z + 0.46, 0.1);
  place(deskLamp(), DESK.x + 1.2, DESK.z - 0.3, -2.4);
  place(deskPhone(), DESK.x + 1.05, DESK.z + 0.28, -0.4);
  place(penCup(), DESK.x - 1.18, DESK.z - 0.28);
  place(folderStack(4, 7), DESK.x - 1.1, DESK.z + 0.22, 0.25);
  place(cup(), DESK.x + 0.75, DESK.z + 0.45);
  for (const x of [-0.8, 0, 0.8]) place(pendant(1.45), DESK.x + x, DESK.z, 0, H - 0.02);
  place(vaseFlowers(6), 11.6, 1.5, 0, 0.44);
  const lounge = sofa(2.4);
  lounge.position.set(11.6, 0, 0.2);
  group.add(lounge);
  const lamp = floorLamp();
  lamp.position.set(13.4, 0, -0.6);
  lamp.rotation.y = -0.6;
  group.add(lamp);
  const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 32), M.stone);
  coffee.position.set(11.6, 0.42, 1.5);
  group.add(coffee);
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.4, 12), M.bronze).translateX(11.6).translateY(0.2).translateZ(1.5));
  [[13.2, 6.8, 1.6, 2], [-1.2, 7.4, 1.3, 3], [1.2, -1.9, 1.5, 5]].forEach(([x, z, h, s]) => {
    const p = plant(h, s); p.position.set(x, 0, z); group.add(p);
  });

  // ---------- six monitors ----------
  const kinds = ['sheet', 'chat', 'mail', 'ledger', 'scan', 'timesheet'];
  const monitors = [];
  const rig = new THREE.Group();
  rig.position.set(DESK.x, 0, DESK.z - 0.28);
  group.add(rig);
  const rk = new Kit();
  rk.add(M.bronze, box(0.05, 1.1, 0.05, 0, 1.3, -0.08));
  rk.add(M.bronze, box(2.1, 0.04, 0.04, 0, 1.28, -0.08));
  rk.add(M.bronze, box(0.3, 0.02, 0.22, 0, 0.785, -0.05));
  rk.build(rig);
  const badgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3b3b).multiplyScalar(2.2), toneMapped: false });
  kinds.forEach((kind, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const m = monitor(0.6, 0.375, appTexture(kind));
    const x = (col - 1) * 0.66;
    m.group.position.set(x, row === 0 ? 1.5 : 1.08, col === 1 ? 0 : 0.12);
    m.group.rotation.y = (1 - col) * 0.32;
    m.group.rotation.x = row === 0 ? 0.12 : 0.02;
    rig.add(m.group);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), badgeMat);
    badge.position.set(0.27, 0.16, 0.013);
    m.group.add(badge);
    const a = new THREE.Object3D(); a.position.set(0, 0.2, 0.02); m.group.add(a);
    anchors.set(`mon${i}`, a);
    monitors.push({ ...m, badge, base: m.group.position.clone() });
  });

  // ---------- CEO ----------
  const ceo = person({ outfit: 'suit', seed: 3, hair: 'short', female: false, grip: 0.25 });
  sit(ceo, 0.5);
  ceo.root.position.set(DESK.x, 0, DESK.z + 1.2);
  ceo.root.rotation.y = Math.PI;
  group.add(ceo.root);

  // ---------- laptop ----------
  const dash = imageTexture(images.dash);
  const chessHi = highlightTexture(images.chess, Object.entries(CELLS).map(([, c]) => ({ u0: c.u0, v0: c.v0, u1: c.u1, v1: c.v1, color: c.color })));
  const lap = laptop(dash, chessHi);
  const lapHome = new THREE.Vector3(DESK.x, 0.772, DESK.z + 0.34);
  lap.group.position.copy(lapHome);
  group.add(lap.group);
  const lapAnchor = new THREE.Object3D(); lapAnchor.position.set(0, 0.2, 0); lap.screen.add(lapAnchor);
  anchors.set('laptop', lapAnchor);
  const lapTop = new THREE.Object3D(); lapTop.position.set(0.1, 0.09, 0.002); lap.screen.add(lapTop);
  anchors.set('laptopCorner', lapTop);

  // flight path in world space → converted to office-local each frame
  const outside = new THREE.Vector3(6.6, Y + 1.8, 12.5);
  const flyTarget = { desk: new THREE.Vector3(34, 24, 26), mob: new THREE.Vector3(10, 62, 22) };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
  const qHome = new THREE.Quaternion(); // screen already faces the CEO (+z)
  const qOut = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, -0.22, 0));
  const SCALE = { desk: 62, mob: 52 };

  // lines from the laptop cells to the apartments on the facade
  const linkMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uShow: { value: 0 }, uColor: { value: new THREE.Color(0xd6f12b).multiplyScalar(1.25) } },
    // the curve is evaluated on the GPU from three control points — no buffer upload per frame
    vertexShader: `attribute float aT; uniform vec3 uP0; uniform vec3 uP1; uniform vec3 uP2; varying float vT;
      void main(){ vT = aT; float u = 1.0 - aT; vec3 p = u * u * uP0 + 2.0 * u * aT * uP1 + aT * aT * uP2;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    fragmentShader: `uniform float uTime; uniform float uShow; uniform vec3 uColor; varying float vT;
      void main(){ float grow = step(vT, uShow);
        float p = fract(vT * 2.5 - uTime * 0.7); float pulse = smoothstep(0.0, 0.08, p) * (1.0 - smoothstep(0.08, 0.25, p));
        float a = (0.35 + pulse) * grow; gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }`,
  });
  const links = Object.entries(CELLS).map(([id, c]) => {
    const geo = new THREE.BufferGeometry();
    const N = 40;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(Array.from({ length: N }, (_, i) => i / (N - 1)), 1));
    const mat = linkMat.clone();
    mat.uniforms = { ...linkMat.uniforms, uP0: { value: new THREE.Vector3() }, uP1: { value: new THREE.Vector3() }, uP2: { value: new THREE.Vector3() } };
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.visible = false;
    const cell = new THREE.Object3D();
    cell.position.set(((c.u0 + c.u1) / 2 - 0.5) * 0.318, (1 - (c.v0 + c.v1) / 2 - 0.5) * 0.199, 0.002);
    lap.screen.add(cell);
    const f = FOCUS[id];
    return { id: f.floor * 100 + f.apt, line, cell, N, mat };
  });
  const linkGroup = new THREE.Group();
  links.forEach(l => linkGroup.add(l.line));

  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
  const camDir = new THREE.Vector3();

  return {
    group, linkGroup, monitors, laptop: lap, ceo,
    update(t, s, portrait, camera) {
      group.visible = s.office > 0.001;
      linkGroup.visible = s.focus > 0.001;
      if (!group.visible) return;
      // monitors: on in slide 2, dark in 3+
      monitors.forEach((m, i) => {
        m.mat.uniforms.uOn.value = smooth(0.15, 0.85, s.screens);
        m.group.position.y = m.base.y - (1 - s.screens) * 0.08;
        const pulse = 1 + 0.25 * Math.sin(t * 5 + i * 1.7);
        m.badge.scale.setScalar(s.screens > 0.5 ? pulse : 0.001);
      });
      // CEO: scanning the screens, then relaxed looking at the laptop
      const busy = s.screens;
      ceo.neck.rotation.y = busy * Math.sin(t * 0.75) * 0.55;
      ceo.neck.rotation.x = lerp(0.32, -0.18 + Math.sin(t * 1.3) * 0.04, busy);
      ceo.spine.rotation.x = lerp(-0.12, 0.08, busy);
      // relaxed: elbows on the armrests, hands back from the laptop
      ceo.l.sh.rotation.x = lerp(-0.15, -0.9, busy); ceo.r.sh.rotation.x = lerp(-0.15, -0.9, busy) + busy * Math.sin(t * 2.1) * 0.12;
      ceo.l.el.rotation.x = lerp(-1.2, -0.9, busy); ceo.r.el.rotation.x = lerp(-1.2, -0.9, busy);
      ceo.l.sh.rotation.z = lerp(0.32, 0.2, busy); ceo.r.sh.rotation.z = lerp(-0.32, -0.2, busy);

      // laptop lid + flight
      lap.setOpen(s.laptop);
      const f = s.fly;
      lap.mat.uniforms.uMix.value = smooth(0.12, 0.4, f);
      const key = portrait ? 'mob' : 'desk';
      if (f <= 0.0001) {
        lap.group.position.copy(lapHome);
        lap.group.quaternion.copy(qHome);
        lap.group.scale.setScalar(1);
      } else {
        const p0 = tmpA.copy(lapHome).add(group.position);
        const p2 = flyTarget[key];
        curve.v0.copy(p0);
        curve.v1.copy(outside).lerp(p2, 0.25).setY(Math.max(outside.y, p2.y) + 4);
        curve.v2.copy(p2);
        const e = smooth(0, 1, f);
        curve.getPoint(e, tmpB);
        lap.group.position.copy(tmpB).sub(group.position);
        lap.group.quaternion.copy(qHome).slerp(qOut, smooth(0.1, 0.7, f));
        lap.group.scale.setScalar(lerp(1, SCALE[key], smooth(0.3, 1, f) ** 1.6));
      }
      // facade links
      if (s.focus > 0.001) {
        linkMat.uniforms.uTime.value = t;
        linkMat.uniforms.uShow.value = s.focus;
        camera.getWorldDirection(camDir);
        for (const l of links) {
          l.line.visible = true;
          const a = l.cell.getWorldPosition(tmpA);
          const b = building.aptWorld(l.id, tmpB);
          tmpC.copy(a).lerp(b, 0.5).addScaledVector(camDir, -6).y += 3;
          l.mat.uniforms.uP0.value.copy(a);
          l.mat.uniforms.uP1.value.copy(tmpC);
          l.mat.uniforms.uP2.value.copy(b);
        }
      } else links.forEach(l => { l.line.visible = false; });
    },
  };
}

export { FOCUS };
