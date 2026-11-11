import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const BG = new THREE.Color(0x10120e);
export const HORIZON = new THREE.Color(0x181b15);

const FOG_GLSL = /* glsl */ `
  vec3 applyFog(vec3 col, vec3 w) {
    float d = length(w.xz - cameraPosition.xz * 0.15);
    return mix(col, uHorizon, smoothstep(uFogNear, uFogFar, d));
  }
`;

function fogUniforms() {
  return { uHorizon: { value: HORIZON }, uFogNear: { value: 110 }, uFogFar: { value: 420 } };
}

export function createWorld() {
  const group = new THREE.Group();

  // ---------- sky dome ----------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
      uniforms: { uTop: { value: new THREE.Color(0x070806) }, uHorizon: { value: HORIZON }, uGlow: { value: new THREE.Color(0x2a3020) } },
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlow; varying vec3 vD;
        void main(){ float h = clamp(vD.y, 0., 1.);
          vec3 c = mix(uHorizon, uTop, pow(smoothstep(0.0, 0.55, h), 0.7));
          c += uGlow * pow(1. - h, 6.) * 0.35;
          gl_FragColor = vec4(c, 1.);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -10;
  group.add(sky);

  // ---------- ground ----------
  const groundUniforms = { ...fogUniforms(), uGrid: { value: 1 }, uSite: { value: 1 }, uLime: { value: new THREE.Color(0xd6f12b) }, uTime: { value: 0 } };
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600, 1, 1).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: groundUniforms,
      toneMapped: false,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform vec3 uHorizon; uniform float uFogNear; uniform float uFogFar;
        uniform float uGrid; uniform float uSite; uniform vec3 uLime; uniform float uTime;
        varying vec3 vW;
        ${FOG_GLSL}
        float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
        float gridLine(vec2 p, float s, float w){ vec2 q = p / s; vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q); return 1. - min(min(g.x, g.y) / w, 1.); }
        void main(){
          vec2 p = vW.xz;
          float d = length(p);
          vec3 col = vec3(0.034, 0.038, 0.031);
          // paving of the plot
          float plot = sdBox(p - vec2(0., 6.), vec2(38., 28.));
          col = mix(col, vec3(0.058, 0.062, 0.054), (1. - smoothstep(0., 0.6, plot)) * uSite);
          // limestone plaza with a tile joint pattern around the tower and down the entrance
          float plaza = min(sdBox(p - vec2(0., 2.), vec2(24., 18.)) - 2., sdBox(p - vec2(0., 24.), vec2(4.2, 10.)));
          float inPlaza = 1. - smoothstep(0., 0.3, plaza);
          vec2 tq = abs(fract(p / vec2(1.2, 0.6)) - 0.5);
          float joint = 1. - smoothstep(0.46, 0.49, max(tq.x, tq.y));
          col = mix(col, vec3(0.16, 0.15, 0.135) * (0.88 + 0.12 * joint), inPlaza * uSite);
          // architectural grid
          float fade = 1. - smoothstep(30., 210., d);
          col += vec3(0.75, 0.8, 0.68) * (gridLine(p, 6., 1.) * 0.05 + gridLine(p, 30., 1.2) * 0.09) * fade * uGrid;
          // dashed site boundary in lime
          float edge = 1. - smoothstep(0.0, 0.12, abs(plot));
          float dash = step(0.5, fract((p.x + p.y) * 0.25));
          col += uLime * edge * dash * 0.55 * uSite;
          // contact shadow under the tower
          float sb = sdBox(p, vec2(12., 6.)) - 6.;
          col *= mix(0.32, 1., smoothstep(-1., 9., sb));
          // warm light spilling out of the lobby onto the plaza
          float spill = 1. - smoothstep(0., 16., max(0., sdBox(p - vec2(0., 2.), vec2(13., 7.)) - 1.));
          col += vec3(0.55, 0.36, 0.18) * spill * 0.16 * uSite;
          // street lamps glow pools
          col = applyFog(col, vW);
          gl_FragColor = vec4(col, 1.);
          #include <colorspace_fragment>
        }`,
    }),
  );
  ground.renderOrder = -5;
  group.add(ground);

  // ---------- night city context ----------
  const rand = mulberry(7);
  const blocks = [];
  const avoid = (x, z) => Math.abs(x) < 52 && Math.abs(z) < 42;
  for (let n = 0; n < 90; n++) {
    const a = rand() * Math.PI * 2;
    const r = 150 + rand() * 260;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (avoid(x, z)) continue;
    const w = 14 + rand() * 26, d = 12 + rand() * 18;
    const h = 9 + Math.pow(rand(), 2.2) * 55;
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    g.rotateY(Math.round(rand() * 2) * Math.PI / 2 + (rand() - 0.5) * 0.2);
    g.translate(x, 0, z);
    const seed = new Float32Array(g.attributes.position.count).fill(rand());
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    blocks.push(g);
  }
  const city = new THREE.Mesh(
    mergeGeometries(blocks),
    new THREE.ShaderMaterial({
      uniforms: { ...fogUniforms(), uLit: { value: 1 } },
      toneMapped: false,
      vertexShader: `attribute float aSeed; varying vec3 vW; varying vec3 vN; varying float vSeed;
        void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vN = normal; vSeed = aSeed; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform vec3 uHorizon; uniform float uFogNear; uniform float uFogFar; uniform float uLit;
        varying vec3 vW; varying vec3 vN; varying float vSeed;
        ${FOG_GLSL}
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main(){
          vec3 n = normalize(vN);
          vec3 col = vec3(0.028, 0.031, 0.026) * (0.7 + 0.3 * n.y);
          if (abs(n.y) < 0.5) {
            float u = abs(n.x) > 0.5 ? vW.z : vW.x;
            vec2 cell = vec2(floor(u / 3.2), floor(vW.y / 3.1));
            vec2 f = vec2(fract(u / 3.2), fract(vW.y / 3.1));
            float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.8);
            float on = step(0.72 - vSeed * 0.12, hash(vec3(cell, vSeed * 91.)));
            vec3 warm = mix(vec3(1.0, 0.7, 0.42), vec3(0.75, 0.82, 0.9), step(0.8, hash(vec3(cell.yx, 3.))));
            col += warm * win * on * 0.24 * uLit * step(1.2, vW.y);
          }
          col = applyFog(col, vW);
          gl_FragColor = vec4(col, 1.);
          #include <colorspace_fragment>
        }`,
    }),
  );
  group.add(city);

  // ---------- trees ----------
  const treePos = [];
  const tr = mulberry(31);
  for (let n = 0; n < 70; n++) {
    let x, z;
    const edge = Math.floor(tr() * 4);
    if (edge === 0) { x = -36 + tr() * 72; z = 32 + tr() * 4; }
    else if (edge === 1) { x = -36 + tr() * 72; z = -22 - tr() * 4; }
    else if (edge === 2) { x = 34 + tr() * 4; z = -22 + tr() * 54; }
    else { x = -34 - tr() * 4; z = -22 + tr() * 54; }
    if (Math.abs(x) < 20 && Math.abs(z) < 14) continue;
    if (Math.abs(x) < 16 && z > 12 && z < 36) continue; // entrance plaza and pools
    if (x > 18 && z < -2) continue; // crane and pallets
    if (x > 18 && z > 0 && z < 18) continue; // site storage
    treePos.push([x, z, 1.0 + tr() * 0.8]);
  }
  const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
  const canopy = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ color: 0x2c3627, roughness: 1, flatShading: true }), treePos.length);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1, 5), new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 1 }), treePos.length);
  const m = new THREE.Matrix4();
  treePos.forEach(([x, z, s], i) => {
    m.compose(new THREE.Vector3(x, 2.2 + s, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 1.15, s));
    canopy.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, 1.2, z), new THREE.Quaternion(), new THREE.Vector3(1, 2.4, 1));
    trunk.setMatrixAt(i, m);
  });
  group.add(canopy, trunk);
  // two more canopy layers per tree for a fuller, less faceted crown
  for (const [dx, dy, dz, k] of [[0.45, 0.55, -0.2, 0.7], [-0.4, 0.35, 0.35, 0.62]]) {
    const layer = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: 0x33402c, roughness: 1 }), treePos.length);
    treePos.forEach(([x, z, sc], i) => {
      m.compose(new THREE.Vector3(x + dx * sc, 2.2 + sc + dy * sc, z + dz * sc), new THREE.Quaternion(), new THREE.Vector3(sc * k, sc * k * 1.1, sc * k));
      layer.setMatrixAt(i, m);
    });
    group.add(layer);
  }

  // ---------- streets, curbs, street lights and cars ----------
  const bxS = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.85 });
  const curbM = new THREE.MeshStandardMaterial({ color: 0x8e8a82, roughness: 0.8 });
  const paintM = new THREE.MeshStandardMaterial({ color: 0xd8d6cf, roughness: 0.6 });
  const streets = [[0, 46, 220, 10], [0, -36, 220, 9]];
  const streetsZ = [[-52, 5, 9, 160], [52, 5, 9, 160]];
  const sk = [];
  for (const [x, z, w, d] of [...streets, ...streetsZ]) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), asphalt);
    road.position.set(x, 0.035, z);
    group.add(road);
  }
  for (const [, z] of streets) {
    for (let x = -105; x < 105; x += 6) sk.push(bxS(3, 0.02, 0.18, x, 0.05, z));
    sk.push(bxS(220, 0.18, 0.3, 0, 0.09, z - 5.15), bxS(220, 0.18, 0.3, 0, 0.09, z + 5.15));
  }
  group.add(new THREE.Mesh(mergeGeometries(sk.slice(0, -4)), paintM));
  group.add(new THREE.Mesh(mergeGeometries(sk.slice(-4)), curbM));
  // street lights along the front street
  const poleParts = [], heads = [], pools = [];
  for (let x = -60; x <= 60; x += 15) for (const side of [-1, 1]) {
    const z = 46 + side * 5.6;
    poleParts.push(bxS(0.14, 7, 0.14, x, 3.5, z), bxS(0.1, 0.1, 1.6, x, 7, z - side * 0.75));
    heads.push(bxS(0.5, 0.12, 0.28, x, 6.92, z - side * 1.5));
    pools.push(x, 0.12, z - side * 1.6);
  }
  group.add(new THREE.Mesh(mergeGeometries(poleParts), new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.4, metalness: 0.8 })));
  group.add(new THREE.Mesh(mergeGeometries(heads), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.88, 0.7).multiplyScalar(4), toneMapped: false })));
  const poolPts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pools, 3)), spriteMaterial(0xffc98c, 9, 0.35));
  group.add(poolPts);
  // cars
  const cars = [];
  const carColors = [0xf1f0ec, 0x16171a, 0x5e646b, 0xa9adb1, 0x1e2a44, 0x6b1f22, 0x2f3a2f];
  const cr = mulberry(55);
  const carShape = new THREE.Shape([[-2.25, 0.32], [2.25, 0.32], [2.32, 0.72], [1.95, 0.86], [1.05, 0.92], [0.5, 1.4], [-0.95, 1.44], [-1.75, 1.02], [-2.28, 0.92], [-2.32, 0.55]].map(([a, b]) => new THREE.Vector2(a, b)));
  const cabinShape = new THREE.Shape([[0.95, 0.9], [0.47, 1.36], [-0.92, 1.4], [-1.65, 1.0]].map(([a, b]) => new THREE.Vector2(a, b)));
  const bodyGeo = new THREE.ExtrudeGeometry(carShape, { depth: 1.72, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3, curveSegments: 4 });
  bodyGeo.translate(0, 0, -0.86);
  const glassGeo = new THREE.ExtrudeGeometry(cabinShape, { depth: 1.82, bevelEnabled: false });
  glassGeo.translate(0, 0, -0.91);
  const carGlass = new THREE.MeshStandardMaterial({ color: 0x0c1014, roughness: 0.05, metalness: 0.9, envMapIntensity: 1.5 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.9 });
  const wheelRim = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.25, metalness: 1 });
  const headL = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.96, 0.88).multiplyScalar(5), toneMapped: false });
  const tailL = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.05, 0.03).multiplyScalar(3.5), toneMapped: false });
  for (let i = 0; i < 16; i++) {
    const car = new THREE.Group();
    const paintC = new THREE.MeshStandardMaterial({ color: carColors[Math.floor(cr() * carColors.length)], roughness: 0.22, metalness: 0.6, envMapIntensity: 1.4 });
    car.add(new THREE.Mesh(bodyGeo, paintC), new THREE.Mesh(glassGeo, carGlass));
    for (const [x, z] of [[1.4, 0.9], [-1.45, 0.9], [1.4, -0.9], [-1.45, -0.9]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20).rotateX(Math.PI / 2), tyre);
      w.position.set(x, 0.34, z); car.add(w);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 12).rotateX(Math.PI / 2), wheelRim);
      h.position.set(x, 0.34, z); car.add(h);
    }
    for (const z of [-0.6, 0.6]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.32), headL); hl.position.set(2.33, 0.68, z); car.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.34), tailL); tl.position.set(-2.34, 0.8, z); car.add(tl);
    }
    const moving = i < 6;
    const lane = moving ? (i % 2 ? 43.6 : 48.4) : (i % 2 ? 40.8 : 51.2);
    const dir = moving ? (i % 2 ? 1 : -1) : 1;
    car.position.set(-100 + cr() * 200, 0, lane);
    car.rotation.y = dir > 0 ? 0 : Math.PI;
    car.scale.setScalar(0.95 + cr() * 0.1);
    car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(car);
    cars.push({ car, moving, dir, speed: 7 + cr() * 5 });
  }

  // ---------- site storage: containers and material stacks ----------
  const boxAt = (w, h, d, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(ry); g.translate(x, y, z); return g; };
  const contGeo = mergeGeometries([
    boxAt(2.4, 2.6, 6.1, 24, 1.3, 7),
    boxAt(2.4, 2.6, 6.1, 27, 1.3, 7.4),
    boxAt(2.4, 2.6, 6.1, 25.5, 3.9, 7.2),
  ]);
  const containers = new THREE.Mesh(contGeo, new THREE.MeshStandardMaterial({ color: 0x4a4e44, roughness: 0.75, metalness: 0.2 }));
  const limeCont = new THREE.Mesh(boxAt(2.4, 2.6, 6.1, 24.2, 1.3, 14.2, 0.08), new THREE.MeshStandardMaterial({ color: 0xb8cf2a, roughness: 0.7, metalness: 0.1 }));
  const stackParts = [];
  for (let k = 0; k < 4; k++) stackParts.push(boxAt(5.5, 0.35, 1.4, 20.4, 0.2 + k * 0.38, 11 + (k % 2) * 0.2));
  for (let k = 0; k < 3; k++) stackParts.push(boxAt(1.4, 1.1, 1.4, 19.2 + k * 1.7, 0.55, 15.6));
  const stacks = new THREE.Mesh(mergeGeometries(stackParts), new THREE.MeshStandardMaterial({ color: 0x7a7c72, roughness: 0.9 }));
  const yard = new THREE.Group();
  yard.add(containers, limeCont, stacks);
  group.add(yard);

  // ---------- reflecting pools and bollard lights along the entrance ----------
  const water = new THREE.MeshStandardMaterial({ color: 0x0b0d0c, roughness: 0.12, metalness: 0.9, envMapIntensity: 0.22 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xd9d1c1, roughness: 0.45 });
  for (const sx of [-1, 1]) {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(8, 14).rotateX(-Math.PI / 2), water);
    pool.position.set(sx * 9.5, 0.06, 25);
    group.add(pool);
    group.add(new THREE.Mesh(boxAt(8.6, 0.12, 14.6, sx * 9.5, 0.06, 25), rim).translateY(-0.04));
  }
  const bollards = [];
  for (let z = 15; z <= 34; z += 3.8) for (const x of [-4.8, 4.8]) bollards.push(x, 0.9, z);
  const lampsB = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(bollards, 3)), spriteMaterial(0xffc98c, 1.6, 0.95));
  group.add(lampsB);
  const postGeo = [];
  for (let i = 0; i < bollards.length; i += 3) postGeo.push(boxAt(0.16, 0.85, 0.16, bollards[i], 0.42, bollards[i + 2]));
  group.add(new THREE.Mesh(mergeGeometries(postGeo), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.35, metalness: 1 })));

  // ---------- lamps + floating dust ----------
  const lampPts = [];
  for (let x = -36; x <= 36; x += 7.2) lampPts.push(x, 0.6, 38, x, 0.6, -27);
  for (let z = -20; z <= 32; z += 7.4) lampPts.push(41, 0.6, z, -41, 0.6, z);
  const lamps = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lampPts, 3)),
    spriteMaterial(0xffc27a, 2.4, 0.9),
  );
  group.add(lamps);

  const dust = [];
  const dr = mulberry(77);
  for (let n = 0; n < 420; n++) dust.push((dr() - 0.5) * 180, dr() * 70, (dr() - 0.5) * 180);
  const dustPts = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(dust, 3)),
    spriteMaterial(0xe9eedc, 0.35, 0.35),
  );
  group.add(dustPts);

  // ---------- integration nodes ----------
  const nodes = createNodes();
  group.add(nodes.group);

  return {
    group,
    ground,
    groundUniforms,
    city,
    dust: dustPts,
    yard,
    nodes,
    update(t) {
      dustPts.rotation.y = t * 0.006;
      dustPts.position.y = Math.sin(t * 0.2) * 0.6;
      nodes.update(t);
      for (const c of cars) {
        if (!c.moving) continue;
        let x = c.car.position.x + c.dir * c.speed * (1 / 60);
        if (x > 110) x = -110; if (x < -110) x = 110;
        c.car.position.x = x;
      }
    },
  };
}

function spriteMaterial(color, size, opacity) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.PointsMaterial({ color, size, map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false });
}

export const NODE_LIST = [
  { key: '1c', title: '1С:Бухгалтерия', text: 'платежи, договоры, акты', a: -150, r: 52 },
  { key: 'bank', title: 'Оптима Банк', text: 'выписки, эскроу, зарплата', a: -112, r: 60 },
  { key: 'esign', title: 'Инфоком ЭЦП', text: 'подпись и штамп времени', a: -72, r: 50 },
  { key: 'tunduk', title: 'Түндүк', text: 'паспорта, кадастр, Tunduk ID', a: -34, r: 60 },
  { key: 'pbx', title: 'Beeline Cloud PBX', text: 'звонки и записи', a: 8, r: 52 },
  { key: 'wa', title: 'WhatsApp Business', text: 'чаты и рассылки', a: 48, r: 60 },
  { key: 'bi', title: 'Power BI и Looker', text: 'отчёты для акционеров', a: 92, r: 52 },
  { key: 'api', title: 'REST API', text: 'сайт, партнёры, вебхуки', a: 135, r: 58 },
];

function createNodes() {
  const group = new THREE.Group();
  const anchors = [];
  const lineMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uShow: { value: 0 }, uColor: { value: new THREE.Color(0xd6f12b).multiplyScalar(1.15) } },
    vertexShader: `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; uniform float uShow; uniform vec3 uColor; varying float vT;
      void main(){
        float grow = step(vT, uShow * 1.05);
        float pulse = smoothstep(0.0, 0.12, fract(vT * 3.0 - uTime * 0.45)) * (1.0 - smoothstep(0.12, 0.3, fract(vT * 3.0 - uTime * 0.45)));
        float a = (0.22 + pulse * 0.9) * grow * uShow;
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }`,
  });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xd6f12b, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xd6f12b, transparent: true, opacity: 0, toneMapped: false });
  const ringGeo = new THREE.RingGeometry(1.6, 1.85, 48).rotateX(-Math.PI / 2);
  const coreGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 24);
  const rings = [];
  for (const N of NODE_LIST) {
    const a = THREE.MathUtils.degToRad(N.a);
    const p = new THREE.Vector3(Math.cos(a) * N.r, 0.05, Math.sin(a) * N.r);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(p);
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(p).setY(0.2);
    group.add(ring, core);
    rings.push(ring);
    const start = new THREE.Vector3(Math.cos(a) * 13, 24, Math.sin(a) * 7);
    const mid = start.clone().lerp(p, 0.5).setY(30);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, p.clone().setY(0.3));
    const pts = curve.getPoints(80);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(pts.map((_, i) => i / (pts.length - 1)), 1));
    group.add(new THREE.Line(geo, lineMat));
    anchors.push({ ...N, pos: p.clone().setY(0.6) });
  }
  return {
    group,
    anchors,
    set(v) {
      lineMat.uniforms.uShow.value = v;
      ringMat.opacity = v * 0.9;
      coreMat.opacity = v;
      group.visible = v > 0.001;
    },
    update(t) {
      lineMat.uniforms.uTime.value = t;
      rings.forEach((r, i) => { const s = 1 + 0.18 * Math.sin(t * 1.6 + i); r.scale.set(s, 1, s); });
    },
  };
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
