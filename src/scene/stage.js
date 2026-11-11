import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { createBuilding, TOP, FOCUS } from './building.js';
import { createWorld, BG } from './world.js';
import { createOffice } from './office.js';
import { createLobby } from './lobby.js';
import { createSite } from './site.js';

const DEG = Math.PI / 180;
const LOBBY_C = new THREE.Vector3(0, 3, 0);

/** Numeric scene state — every field is tweenable, so every change is reversible and smooth. */
export const DEFAULT_STATE = {
  // camera: orbit around (tx, ty, tz)
  az: 35, el: 12, dist: 105, tx: 0, ty: 22, tz: 0, sx: 0.18, sy: 0, fov: 34, orbit: 0, sway: 1,
  // facade
  night: 1, build: TOP + 2, glassLag: 0, ghost: 0, fill: -10, fillAmt: 0, chess: 0, focus: 0, dim: 1, lobbyGlass: 1,
  // world
  nodes: 0, grid: 1, site: 1, crane: 0, yard: 0,
  // interiors
  office: 0, screens: 0, laptop: 0, fly: 0, sales: 0, sign: 0, crew: 0, gate: 0,
};

export function createStage(canvas, images) {
  const isTouch = matchMedia('(pointer: coarse)').matches;
  // Pixel budget: high-density screens render slightly below native density; MSAA only where
  // pixels are large enough to need it.
  const area = window.innerWidth * window.innerHeight;
  const budget = isTouch ? 2.1e6 : 3.0e6;
  // detail pass: render at native density (up to 2x) — optimisation comes later
  const maxDpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  let dpr = maxDpr;
  const q = new URLSearchParams(location.search);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  // GPU tier: multisampling an HDR target is cheap on discrete and Apple GPUs but eats the
  // budget of integrated ones — those get FXAA instead
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  const weak = isTouch || /Intel|UHD|Iris|Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Microsoft Basic/i.test(gpu);
  // one anti-aliasing path for every device (FXAA below 1.5x density) so the HDR glow looks
  // identical everywhere; ?msaa=4 is kept for comparisons only
  const msaa = q.has('msaa') ? +q.get('msaa') : 0;
  const useFxaa = q.get('fxaa') === '1';
  const useSmaa = q.get('smaa') !== '0' && !useFxaa;
  renderer.setClearColor(BG, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x181b15, 170, 560);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.34;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xb8c4cc, 0x17140f, 0.75));
  const key = new THREE.DirectionalLight(0xffe2bd, 1.6);
  key.position.set(-50, 70, 60);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.04;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 400;
  scene.add(key, key.target);
  const KEY_DIR = new THREE.Vector3(-50, 70, 60).normalize();
  const rim = new THREE.DirectionalLight(0x9fb6ff, 0.5);
  rim.position.set(60, 30, -50);
  scene.add(rim);
  // interior lights (always present so shader programs never change)
  const officeLight = new THREE.PointLight(0xffcf9a, 0, 14, 2);
  officeLight.position.set(6, 50.6, 4.8);
  const lobbyLight = new THREE.PointLight(0xffd2a0, 16, 24, 1.6);
  lobbyLight.position.set(0, 5.4, 1);
  for (const pl of [officeLight, lobbyLight]) {
    pl.castShadow = true;
    pl.shadow.mapSize.set(1024, 1024);
    pl.shadow.bias = -0.002;
    pl.shadow.normalBias = 0.02;
    pl.shadow.camera.near = 0.1;
  }
  scene.add(officeLight, lobbyLight);

  const anchors = new Map();
  const world = createWorld();
  scene.add(world.group);
  const building = createBuilding();
  scene.add(building.root);
  const office = createOffice({ building, images, anchors });
  scene.add(office.group, office.linkGroup);
  const lobby = createLobby({ images, anchors });
  scene.add(lobby.group);
  const site = createSite({ images, anchors });
  scene.add(site.group);
  scene.traverse(o => {
    if (!(o.isMesh || o.isInstancedMesh)) return;
    const m = o.material;
    const custom = m && m.isShaderMaterial;
    const see = m && (m.transparent || m.opacity < 1 || m.isMeshBasicMaterial);
    o.castShadow = !custom && !see;
    o.receiveShadow = !custom && !(m && m.isMeshBasicMaterial);
  });
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.6 }));
  catcher.position.y = 0.03;
  catcher.receiveShadow = true;
  catcher.renderOrder = -4;
  scene.add(catcher);
  const focusIds = Object.values(FOCUS).map(f => f.floor * 100 + f.apt);
  building.glassUniforms.uFocus.value.set(...focusIds);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 2400);
  const baseStone = building.materials.stone.color.clone();
  const baseBronze = building.materials.bronze.color.clone();
  let lastDim = -1;
  const target = new THREE.Vector3();

  // ---------- post: bloom gives windows, lamps and lime accents their glow ----------
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 1.0;
  gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.25, samples: 16, distanceFallOff: 1 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  if (q.get('ao') === '0') gtao.enabled = false;
  composer.addPass(gtao);
  // threshold above 1: only emissive things (lamps, screens, lime lines, lit windows) glow,
  // never a merely well-lit surface
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.42, 1.05);
  composer.addPass(bloom);
  if (q.get('bloom') === '0') bloom.enabled = false;
  composer.addPass(new OutputPass());
  const fxaa = new ShaderPass(FXAAShader);
  fxaa.enabled = useFxaa;
  composer.addPass(fxaa);
  const smaa = new SMAAPass();
  smaa.enabled = useSmaa;
  composer.addPass(smaa);

  const state = { ...DEFAULT_STATE };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let width = 0, height = 0;
  let orbitAcc = 0;
  let time = 0;
  const listeners = [];

  function setRenderSize() {
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
    // bloom works at half resolution: same look, a quarter of the cost
    bloom.resolution.set(width * dpr * 0.5, height * dpr * 0.5);
    bloom.setSize(width * dpr * 0.5, height * dpr * 0.5);
    fxaa.material.uniforms.resolution.value.set(1 / (width * dpr), 1 / (height * dpr));
    gtao.setSize(width * dpr, height * dpr);
    smaa.setSize(width * dpr, height * dpr);
  }

  function resize(force) {
    const w = window.innerWidth, h = window.innerHeight;
    if (!force && w === width && Math.abs(h - height) < 120) return;
    width = w; height = h;
    setRenderSize();
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const portrait = () => width / height < 0.9;

  function applyState(dt) {
    const s = state;
    // 0 = interior close-up, 1 = exterior; continuous so fly-ins never jump
    const ext = THREE.MathUtils.smoothstep(s.dist, 12, 60);
    const kExt = portrait() ? Math.min(1.95, Math.pow(0.9 / (width / height), 0.62)) : Math.max(0.92, Math.pow(1.6 / (width / height), 0.35));
    const kInt = portrait() ? 1.3 : 1;
    const aspectK = THREE.MathUtils.lerp(kInt, kExt, ext);
    const swayAmt = s.sway * THREE.MathUtils.lerp(0.5, 2.2, ext);
    const az = (s.az + orbitAcc + Math.sin(time * 0.35) * swayAmt + pointer.x * THREE.MathUtils.lerp(1.6, 4, ext)) * DEG;
    const el = (s.el + pointer.y * THREE.MathUtils.lerp(1, 2.2, ext)) * DEG;
    const dist = s.dist * aspectK;
    target.set(s.tx, s.ty, s.tz);
    camera.position.set(
      target.x + Math.sin(az) * Math.cos(el) * dist,
      target.y + Math.sin(el) * dist,
      target.z + Math.cos(az) * Math.cos(el) * dist,
    );
    camera.lookAt(target);
    camera.fov = s.fov;
    camera.near = THREE.MathUtils.clamp(dist * 0.012, 0.02, 1);
    const sx = portrait() ? 0 : s.sx;
    const sy = portrait() ? s.sy : 0;
    camera.setViewOffset(width, height, -sx * width, sy * height, width, height);
    camera.updateProjectionMatrix();

    const ext2 = THREE.MathUtils.clamp(dist * 0.6, 3, 90);
    key.target.position.copy(target);
    key.position.copy(target).addScaledVector(KEY_DIR, 160);
    const sc = key.shadow.camera;
    if (Math.abs(sc.right - ext2) > ext2 * 0.02) { sc.left = -ext2; sc.right = ext2; sc.top = ext2; sc.bottom = -ext2; sc.updateProjectionMatrix(); }
    gtao.updateGtaoMaterial({ radius: THREE.MathUtils.clamp(dist * 0.035, 0.25, 4) });

    building.setBuild(s.build, s.glassLag);
    building.setGhost(s.ghost);
    const u = building.glassUniforms;
    u.uNight.value = s.night;
    u.uChess.value = s.chess;
    u.uFocusAmt.value = s.focus;
    u.uFill.value = s.fill;
    u.uFillAmt.value = s.fillAmt;
    u.uDim.value = s.dim;
    u.uLobby.value = s.lobbyGlass;
    u.uTime.value = time;
    if (s.dim !== lastDim) {
      lastDim = s.dim;
      building.materials.stone.color.copy(baseStone).multiplyScalar(0.35 + 0.65 * s.dim);
      building.materials.bronze.color.copy(baseBronze).multiplyScalar(0.35 + 0.65 * s.dim);
    }
    world.groundUniforms.uGrid.value = s.grid;
    world.groundUniforms.uSite.value = s.site;
    world.nodes.set(s.nodes);
    world.yard.visible = s.yard > 0.001;
    officeLight.intensity = 12 * s.office;

    office.update(time, s, portrait(), camera);
    const nearLobby = camera.position.distanceTo(LOBBY_C) < 42;
    lobby.update(time, dt, s, nearLobby);
    lobbyLight.shadow.autoUpdate = nearLobby;
    officeLight.shadow.autoUpdate = s.office > 0.01;
    site.update(time, dt, s);
  }

  // ---------- adaptive quality: bloom off first, then resolution ----------
  let acc = 0, frames = 0, slow = 0, slowWindows = 0, adaptOff = q.get('adapt') !== '1';
  function adapt(dt) {
    if (adaptOff) return;
    acc += dt; frames++;
    if (dt > 1 / 45) slow++;
    if (acc < 1) return;
    const frac = slow / frames;
    acc = 0; frames = 0; slow = 0;
    if (frac > 0.08 && document.visibilityState === 'visible') slowWindows++; else slowWindows = 0;
    if (slowWindows < 2) return;
    slowWindows = 0;
    if (bloom.enabled) { bloom.enabled = false; return; }
    if (dpr > 0.8) { dpr = Math.max(0.8, +(dpr - 0.2).toFixed(2)); setRenderSize(); }
  }

  let last = performance.now();
  let running = false;
  const cpu = { apply: 0, render: 0 };
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt;
    orbitAcc += state.orbit * dt;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
    const c0 = performance.now();
    world.update(time);
    applyState(dt);
    const c1 = performance.now();
    composer.render(dt);
    const c2 = performance.now();
    cpu.apply = cpu.apply * 0.9 + (c1 - c0) * 0.1;
    cpu.render = cpu.render * 0.9 + (c2 - c1) * 0.1;
    for (const fn of listeners) fn(camera, width, height, time);
    adapt(dt);
  }

  window.addEventListener('resize', () => resize(false));
  window.addEventListener('orientationchange', () => setTimeout(() => resize(true), 250));
  if (!isTouch) {
    window.addEventListener('pointermove', e => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }
  resize(true);

  return {
    renderer, scene, camera, building, world, office, lobby, site, state, anchors, composer, bloom, rt, gpu, weak, gtao,
    lights: { officeLight, lobbyLight, key, rim },
    get dpr() { return dpr; },
    cpu,
    setDpr(v) { dpr = v; setRenderSize(); },
    noAdapt() { adaptOff = true; },
    get time() { return time; },
    get size() { return { width, height }; },
    portrait,
    onFrame(fn) { listeners.push(fn); },
    /** glass of these floors dissolves around the camera (fly-through); y = floor centre or -100 */
    setOpen(yA, yB) {
      const u = building.glassUniforms;
      u.uOpenA.value.set(yA ?? -100, yA == null ? 0 : 1);
      u.uOpenB.value.set(yB ?? -100, yB == null ? 0 : 1);
    },
    settleOrbit() {
      state.az = ((state.az + orbitAcc) % 360 + 540) % 360 - 180;
      orbitAcc = 0;
    },
    /** Compile every shader variant and upload every buffer and texture before the first visible frame. */
    async warmup(states) {
      for (const st of states) {
        Object.assign(state, DEFAULT_STATE, st);
        applyState(1 / 60);
        composer.render(1 / 60);
        await new Promise(r => requestAnimationFrame(r));
      }
      if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
      Object.assign(state, DEFAULT_STATE);
    },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    },
  };
}
