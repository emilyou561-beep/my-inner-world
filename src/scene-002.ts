import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { detailed as kitDetailed } from './kit';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root was not found.');
app.innerHTML = `
  <div id="scene" aria-label="Monumental brutalist exterior"></div>
  <header><div class="eyebrow">CONCRETE WORLD / 002</div><h1>THE MONUMENTAL EXTERIOR</h1></header>
  <aside aria-label="Scene controls"><div class="panel-title">ATMOSPHERE</div>
    <label for="fog">FOG <output id="fog-value">0.0052</output><input id="fog" type="range" min="0.002" max="0.02" step="0.0002" value="0.0052"></label>
    <label for="light">LIGHT <output id="light-value">1.0</output><input id="light" type="range" min="0.3" max="2" step="0.1" value="1.0"></label>
    <a class="panel-link" href="/scene-003.html">NEXT SCENE</a><a class="panel-link" href="/">SCENE 001</a><button id="hide" type="button">HIDE UI</button>
  </aside><button id="show" type="button" hidden>SHOW UI</button>`;

// ---------------------------------------------------------------- renderer
// Overcast, fully diffuse light (per the Concretecore reference): pale cyan-grey sky, no hard sun.
const SKY = new THREE.Color(0xc4cdcb);
const scene = new THREE.Scene();
scene.background = SKY;
scene.fog = new THREE.FogExp2(SKY, 0.0052);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 1200);
camera.position.set(0, 5.5, 22);
camera.rotation.order = 'YXZ';
let yaw = 0;
let pitch = 0.34;
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
const detailed = (m: THREE.MeshStandardMaterial, joints: number) => kitDetailed(m, { joints, streaks: 1.2, weather: joints ? 1 : 0.35 });
const concrete = detailed(new THREE.MeshStandardMaterial({ color: 0xaeb3b3, map: cMap, normalMap: cNor, normalScale: new THREE.Vector2(0.12, 0.12), roughnessMap: cRough, roughness: 0.97 }), 1);
const darkConcrete = detailed(new THREE.MeshStandardMaterial({ color: 0x8a8f8f, map: cMap, normalMap: cNor, normalScale: new THREE.Vector2(0.12, 0.12), roughnessMap: cRough, roughness: 0.98 }), 1);
const plainConcrete = detailed(new THREE.MeshStandardMaterial({ color: 0xb0b4b3, map: cMap, normalMap: cNor, normalScale: new THREE.Vector2(0.1, 0.1), roughnessMap: cRough, roughness: 0.98 }), 0);
const groundMat = detailed(new THREE.MeshStandardMaterial({ color: 0xa4aaab, map: cMap, normalMap: cNor, normalScale: new THREE.Vector2(0.2, 0.2), roughnessMap: cRough, roughness: 0.98 }), 0);
const glass = new THREE.MeshStandardMaterial({ color: 0x2b3637, roughness: 0.32, metalness: 0.15 });
const steel = new THREE.MeshStandardMaterial({ color: 0x3e4344, roughness: 0.6, metalness: 0.4 });
const voidMat = new THREE.MeshStandardMaterial({ color: 0x0f1213, roughness: 1 });

