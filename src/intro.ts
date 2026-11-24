// Floating intro text shown when the visitor first enters Scene 001.
// Lines drift up out of a dark veil one at a time, hover, and dissolve; then the veil lifts and the
// hall is revealed. A click, tap or any key skips straight to the scene.

const LINES = [
  'Welcome to my inner world.',
  'This is a dream I made.',
  'You are perfectly safe here — there is no one here but you.',
  'Please be a well-behaved visitor. Do not move anything.',
  'If you feel lonely, that is normal.',
  'But if you feel uncomfortable, please leave, and have a sip of warm water.',
  'And now — welcome.',
];

const CSS = `
#intro { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; cursor: default;
  background: radial-gradient(ellipse at center, rgba(8,10,11,0.72) 0%, rgba(4,5,6,0.94) 75%);
  transition: opacity 3.2s ease; }
#intro.done { opacity: 0; pointer-events: none; }
#intro .line { position: absolute; max-width: min(86vw, 900px); padding: 0 24px; text-align: center;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-weight: 300;
  font-size: clamp(18px, 2.4vw, 30px); letter-spacing: 0.08em; line-height: 1.5; color: #e9eeee;
  text-shadow: 0 0 18px rgba(200,230,240,0.35), 0 0 2px rgba(255,255,255,0.4);
  opacity: 0; filter: blur(8px); transform: translateY(18px);
  transition: opacity 1.6s ease, filter 1.6s ease, transform 4.2s cubic-bezier(.2,.6,.2,1); }
#intro .line.on { opacity: 1; filter: blur(0); transform: translateY(0); animation: introFloat 5s ease-in-out infinite; }
#intro .line.off { opacity: 0; filter: blur(6px); transform: translateY(-22px); }
#intro .skip { position: absolute; bottom: 28px; left: 0; right: 0; text-align: center; font: 300 11px/1 "Helvetica Neue", Helvetica, Arial, sans-serif;
  letter-spacing: 0.3em; color: rgba(220,230,230,0.35); }
@keyframes introFloat { 0%,100% { translate: 0 0; } 50% { translate: 0 -6px; } }
@media (prefers-reduced-motion: reduce) { #intro .line, #intro .line.on, #intro .line.off { transform: none; animation: none; filter: none; } }
`;

export function showIntro(onDone?: () => void) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.id = 'intro'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Introduction');
  const els = LINES.map((t) => { const d = document.createElement('div'); d.className = 'line'; d.textContent = t; root.appendChild(d); return d; });
  const skip = document.createElement('div'); skip.className = 'skip'; skip.textContent = 'CLICK TO ENTER'; root.appendChild(skip);
  document.body.appendChild(root);
  const panel = document.querySelector<HTMLElement>('aside'); const header = document.querySelector<HTMLElement>('header');
  for (const el of [panel, header]) if (el) { el.style.transition = 'opacity 2s'; el.style.opacity = '0'; }

  const timers: number[] = [];
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    timers.forEach(clearTimeout);
    els.forEach((e) => { e.classList.remove('on'); e.classList.add('off'); });
    root.classList.add('done');
    for (const el of [panel, header]) if (el) el.style.opacity = '';
    setTimeout(() => { root.remove(); style.remove(); }, 3400);
    removeEventListener('keydown', finish);
    onDone?.();
  };
  // one line at a time: showing a line always dissolves every other line, so late timers can never stack them
  const show = (i: number) => els.forEach((e, j) => {
    if (j === i) { e.classList.remove('off'); e.classList.add('on'); }
    else if (e.classList.contains('on')) { e.classList.remove('on'); e.classList.add('off'); }
  });
  // start timing only once the scene has drawn (shader compilation can stall the first frames)
  const start = () => {
  let t = 1200;
  els.forEach((_, i) => {
    const hold = 2400 + LINES[i].length * 45;
    timers.push(window.setTimeout(() => show(i), t));
    timers.push(window.setTimeout(() => { if (els[i].classList.contains('on')) show(-1); }, t + hold));
    t += hold + 900;
  });
  timers.push(window.setTimeout(finish, t + 400));
  };
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(start)));
  root.addEventListener('click', finish);
  addEventListener('keydown', finish);
}
