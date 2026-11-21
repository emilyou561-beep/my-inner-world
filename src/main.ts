import * as THREE from 'three';
import { addSnow } from './snow';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { Batch, detailed, tex, aoComposer } from './kit';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root was not found.');

app.innerHTML = `
  <div id="scene" aria-label="Interactive concrete hall"></div>
  <header><div class="eyebrow">CONCRETE WORLD / 001</div><h1>THE SILENT OBSERVER</h1></header>
  <aside aria-label="Scene controls">
    <div class="panel-title">ATMOSPHERE</div>
    <label for="fog">FOG <output id="fog-value">0.012</output><input id="fog" type="range" min="0.003" max="0.05" step="0.001" value="0.012"></label>
    <label for="light">LIGHT <output id="light-value">1.4</output><input id="light" type="range" min="0.3" max="3" step="0.1" value="1.4"></label>
    <button id="next" type="button">NEXT SCENE</button>
    <button id="hide" type="button">HIDE UI</button>
  </aside>
  <button id="show" type="button" hidden>SHOW UI</button>
`;

const scene = new THREE.Scene();
const background = new THREE.Color(0x858b8b);
scene.background = background;
scene.fog = new THREE.FogExp2(background, 0.012);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 350);
camera.position.set(0, 3.4, 0);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.querySelector('#scene')!.appendChild(renderer.domElement);

// ---------------------------------------------------------------- approved materials (unchanged)
const textureLoader = new THREE.TextureLoader();
function loadMaterialTexture(path: string, color = false, repeat = 3): THREE.Texture {
  const texture = textureLoader.load(path);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
// Floor: Poly Haven "concrete" (approved).
const concreteColor = loadMaterialTexture('/textures/concrete_diff_2k.jpg', true);
const concreteNormal = loadMaterialTexture('/textures/concrete_nor_gl_2k.jpg');
const concreteRoughness = loadMaterialTexture('/textures/concrete_rough_2k.jpg');
const concreteDisplacement = loadMaterialTexture('/textures/concrete_disp_2k.jpg');
const floorMat = new THREE.MeshStandardMaterial({ color: 0x817f79, map: concreteColor, normalMap: concreteNormal, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: concreteRoughness, roughness: 0.9, displacementMap: concreteDisplacement, displacementScale: 0.012 });
// Columns: Poly Haven "concrete_wall_009" (approved, do not change).
const columnColor = loadMaterialTexture('/textures/lightwall_diff_2k.jpg', true, 1.5);
const columnNormal = loadMaterialTexture('/textures/lightwall_nor_gl_2k.jpg', false, 1.5);
const columnRoughness = loadMaterialTexture('/textures/lightwall_rough_2k.jpg', false, 1.5);
const columnMat = new THREE.MeshStandardMaterial({ color: 0xb8b6b0, map: columnColor, normalMap: columnNormal, normalScale: new THREE.Vector2(0.08, 0.08), roughnessMap: columnRoughness, roughness: 0.98 });

function block(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
}

// ---------------------------------------------------------------- refined materials for walls / ceiling
// Same light-grey concrete family as the columns, but world-scaled UVs (no stretching on 170 m walls)
// plus panel joints, tie holes and seepage streaks.
const wMap = tex('/textures/lightwall_diff_2k.jpg', true);
const wNor = tex('/textures/lightwall_nor_gl_2k.jpg');
const wRough = tex('/textures/lightwall_rough_2k.jpg');
const wallMat = detailed(new THREE.MeshStandardMaterial({ color: 0xaaa9a3, map: wMap, normalMap: wNor, normalScale: new THREE.Vector2(0.14, 0.14), roughnessMap: wRough, roughness: 0.98 }), { streaks: 0.7 });
const beamMat = detailed(new THREE.MeshStandardMaterial({ color: 0x86857f, map: wMap, normalMap: wNor, normalScale: new THREE.Vector2(0.12, 0.12), roughnessMap: wRough, roughness: 0.99 }), { joints: 0.6, streaks: 0.4 });
const capMat = detailed(new THREE.MeshStandardMaterial({ color: 0x9a9993, map: wMap, normalMap: wNor, normalScale: new THREE.Vector2(0.1, 0.1), roughnessMap: wRough, roughness: 0.99 }), { joints: 0, streaks: 0 });
const steel = new THREE.MeshStandardMaterial({ color: 0x3c4142, roughness: 0.6, metalness: 0.4 });
const voidMat = new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 1 });
const skylightMat = new THREE.MeshBasicMaterial({ color: 0xdfe6e6 });

