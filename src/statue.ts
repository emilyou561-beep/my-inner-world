import * as THREE from 'three';

// An original colossal stone bust: a serene, closed-eyed face with long ear lobes, a top-knot and a
// plain diadem, broken off below the chest. Modelled as a signed distance field (smoothly blended
// ellipsoids and capsules) and turned into a mesh with naive surface nets. Weathering is baked into
// vertex colours: darker crevices, damp streaks on undersides, a green tinge on upward faces.
// The eyes are separate: stone lids that, now and then, slowly lift.

type V = [number, number, number];
const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);
function sdEllipsoid(px: number, py: number, pz: number, c: V, r: V) {
  const x = px - c[0], y = py - c[1], z = pz - c[2];
  const k0 = len3(x / r[0], y / r[1], z / r[2]);
  const k1 = len3(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]));
  return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
}
function sdCapsule(px: number, py: number, pz: number, a: V, b: V, r: number) {
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  return len3(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}
function sdTorusY(px: number, py: number, pz: number, c: V, R: number, r: number) {
  const x = px - c[0], y = py - c[1], z = pz - c[2];
  const q = Math.sqrt(x * x + z * z) - R;
  return Math.sqrt(q * q + y * y) - r;
}
const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);
function hash3(x: number, y: number, z: number) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  let v = 0;
  for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const w = (i ? ux : 1 - ux) * (j ? uy : 1 - uy) * (k ? uz : 1 - uz);
    v += w * hash3(ix + i, iy + j, iz + k);
  }
  return v;
}
const fbm = (x: number, y: number, z: number) => vnoise(x, y, z) * 0.5 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.2;

export const EYE_L: V = [-0.15, 0.38, 0.38], EYE_R: V = [0.15, 0.38, 0.38];
export const EYE_R0 = 0.07;

function bust(x: number, y: number, z: number) {
  const ax = Math.abs(x);                                         // the face is symmetric
  let d = sdEllipsoid(x, y, z, [0, 0.35, 0], [0.42, 0.56, 0.47]);
  d = smin(d, sdEllipsoid(x, y, z, [0, 0.45, -0.07], [0.43, 0.5, 0.48]), 0.1);
  d = smin(d, sdEllipsoid(x, y, z, [0, 0.03, 0.13], [0.29, 0.25, 0.31]), 0.12);             // jaw and chin
  d = smin(d, sdEllipsoid(ax, y, z, [0.2, 0.22, 0.25], [0.16, 0.14, 0.15]), 0.08);          // full cheeks
  d = smin(d, sdCapsule(ax, y, z, [0, 0.49, 0.4], [0.25, 0.48, 0.34], 0.07), 0.05);          // brow
  d = smin(d, sdCapsule(x, y, z, [0, 0.47, 0.46], [0, 0.25, 0.57], 0.058), 0.05);           // nose bridge
  d = smin(d, sdEllipsoid(x, y, z, [0, 0.235, 0.55], [0.08, 0.06, 0.065]), 0.04);           // nose tip
  d = smin(d, sdEllipsoid(ax, y, z, [0.065, 0.225, 0.5], [0.055, 0.045, 0.05]), 0.03);       // nostril wings
  // eye sockets, filled later by separate eyeballs and lids
  d = smax(d, -sdEllipsoid(ax, y, z, [0.15, 0.38, 0.45], [0.11, 0.065, 0.09]), 0.025);
  // closed lids carved in the stone: a heavy upper lid bulging out of the socket, and the lash seam
  d = smin(d, sdEllipsoid(ax, y, z, [0.15, 0.385, 0.405], [0.1, 0.05, 0.05]), 0.02);
  const seamY = 0.362 - 0.9 * (ax - 0.15) ** 2;
  d = smax(d, -sdCapsule(ax, y - (seamY - 0.362), z, [0.07, 0.362, 0.455], [0.23, 0.362, 0.43], 0.0055), 0.004);
  // stronger relief for top light: a deep shelf under the brow, philtrum and mouth corners
  d = smax(d, -sdEllipsoid(ax, y, z, [0.14, 0.43, 0.47], [0.13, 0.025, 0.05]), 0.02);
  d = smax(d, -sdCapsule(x, y, z, [0, 0.2, 0.5], [0, 0.14, 0.47], 0.012), 0.01);
  // lips with a faint smile, and the mouth seam
  const smile = 0.035 * (ax / 0.1) ** 2;
  d = smin(d, sdCapsule(x, y - smile, z, [-0.085, 0.115, 0.43], [0.085, 0.115, 0.43], 0.032), 0.03);
  d = smin(d, sdCapsule(x, y - smile, z, [-0.07, 0.065, 0.415], [0.07, 0.065, 0.415], 0.038), 0.03);
  d = smax(d, -sdCapsule(x, y - smile, z, [-0.1, 0.092, 0.47], [0.1, 0.092, 0.47], 0.007), 0.006);
  // long ears and lobes
  d = smin(d, sdEllipsoid(ax, y, z, [0.43, 0.34, 0.0], [0.055, 0.17, 0.1]), 0.04);
  d = smin(d, sdEllipsoid(ax, y, z, [0.445, 0.1, 0.03], [0.05, 0.14, 0.065]), 0.05);
  // neck, shoulders, chest
  d = smin(d, sdCapsule(x, y, z, [0, -0.05, -0.02], [0, -0.55, -0.03], 0.23), 0.12);
  d = smin(d, sdEllipsoid(x, y, z, [0, -0.82, -0.08], [1.2, 0.34, 0.4]), 0.25);
  d = smin(d, sdEllipsoid(x, y, z, [0, -1.05, 0.0], [0.85, 0.5, 0.36]), 0.2);
  if (y < -0.5) d += Math.sin(x * 13 + y * 5) * 0.009 * Math.min(1, (-0.5 - y) * 4);   // robe folds
  // hair: a cap with combed grooves, and a top-knot
  const hairClip = y - (0.62 - 0.6 * Math.max(0, -z) + 0.05 * ax);
  let hair = sdEllipsoid(x, y, z, [0, 0.5, -0.06], [0.455, 0.53, 0.5]);
  hair += Math.sin(Math.atan2(x, z) * 30 + y * 6) * 0.004;
  hair = smax(hair, -hairClip, 0.03);
  d = smin(d, hair, 0.02);
  let knot = sdEllipsoid(x, y, z, [0, 0.98, -0.08], [0.22, 0.2, 0.22]);
  knot = smin(knot, sdEllipsoid(x, y, z, [0, 1.14, -0.08], [0.11, 0.1, 0.11]), 0.05);
  knot += (Math.sin(x * 55) * Math.sin(y * 55) * Math.sin(z * 55)) * 0.01;
  d = smin(d, knot, 0.06);
  // a plain diadem band with a front plaque, and a heavy collar
  d = smin(d, sdTorusY(x, y, z, [0, -0.47, -0.02], 0.31, 0.04), 0.03);
  // broken: jagged fracture below the chest, a chunk gone from one shoulder
  const cut = -1.32 + (fbm(x * 3, 0, z * 3) - 0.5) * 0.28;
  d = smax(d, -(y - cut), 0.02);
  d = smax(d, -sdEllipsoid(x, y, z, [1.0, -0.62, 0.2], [0.3, 0.22, 0.3]), 0.03);
  // weathering
  d += (fbm(x * 9, y * 9, z * 9) - 0.5) * 0.012;
  return d;
}

