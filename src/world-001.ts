import { mountWorld } from './world';

mountWorld({
  index: '001',
  title: 'THE SILENT OBSERVER',
  splat: '/worlds/scene-001.spz',
  classic: '/classic-001.html',
  next: { label: 'NEXT SCENE', href: '/scene-002.html' },
});