const b = new Batch(8);

// ---------------------------------------------------------------- shell
block(0, -0.45, 0, 130, 0.9, 170, floorMat);
b.box(0, 28, 0, 130, 2, 170, beamMat);                                    // roof slab
b.box(-63, 13, 0, 2, 28, 170, wallMat); b.box(63, 13, 0, 2, 28, 170, wallMat);
b.box(0, 13, -83, 130, 28, 2, wallMat); b.box(0, 13, 83, 130, 28, 2, wallMat);

// ---------------------------------------------------------------- columns and coffered beam grid
const COL_X = [-48, -32, -16, 16, 32, 48];
const COL_Z: number[] = []; for (let z = -65; z <= 65; z += 20) COL_Z.push(z);
for (const x of COL_X) for (const z of COL_Z) {
  block(x, 13, z, 3.8, 26, 3.8, columnMat);                               // approved column, unchanged
  b.box(x, 0.12, z, 4.6, 0.24, 4.6, capMat);                               // thin base plinth
  b.box(x, 24.9, z, 4.6, 0.5, 4.6, capMat);                                // stepped capital
  b.box(x, 25.45, z, 5.6, 0.6, 5.6, capMat);
}
// Primary beams on the column lines in both directions (previously misaligned with the columns).
for (const z of COL_Z) b.box(0, 26.4, z, 126, 1.8, 2.6, beamMat);
for (const x of COL_X) b.box(x, 26.4, 0, 2.6, 1.8, 166, beamMat);
// Secondary ribs between them.
for (let z = -75; z <= 75; z += 10) if (!COL_Z.includes(z)) b.box(0, 26.75, z, 126, 1.1, 0.9, beamMat);

// Narrow cold skylight slots in the roof (kept from the approved layout), with deep reveals.
for (const x of [-24, 0, 24]) {
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 142), skylightMat);
  sky.rotation.x = Math.PI / 2; sky.position.set(x, 26.98, 0); scene.add(sky);
  b.box(x - 0.85, 26.6, 0, 0.5, 0.8, 142, capMat);
  b.box(x + 0.85, 26.6, 0, 0.5, 0.8, 142, capMat);
}

// ---------------------------------------------------------------- walls: pilasters, skirting, vents, high window band
for (const sx of [-1, 1]) {
  const wx = sx * 61.9;
  for (const z of COL_Z) b.box(wx, 13, z, 0.8, 26, 2.4, wallMat);         // pilasters aligned with columns
  b.box(sx * 61.75, 0.5, 0, 0.5, 1, 166, capMat);                          // skirting
  for (let i = 0; i < COL_Z.length - 1; i++) {
    const zc = (COL_Z[i] + COL_Z[i + 1]) / 2;
    // low louvred vent in every bay
    b.box(sx * 61.98, 2.2, zc, 0.05, 1.6, 4, voidMat);
    for (let k = 0; k < 5; k++) b.box(sx * 61.85, 1.55 + k * 0.32, zc, 0.24, 0.06, 4, capMat);
    // high clerestory band: dark glass, mullions, sill
    b.box(sx * 61.97, 21.5, zc, 0.06, 2.2, 14, voidMat);
    for (let m = -6; m <= 6; m += 1.5) b.box(sx * 61.9, 21.5, zc + m, 0.1, 2.2, 0.08, steel);
    b.box(sx * 61.7, 20.3, zc, 0.6, 0.2, 14.8, capMat);
  }
}
for (const sz of [-1, 1]) {
  b.box(0, 0.5, sz * 81.75, 126, 1, 0.5, capMat);
  for (const x of COL_X) b.box(x, 13, sz * 81.6, 2.4, 26, 0.8, wallMat);
}

