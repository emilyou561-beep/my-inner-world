import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { detailed as kitDetailed } from './kit';
import { Decay } from './decay';
import { rustMaterial, streakMaterial } from './rust';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root was not found.');
app.innerHTML = `
  <div id="scene" aria-label="Monumental brutalist exterior"></div>
  <header><div class="eyebrow">CONCRETE WORLD / 002</div><h1>THE MONUMENTAL EXTERIOR</h1></header>
  <aside aria-label="Scene controls"><div class="panel-title">ATMOSPHERE</div>
    <label for="fog">FOG <output id="fog-value">0.0012</output><input id="fog" type="range" min="0.0004" max="0.02" step="0.0002" value="0.0012"></label>
    <label for="light">LIGHT <output id="light-value">1.0</output><input id="light" type="range" min="0.3" max="2" step="0.1" value="1.0"></label>
    <a class="panel-link" href="/classic-003.html">NEXT SCENE</a><a class="panel-link" href="/classic-001.html">SCENE 001</a><button id="hide" type="button">HIDE UI</button>
  </aside><button id="show" type="button" hidden>SHOW UI</button>`;

// ---------------------------------------------------------------- renderer
// Overcast, fully diffuse light (per the Concretecore reference): pale cyan-grey sky, no hard sun.
const SKY = new THREE.Color(0xc4cdcb);
const scene = new THREE.Scene();
scene.background = SKY;
scene.fog = new THREE.FogExp2(SKY, 0.0012);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 5000);
camera.position.set(0, 5.5, 22);
camera.rotation.order = 'YXZ';
let yaw = 0;
let pitch = 0.5;
camera.rotation.set(pitch, yaw, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.querySelector('#scene')!.appendChild(renderer.domElement);

// ---------------------------------------------------------------- materials
const loader = new THREE.TextureLoader();
function tex(path: string, color = false) {
  const t = loader.load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const cMap = tex('/textures/lightwall_diff_2k.jpg', true);
const cNor = tex('/textures/lightwall_nor_gl_2k.jpg');
const cRough = tex('/textures/lightwall_rough_2k.jpg');

// Surface detail and weathering come from the shared kit (panel joints, tie holes, damp tide marks, rust, pitting).
const detailed = (m: THREE.MeshStandardMaterial, joints: number) => kitDetailed(m, { joints, streaks: 2.4, weather: joints ? 1.9 : 1.1 });
const concrete = detailed(new THREE.MeshStandardMaterial({ color: 0x959996, map: cMap, normalMap: cNor, normalScale: new THREE.Vector2(0.12, 0.12), roughnessMap: cRough, roughness: 0.97 }), 1);
const darkConcrete = detailed(new THREE.MeshStandardMaterial({ color: 0x6c7070, map: cMap, normalMap: cNor, normalScale: new THREE.Vector2(0.12, 0.12), roughnessMap: cRough, roughness: 0.98 }), 1);
const plainConcrete = detailed(new THREE.MeshStandardMaterial({ color: 0xb0b4b3, map: cMap, normalMap: cNor, normalScale: new THREE.Vector2(0.1, 0.1), roughnessMap: cRough, roughness: 0.98 }), 0);
const groundMat = detailed(new THREE.MeshStandardMaterial({ color: 0xa4aaab, map: cMap, normalMap: cNor, normalScale: new THREE.Vector2(0.2, 0.2), roughnessMap: cRough, roughness: 0.98 }), 0);
const glass = new THREE.MeshStandardMaterial({ color: 0x2b3637, roughness: 0.32, metalness: 0.15 });
const steel = new THREE.MeshStandardMaterial({ color: 0x3e4344, roughness: 0.6, metalness: 0.4 });
const voidMat = new THREE.MeshStandardMaterial({ color: 0x0f1213, roughness: 1 });

// ---------------------------------------------------------------- geometry batching
// Thousands of small parts (mullions, rails, sills) are merged into one mesh per material.
const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
const TILE = 9;
// While BIG is set, everything pushed is scaled up about the structure's centre line (see below).
let BIG: THREE.Matrix4 | null = null;
function push(geo: THREE.BufferGeometry, mat: THREE.Material) {
  if (BIG) geo.applyMatrix4(BIG);
  if (geo.index) geo = geo.toNonIndexed();   // mixed indexed/non-indexed parts would fail to merge
  if (!batches.has(mat)) batches.set(mat, []);
  batches.get(mat)!.push(geo);
}
function box(x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material = concrete) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * size[f][0] / TILE + x * 0.013, uv.getY(i) * size[f][1] / TILE + y * 0.011 + z * 0.007);
  }
  geo.translate(x, y, z);
  push(geo, mat);
}
const UP = new THREE.Vector3(0, 1, 0);
function strut(a: THREE.Vector3, b: THREE.Vector3, size: number, mat: THREE.Material = plainConcrete) {
  const dir = b.clone().sub(a);
  const geo = new THREE.BoxGeometry(size, dir.length(), size);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  geo.translate(mid.x, mid.y, mid.z);
  push(geo, mat);
}
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- component library
type Face = 'front' | 'left' | 'right' | 'back';
// Places a part on a face: `u` runs along the face, `out` is distance in front of the face plane.
function onFace(f: Face, cx: number, cz: number, w: number, d: number, u: number, y: number, out: number,
  len: number, h: number, depth: number, mat: THREE.Material) {
  if (f === 'front') box(cx + u, y, cz + d / 2 + out, len, h, depth, mat);
  else if (f === 'back') box(cx + u, y, cz - d / 2 - out, len, h, depth, mat);
  else if (f === 'left') box(cx - w / 2 - out, y, cz + u, depth, h, len, mat);
  else box(cx + w / 2 + out, y, cz + u, depth, h, len, mat);
}

