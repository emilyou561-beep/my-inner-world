import * as THREE from 'three';
import { mountWorld } from './world';

mountWorld({
  index: '003',
  title: 'THE VERTICAL VOID',
  splat: './worlds/scene-003-v2.spz',
  pitch: 0.2,
  snow: { radius: 0.36, height: 1.5, count: 14000, size: 0.0032, speed: 0.07, innerRadius: 0.17, wind: [0.006, 0.002], center: new THREE.Vector3(0, 0.3, -0.24) },
  classic: './classic-003.html',
  next: { label: 'NEXT SCENE', href: './scene-004.html' },
  prev: { label: 'SCENE 002', href: './scene-002.html' },
});
