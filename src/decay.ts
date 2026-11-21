import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Small, human-scale signs of abandonment: dead trees, sewage and chemical puddles, rusted drums,
// spilled reagent cans and dry weeds. Kept deliberately small so the architecture reads as colossal.

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const UP = new THREE.Vector3(0, 1, 0);

function drumTexture(paint: string, label: boolean, seed: number): THREE.CanvasTexture {
  const r = rng(seed);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = paint; g.fillRect(0, 0, 512, 256);
  // faded paint and grime toward the bottom
  const grime = g.createLinearGradient(0, 0, 0, 256);
  grime.addColorStop(0, 'rgba(40,32,24,0.05)'); grime.addColorStop(0.7, 'rgba(40,32,24,0.25)'); grime.addColorStop(1, 'rgba(30,22,14,0.75)');
  g.fillStyle = grime; g.fillRect(0, 0, 512, 256);
  if (label) {
    // a hazard diamond and a faded label panel
    g.save(); g.translate(150, 110); g.rotate(Math.PI / 4);
    g.fillStyle = '#c9a12a'; g.fillRect(-34, -34, 68, 68); g.strokeStyle = '#1a1a1a'; g.lineWidth = 5; g.strokeRect(-30, -30, 60, 60); g.restore();
    g.fillStyle = '#1a1a1a'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText('!', 150, 125);
    g.fillStyle = 'rgba(225,222,210,0.75)'; g.fillRect(230, 70, 170, 80);
    g.fillStyle = 'rgba(30,30,30,0.6)'; for (let i = 0; i < 5; i++) g.fillRect(242, 82 + i * 13, 60 + r() * 90, 5);
  }
  // rust blooms and drips
  for (let i = 0; i < 40; i++) {
    const x = r() * 512, y = r() * 256, s = 6 + r() * 40;
    const rad = g.createRadialGradient(x, y, 0, x, y, s);
    rad.addColorStop(0, `rgba(${90 + r() * 40},${40 + r() * 20},${15},${0.6 + r() * 0.35})`); rad.addColorStop(1, 'rgba(90,45,15,0)');
    g.fillStyle = rad; g.fillRect(x - s, y - s, s * 2, s * 2);
    if (r() < 0.5) { g.fillStyle = `rgba(95,45,15,${0.3 + r() * 0.4})`; g.fillRect(x, y, 2 + r() * 3, 20 + r() * 90); }
  }
  // the dark seams of the rolling hoops
  g.fillStyle = 'rgba(20,16,12,0.5)'; g.fillRect(0, 82, 512, 5); g.fillRect(0, 168, 512, 5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export interface DecayOptions { envMap?: THREE.Texture; shadows?: boolean }

export class Decay {
  private groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private noShadow = new Set<THREE.Material>();
  readonly bark: THREE.MeshStandardMaterial;
  readonly sewage: THREE.MeshPhysicalMaterial;
  readonly toxic: THREE.MeshPhysicalMaterial;
  readonly stain: THREE.MeshStandardMaterial;
  readonly drums: THREE.MeshStandardMaterial[];
  readonly hoop: THREE.MeshStandardMaterial;
  readonly plastic: THREE.MeshStandardMaterial[];
  readonly weed: THREE.MeshStandardMaterial;
  readonly wood: THREE.MeshStandardMaterial;

  constructor(private scene: THREE.Scene, private o: DecayOptions = {}) {
    const env = o.envMap;
    this.bark = new THREE.MeshStandardMaterial({ color: 0x3a3732, roughness: 1 });
    this.sewage = new THREE.MeshPhysicalMaterial({ color: 0x1a1a12, roughness: 0.12, clearcoat: 0.5, clearcoatRoughness: 0.08, envMap: env, envMapIntensity: 0.28, polygonOffset: true, polygonOffsetFactor: -4 });
    this.toxic = new THREE.MeshPhysicalMaterial({ color: 0x3a4210, emissive: 0x1c2600, emissiveIntensity: 0.35, roughness: 0.18, clearcoat: 0.5, envMap: env, envMapIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: -5 });
    this.stain = new THREE.MeshStandardMaterial({ color: 0x3a3529, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.drums = [
      ['#7a4f2d', false], ['#8a7a3c', true], ['#3a5664', true], ['#2d2e2b', false], ['#6b6e5e', true],
    ].map(([p, l], i) => new THREE.MeshStandardMaterial({ map: drumTexture(p as string, l as boolean, 11 + i * 7), roughness: 0.75, metalness: 0.35, envMap: env, envMapIntensity: 0.4 }));
    this.hoop = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.8, metalness: 0.5, envMap: env, envMapIntensity: 0.4 });
    this.plastic = [0xb9b8ad, 0x3f5f78, 0x9a8f4a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
    this.weed = new THREE.MeshStandardMaterial({ color: 0x6d6650, roughness: 1, side: THREE.DoubleSide });
    this.wood = new THREE.MeshStandardMaterial({ color: 0x5a5144, roughness: 1 });
    for (const m of [this.sewage, this.toxic, this.stain]) this.noShadow.add(m);
  }

  private push(g: THREE.BufferGeometry, m: THREE.Material) {
    if (g.index) g = g.toNonIndexed();
    if (!this.groups.has(m)) this.groups.set(m, []);
    this.groups.get(m)!.push(g);
  }
  private member(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, m: THREE.Material, seg = 7) {
    const dir = b.clone().sub(a); const len = dir.length();
    const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
    const mid = a.clone().add(b).multiplyScalar(0.5); g.translate(mid.x, mid.y, mid.z);
    this.push(g, m);
  }

  // A dead, leafless tree: gnarled trunk, forking bare branches, broken stubs.
  tree(x: number, y: number, z: number, height: number, seed: number, lean = 0.12, up?: THREE.Vector3) {
    const r = rng(seed);
    const base = new THREE.Vector3(x, y, z);
    const trunkR = height * 0.035;
    // root flare
    for (let i = 0; i < (up ? 0 : 5); i++) {
      const a = (i / 5) * Math.PI * 2 + r();
      const tip = base.clone().add(new THREE.Vector3(Math.cos(a) * trunkR * 4, -0.1, Math.sin(a) * trunkR * 4));
      this.member(base.clone().add(new THREE.Vector3(0, trunkR * 1.5, 0)), tip, trunkR * 0.7, trunkR * 0.15, this.bark, 5);
    }
    const branch = (p: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
      // each limb is a few bent segments
      let cur = p.clone(); let d = dir.clone();
      const segs = depth > 3 ? 3 : 2;
      for (let s = 0; s < segs; s++) {
        d.add(new THREE.Vector3((r() - 0.5) * 0.5, (r() - 0.35) * 0.3, (r() - 0.5) * 0.5)).normalize();
        const next = cur.clone().addScaledVector(d, len / segs);
        const rr = rad * (1 - (s + 1) / segs * 0.3);
        this.member(cur, next, rad * (1 - s / segs * 0.3), rr, this.bark, depth > 2 ? 7 : 5);
        cur = next;
      }
      if (depth <= 0 || rad < 0.012) return;
      if (depth < 4 && r() < 0.18) {           // snapped-off limb
        this.member(cur, cur.clone().addScaledVector(d, len * 0.15), rad * 0.7, rad * 0.4, this.bark, 5);
        return;
      }
      const n = depth > 3 ? 2 + Math.floor(r() * 2) : 2;
      for (let i = 0; i < n; i++) {
        const spread = 0.45 + r() * 0.5;
        const az = r() * Math.PI * 2;
        const side = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
        const nd = d.clone().multiplyScalar(Math.cos(spread)).addScaledVector(side, Math.sin(spread));
        nd.y += depth < 2 ? -0.15 : 0.05;              // the finest twigs droop
        branch(cur, nd.normalize(), len * (0.62 + r() * 0.15), rad * 0.62, depth - 1);
      }
    };
    const dir = new THREE.Vector3((r() - 0.5) * lean, 1, (r() - 0.5) * lean);
    if (up) dir.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, up.clone().normalize()));
    dir.normalize();
    branch(base, dir, height * 0.42, trunkR, 5);
  }

  private blob(rx: number, rz: number, seed: number, pts = 48) {
    const r = rng(seed);
    const ph = [r() * 6, r() * 6, r() * 6];
    const s = new THREE.Shape();
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const k = 1 + 0.18 * Math.sin(a * 3 + ph[0]) + 0.1 * Math.sin(a * 5 + ph[1]) + 0.06 * Math.sin(a * 9 + ph[2]);
      const px = Math.cos(a) * rx * k, pz = Math.sin(a) * rz * k;
      if (i === 0) s.moveTo(px, pz); else s.lineTo(px, pz);
    }
    const g = new THREE.ShapeGeometry(s, 2); g.rotateX(-Math.PI / 2);
    return g;
  }
  // A shallow puddle of stagnant sewage (or a chemical spill) with a dried stain ring round it.
  puddle(x: number, y: number, z: number, rx: number, rz: number, seed: number, kind: 'sewage' | 'toxic' = 'sewage', rot = 0) {
    const stain = this.blob(rx * 1.35, rz * 1.35, seed + 1); stain.rotateY(rot); stain.translate(x, y + 0.015, z); this.push(stain, this.stain);
    const pool = this.blob(rx, rz, seed); pool.rotateY(rot); pool.translate(x, y + 0.03, z); this.push(pool, kind === 'toxic' ? this.toxic : this.sewage);
    // a few islands of sludge breaking the surface
    const r = rng(seed + 9);
    for (let i = 0; i < 3; i++) {
      const isl = this.blob(rx * (0.06 + r() * 0.1), rz * (0.05 + r() * 0.08), seed + 20 + i, 16);
      isl.translate(x + (r() - 0.5) * rx, y + 0.035, z + (r() - 0.5) * rz); this.push(isl, this.stain);
    }
  }

  private drum(p: THREE.Vector3, tipped: boolean, yaw: number, mat: THREE.Material, dent: number) {
    const R = 0.29, H = 0.88;
    const parts: [THREE.BufferGeometry, THREE.Material][] = [];
    const body = new THREE.CylinderGeometry(R, R, H, 28, 1); body.scale(1 + dent, 1, 1 - dent * 0.6); parts.push([body, mat]);
    for (const hy of [-H / 6, H / 6]) { const h = new THREE.TorusGeometry(R + 0.008, 0.012, 5, 28); h.rotateX(Math.PI / 2); h.translate(0, hy, 0); parts.push([h, this.hoop]); }
    for (const hy of [-H / 2, H / 2]) { const h = new THREE.TorusGeometry(R, 0.018, 5, 28); h.rotateX(Math.PI / 2); h.translate(0, hy, 0); parts.push([h, this.hoop]); }
    const bung = new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8); bung.translate(0.15, H / 2 + 0.01, 0.05); parts.push([bung, this.hoop]);
    for (const [g, m] of parts) {
      if (tipped) { g.rotateZ(Math.PI / 2); g.translate(0, R, 0); } else g.translate(0, H / 2, 0);
      g.rotateY(yaw); g.translate(p.x, p.y, p.z); this.push(g, m);
    }
  }
  // A dumped cluster of chemical drums, reagent cans and a broken pallet, with a leak.
  dump(x: number, y: number, z: number, seed: number, count = 6, leak = true) {
    const r = rng(seed);
    // pallet
    const py = y, pyaw = r() * Math.PI;
    const pal = (dx: number, dz: number, w: number, h: number, d: number, yy: number) => {
      const g = new THREE.BoxGeometry(w, h, d); g.translate(dx, yy, dz); g.rotateY(pyaw); g.translate(x, py, z); this.push(g, this.wood);
    };
    for (let i = 0; i < 5; i++) if (r() > 0.2) pal(-0.5 + i * 0.25, 0, 0.16, 0.025, 1.2, 0.14);
    for (const dz of [-0.5, 0, 0.5]) pal(0, dz, 1.1, 0.12, 0.1, 0.06);
    const placed: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      let p = new THREE.Vector3();
      for (let tries = 0; tries < 20; tries++) {
        p.set(x + (r() - 0.5) * 3.2, y, z + (r() - 0.5) * 3.2);
        if (placed.every((q) => q.distanceTo(p) > 0.72)) break;
      }
      placed.push(p);
      const tipped = r() < 0.3;
      this.drum(p, tipped, r() * Math.PI * 2, this.drums[Math.floor(r() * this.drums.length)], r() * 0.08);
      if (tipped && leak && r() < 0.8) {
        const a = r() * Math.PI * 2;
        this.puddle(p.x + Math.cos(a) * 0.9, y, p.z + Math.sin(a) * 0.9, 0.7 + r() * 0.7, 0.5 + r() * 0.4, seed * 13 + i, 'toxic', a);
      }
    }
    // plastic reagent cans, some on their sides
    for (let i = 0; i < 4 + Math.floor(r() * 4); i++) {
      const g = new THREE.BoxGeometry(0.22, 0.34, 0.14);
      const cap = new THREE.CylinderGeometry(0.025, 0.025, 0.04, 8); cap.translate(0.06, 0.19, 0);
      const side = r() < 0.5;
      const yaw = r() * Math.PI * 2;
      const px = x + (r() - 0.5) * 4.2, pz = z + (r() - 0.5) * 4.2;
      const mat = this.plastic[Math.floor(r() * this.plastic.length)];
      for (const part of [g, cap]) {
        if (side) { part.rotateZ(Math.PI / 2); part.translate(0, 0.07, 0); } else part.translate(0, 0.17, 0);
        part.rotateY(yaw); part.translate(px, y, pz); this.push(part, mat);
      }
    }
    if (leak) this.puddle(x + 1.2, y, z + 0.8, 1.4, 0.9, seed + 77, 'sewage', r());
  }

  // A clump of dry, dead grass growing from a crack.
  weeds(x: number, y: number, z: number, radius: number, seed: number, count = 40, scale = 1) {
    const r = rng(seed);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius;
      const h = (0.25 + r() * 0.6) * scale;
      const g = new THREE.ConeGeometry(0.018 * scale, h, 3, 1); g.translate(0, h / 2, 0);
      g.rotateZ((r() - 0.5) * 0.9); g.rotateX((r() - 0.5) * 0.9);
      g.translate(x + Math.cos(a) * d, y, z + Math.sin(a) * d); this.push(g, this.weed);
    }
  }

  flush() {
    for (const [m, gs] of this.groups) {
      const merged = mergeGeometries(gs, false); if (!merged) continue;
      const mesh = new THREE.Mesh(merged, m);
      const shadow = this.o.shadows !== false && !this.noShadow.has(m);
      mesh.castShadow = shadow; mesh.receiveShadow = true;
      if (this.noShadow.has(m)) mesh.renderOrder = 1;
      this.scene.add(mesh);
    }
    this.groups.clear();
  }
}