// A horizontal ribbon window with sill, head, jambs, mullions and a transom.
function ribbon(f: Face, cx: number, cz: number, w: number, d: number, u: number, y0: number, len: number) {
  const H = 1.8;
  onFace(f, cx, cz, w, d, u, y0 + H / 2, 0.02, len, H, 0.06, glass);
  onFace(f, cx, cz, w, d, u, y0 - 0.1, 0.22, len + 0.7, 0.2, 0.45, concrete);         // sill
  onFace(f, cx, cz, w, d, u, y0 + H + 0.14, 0.14, len + 0.4, 0.28, 0.28, concrete);   // head
  onFace(f, cx, cz, w, d, u - len / 2 - 0.12, y0 + H / 2, 0.14, 0.24, H, 0.28, concrete);
  onFace(f, cx, cz, w, d, u + len / 2 + 0.12, y0 + H / 2, 0.14, 0.24, H, 0.28, concrete);
  const n = Math.max(1, Math.round(len / 1.25));
  for (let i = 1; i < n; i++) onFace(f, cx, cz, w, d, u - len / 2 + (i * len) / n, y0 + H / 2, 0.06, 0.07, H, 0.08, steel);
  onFace(f, cx, cz, w, d, u, y0 + 1.2, 0.06, len, 0.06, 0.08, steel);
}

// Steel guard railing along a top edge.
function railing(f: Face, cx: number, cz: number, w: number, d: number, yTop: number, len: number) {
  const n = Math.max(2, Math.round(len / 1.7));
  for (let i = 0; i <= n; i++) onFace(f, cx, cz, w, d, -len / 2 + (i * len) / n, yTop + 0.55, -0.35, 0.06, 1.1, 0.06, steel);
  onFace(f, cx, cz, w, d, 0, yTop + 1.1, -0.35, len, 0.06, 0.06, steel);
  onFace(f, cx, cz, w, d, 0, yTop + 0.6, -0.35, len, 0.04, 0.04, steel);
}

// Ventilation louvre panel.
function louvre(f: Face, cx: number, cz: number, w: number, d: number, u: number, yc: number, len: number, h: number) {
  onFace(f, cx, cz, w, d, u, yc, 0.01, len, h, 0.05, voidMat);
  const n = Math.round(h / 0.32);
  for (let i = 0; i < n; i++) onFace(f, cx, cz, w, d, u, yc - h / 2 + (i + 0.5) * (h / n), 0.12, len, 0.06, 0.26, plainConcrete);
  onFace(f, cx, cz, w, d, u, yc + h / 2 + 0.12, 0.15, len + 0.5, 0.24, 0.32, concrete);
  onFace(f, cx, cz, w, d, u, yc - h / 2 - 0.12, 0.15, len + 0.5, 0.24, 0.32, concrete);
}

// A stacked concrete volume dressed with ribbon windows, roof cap and railings.
interface ModOpts { faces?: Face[]; every?: number; margin?: number; rail?: boolean; mat?: THREE.Material; split?: boolean }
function volume(cx: number, y0: number, cz: number, w: number, h: number, d: number, o: ModOpts = {}) {
  const faces = o.faces ?? ['front', 'left', 'right'];
  const mat = o.mat ?? concrete;
  box(cx, y0 + h / 2, cz, w, h, d, mat);
  box(cx, y0 + h + 0.25, cz, w + 0.5, 0.5, d + 0.5, darkConcrete);              // roof cap / drip edge
  box(cx, y0 - 0.2, cz, w + 0.3, 0.4, d + 0.3, darkConcrete);                   // soffit edge
  const every = o.every ?? 1;
  const margin = o.margin ?? 2.6;
  for (const f of faces) {
    const extent = f === 'front' || f === 'back' ? w : d;
    let k = 0;
    for (let yy = Math.ceil((y0 + 1.6) / 4.5) * 4.5; yy + 1.8 <= y0 + h - 1.4; yy += 4.5, k++) {
      if (k % every !== 0) continue;
      const len = extent - margin * 2;
      if (len < 3) continue;
      if (o.split && len > 20) {
        const half = (len - 3) / 2;
        ribbon(f, cx, cz, w, d, -len / 2 + half / 2, yy, half);
        ribbon(f, cx, cz, w, d, len / 2 - half / 2, yy, half);
      } else ribbon(f, cx, cz, w, d, 0, yy, len);
    }
    if (o.rail !== false) railing(f, cx, cz, w, d, y0 + h + 0.5, extent - 0.6);
  }
}

