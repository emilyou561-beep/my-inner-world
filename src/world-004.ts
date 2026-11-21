import * as THREE from 'three';
import { mountWorld } from './world';

mountWorld({
  index: '004',
  title: 'THE CRESCENT',
  splat: '/worlds/scene-004.spz',
  height: 0.8,
  pitch: 0.08,
  snow: { radius: 9, height: 9, count: 22000, innerRadius: 0.4, size: 0.03, center: new THREE.Vector3(0, 4, 0) },
  classic: '/classic-004.html',
  prev: { label: 'SCENE 003', href: '/scene-003.html' },
});