// ---------------------------------------------------------------- geometry batching
// Thousands of small parts (mullions, rails, sills) are merged into one mesh per material.
const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
const TILE = 9;
function push(geo: THREE.BufferGeometry, mat: THREE.Material) {
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
box(0, -0.6, -50, 260, 1.2, 160, groundMat);                       // plateau, ends at z = 30
box(0, -21, 31, 260, 42, 6, darkConcrete);                          // cliff face (overlaps plateau edge: no seam)
box(0, -42.5, 150, 600, 1, 240, groundMat);                         // barren plain far below
box(0, 0.55, 29.4, 260, 1.1, 0.4, darkConcrete);                    // low edge wall behind the observer
railing('front', 0, 29.4, 0, 0, 1.1, 80);

// ---------------------------------------------------------------- megastructure
// Core tower: rises into the fog.
const CORE = { x: 0, z: -55, w: 30, d: 26, h: 200 };
box(CORE.x, CORE.h / 2, CORE.z, CORE.w, CORE.h, CORE.d, darkConcrete);
for (let yy = 58.5; yy < 196; yy += 9) {
  ribbon('left', CORE.x, CORE.z, CORE.w, CORE.d, 0, yy, CORE.d - 6);
  ribbon('right', CORE.x, CORE.z, CORE.w, CORE.d, 0, yy, CORE.d - 6);
}
// Vertical fins on the core front above the gate.
for (let x = -13; x <= 13; x += 2) box(x, 128, CORE.z + CORE.d / 2 + 0.6, 0.45, 140, 1.2, plainConcrete);

// Monumental gate at the foot of the core: deep portal frame, dark tall opening.
const gz = CORE.z + CORE.d / 2;
box(0, 24, gz + 0.05, 12, 48, 0.2, voidMat);
box(-9, 26, gz + 4, 6, 52, 8, concrete);
box(9, 26, gz + 4, 6, 52, 8, concrete);
box(0, 55, gz + 4, 26, 6, 8, concrete);
box(0, 50, gz + 1.5, 14, 4, 3, darkConcrete);
box(-6.5, 24, gz + 1.2, 1, 48, 2.4, darkConcrete);
box(6.5, 24, gz + 1.2, 1, 48, 2.4, darkConcrete);

// Side towers.
const LT = { x: -58, z: -66, w: 18, d: 22 };
volume(LT.x, 0, LT.z, LT.w, 176, LT.d, { faces: ['front', 'right', 'left'], every: 2, margin: 2.2 });
const RT = { x: 58, z: -68, w: 18, d: 22 };
box(RT.x, 95, RT.z, RT.w, 190, RT.d, darkConcrete);
// Right tower front: capsule modules with round portholes.
const ringGeo = new THREE.TorusGeometry(1.35, 0.35, 10, 28);
const discGeo = new THREE.CircleGeometry(1.35, 28);
for (let row = 0; row < 26; row++) for (let col = -1; col <= 1; col++) {
  const x = RT.x + col * 5.8 + (row % 2 ? 0.6 : -0.6);
  const y = 6 + row * 5.8;
  const z = RT.z + RT.d / 2 + 1.6 + ((row + col) % 3 === 0 ? 0.8 : 0);
  box(x, y, z, 5.4, 5.4, 3.2, concrete);
  const r = ringGeo.clone(); r.translate(x, y, z + 1.6); push(r, plainConcrete);
  const g = discGeo.clone(); g.translate(x, y, z + 1.62); push(g, glass);
}
for (let yy = 4.5; yy < 186; yy += 9) ribbon('left', RT.x, RT.z, RT.w, RT.d, 0, yy, RT.d - 5);

// Stacked cantilevered volumes, staggered left/right up the core.
volume(-24, 20.25, -34, 36, 13.5, 20, {});
volume(22, 38.25, -33, 40, 13.5, 22, { split: true });
volume(-28, 57, -38, 44, 18, 26, {});
volume(27, 81, -40, 38, 13.5, 24, {});
volume(-10, 105.75, -34, 50, 13.5, 22, { split: true });
volume(25, 130.5, -44, 34, 18, 22, {});
volume(-22, 153, -46, 40, 13.5, 24, {});
volume(-40, 99, -60, 30, 9, 30, { faces: ['front'] });               // bridge to the left tower
volume(40, 0, -42, 24, 18, 20, { faces: ['front', 'left'] });        // low service wing
louvre('front', 40, -42, 24, 20, -5, 4, 8, 4);
louvre('front', 40, -42, 24, 20, 5, 4, 8, 4);
louvre('right', CORE.x, CORE.z, CORE.w, CORE.d, 0, 30, 10, 6);
louvre('left', CORE.x, CORE.z, CORE.w, CORE.d, 0, 30, 10, 6);

// Rear mass, mostly dissolved in fog, gives the depth of a city-sized building.
volume(0, 0, -122, 210, 150, 30, { faces: ['front'], every: 2, margin: 6, rail: false, split: true });

// ---------------------------------------------------------------- structure: struts & leaning piers
// Leaning A-frame piers under the first cantilever.
for (const z of [-27, -41]) {
  strut(v3(-41, 0, z), v3(-33, 20.3, z), 1.6);
  strut(v3(-25, 0, z), v3(-33, 20.3, z), 1.6);
}
// Diagonal braces from the core / towers to the undersides of the cantilevers.
for (const z of [-25, -41]) strut(v3(15, 22, -43), v3(38, 38.3, z), 1.3);
for (const z of [-28, -48]) strut(v3(-49, 36, -56), v3(-46, 57.1, z), 1.3);
for (const z of [-31, -49]) strut(v3(15, 62, -44), v3(42, 81.1, z), 1.2);
for (const z of [-26, -42]) strut(v3(-15, 86, -43), v3(-32, 105.8, z), 1.2);
for (const z of [-36, -52]) strut(v3(15, 112, -44), v3(39, 130.6, z), 1.1);
// Slender steel tie rods above the cantilevers, back to the core.
strut(v3(40, 52.3, -23), v3(15, 70, -42), 0.35, steel);
strut(v3(-48, 75.6, -26), v3(-15, 95, -42), 0.35, steel);
strut(v3(43, 95.1, -29), v3(15, 115, -42), 0.35, steel);

// Bake batches into meshes.
for (const [mat, geos] of batches) {
  const merged = mergeGeometries(geos, false);
  if (!merged) continue;
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = mat !== glass;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// ---------------------------------------------------------------- light
const hemi = new THREE.HemisphereLight(0xe6eded, 0x70726e, 2.1);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xf0f3f2, 0.9);           // weak, high, soft: overcast sky dome
key.position.set(-70, 160, 90);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 500 });
key.shadow.radius = 6;
key.shadow.bias = -0.0003;
scene.add(key);

// Ambient occlusion: contact darkening in corners, under sills and where volumes meet.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.updateGtaoMaterial({ radius: 2.5, distanceExponent: 1.4, thickness: 3, scale: 1.2, samples: 16 });
gtao.blendIntensity = 0.9;
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
lightInput.addEventListener('input', () => { const v = Number(lightInput.value); hemi.intensity = 2.1 * v; key.intensity = 0.9 * v; lightValue.textContent = v.toFixed(1); });
const panel = document.querySelector<HTMLElement>('aside')!;
const show = document.querySelector<HTMLButtonElement>('#show')!;
document.querySelector<HTMLButtonElement>('#hide')!.addEventListener('click', () => { panel.hidden = true; show.hidden = false; });
show.addEventListener('click', () => { panel.hidden = false; show.hidden = true; });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});
function animate() {
  requestAnimationFrame(animate);
  composer.render();
}
animate();