// ---------------------------------------------------------------- site: plateau on a cliff
box(0, -0.6, -720, 1800, 1.2, 1500, groundMat);                     // plateau, ends at z = 30
box(0, -21, 31, 1800, 42, 6, darkConcrete);                          // cliff face (overlaps plateau edge: no seam)
box(0, -42.5, 150, 600, 1, 240, groundMat);                         // barren plain far below
box(0, 0.55, 29.4, 1800, 1.1, 0.4, darkConcrete);                    // low edge wall behind the observer
railing('front', 0, 29.4, 0, 0, 1.1, 80);

// ---------------------------------------------------------------- megastructure
// One colossal monolith instead of a stack of blocks: a 140 x 200 m concrete slab pierced by a
// 34 m round aperture lined in steel, with a tiny gate at its foot for scale.
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const metal = new THREE.MeshStandardMaterial({ color: 0x737a7d, metalness: 0.9, roughness: 0.4, envMap, envMapIntensity: 1.0 });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x3d4245, metalness: 0.85, roughness: 0.5, envMap, envMapIntensity: 0.8 });
const glow = new THREE.MeshStandardMaterial({ color: 0x0c0f10, emissive: 0xe4f3f6, emissiveIntensity: 2.2, roughness: 1 });
// Rusted iron for the clock and the window frames; dark glass behind them.
const rustIron = rustMaterial({ amount: 0.8, seed: 3, envMap, repeat: 2, tint: 0xd4b4a0 });
const rustHeavy = rustMaterial({ amount: 1, seed: 5, envMap, repeat: 2, tint: 0xc8a48c });
const darkGlass = new THREE.MeshStandardMaterial({ color: 0x0b0e0f, roughness: 0.2, metalness: 0.6, envMap, envMapIntensity: 0.15 });
const streaks = streakMaterial();
// A rust/water run decal hanging down a +z-facing concrete face from (x, yTop).
function stain(x: number, yTop: number, z: number, w: number, len: number) {
  const g = new THREE.PlaneGeometry(w, len); g.translate(x, yTop - len / 2, z); push(g, streaks);
}

