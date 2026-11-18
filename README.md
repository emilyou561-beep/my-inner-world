# Concrete World

Four fixed-viewpoint brutalist scenes built with Three.js. Drag to look around.

| Scene | Page | Description |
| --- | --- | --- |
| 001 · The Silent Observer | `index.html` | Columned concrete hall with a coffered roof and skylight slots |
| 002 · The Monumental Exterior | `scene-002.html` | Stacked cantilevered megastructure on a cliff plateau |
| 003 · The Vertical Void | `scene-003.html` | Vast concrete shaft with stairs, bridges and an oculus |
| 004 · The Crescent | `scene-004.html` | Curved terraced crescent, drum towers and a monumental gate |

## Run

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:5173/.

## Structure

- `src/kit.ts`: shared toolkit with the concrete surface shader (panel joints, tie holes, damp tide marks, rust, pitting), geometry batching, curved parts and ambient occlusion.
- `src/main.ts`, `src/scene-00x.ts`: one file per scene.
- `public/textures/`: concrete textures from [Poly Haven](https://polyhaven.com) (CC0).
