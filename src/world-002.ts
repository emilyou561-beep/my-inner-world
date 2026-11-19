import { mountWorld } from './world';

mountWorld({
  index: '002',
  title: 'THE MONUMENTAL EXTERIOR',
  splat: '/worlds/scene-002.spz',
  height: 0.8,
  pitch: 0.08,
  classic: '/classic-002.html',
  next: { label: 'NEXT SCENE', href: '/scene-003.html' },
  prev: { label: 'SCENE 001', href: '/' },
});