// A tall, interlocking stack of hollow concrete boxes cantilevering in every direction, carried on
// leaning slab legs. At its heart a massive square block holds the stopped clock.
const MZ = -150, MD = 28, AY = 122, AR = 34, CW = 100;
// The structure and clock are designed in the units below, then built 2.4x larger: about 1.2 km
// tall and 700 m wide, its upper tiers leaning out over the observer's head.
const K = 2.4;
const BACK = -100;   // pushed back so it rises up out of the view instead of walling it off
BIG = new THREE.Matrix4().makeTranslation(0, 0, MZ + BACK).multiply(new THREE.Matrix4().makeScale(K, K, K)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -MZ));
const clockRoot = new THREE.Group(); clockRoot.position.set(0, 0, MZ * (1 - K) + BACK); clockRoot.scale.setScalar(K); scene.add(clockRoot);
// Clock block: a solid square slab pierced by the round clock aperture.
{
  const shape = new THREE.Shape();
  shape.moveTo(-CW / 2, AY - CW / 2); shape.lineTo(CW / 2, AY - CW / 2); shape.lineTo(CW / 2, AY + CW / 2); shape.lineTo(-CW / 2, AY + CW / 2); shape.lineTo(-CW / 2, AY - CW / 2);
  const hole = new THREE.Path(); hole.absarc(0, AY, AR, 0, Math.PI * 2, true); shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: MD, bevelEnabled: false, curveSegments: 96 });
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / TILE, uv.getY(i) / TILE);
  geo.translate(0, 0, MZ - MD / 2);
  push(geo, concrete);
}
const front = MZ + MD / 2;
// Steel sleeve lining the aperture, with heavy rims front and back and a light line inside.
{
  const sleeve = new THREE.CylinderGeometry(AR - 0.3, AR - 0.3, MD + 1, 128, 1, true);
  sleeve.rotateX(Math.PI / 2); sleeve.translate(0, AY, MZ); push(sleeve, rustIron);
  for (const [z, t] of [[front + 0.6, 1.6], [MZ - MD / 2 - 0.6, 1.2]] as [number, number][]) {
    const rim = new THREE.TorusGeometry(AR + 0.4, t, 16, 160); rim.translate(0, AY, z); push(rim, rustHeavy);
  }
  const line = new THREE.TorusGeometry(AR - 0.45, 0.22, 8, 160); line.translate(0, AY, front - 4); push(line, glow);
  // radial steel ribs around the rim, like the stiffeners of a pressure door
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const g = new THREE.BoxGeometry(1.1, 7, 1.6);
    g.translate(0, AR + 3, 0); g.rotateZ(a); g.translate(0, AY, front + 0.6); push(g, rustHeavy);
  }
}
// ---------------------------------------------------------------- the clock in the aperture
// A stopped clock fills the round opening. Its hour hand is seized; the minute hand keeps trying to
// move on, jerks forward, shudders and falls back, never getting anywhere. A loose second hand hangs.
function clockFace(): THREE.CanvasTexture {
  const S = 2048, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!; const C = S / 2;
  g.fillStyle = '#b9bbb4'; g.fillRect(0, 0, S, S);
  // grime: darker toward the rim, mottled patches
  const v = g.createRadialGradient(C, C, S * 0.15, C, C, S * 0.5);
  v.addColorStop(0, 'rgba(60,58,50,0)'); v.addColorStop(1, 'rgba(50,46,38,0.55)'); g.fillStyle = v; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 20 + Math.random() * 160;
    const p = g.createRadialGradient(x, y, 0, x, y, r);
    p.addColorStop(0, `rgba(${60 + Math.random() * 40},${55 + Math.random() * 20},40,${0.08 + Math.random() * 0.18})`); p.addColorStop(1, 'rgba(60,55,40,0)');
    g.fillStyle = p; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // marks: 60 minute ticks, 12 heavy hour bars
  g.translate(C, C);
  for (let i = 0; i < 60; i++) {
    g.save(); g.rotate((i / 60) * Math.PI * 2);
    if (i % 5 === 0) { g.fillStyle = '#26292a'; g.fillRect(-26, -C * 0.93, 52, C * 0.17); }
    else { g.fillStyle = '#3a3d3d'; g.fillRect(-7, -C * 0.93, 14, C * 0.06); }
    g.restore();
  }
  g.strokeStyle = '#2a2d2d'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, C * 0.95, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(0, 0, C * 0.72, 0, Math.PI * 2); g.stroke();
  g.setTransform(1, 0, 0, 1, 0, 0);
  // rust and damp drips running down from the hour bars
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, rr = C * (0.3 + Math.random() * 0.62);
    const x = C + Math.sin(a) * rr, y = C - Math.cos(a) * rr;
    const rust = Math.random() < 0.5;
    const len = 60 + Math.random() * 420;
    const gr = g.createLinearGradient(0, y, 0, y + len);
    gr.addColorStop(0, rust ? 'rgba(110,55,20,0.6)' : 'rgba(40,40,34,0.45)'); gr.addColorStop(1, 'rgba(60,40,20,0)');
    g.fillStyle = gr; g.fillRect(x, y, 4 + Math.random() * 12, len);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const CLOCK_Z = front - 6;
const clockMat = new THREE.MeshStandardMaterial({ map: clockFace(), roughness: 0.85 });
const face = new THREE.Mesh(new THREE.CircleGeometry(AR - 0.25, 160), clockMat);
face.position.set(0, AY, CLOCK_Z); face.receiveShadow = true; clockRoot.add(face);
function hand(len: number, tail: number, width: number, depth: number, mat: THREE.Material, z: number) {
  const pivot = new THREE.Group(); pivot.position.set(0, AY, z);
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -tail); shape.lineTo(width / 2, -tail); shape.lineTo(width * 0.32, len * 0.92); shape.lineTo(0, len); shape.lineTo(-width * 0.32, len * 0.92); shape.lineTo(-width / 2, -tail);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; pivot.add(m); clockRoot.add(pivot);
  return pivot;
}
const handMat = rustMaterial({ amount: 0.5, seed: 9, envMap, tint: 0x8a8a8a, repeat: 0.3 });
const rustMat = new THREE.MeshStandardMaterial({ color: 0x5b3420, metalness: 0.4, roughness: 0.8 });
const hourHand = hand(AR * 0.52, 4, 3.0, 0.6, handMat, CLOCK_Z + 0.05);
const minuteHand = hand(AR * 0.86, 6, 1.7, 0.5, handMat, CLOCK_Z + 0.7);
const secondHand = hand(AR * 0.8, 5, 0.35, 0.2, rustMat, CLOCK_Z + 1.25);
{
  const hub = new THREE.CylinderGeometry(2.4, 2.6, 2.2, 48); hub.rotateX(Math.PI / 2); hub.translate(0, AY, CLOCK_Z + 0.9);
  const m = new THREE.Mesh(hub, rustHeavy); m.castShadow = true; clockRoot.add(m);
}
const HOUR = 4 + 47 / 60, MIN = 47;            // stopped at 4:47
hourHand.rotation.z = -(HOUR / 12) * Math.PI * 2;
const minuteBase = -(MIN / 60) * Math.PI * 2;
const clockState = { a: minuteBase, v: 0, target: minuteBase, next: 1.2, hold: 0, burst: 0 };
function updateClock(dt: number, t: number) {
  const s = clockState;
  if (t > s.next) {
    if (s.burst > 0) {                          // a run of small, nervous twitches
      s.target = minuteBase - (Math.random() - 0.3) * 0.05; s.burst--; s.next = t + 0.05 + Math.random() * 0.09;
    } else if (Math.random() < 0.35) {
      s.burst = 3 + Math.floor(Math.random() * 6); s.next = t;
    } else {                                    // try to reach the next minute, fail, fall back
      s.target = minuteBase - (Math.PI * 2 / 60) * (0.6 + Math.random() * 0.5);
      s.hold = t + 0.12 + Math.random() * 0.35; s.next = t + 0.6 + Math.random() * 1.6;
    }
  }
  if (s.hold && t > s.hold) { s.target = minuteBase; s.hold = 0; }
  // stiff, under-damped spring: overshoot and shudder on every move
  const k = 900, c = 14;
  const steps = Math.ceil(dt / 0.004);
  for (let i = 0; i < steps; i++) { const h = dt / steps; s.v += (k * (s.target - s.a) - c * s.v) * h; s.a += s.v * h; }
  const tremor = Math.sin(t * 61) * 0.0025 + Math.sin(t * 37.7) * 0.002;
  minuteHand.rotation.z = s.a + tremor;
  // the loose second hand hangs straight down and sways with each jolt of the mechanism
  secondHand.rotation.z = Math.PI + Math.sin(t * 1.3) * 0.05 + s.v * 0.02;
}

