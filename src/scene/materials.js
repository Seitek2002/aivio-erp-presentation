import * as THREE from 'three';
import { rng } from './geo.js';

/* Premium palette: warm limestone slabs, champagne bronze, smoked glass, walnut and travertine. */

function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

function woodPlanks(g, n) {
  const r = rng(5);
  g.fillStyle = '#3b2819';
  g.fillRect(0, 0, n, n);
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    const y = (i * n) / rows;
    let x = -r() * n * 0.5;
    while (x < n) {
      const len = n * (0.35 + r() * 0.4);
      const tone = 46 + r() * 22;
      g.fillStyle = `rgb(${tone + 18}, ${tone - 2}, ${tone - 18})`;
      g.fillRect(x, y + 1, len - 2, n / rows - 2);
      g.globalAlpha = 0.08;
      for (let k = 0; k < 14; k++) {
        g.fillStyle = r() > 0.5 ? '#1f140c' : '#6b4a30';
        g.fillRect(x, y + 2 + r() * (n / rows - 4), len, 1);
      }
      g.globalAlpha = 1;
      x += len;
    }
  }
}

function travertine(g, n) {
  const r = rng(9);
  g.fillStyle = '#d9cfbd';
  g.fillRect(0, 0, n, n);
  const tile = n / 2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const v = 212 + r() * 16;
    g.fillStyle = `rgb(${v}, ${v - 9}, ${v - 24})`;
    g.fillRect(i * tile + 1, j * tile + 1, tile - 2, tile - 2);
  }
  g.globalAlpha = 0.12;
  for (let k = 0; k < 220; k++) {
    g.strokeStyle = r() > 0.5 ? '#b8a78c' : '#efe6d6';
    g.lineWidth = 0.6 + r() * 1.4;
    const y = r() * n;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= n; x += n / 8) g.lineTo(x, y + (r() - 0.5) * 10);
    g.stroke();
  }
  g.globalAlpha = 1;
}

function walnut(g, n) {
  const r = rng(13);
  g.fillStyle = '#4a2f1d';
  g.fillRect(0, 0, n, n);
  g.globalAlpha = 0.14;
  for (let k = 0; k < 160; k++) {
    g.strokeStyle = r() > 0.5 ? '#2a1a10' : '#7a5236';
    g.lineWidth = 0.5 + r() * 2.2;
    const y = r() * n;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= n; x += n / 10) g.lineTo(x, y + Math.sin(x * 0.02 + k) * 4 + (r() - 0.5) * 3);
    g.stroke();
  }
  g.globalAlpha = 1;
}

let cache = null;

export function materials() {
  if (cache) return cache;
  const stone = new THREE.MeshStandardMaterial({ color: 0xe9e4d9, roughness: 0.5, metalness: 0 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0xb48c5c, roughness: 0.3, metalness: 1, envMapIntensity: 2.4 });
  const darkBronze = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.35, metalness: 1, envMapIntensity: 1.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa9adb0, roughness: 0.28, metalness: 1, envMapIntensity: 1.8 });
  const blackSteel = new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.35, metalness: 0.8, envMapIntensity: 1.2 });
  const railGlass = new THREE.MeshBasicMaterial({ color: 0xc6d4d6, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide });
  const lime = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd6f12b).multiplyScalar(2.2), toneMapped: false });
  const warmLight = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd7a0).multiplyScalar(2.6), toneMapped: false });
  const softLight = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1dc).multiplyScalar(1.5), toneMapped: false });

  const floorWood = new THREE.MeshStandardMaterial({ map: canvasTex(512, woodPlanks, 6), roughness: 0.42, metalness: 0, envMapIntensity: 0.9 });
  const travert = new THREE.MeshStandardMaterial({ map: canvasTex(512, travertine, 6), roughness: 0.3, metalness: 0, envMapIntensity: 1.2 });
  const walnutM = new THREE.MeshStandardMaterial({ map: canvasTex(512, walnut, 1), roughness: 0.38, metalness: 0, envMapIntensity: 1.1 });
  const walnutPanel = new THREE.MeshStandardMaterial({ map: canvasTex(512, walnut, 2), roughness: 0.55, metalness: 0, color: 0x9a8070 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x1e1a17, roughness: 0.45, metalness: 0 });
  const fabric = new THREE.MeshStandardMaterial({ color: 0xbdb3a3, roughness: 0.95 });
  const plaster = new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.9 });
  const ceiling = new THREE.MeshStandardMaterial({ color: 0x2b2520, roughness: 0.8 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x3f5a35, roughness: 0.8, flatShading: true });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xe9e5dc, roughness: 0.3 });
  const screenOff = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.15, metalness: 0.2, envMapIntensity: 1.4 });
  const mannequin = new THREE.MeshStandardMaterial({ color: 0xe7e2d7, roughness: 0.62 });
  const mannequinDark = new THREE.MeshStandardMaterial({ color: 0x2b2b2d, roughness: 0.7 });
  const hardHat = new THREE.MeshStandardMaterial({ color: 0xd6f12b, roughness: 0.4 });
  const vest = new THREE.MeshStandardMaterial({ color: 0xff7a3d, roughness: 0.7 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9b978d, roughness: 0.95 });
  const plywood = new THREE.MeshStandardMaterial({ color: 0xb98d55, roughness: 0.8 });
  const rebar = new THREE.MeshStandardMaterial({ color: 0x6b4a36, roughness: 0.7, metalness: 0.6 });

  cache = {
    stone, bronze, darkBronze, steel, blackSteel, railGlass, lime, warmLight, softLight,
    floorWood, travert, walnut: walnutM, walnutPanel, leather, fabric, plaster, ceiling, paper,
    leaf, ceramic, screenOff, mannequin, mannequinDark, hardHat, vest, concrete, plywood, rebar,
  };
  return cache;
}

/** Screen material that shows a texture, optionally blending to a second one (laptop). */
export function screenMaterial(map, { brightness = 0.92, mapB = null } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map }, uMapB: { value: mapB || map }, uMix: { value: 0 },
      uOn: { value: 1 }, uBright: { value: brightness }, uTime: { value: 0 },
      uReveal: { value: 1 }, uGlowRect: { value: new THREE.Vector4(-1, -1, -1, -1) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform sampler2D uMapB; uniform float uMix; uniform float uOn;
      uniform float uBright; uniform float uTime; uniform float uReveal;
      varying vec2 vUv;
      void main(){
        vec3 a = texture2D(uMap, vUv).rgb;
        vec3 b = texture2D(uMapB, vUv).rgb;
        vec3 c = mix(a, b, uMix);
        // data "filling in" top to bottom
        float rv = smoothstep(vUv.y - 0.02, vUv.y + 0.02, 1.0 - uReveal * 1.05);
        float scan = (1.0 - smoothstep(0.0, 0.025, abs((1.0 - vUv.y) - uReveal))) * step(uReveal, 0.999);
        c = mix(c, vec3(0.05, 0.06, 0.05), rv * 0.92);
        c += vec3(0.84, 0.95, 0.17) * scan * 0.45;
        vec3 off = vec3(0.012, 0.014, 0.015);
        gl_FragColor = vec4(mix(off, c * uBright, uOn), 1.0);
        #include <colorspace_fragment>
      }`,
    toneMapped: false,
  });
}

export function imageTexture(img) {
  const t = new THREE.Texture(img);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}
