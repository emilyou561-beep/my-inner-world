import * as THREE from 'three';
import { Batch, detailed, aoComposer, v3 } from './kit';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root was not found.');
app.innerHTML = `
  <div id="scene" aria-label="Vertical concrete void"></div>
  <header><div class="eyebrow">CONCRETE WORLD / 003</div><h1>THE VERTICAL VOID</h1></header>
  <aside aria-label="Scene controls">
    <div class="panel-title">ATMOSPHERE</div>
    <label for="fog">FOG <output id="fog-value">0.008</output><input id="fog" type="range" min="0.002" max="0.03" step="0.001" value="0.008"></label>
    <label for="light">LIGHT <output id="light-value">1.0</output><input id="light" type="range" min="0.3" max="2.5" step="0.1" value="1.0"></label>
    <button id="next" type="button">NEXT SCENE</button>
    <button id="prev" type="button">SCENE 002</button>
    <button id="first" type="button">SCENE 001</button>
    <button id="hide" type="button">HIDE UI</button>
  </aside>
  <button id="show" type="button" hidden>SHOW UI</button>`;

// ---------- renderer / camera ----------
const scene = new THREE.Scene();
const background = new THREE.Color(0x737a7d);
scene.background = background;
scene.fog = new THREE.FogExp2(background, 0.008);

const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 900);
// The observer stands on a landing cantilevered from the south wall, high inside the shaft.
camera.position.set(0, 2.4, 22.3);
camera.rotation.order = 'YXZ';
let yaw = 0;
let pitch = -0.12;
camera.rotation.set(pitch, yaw, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.querySelector('#scene')!.appendChild(renderer.domElement);

// ---------- materials ----------
// Same approved light-grey concrete as the Scene 001 columns. UVs are set in world units below,
// so a 200 m wall shows the same grain size as a 2 m parapet instead of one stretched image.
const loader = new THREE.TextureLoader();
function texture(path: string, color = false) {
  const map = loader.load(path);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  if (color) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
const wallColor = texture('/textures/lightwall_diff_2k.jpg', true);
const wallNormal = texture('/textures/lightwall_nor_gl_2k.jpg');
const wallRough = texture('/textures/lightwall_rough_2k.jpg');

const concrete = detailed(new THREE.MeshStandardMaterial({ color: 0xb6bbbd, map: wallColor, normalMap: wallNormal, normalScale: new THREE.Vector2(0.1, 0.1), roughnessMap: wallRough, roughness: 0.98 }), { floorY: -180 });
const darkConcrete = detailed(new THREE.MeshStandardMaterial({ color: 0x868b8d, map: wallColor, normalMap: wallNormal, normalScale: new THREE.Vector2(0.1, 0.1), roughnessMap: wallRough, roughness: 0.99 }), { joints: 0.7, streaks: 0.6, floorY: -180 });
const stairMat = detailed(new THREE.MeshStandardMaterial({ color: 0xaeb3b5, map: wallColor, normalMap: wallNormal, normalScale: new THREE.Vector2(0.1, 0.1), roughnessMap: wallRough, roughness: 0.98 }), { joints: 0, streaks: 0 });
const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f40, roughness: 0.6, metalness: 0.4 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0xa6abad, map: wallColor, normalMap: wallNormal, normalScale: new THREE.Vector2(0.12, 0.12), roughnessMap: wallRough, roughness: 0.97 });
const voidMat = new THREE.MeshStandardMaterial({ color: 0x121516, roughness: 1 });
const skyMat = new THREE.MeshBasicMaterial({ color: 0xe9eeee, fog: false });
const beamMat = new THREE.MeshBasicMaterial({ color: 0xdfe6e6, transparent: true, opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

const b = new Batch(9);
function block(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material = concrete, _shadows = true) {
  b.box(x, y, z, w, h, d, material);
}

// ---------- the shaft ----------
// Interior is 72 x 72 m, from far below the fog line (-180) up to a roof at +118.
const HALF = 36;
const BOTTOM = -180;
const TOP = 118;
const H = TOP - BOTTOM;
const MID = (TOP + BOTTOM) / 2;
block(0, MID, -HALF - 2, HALF * 2 + 8, H, 4);          // north wall (facing the observer)
block(0, MID, HALF + 2, HALF * 2 + 8, H, 4);           // south wall (behind the observer)
block(-HALF - 2, MID, 0, 4, H, HALF * 2);              // west wall
block(HALF + 2, MID, 0, 4, H, HALF * 2);               // east wall
block(0, BOTTOM - 1, 0, HALF * 2 + 8, 2, HALF * 2 + 8, floorMat);

// Roof slab with a square oculus (18 x 18 m), built from four pieces so the hole is real.
const O = 9;
const roofY = TOP + 2;
block(0, roofY, -(O + HALF) / 2 - 2, HALF * 2 + 8, 4, HALF - O + 4);
block(0, roofY, (O + HALF) / 2 + 2, HALF * 2 + 8, 4, HALF - O + 4);
block(-(O + HALF) / 2 - 2, roofY, 0, HALF - O + 4, 4, O * 2);
block((O + HALF) / 2 + 2, roofY, 0, HALF - O + 4, 4, O * 2);
// Deep coffer around the oculus so the opening reads as thick concrete, not a paper cut.
block(0, TOP - 4, -O - 1, O * 2 + 4, 8, 2, darkConcrete);
block(0, TOP - 4, O + 1, O * 2 + 4, 8, 2, darkConcrete);
block(-O - 1, TOP - 4, 0, 2, 8, O * 2, darkConcrete);
block(O + 1, TOP - 4, 0, 2, 8, O * 2, darkConcrete);
// Bright sky plane above the oculus (unaffected by fog).
const sky = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), skyMat);
sky.rotation.x = Math.PI / 2;
sky.position.set(0, TOP + 12, 0);
scene.add(sky);