// ---------------------------------------------------------------- the stack
const decay = new Decay(clockRoot as unknown as THREE.Scene, { envMap });   // grass on the structure, scaled with it
// A hollow box: four thick slabs, open at both ends along `open`. `back` adds a recessed inner wall.
let frameNo = 0;
function frame(cx: number, cy: number, cz: number, w: number, h: number, d: number, t: number, open: 'x' | 'z', back = false, fill = true) {
  const n = frameNo++;
  box(cx, cy + h / 2 - t / 2, cz, w, t, d, concrete);
  box(cx, cy - h / 2 + t / 2, cz, w, t, d, concrete);
  if (open === 'z') {
    for (const sx of [-1, 1]) box(cx + sx * (w / 2 - t / 2), cy, cz, t, h - 2 * t, d, concrete);
    if (back) box(cx, cy, cz - d * 0.15, w - 2 * t, h - 2 * t, t * 0.8, darkConcrete);
  } else {
    for (const sz of [-1, 1]) box(cx, cy, cz + sz * (d / 2 - t / 2), w, h - 2 * t, t, concrete);
    if (back) box(cx - w * 0.15, cy, cz, t * 0.8, h - 2 * t, d - 2 * t, darkConcrete);
  }
  // a thickened drip edge under the front of the top slab
  box(cx, cy + h / 2 - t - 0.6, cz + d / 2 - 0.8, w, 1.2, 1.6, darkConcrete);
  if (fill) glaze(cx, cy, cz, w, h, d, t, open, n);
  // rust and water running down any wall that faces us
  if (open === 'x') stain(cx, cy + h / 2 - t, cz + d / 2 + 0.06, w * 0.95, h - 2 * t);
  // dry grass along the top edge, some hanging over
  for (let k = 0; k < 3; k++) if ((n * 7 + k * 3) % 5 < 3) decay.weeds(cx + (k - 1) * w * 0.3, cy + h / 2, cz + d / 2 - 1.5, 2.5, n * 31 + k, 26, 3.2);
}
// Fill an opening with dark glass behind a rusted iron grid; every other box gets a coarse
// industrial grid, the rest a fine one. Both ends are filled.
function glaze(cx: number, cy: number, cz: number, w: number, h: number, d: number, t: number, open: 'x' | 'z', n: number) {
  const span = (open === 'z' ? w : d) - 2 * t, ih = h - 2 * t, inset = 1.4;
  const cell = n % 2 ? 5.5 : 2.6, bar = n % 2 ? 0.7 : 0.35;
  const cols = Math.max(1, Math.round(span / cell)), rows = Math.max(1, Math.round(ih / (cell * 1.1)));
  for (const end of [1, -1]) {
    // position along the opening axis and a mapper from (u along span, v height) to a box
    const at = (u: number, v: number, uw: number, vh: number, depth: number, mat: THREE.Material, off = 0) => {
      if (open === 'z') box(cx + u, cy + v, cz + end * (d / 2 - inset - off), uw, vh, depth, mat);
      else box(cx + end * (w / 2 - inset - off), cy + v, cz + u, depth, vh, uw, mat);
    };
    at(0, 0, span, ih, 0.12, darkGlass, 0.3);
    for (let i = 0; i <= cols; i++) at(-span / 2 + (i * span) / cols, 0, bar, ih, bar, rustIron);
    for (let j = 0; j <= rows; j++) at(0, -ih / 2 + (j * ih) / rows, span, bar, bar, rustIron);
    // a heavier rusted sill and head
    at(0, -ih / 2 + 0.4, span + 0.4, 0.8, 1.2, rustHeavy, -0.3);
  }
}
const L1 = 42;
// Grounding: a solid podium with deep dark bays, and wall-like pylons under each side cluster.
box(0, L1 / 2, MZ + 2, 250, L1, 66, plainConcrete);
for (const [x, w, l] of [[-112, 14, 30], [-70, 22, 36], [-20, 18, 26], [24, 26, 38], [70, 16, 30], [112, 20, 34]]) stain(x, L1, MZ + 35.06, w, l);
box(0, L1 + 1.5, MZ + 36, 252, 3, 4, darkConcrete);                  // heavy cornice over the podium
box(-104, 64, -124, 36, 44, 30, darkConcrete);                       // left pylon, podium to cluster
box(-110, 121, -150, 40, 16, 40, darkConcrete);
box(132, 28.5, -150, 30, 57, 36, darkConcrete);                      // right pylon, ground to cluster
box(80, 63, -110, 24, 42, 20, darkConcrete);
box(110, 140, -130, 30, 18, 30, darkConcrete);
// First tier: two wide boxes, one open to the front, one turned sideways.
frame(-42, L1 + 15, MZ + 6, 128, 30, 62, 4, 'z', true);
frame(62, L1 + 20, MZ - 4, 96, 40, 72, 4, 'x');
// The clock block sits in a deep square frame, which projects past the clock face like a hood.
frame(0, AY, MZ - 2, 118, 118, 46, 7, 'z', false, false);
// Left cluster, cantilevering forward and out.
frame(-104, 100, -124, 72, 28, 46, 4, 'x', true);
frame(-92, 146, -162, 62, 34, 60, 4, 'z', true);
frame(-128, 178, -140, 48, 26, 52, 4, 'x');
box(-78, 196, -150, 40, 30, 50, darkConcrete);
// Right cluster.
frame(102, 112, -140, 64, 40, 54, 4, 'z', true);
frame(116, 160, -118, 52, 24, 72, 4, 'x');
frame(80, 96, -110, 44, 24, 36, 3.5, 'x');
frame(132, 72, -150, 40, 30, 44, 4, 'z');
// The upper tower: boxes turning and stepping as they climb into the fog.
// Each tier steps forward of the one below, so the top of the stack hangs out over the observer.
const upper: [number, number, number, number, number, number, 'x' | 'z', boolean][] = [
  [-10, 196, -150, 132, 36, 72, 'x', true], [28, 234, -138, 92, 40, 62, 'z', true], [-36, 268, -130, 104, 30, 58, 'x', false],
  [12, 302, -118, 92, 38, 72, 'z', true], [44, 336, -108, 104, 30, 62, 'x', false], [-22, 368, -98, 92, 34, 72, 'z', true],
  [18, 400, -90, 120, 30, 66, 'x', false], [-30, 432, -82, 130, 34, 76, 'z', true], [26, 466, -76, 110, 36, 70, 'x', true],
  [-8, 500, -68, 150, 34, 86, 'z', true],
];
for (const [x, y, z, w, h, d, o, bk] of upper) frame(x, y, z, w, h, d, 4, o, bk);
// A solid spine behind everything ties the stack together from the ground to the top.
box(0, 258, -196, 56, 516, 34, darkConcrete);
// Raking struts from the spine up to the undersides of the overhanging tiers.
function rake(x: number, y0: number, z0: number, y1: number, z1: number, w: number, t: number) {
  const dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dy, dz);
  const g = new THREE.BoxGeometry(w, len, t); g.rotateX(Math.atan2(dz, dy)); g.translate(x, (y0 + y1) / 2, (z0 + z1) / 2); push(g, plainConcrete);
}
for (const x of [-34, 34]) { rake(x, 250, -182, 380, -110, 10, 5); rake(x * 0.6, 340, -182, 480, -84, 9, 5); }
const coreFront = -179;
// Rust bleeding from the clock rim down the block face, and long water runs down the spine.
stain(0, AY - AR - 3, front + 0.06, 60, 12);
stain(-32, AY + 48, front + 0.06, 26, 14); stain(33, AY + 48, front + 0.06, 24, 13);
for (const [x, y, w, l] of [[-18, 400, 18, 120], [14, 300, 22, 140], [-8, 190, 30, 120], [10, 110, 20, 100]]) stain(x, y, coreFront + 0.06, w, l);
// Dry grass along the podium cornice.
for (const x of [-110, -60, -20, 30, 70, 115]) decay.weeds(x, L1 + 3, MZ + 35, 2.5, x * 13 + 5, 40, 2.4);
decay.flush();
BIG = null;   // back to real-world units

