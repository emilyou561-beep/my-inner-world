import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const page = (file: string) => resolve(__dirname, file);

export default defineConfig({
  // relative asset paths, so the site works under /my-inner-world/ on GitHub Pages
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: page('index.html'),
        scene002: page('scene-002.html'),
        scene003: page('scene-003.html'),
        scene004: page('scene-004.html'),
        classic001: page('classic-001.html'),
        classic002: page('classic-002.html'),
        classic003: page('classic-003.html'),
        classic004: page('classic-004.html')
      }
    }
  }
});