// ---------- wall articulation ----------
// Ring beams every 24 m on all four walls.
for (let y = -132; y <= 108; y += 24) {
  block(0, y, -HALF + 0.7, HALF * 2, 1.6, 1.4, darkConcrete);
  block(0, y, HALF - 0.7, HALF * 2, 1.6, 1.4, darkConcrete);
  block(-HALF + 0.7, y, 0, 1.4, 1.6, HALF * 2 - 2.8, darkConcrete);
  block(HALF - 0.7, y, 0, 1.4, 1.6, HALF * 2 - 2.8, darkConcrete);
}

// Galleries: rows of deep dark openings with thick jambs, on the north, west and east walls.
function galleryRow(wall: 'north' | 'west' | 'east', y: number, count: number, spacing: number, w: number, h: number) {
  for (let i = 0; i < count; i++) {
    const t = (i - (count - 1) / 2) * spacing;
    if (wall === 'north') {
      block(t, y, -HALF + 0.12, w, h, 0.3, voidMat, false);
      block(t - w / 2 - 0.6, y, -HALF + 1, 1.2, h + 1.2, 2, concrete);
      block(t + w / 2 + 0.6, y, -HALF + 1, 1.2, h + 1.2, 2, concrete);
    } else {
      const sx = wall === 'west' ? -HALF : HALF;
      const dir = wall === 'west' ? 1 : -1;
      block(sx + dir * 0.12, y, t, 0.3, h, w, voidMat, false);
      block(sx + dir * 1, y, t - w / 2 - 0.6, 2, h + 1.2, 1.2, concrete);
      block(sx + dir * 1, y, t + w / 2 + 0.6, 2, h + 1.2, 1.2, concrete);
    }
  }
}
for (const y of [-108, -84, -60, -36, -12, 12, 36, 60, 84]) galleryRow('north', y, 5, 12.5, 5, 13);
for (const y of [-96, -72, -48, -24, 0, 24, 48, 72]) {
  galleryRow('west', y, 4, 15, 4, 9);
  galleryRow('east', y + 12, 4, 15, 4, 9);
}
// One very tall slot in the centre of the north wall: the eye of the composition.
block(0, 50, -HALF + 0.1, 3.2, 120, 0.3, voidMat, false);
block(-2.6, 50, -HALF + 1.1, 2, 122, 2.2, darkConcrete);
block(2.6, 50, -HALF + 1.1, 2, 122, 2.2, darkConcrete);

