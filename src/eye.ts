import * as THREE from 'three';

// A giant mechanical eye set into the ring gate of Scene 001.
// The eyeball darts between look targets (often straight at the viewer) and two steel lid shells
// close over it now and then to blink.

function irisCanvas(glowOnly: boolean): HTMLCanvasElement {
  // Equirectangular map for a sphere whose pole faces the viewer: the top rows are the pupil,
  // then the iris, then the sclera wrapping round the back.
  const W = 2048, Hc = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = Hc;
  const g = c.getContext('2d')!;
  const PUPIL = 0.075, IRIS = 0.19; // fractions of the canvas height (0 = front pole)
  if (glowOnly) {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, Hc);
    // a cold glowing ring at the iris edge and a faint inner ring round the pupil
    const band = (y0: number, y1: number, color: string) => { g.fillStyle = color; g.fillRect(0, y0 * Hc, W, (y1 - y0) * Hc); };
    band(IRIS - 0.012, IRIS, '#9fe6ff');
    band(PUPIL, PUPIL + 0.006, '#3f7c8c');
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * W, y0 = (PUPIL + 0.01) * Hc, len = (IRIS - PUPIL - 0.03) * Hc * (0.4 + Math.random() * 0.6);
      g.fillStyle = `rgba(110,200,230,${0.08 + Math.random() * 0.18})`; g.fillRect(x, y0, 2 + Math.random() * 3, len);
    }
    return c;
  }
  // sclera: pale, slightly grey, with a few dark veins creeping in from the back
  const sc = g.createLinearGradient(0, 0, 0, Hc);
  sc.addColorStop(0, '#c9ccc8'); sc.addColorStop(0.5, '#b2b5b1'); sc.addColorStop(1, '#8e918e');
  g.fillStyle = sc; g.fillRect(0, 0, W, Hc);
  g.strokeStyle = 'rgba(90,40,40,0.35)';
  for (let i = 0; i < 70; i++) {
    let x = Math.random() * W, y = Hc * (0.55 + Math.random() * 0.4);
    g.lineWidth = 1 + Math.random() * 2.5; g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 12 && y > IRIS * Hc + 20; s++) { x += (Math.random() - 0.5) * 40; y -= 15 + Math.random() * 25; g.lineTo(x, y); }
    g.stroke();
  }
  // iris: steel blue-grey with radial fibres (vertical streaks in this projection)
  const ir = g.createLinearGradient(0, PUPIL * Hc, 0, IRIS * Hc);
  ir.addColorStop(0, '#2c4a55'); ir.addColorStop(0.45, '#4f7480'); ir.addColorStop(0.85, '#38525b'); ir.addColorStop(1, '#141c20');
  g.fillStyle = ir; g.fillRect(0, PUPIL * Hc, W, (IRIS - PUPIL) * Hc);
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * W, y0 = PUPIL * Hc + Math.random() * 10, len = (IRIS - PUPIL) * Hc * (0.3 + Math.random() * 0.7);
    const l = Math.random();
    g.fillStyle = l > 0.5 ? `rgba(160,200,210,${0.1 + Math.random() * 0.25})` : `rgba(10,20,25,${0.15 + Math.random() * 0.3})`;
    g.fillRect(x, y0, 1 + Math.random() * 3, len);
  }
  // limbal ring: dark edge where iris meets sclera, softened
  const lim = g.createLinearGradient(0, (IRIS - 0.02) * Hc, 0, (IRIS + 0.03) * Hc);
  lim.addColorStop(0, 'rgba(8,12,14,0)'); lim.addColorStop(0.4, 'rgba(8,12,14,0.95)'); lim.addColorStop(1, 'rgba(8,12,14,0)');
  g.fillStyle = lim; g.fillRect(0, (IRIS - 0.02) * Hc, W, 0.05 * Hc);
  // pupil
  g.fillStyle = '#050607'; g.fillRect(0, 0, W, PUPIL * Hc);
  return c;
}

export interface Eye { update(dt: number, t: number): void }