// Naive surface nets over a regular grid.
function surfaceNets(f: (x: number, y: number, z: number) => number, min: V, max: V, step: number) {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1, ny = Math.ceil((max[1] - min[1]) / step) + 1, nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const field = new Float32Array(nx * ny * nz);
  const id = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    field[id(i, j, k)] = f(min[0] + i * step, min[1] + j * step, min[2] + k * step);
  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const pos: number[] = [];
  const corners: V[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v = corners.map((c) => field[id(i + c[0], j + c[1], k + c[2])]);
    let neg = 0; for (const a of v) if (a < 0) neg++;
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
      sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
      sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
      n++;
    }
    cellVert[id(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * step, min[1] + (j + sy / n) * step, min[2] + (k + sz / n) * step);
  }
  const index: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) index.push(a, b, c, a, c, d); else index.push(a, c, b, a, d, c);   // outward-facing winding
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = field[id(i, j, k)] < 0;
    if ((field[id(i + 1, j, k)] < 0) !== s0) quad(cellVert[id(i, j - 1, k - 1)], cellVert[id(i, j, k - 1)], cellVert[id(i, j, k)], cellVert[id(i, j - 1, k)], s0);
    if ((field[id(i, j + 1, k)] < 0) !== s0) quad(cellVert[id(i - 1, j, k - 1)], cellVert[id(i - 1, j, k)], cellVert[id(i, j, k)], cellVert[id(i, j, k - 1)], s0);
    if ((field[id(i, j, k + 1)] < 0) !== s0) quad(cellVert[id(i - 1, j - 1, k)], cellVert[id(i, j - 1, k)], cellVert[id(i, j, k)], cellVert[id(i - 1, j, k)], s0);
  }
  return { pos, index };
}

export interface Statue { group: THREE.Group; update(t: number): void }