// Tiny gate in the foot of the podium: the only human-scale thing.
const gateZ = MZ + 35 * K + BACK;
box(0, 4.5, gateZ + 0.05, 3.6, 9, 0.2, voidMat);
box(-2.5, 4.8, gateZ + 0.8, 1.4, 9.6, 1.6, metal);
box(2.5, 4.8, gateZ + 0.8, 1.4, 9.6, 1.6, metal);
box(0, 10.1, gateZ + 0.8, 6.4, 1, 1.6, metal);
box(0, 9.2, gateZ + 0.3, 3.6, 0.18, 0.4, glow);
// A long, low ramp from the plateau edge to the gate, with steel edge lines.
box(0, 0.12, (gateZ + 8) / 2, 10, 0.24, 8 - gateZ, plainConcrete);
for (const sx of [-1, 1]) box(sx * 5.1, 0.3, (gateZ + 8) / 2, 0.2, 0.4, 8 - gateZ, metal);
// Dry grass around the plateau, at real scale.
{
  const g = new Decay(scene, { envMap });
  for (const [x, z] of [[-9, 13], [12, 6], [-20, -8], [24, -26], [6, -40], [-14, -55], [30, -50], [-36, -30], [-8, gateZ + 3], [10, gateZ + 2]]) g.weeds(x, 0, z, 1.6, x * 17 + z, 45, 1.4);
  g.flush();
}