b.flush(scene, [voidMat]);

// ---------------------------------------------------------------- light
RectAreaLightUniformsLib.init();
const ambient = new THREE.HemisphereLight(0xdce5e8, 0x383a3a, 1.3); scene.add(ambient);
const interiorFill = new THREE.DirectionalLight(0xc7d1d1, 0.5);
interiorFill.position.set(-35, 20, -28); scene.add(interiorFill);
// Soft light falling from the two skylight slots.
const slotLights: THREE.RectAreaLight[] = [];
for (const x of [-24, 0, 24]) {
  const l = new THREE.RectAreaLight(0xe4ecec, 7, 1.2, 142);
  l.position.set(x, 26.9, 0); l.lookAt(x, 0, 0);
  scene.add(l); slotLights.push(l);
}

const composer = aoComposer(renderer, scene, camera, 2.2, 0.85);

// ---------------------------------------------------------------- interaction
let yaw = 0, pitch = 0, dragging = false, lastX = 0, lastY = 0;
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (event) => { dragging = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointerup', () => { dragging = false; }); canvas.addEventListener('pointercancel', () => { dragging = false; });
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  yaw -= (event.clientX - lastX) * 0.004; pitch = THREE.MathUtils.clamp(pitch - (event.clientY - lastY) * 0.004, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
  lastX = event.clientX; lastY = event.clientY; camera.rotation.set(pitch, yaw, 0);
});
(window as unknown as { __setView: (y: number, p: number, f?: number) => void }).__setView = (y, p, f) => { yaw = y; pitch = p; camera.rotation.set(pitch, yaw, 0); if (f) { camera.fov = f; camera.updateProjectionMatrix(); } };

const fogInput = document.querySelector<HTMLInputElement>('#fog')!; const lightInput = document.querySelector<HTMLInputElement>('#light')!;
const fogValue = document.querySelector<HTMLOutputElement>('#fog-value')!; const lightValue = document.querySelector<HTMLOutputElement>('#light-value')!;
fogInput.addEventListener('input', () => { const value = Number(fogInput.value); (scene.fog as THREE.FogExp2).density = value; fogValue.textContent = value.toFixed(3); });
lightInput.addEventListener('input', () => {
  const value = Number(lightInput.value);
  ambient.intensity = value; interiorFill.intensity = value * 0.385;
  for (const l of slotLights) l.intensity = value * 5;
  lightValue.textContent = value.toFixed(1);
});
const panel = document.querySelector<HTMLElement>('aside')!; const show = document.querySelector<HTMLButtonElement>('#show')!;
document.querySelector<HTMLButtonElement>('#next')!.addEventListener('click', () => { window.location.href = '/classic-002.html'; });
document.querySelector<HTMLButtonElement>('#hide')!.addEventListener('click', () => { panel.hidden = true; show.hidden = false; }); show.addEventListener('click', () => { panel.hidden = false; show.hidden = true; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
// Snow drifting down through the three skylight slots, lit by the slot light.
const snowfall = [-24, 0, 24].map((x) => addSnow(scene, camera, renderer, {
  box: [1.0, 120], spread: 3.5, center: new THREE.Vector3(x, 13.5, 0), height: 27,
  count: 7000, size: 0.05, speed: 1.3, innerRadius: 1.5, opacity: 0.9, fog: 0.02,
}));
function animate() { requestAnimationFrame(animate); snowfall.forEach((s) => s.update()); composer.render(); } animate();
