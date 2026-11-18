import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        scene002: resolve(__dirname, 'scene-002.html'),
        scene003: resolve(__dirname, 'scene-003.html'),
        scene004: resolve(__dirname, 'scene-004.html')
      }
    }
  }
});