// ---------------------------------------------------------------- banners
// Four colossal cloth banners hang from the podium cornice, like the scorched hive-city banners and
// the facade cloths of monumental-era buildings: faded oxblood, an invented clock emblem echoing the
// stopped clock above, columns of unreadable glyphs and torn hems. They sway slowly.
function bannerTexture(seed: number): THREE.CanvasTexture {
  let a = seed; const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const W = 512, H = 1280, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#5e1d19'); base.addColorStop(0.5, '#6a2620'); base.addColorStop(1, '#4a1a16');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  // sun-bleached vertical bands and fold creases
  for (let i = 0; i < 14; i++) { const x = rnd() * W, w = 10 + rnd() * 60; g.fillStyle = `rgba(190,140,120,${0.04 + rnd() * 0.08})`; g.fillRect(x, 0, w, H); }
  for (let i = 0; i < 9; i++) { const x = (i + 1) * W / 10 + (rnd() - 0.5) * 20; g.fillStyle = 'rgba(20,6,5,0.18)'; g.fillRect(x, 0, 3, H); }
  // border stripes
  g.fillStyle = 'rgba(205,190,170,0.75)'; g.fillRect(22, 0, 8, H); g.fillRect(W - 30, 0, 8, H);
  g.fillStyle = 'rgba(20,10,8,0.6)'; g.fillRect(40, 0, 3, H); g.fillRect(W - 43, 0, 3, H);
  // emblem: a ring with twelve bars and a single hand, in worn off-white
  const cx = W / 2, cy = 300, R = 150;
  g.strokeStyle = 'rgba(214,200,178,0.9)'; g.lineWidth = 22; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R - 36, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(214,200,178,0.9)';
  for (let i = 0; i < 12; i++) { g.save(); g.translate(cx, cy); g.rotate(i * Math.PI / 6); g.fillRect(-7, -R + 22, 14, i % 3 ? 26 : 46); g.restore(); }
  g.save(); g.translate(cx, cy); g.rotate(-0.55); g.fillRect(-9, -R + 50, 18, R - 40); g.restore();
  g.beginPath(); g.arc(cx, cy, 20, 0, Math.PI * 2); g.fill();
  // a horizontal bar and two columns of invented glyphs below
  g.fillRect(70, 500, W - 140, 14);
  for (const col of [150, 330]) for (let r = 0; r < 14; r++) {
    const y = 560 + r * 46;
    for (let k = 0; k < 3; k++) if (rnd() > 0.25) g.fillRect(col + (rnd() - 0.5) * 30, y + k * 11, 14 + rnd() * 26, 6);
    if (rnd() > 0.5) g.fillRect(col + 6, y, 6, 34);
  }
  // grime: water runs from the top, mould and soot toward the hem
  for (let i = 0; i < 60; i++) { const x = rnd() * W, l = 100 + rnd() * 700; const gr = g.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, 'rgba(25,12,10,0.45)'); gr.addColorStop(1, 'rgba(25,12,10,0)'); g.fillStyle = gr; g.fillRect(x, 0, 2 + rnd() * 8, l); }
  const soot = g.createLinearGradient(0, H * 0.6, 0, H); soot.addColorStop(0, 'rgba(15,10,8,0)'); soot.addColorStop(1, 'rgba(15,10,8,0.7)');
  g.fillStyle = soot; g.fillRect(0, 0, W, H);
  // torn hem: cut away with alpha so the bottom edge reads as ragged cloth
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, H - 30 - rnd() * 170 - (rnd() < 0.08 ? 160 : 0));
  g.lineTo(W, H); g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const banners: { geo: THREE.PlaneGeometry; base: Float32Array; phase: number }[] = [];
{
  const BW = 32, BH = 84, top = L1 * K - 2, z = MZ + 35 * K + BACK + 1.6;
  for (const [i, x] of [-230, -115, 115, 230].entries()) {
    const geo = new THREE.PlaneGeometry(BW, BH, 14, 36); geo.translate(x, top - BH / 2, z);
    const mat = new THREE.MeshStandardMaterial({ map: bannerTexture(7 + i * 131), side: THREE.DoubleSide, alphaTest: 0.5, roughness: 1 });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    banners.push({ geo, base: Float32Array.from(geo.attributes.position.array as Float32Array), phase: i * 1.7 });
    // rusted hanging bar and its brackets
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, BW + 4, 12), rustHeavy); bar.rotation.z = Math.PI / 2; bar.position.set(x, top + 0.4, z); scene.add(bar);
    for (const sx of [-1, 1]) { const br = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 3.4), rustHeavy); br.position.set(x + sx * (BW / 2 + 1), top + 1.2, z - 1.2); scene.add(br); }
  }
}
function updateBanners(t: number) {
  for (const bn of banners) {
    const pos = bn.geo.attributes.position as THREE.BufferAttribute, b0 = bn.base;
    for (let i = 0; i < pos.count; i++) {
      const x = b0[i * 3], y = b0[i * 3 + 1], z = b0[i * 3 + 2];
      const hang = (L1 * K - 2 - y) / 84;                    // 0 at the bar, 1 at the hem
      const w = hang ** 1.4;
      // billow outward only: the cloth never swings back through the wall behind it
      pos.setZ(i, z + w * (1.6 + 1.1 * Math.sin(t * 0.55 + bn.phase + y * 0.05) + 0.4 * Math.sin(t * 1.3 + x * 0.15 + bn.phase)));
      pos.setX(i, x + w * 0.8 * Math.sin(t * 0.4 + bn.phase * 2));
    }
    pos.needsUpdate = true; bn.geo.computeVertexNormals();
  }
}

