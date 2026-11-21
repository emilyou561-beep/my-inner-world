import * as THREE from 'three';
import { mountWorld } from './world';

mountWorld({
  index: '002',
  title: 'THE MONUMENTAL EXTERIOR',
  splat: '/worlds/scene-002.spz',
  height: 0.8,
  pitch: 0.08,
  snow: { radius: 9, height: 9, count: 22000, innerRadius: 0.4, size: 0.03, center: new THREE.Vector3(0, 4, 0) },
  classic: '/classic-002.html',
  next: { label: 'NEXT SCENE', href: '/scene-003.html' },
  prev: { label: 'SCENE 001', href: '/' },
});