export function addEye(scene: THREE.Scene, opts: { center: THREE.Vector3; radius: number; lidMaterial: THREE.Material; rimMaterial: THREE.Material; envMap?: THREE.Texture }): Eye {
  const { center, radius: R } = opts;
  const map = new THREE.CanvasTexture(irisCanvas(false)); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const emissiveMap = new THREE.CanvasTexture(irisCanvas(true)); emissiveMap.colorSpace = THREE.SRGBColorSpace;

  // Sphere with its +Y pole turned to face +Z (towards the hall).
  const ballGeo = new THREE.SphereGeometry(R, 128, 64); ballGeo.rotateX(Math.PI / 2);
  const ballMat = new THREE.MeshPhysicalMaterial({
    map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.6,
    roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    envMap: opts.envMap, envMapIntensity: 1.2,
  });
  const ball = new THREE.Mesh(ballGeo, ballMat);
  const ballPivot = new THREE.Group(); ballPivot.position.copy(center); ballPivot.add(ball); scene.add(ballPivot);

  // Two steel lid shells (upper and lower hemispheres), slightly larger than the eyeball.
  const lidGeoUp = new THREE.SphereGeometry(R * 1.04, 96, 32, 0, Math.PI * 2, 0, Math.PI / 2);
  const lidGeoDn = new THREE.SphereGeometry(R * 1.04, 96, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const upper = new THREE.Mesh(lidGeoUp, opts.lidMaterial); const lower = new THREE.Mesh(lidGeoDn, opts.lidMaterial);
  // a steel rim along each lid's edge so the shells read as thick plates
  const rimGeo = new THREE.TorusGeometry(R * 1.04, R * 0.035, 10, 160); rimGeo.rotateX(Math.PI / 2);
  upper.add(new THREE.Mesh(rimGeo, opts.rimMaterial)); lower.add(new THREE.Mesh(rimGeo, opts.rimMaterial));
  // horizontal ribs on the lids
  for (const [lid, sign] of [[upper, 1], [lower, -1]] as const) {
    for (const k of [0.35, 0.6, 0.82]) {
      const a = k * Math.PI / 2, r = Math.cos(a) * R * 1.05;
      const rib = new THREE.TorusGeometry(r, R * 0.012, 6, 140); rib.rotateX(Math.PI / 2); rib.translate(0, sign * Math.sin(a) * R * 1.05, 0);
      lid.add(new THREE.Mesh(rib, opts.rimMaterial));
    }
  }
  const lids = new THREE.Group(); lids.position.copy(center); lids.add(upper, lower); scene.add(lids);
  // a cold light just in front of the eye so it reads inside the dark recess
  const eyeLight = new THREE.PointLight(0xcfe8ef, 550, R * 6, 2); eyeLight.position.set(center.x, center.y + R * 0.4, center.z + R * 2.2); scene.add(eyeLight);

  const OPEN_UP = 0.95, OPEN_DN = 0.7; // radians the lids are swung back when open
  // gaze state
  const look = new THREE.Vector2(), target = new THREE.Vector2();
  let nextSaccade = 1.5, nextBlink = 2.5, blinkStart = -10, doubleBlink = false;
  const BLINK = 0.32;

  return {
    update(dt, t) {
      // gaze: quick saccades between targets, often straight at the viewer
      if (t > nextSaccade) {
        if (Math.random() < 0.35) target.set(0, 0);
        else target.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.45);
        nextSaccade = t + 0.6 + Math.random() * 2.6;
        if (Math.random() < 0.25) nextBlink = Math.min(nextBlink, t + 0.05); // blinks often come with a glance
      }
      const k = 1 - Math.exp(-dt * 14);
      look.lerp(target, k);
      const tremor = 0.004;
      ball.rotation.set(-look.y + Math.sin(t * 23) * tremor, look.x + Math.sin(t * 17.3) * tremor, 0);

      // blink
      if (t > nextBlink) { blinkStart = t; doubleBlink = Math.random() < 0.2; nextBlink = t + 2.5 + Math.random() * 4.5; }
      let close = 0; // 0 open .. 1 shut
      const p = (t - blinkStart) / BLINK;
      if (p >= 0 && p < 1) close = Math.sin(p * Math.PI) ** 0.7;
      else if (doubleBlink && p >= 1.25 && p < 2.25) close = Math.sin((p - 1.25) * Math.PI) ** 0.7;
      // lids also follow the gaze a little, as real lids do
      upper.rotation.x = -OPEN_UP * (1 - close) - look.y * 0.35 * (1 - close);
      lower.rotation.x = OPEN_DN * (1 - close) - look.y * 0.25 * (1 - close);
      ballMat.emissiveIntensity = 1.6 * (1 - close * 0.8);
    },
  };
}
