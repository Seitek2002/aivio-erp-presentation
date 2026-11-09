import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBuilding, TOP } from './building.js';
import { createWorld, BG } from './world.js';

const DEG = Math.PI / 180;

/** Numeric scene state — every field is tweenable. */
export const DEFAULT_STATE = {
  az: 35, el: 12, dist: 105, ty: 22, sx: 0.18, sy: 0, fov: 34,
  explode: 0, twist: 1, chess: 0, night: 1, build: TOP + 2, glassLag: 0, ghost: 0,
  fill: -10, fillAmt: 0, hiFloor: -10, hi: 0, crane: 0, nodes: 0, dim: 1, grid: 1, site: 1,
  orbit: 0, sway: 1,
};

export function createStage(canvas) {
  const isTouch = matchMedia('(pointer: coarse)').matches;
  // Pixel budget: high-density screens render slightly below native density (edges stay crisp,
  // the GPU keeps headroom); MSAA only where pixels are large enough to need it.
  const area = window.innerWidth * window.innerHeight;
  const budget = isTouch ? 2.4e6 : 3.2e6;
  const maxDpr = Math.max(1, Math.min(window.devicePixelRatio || 1, isTouch ? 2 : 1.5, Math.sqrt(budget / area)));
  let dpr = maxDpr;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: dpr * dpr * area <= 2.3e6,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setClearColor(BG, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;

  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x181b15, 160, 520);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xb8c4cc, 0x14160f, 0.7));
  const key = new THREE.DirectionalLight(0xffe3c0, 1.75);
  key.position.set(-50, 70, 60);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb6ff, 0.55);
  rim.position.set(60, 30, -50);
  scene.add(rim);

  const world = createWorld();
  scene.add(world.group);
  const building = createBuilding();
  scene.add(building.root);

  const camera = new THREE.PerspectiveCamera(34, 1, 1, 2000);
  const baseConcrete = building.materials.concrete.color.clone();
  const baseMetal = building.materials.metal.color.clone();
  let lastDim = -1;
  const target = new THREE.Vector3();

  const state = { ...DEFAULT_STATE };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let width = 0, height = 0;
  let orbitAcc = 0;
  let time = 0;
  const listeners = [];

  function resize(force) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // ignore small height jitter from mobile browser chrome
    if (!force && w === width && Math.abs(h - height) < 120) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const portrait = () => width / height < 0.9;

  function applyState(dt) {
    const s = state;
    // camera
    const aspectK = portrait() ? Math.min(1.95, Math.pow(0.9 / (width / height), 0.62)) : Math.max(0.92, Math.pow(1.6 / (width / height), 0.35));
    const sway = s.sway * Math.sin(time * 0.35) * 2.2;
    const az = (s.az + orbitAcc + sway + pointer.x * 4) * DEG;
    const el = (s.el + pointer.y * 2.2) * DEG;
    const dist = s.dist * aspectK;
    target.set(0, s.ty, 0);
    camera.position.set(
      target.x + Math.sin(az) * Math.cos(el) * dist,
      target.y + Math.sin(el) * dist,
      target.z + Math.cos(az) * Math.cos(el) * dist,
    );
    camera.lookAt(target);
    if (camera.fov !== s.fov) { camera.fov = s.fov; }
    const sx = portrait() ? 0 : s.sx;
    const sy = portrait() ? s.sy : 0;
    camera.setViewOffset(width, height, -sx * width, sy * height, width, height);
    camera.updateProjectionMatrix();

    // building
    building.setExplode(s.explode, s.twist);
    building.setBuild(s.build, s.glassLag);
    building.setGhost(s.ghost);
    building.setCrane(s.crane, time);
    const u = building.glassUniforms;
    u.uNight.value = s.night;
    u.uChess.value = s.chess;
    u.uFill.value = s.fill;
    u.uFillAmt.value = s.fillAmt;
    u.uHiFloor.value = s.hiFloor;
    u.uHi.value = s.hi;
    u.uDim.value = s.dim;
    if (s.dim !== lastDim) {
      lastDim = s.dim;
      const m = building.materials;
      m.concrete.color.copy(baseConcrete).multiplyScalar(0.35 + 0.65 * s.dim);
      m.metal.color.copy(baseMetal).multiplyScalar(0.35 + 0.65 * s.dim);
    }
    u.uTime.value = time;
    world.groundUniforms.uGrid.value = s.grid;
    world.groundUniforms.uSite.value = s.site;
    world.nodes.set(s.nodes);
  }

  // adaptive resolution — keeps frame time in budget on weaker GPUs
  let acc = 0, frames = 0, slow = 0, slowWindows = 0;
  function adapt(dt) {
    acc += dt; frames++;
    if (dt > 1 / 45) slow++;
    if (acc < 1) return;
    const frac = slow / frames;
    acc = 0; frames = 0; slow = 0;
    if (frac > 0.08 && document.visibilityState === 'visible') slowWindows++; else slowWindows = 0;
    if (slowWindows >= 2 && dpr > 0.8) {
      dpr = Math.max(0.8, +(dpr - 0.2).toFixed(2));
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      slowWindows = 0;
    }
  }

  let last = performance.now();
  let running = false;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt;
    orbitAcc += state.orbit * dt;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
    world.update(time);
    applyState(dt);
    renderer.render(scene, camera);
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
    renderer, scene, camera, building, world, state,
    get time() { return time; },
    get size() { return { width, height }; },
    portrait,
    onFrame(fn) { listeners.push(fn); },
    /** Absorb the accumulated idle orbit into az so the next tween starts from what is on screen. */
    settleOrbit() {
      state.az = ((state.az + orbitAcc) % 360 + 540) % 360 - 180;
      orbitAcc = 0;
    },
    /** Compile every shader variant and upload geometry before the first visible frame. */
    async warmup(states) {
      building.crane.visible = true;
      world.nodes.group.visible = true;
      for (const st of states) {
        Object.assign(state, DEFAULT_STATE, st);
        applyState(0);
        building.crane.visible = true;
        world.nodes.group.visible = true;
        renderer.render(scene, camera);
        await new Promise(r => requestAnimationFrame(r));
      }
      if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    },
    renderOnce() { applyState(0); renderer.render(scene, camera); },
  };
}