// Corner piers running the full height.
for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(sx * (HALF - 3), MID, sz * (HALF - 3), 6, H, 6, darkConcrete);

// ---------- stairs & bridges ----------
// A flight of solid concrete treads on a sloping slab, with a steel handrail on the void side.
function flight(x0: number, y0: number, z0: number, axis: 'x' | 'z', dir: 1 | -1, steps: number, voidSide: 1 | -1) {
  const run = 0.9, rise = 0.55, width = 3.2;
  const at = (along: number, y: number, side = 0) => axis === 'x' ? v3(x0 + along, y, z0 + side) : v3(x0 + side, y, z0 + along);
  for (let s = 0; s < steps; s++) {
    const p = at(dir * (s * run + run / 2), y0 + s * rise + rise / 2);
    if (axis === 'x') block(p.x, p.y, p.z, run, rise, width, stairMat); else block(p.x, p.y, p.z, width, rise, run, stairMat);
  }
  const L = dir * steps * run, H = steps * rise;
  b.slab(at(0, y0 - 0.35), at(L, y0 + H - 0.35), width, 0.5, darkConcrete);            // sloping soffit slab
  const top = at(L + dir * 2, y0 + H - 0.3);
  if (axis === 'x') block(top.x, top.y, top.z, 4, 0.6, width, stairMat); else block(top.x, top.y, top.z, width, 0.6, 4, stairMat);
  const edge = voidSide * (width / 2 - 0.12);
  b.rail(at(0, y0 + 0.02, edge), at(L, y0 + H + 0.02, edge), steel);                    // handrail follows the pitch
  b.rail(at(L, y0 + H, edge), at(L + dir * 4, y0 + H, edge), steel);                     // and the landing
}
// Zig-zag stairs climbing the north wall (left half) and descending into the fog.
for (let k = -5; k <= 3; k++) {
  const y0 = k * 12;
  const dir = (k % 2 === 0 ? 1 : -1) as 1 | -1;
  flight(dir === 1 ? -30 : -8, y0, -HALF + 2.6, 'x', dir, 22, 1);
}
// Stairs along the east wall.
for (let k = -4; k <= 3; k++) {
  const y0 = k * 12 + 6;
  const dir = (k % 2 === 0 ? 1 : -1) as 1 | -1;
  flight(HALF - 2.6, y0, dir === 1 ? -26 : -6, 'z', dir, 22, -1);
}

// Bridges across the void at different heights and directions.
function bridge(y: number, axis: 'x' | 'z', offset: number, width: number) {
  const len = HALF * 2;
  if (axis === 'x') {
    block(0, y, offset, len, 1.4, width, concrete);
    block(0, y - 2.2, offset, len, 3, 1.4, darkConcrete);               // deep spine beam
    block(0, y + 0.9, offset - width / 2 + 0.15, len, 0.6, 0.3, darkConcrete);
    block(0, y + 0.9, offset + width / 2 - 0.15, len, 0.6, 0.3, darkConcrete);
    for (const sd of [-1, 1]) b.rail(v3(-HALF + 1, y + 1.2, offset + sd * (width / 2 - 0.15)), v3(HALF - 1, y + 1.2, offset + sd * (width / 2 - 0.15)), steel, 0.8, 2);
  } else {
    block(offset, y, 0, width, 1.4, len, concrete);
    block(offset, y - 2.2, 0, 1.4, 3, len, darkConcrete);
    block(offset - width / 2 + 0.15, y + 0.9, 0, 0.3, 0.6, len, darkConcrete);
    block(offset + width / 2 - 0.15, y + 0.9, 0, 0.3, 0.6, len, darkConcrete);
    for (const sd of [-1, 1]) b.rail(v3(offset + sd * (width / 2 - 0.15), y + 1.2, -HALF + 1), v3(offset + sd * (width / 2 - 0.15), y + 1.2, HALF - 1), steel, 0.8, 2);
  }
}
bridge(-30, 'x', -6, 4);
bridge(42, 'z', -14, 3.5);
bridge(-78, 'z', 10, 4);
bridge(78, 'x', 12, 3);

