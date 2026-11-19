import { mountWorld } from './world';

mountWorld({
  index: '003',
  title: 'THE VERTICAL VOID',
  splat: '/worlds/scene-003.spz',
  classic: '/classic-003.html',
  next: { label: 'NEXT SCENE', href: '/scene-004.html' },
  prev: { label: 'SCENE 002', href: '/scene-002.html' },
});