// Far monoliths, almost dissolved in the fog: the city-scale depth behind.
box(-620, 380, -1100, 160, 760, 100, plainConcrete);
box(600, 320, -1250, 200, 640, 100, plainConcrete);
box(80, 520, -1700, 320, 1040, 120, plainConcrete);

// Bake batches into meshes.
for (const [mat, geos] of batches) {
  const merged = mergeGeometries(geos, false);
  if (!merged) continue;
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = mat !== glass && mat !== glow;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// ---------------------------------------------------------------- decay on the plateau
// Standing sewage water on the plateau.
{
  const d = new Decay(scene, { envMap });
  for (const [x, z, rx, rz, sd] of [[-7, 10, 4, 2.5, 11], [18, -12, 6, 3.5, 12], [-25, -50, 9, 5, 13], [9, -52, 7, 4, 14], [-40, -46, 10, 6, 15], [35, -60, 8, 4, 16]]) d.puddle(x, 0, z, rx, rz, sd);
  d.flush();
}

// ---------------------------------------------------------------- light
const hemi = new THREE.HemisphereLight(0xe6eded, 0x2c2e2c, 1.55);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xf0f3f2, 1.5);           // weak, high, soft: overcast sky dome
key.position.set(-180, 1100, 120);           // high overhead: the insides of the boxes fall into shadow
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -760, right: 760, top: 760, bottom: -760, near: 10, far: 2800 });
key.target.position.set(0, 300, -200); scene.add(key.target);
key.shadow.radius = 6;
key.shadow.bias = -0.0003;
scene.add(key);

// Ambient occlusion: contact darkening in corners, under sills and where volumes meet.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.updateGtaoMaterial({ radius: 9, distanceExponent: 1.1, thickness: 12, scale: 1.3, samples: 16 });
gtao.blendIntensity = 1.0;
composer.addPass(gtao);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- interaction
let dragging = false, lastX = 0, lastY = 0;
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  yaw -= (e.clientX - lastX) * 0.004;
  pitch = THREE.MathUtils.clamp(pitch - (e.clientY - lastY) * 0.004, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
  lastX = e.clientX; lastY = e.clientY;
  camera.rotation.set(pitch, yaw, 0);
});
(window as unknown as { __setView: (y: number, p: number, f?: number) => void }).__setView = (y, p, f) => { yaw = y; pitch = p; camera.rotation.set(pitch, yaw, 0); if (f) { camera.fov = f; camera.updateProjectionMatrix(); } };

const fogInput = document.querySelector<HTMLInputElement>('#fog')!;
const lightInput = document.querySelector<HTMLInputElement>('#light')!;
const fogValue = document.querySelector<HTMLOutputElement>('#fog-value')!;
const lightValue = document.querySelector<HTMLOutputElement>('#light-value')!;
fogInput.addEventListener('input', () => { const v = Number(fogInput.value); (scene.fog as THREE.FogExp2).density = v; fogValue.textContent = v.toFixed(4); });
lightInput.addEventListener('input', () => { const v = Number(lightInput.value); hemi.intensity = 1.55 * v; key.intensity = 1.5 * v; lightValue.textContent = v.toFixed(1); });
const panel = document.querySelector<HTMLElement>('aside')!;
const show = document.querySelector<HTMLButtonElement>('#show')!;
document.querySelector<HTMLButtonElement>('#hide')!.addEventListener('click', () => { panel.hidden = true; show.hidden = false; });
show.addEventListener('click', () => { panel.hidden = false; show.hidden = true; });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  updateClock(dt, clock.elapsedTime);
  updateBanners(clock.elapsedTime);
  composer.render();
}
animate();