// ---------- the observer's landing ----------
block(0, -0.6, 28.75, 14, 1.2, 14.5, floorMat);             // slab, tied into the south wall
block(0, -3.2, 31, 10, 4, 10, darkConcrete);                // corbel underneath
block(0, 0.45, 21.65, 14, 0.9, 0.3, darkConcrete);          // low front parapet: you can look over it
block(-6.85, 0.45, 28.75, 0.3, 0.9, 14.5, darkConcrete);    // side parapets
block(6.85, 0.45, 28.75, 0.3, 0.9, 14.5, darkConcrete);
block(0, 4, HALF - 0.1, 3.4, 8, 0.3, voidMat, false);       // the doorway you came through, behind you

b.flush(scene, [voidMat]);

// ---------- light ----------
const ambient = new THREE.HemisphereLight(0xd6dddd, 0x5a5e5e, 1.6);
scene.add(ambient);
// Sun enters only through the oculus: the roof casts shadows, so a bright patch lands on the walls.
const sun = new THREE.DirectionalLight(0xf2f4f2, 3.2);
sun.position.set(-40, 320, 70);
sun.target.position.set(0, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.near = 50; sun.shadow.camera.far = 700;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);
// Soft bounce from the lit side so nothing collapses into pure black.
const bounce = new THREE.DirectionalLight(0xb4bcbc, 0.8);
bounce.position.set(30, -20, -40);
scene.add(bounce);

// Visible light shaft under the oculus, leaning the same way the sun does.
const sunDir = sun.position.clone().normalize();
const shaftLen = 200;
const shaft = new THREE.Mesh(new THREE.BoxGeometry(O * 2 - 1, shaftLen, O * 2 - 1), beamMat);
shaft.position.set(0, TOP, 0).addScaledVector(sunDir, -shaftLen / 2);
shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sunDir);
scene.add(shaft);

// ---------- interaction ----------
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
fogInput.addEventListener('input', () => { const v = Number(fogInput.value); (scene.fog as THREE.FogExp2).density = v; fogValue.textContent = v.toFixed(3); });
lightInput.addEventListener('input', () => { const v = Number(lightInput.value); ambient.intensity = 1.6 * v; bounce.intensity = v * 0.8; sun.intensity = 3.2 * v; lightValue.textContent = v.toFixed(1); });
document.querySelector<HTMLButtonElement>('#next')!.addEventListener('click', () => { window.location.href = '/scene-004.html'; });
document.querySelector<HTMLButtonElement>('#prev')!.addEventListener('click', () => { window.location.href = '/scene-002.html'; });
document.querySelector<HTMLButtonElement>('#first')!.addEventListener('click', () => { window.location.href = '/'; });
const panel = document.querySelector<HTMLElement>('aside')!;
const show = document.querySelector<HTMLButtonElement>('#show')!;
document.querySelector<HTMLButtonElement>('#hide')!.addEventListener('click', () => { panel.hidden = true; show.hidden = false; });
show.addEventListener('click', () => { panel.hidden = false; show.hidden = true; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const composer = aoComposer(renderer, scene, camera, 3, 0.9);
function animate() { requestAnimationFrame(animate); composer.render(); }
animate();