export function buildStatue(scale: number, envMap?: THREE.Texture): Statue {
  const { pos, index } = surfaceNets(bust, [-1.45, -1.62, -0.75], [1.45, 1.3, 0.75], 0.022);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  // normals from the field gradient, colours from weathering
  const n = pos.length / 3, nor = new Float32Array(n * 3), col = new Float32Array(n * 3), e = 0.004;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    let gx = bust(x + e, y, z) - bust(x - e, y, z), gy = bust(x, y + e, z) - bust(x, y - e, z), gz = bust(x, y, z + e) - bust(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1; gx /= l; gy /= l; gz /= l;
    nor[i * 3] = gx; nor[i * 3 + 1] = gy; nor[i * 3 + 2] = gz;
    const occ = 0.5 * Math.max(0, Math.min(1, bust(x + gx * 0.05, y + gy * 0.05, z + gz * 0.05) / 0.05))
              + 0.5 * Math.max(0, Math.min(1, bust(x + gx * 0.015, y + gy * 0.015, z + gz * 0.015) / 0.015));   // 0 in crevices
    // grime collects along the carved features, so the face still reads from hundreds of metres away
    const ax = Math.abs(x); let feat = 0;
    const band = (dist: number, w: number) => Math.max(0, 1 - dist / w);
    if (z > 0.3) {
      if (ax > 0.06 && ax < 0.25) feat = Math.max(feat, band(Math.abs(y - (0.362 - 0.9 * (ax - 0.15) ** 2)), 0.018) * 0.85);   // lash seams
      if (ax < 0.27) feat = Math.max(feat, band(Math.abs(y - (0.425 - 0.6 * (ax - 0.14) ** 2)), 0.018) * 0.22 * (ax > 0.03 ? 1 : 0));   // under the brow
      if (ax < 0.095) feat = Math.max(feat, band(Math.abs(y - (0.092 + 0.035 * (ax / 0.1) ** 2)), 0.011) * 0.6 * (1 - ax / 0.095 * 0.5));   // mouth
      feat = Math.max(feat, band(Math.hypot(ax - 0.045, y - 0.205), 0.03) * 0.7);                                // nostrils
    }
    const hairEdge = y - (0.62 - 0.6 * Math.max(0, -z) + 0.05 * ax);
    feat = Math.max(feat, band(Math.abs(hairEdge), 0.02) * 0.5);
    const tone = 0.5 + 0.5 * fbm(x * 4, y * 4, z * 4);
    const streak = Math.max(0, fbm(x * 22, y * 1.5, z * 22) - 0.55) * 2.2;            // soft vertical damp runs
    const damp = Math.max(0, -gy) * 0.35;
    const moss = Math.max(0, gy) ** 3 * fbm(x * 12, y * 12, z * 12);
    let r = 0.5 * tone + 0.42, g = 0.52 * tone + 0.43, b = 0.48 * tone + 0.41;
    const dark = Math.min(0.85, (1 - occ) * 0.45 + damp * 0.7 + streak * 0.25 + feat);
    r *= 1 - dark; g *= 1 - dark; b *= 1 - dark * 0.95;
    r = r * (1 - moss * 0.4); g = g * (1 - moss * 0.15); b = b * (1 - moss * 0.45);
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stone = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x7f857d, roughness: 0.95, metalness: 0, envMap, envMapIntensity: 0.2 });
  const body = new THREE.Mesh(geo, stone); body.castShadow = true; body.receiveShadow = true;

  const group = new THREE.Group(); group.add(body);
  // eyes: closed in the stone; when they 'open', a dark slit widens along the lash seam and a faint
  // pale pupil appears inside it
  const slitMat = new THREE.MeshBasicMaterial({ color: 0x050607 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x9fd3e0, transparent: true, opacity: 0 });
  const slits: THREE.Mesh[] = [];
  for (const c of [EYE_L, EYE_R]) {
    const slit = new THREE.Mesh(new THREE.CircleGeometry(1, 48), slitMat);
    slit.position.set(c[0], 0.364, 0.468); slit.rotation.x = -0.3; slit.scale.set(0.08, 0.0001, 1);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.016, 24), pupilMat); pupil.position.set(0, 0, 0.002);
    pupil.scale.set(1 / 0.08, 1, 1); slit.add(pupil);
    group.add(slit); slits.push(slit);
  }
  group.scale.setScalar(scale);

  let next = 18, start = -100;
  return {
    group,
    update(t: number) {
      // every 40-70 s the eyes open very slowly, stay open, and close again
      if (t > next) { start = t; next = t + 40 + Math.random() * 30; }
      const p = (t - start) / 14;               // 14 s cycle: 4 s opening, 6 s open, 4 s closing
      let open = 0;
      if (p >= 0 && p < 1) { const s = p * 14; open = s < 4 ? s / 4 : s < 10 ? 1 : 1 - (s - 10) / 4; open = open * open * (3 - 2 * open); }
      for (const sl of slits) { sl.scale.y = 0.0001 + 0.028 * open; sl.children[0].scale.y = 1 / Math.max(0.0001, sl.scale.y) * 0.016 / 0.016 * Math.min(1, open * 1.2) * sl.scale.y / 0.028; }
      pupilMat.opacity = Math.max(0, open * 1.3 - 0.3);
    },
  };
}

// A hanging chain of giant links from `top`, swaying slightly.
export function chain(top: THREE.Vector3, links: number, linkLen: number, mat: THREE.Material) {
  const g = new THREE.Group(); g.position.copy(top);
  const link = new THREE.TorusGeometry(linkLen * 0.32, linkLen * 0.09, 8, 18); link.scale(1, 1.6, 1);
  const inst = new THREE.InstancedMesh(link, mat, links);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < links; i++) {
    q.setFromEuler(new THREE.Euler(0, i % 2 ? Math.PI / 2 : 0, 0));
    m.compose(new THREE.Vector3(0, -i * linkLen * 0.78, 0), q, new THREE.Vector3(1, 1, 1));
    inst.setMatrixAt(i, m);
  }
  inst.castShadow = true; g.add(inst);
  return g;
}
