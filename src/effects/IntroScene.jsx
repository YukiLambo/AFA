import React, { useEffect, useMemo, useState } from 'react';
import { prefersReducedMotion } from './gl';

/*
 * Opening animation: an isometric field of glossy cubes that rises in a ripple from the centre,
 * with light running along the gaps and the A.F.A. logo glowing on top of the centre cube.
 * Original implementation in CSS 3D (no libraries, no WebGL), styled in the A.F.A. blue palette.
 *
 * Props:
 *   logo      – the element drawn on the centre cube (the AppIcon with its stroke animation)
 *   duration  – total length in ms before onDone fires
 *   onDone    – called when the intro finishes or the user skips it (click / Esc / Enter)
 */

// Small deterministic hash so cube heights look random but stay the same on every visit
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const CIRCUIT = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
    <g fill="none" stroke="#7ff8ff" stroke-width="1.4" stroke-linecap="round">
      <path d="M4 10h22l6 6h24M4 26h12l5-5h14M4 42h30l6-6h16M18 52h22l4 4"/>
      <path d="M44 4v8M10 48v8" opacity=".6"/>
    </g>
    <g fill="#bffcff"><circle cx="26" cy="10" r="1.8"/><circle cx="35" cy="21" r="1.8"/><circle cx="40" cy="36" r="1.8"/><circle cx="18" cy="52" r="1.6"/></g>
  </svg>`
);

export default function IntroScene({ logo, duration = 3800, onDone }) {
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const total = reduced ? 1400 : duration;
  const [leaving, setLeaving] = useState(false);

  // Cube size follows the viewport so phones and desktops both show a full field
  const layout = useMemo(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    const n = w < 640 ? 7 : 9;
    const size = Math.round(Math.max(64, Math.min(170, Math.min(w, h) / 4.4)));
    const gap = Math.round(size * 0.14);
    return { n, size, gap, step: size + gap };
  }, []);

  const cubes = useMemo(() => {
    const { n } = layout;
    const c = Math.floor(n / 2);
    const list = [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const centre = x === c && y === c;
        const dist = Math.hypot(x - c, y - c);
        const r = hash(x, y);
        list.push({
          key: `${x}-${y}`,
          x, y, centre,
          height: centre ? Math.round(layout.size * 1.45) : Math.round(layout.size * (0.14 + r * 0.5) * Math.min(1, Math.max(0.4, dist / 2.6))),
          delay: reduced ? 0 : 0.08 + dist * 0.11 + r * 0.08,
          lit: !centre && r > 0.82, // a few cubes catch extra light
          float: !centre && r < 0.18 // and a few drift gently once settled
        });
      }
    }
    return list;
  }, [layout, reduced]);

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), Math.max(0, total - 550));
    const done = setTimeout(onDone, total);
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onDone(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(fade); clearTimeout(done); window.removeEventListener('keydown', onKey); };
  }, [total, onDone]);

  const world = layout.n * layout.step - layout.gap;

  return (
    <div
      className={`afa-intro fixed inset-0 z-50 overflow-hidden cursor-pointer select-none ${reduced ? 'afa-intro-reduced' : ''}`}
      style={{ opacity: leaving ? 0 : 1, transition: 'opacity 550ms ease' }}
      onClick={onDone}
      role="presentation"
    >
      <style>{INTRO_CSS}</style>

      {/* 3D stage */}
      <div className="afa-intro-stage">
        <div className="afa-intro-world" style={{ width: world, height: world, '--step': `${layout.step}px`, '--size': `${layout.size}px` }}>
          <div className="afa-intro-floor">
            {[0.22, 0.48, 0.71].map((p, i) => (
              <span key={`h${i}`} className="afa-intro-streak afa-intro-streak-h" style={{ top: Math.round(p * layout.n) * layout.step - layout.gap / 2 - 1, animationDelay: `${0.6 + i * 0.5}s` }} />
            ))}
            {[0.3, 0.62].map((p, i) => (
              <span key={`v${i}`} className="afa-intro-streak afa-intro-streak-v" style={{ left: Math.round(p * layout.n) * layout.step - layout.gap / 2 - 1, animationDelay: `${0.9 + i * 0.6}s` }} />
            ))}
          </div>

          {cubes.map(cube => (
            <div
              key={cube.key}
              className={`afa-cube ${cube.centre ? 'afa-cube-centre' : ''} ${cube.lit ? 'afa-cube-lit' : ''} ${cube.float ? 'afa-cube-float' : ''}`}
              style={{
                left: cube.x * layout.step,
                top: cube.y * layout.step,
                width: layout.size,
                height: layout.size,
                '--h': `${cube.height}px`,
                '--d': `${cube.delay}s`
              }}
            >
              <div className="afa-cube-lift">
                {/* Four outward-facing walls; the browser hides whichever ones face away from the camera */}
                {['py', 'ny', 'px', 'nx'].map(side => (
                  <div
                    key={side}
                    className={`afa-face afa-wall afa-wall-${side}`}
                    style={cube.centre ? { backgroundImage: `url("data:image/svg+xml,${CIRCUIT}"), linear-gradient(to bottom, #0b3b6e, #061428)` } : undefined}
                  />
                ))}
                <div className="afa-face afa-face-top">
                  {cube.centre && <div className="afa-cube-logo">{logo}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Screen-space light and framing */}
      <div className="afa-intro-halo" />
      <div className="afa-intro-vignette" />

      <div className="afa-intro-text">
        <div translate="no" className="notranslate afa-intro-title">
          <span style={{ animationDelay: reduced ? '0s' : '1.5s' }}>A.</span>
          <span style={{ animationDelay: reduced ? '0s' : '1.7s' }}>F.</span>
          <span style={{ animationDelay: reduced ? '0s' : '1.9s' }}>A.</span>
        </div>
        <p style={{ animationDelay: reduced ? '0s' : '2.2s' }}>Automated Financial Assistant</p>
      </div>

      <span className="afa-intro-skip">Click to skip</span>
    </div>
  );
}

const INTRO_CSS = `
.afa-intro {
  background: radial-gradient(ellipse at 50% 42%, #0c1d44 0%, #060c1f 55%, #03060f 100%);
  --cyan: #00f2fe;
}
.afa-intro-stage {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  perspective: 2600px; perspective-origin: 50% 35%;
}
.afa-intro-world {
  position: relative; flex-shrink: 0;
  transform-style: preserve-3d;
  transform: translateY(-4%) rotateX(58deg) rotateZ(-45deg);
  animation: afaIntroCamera 4.2s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes afaIntroCamera {
  from { transform: translateY(2%) rotateX(64deg) rotateZ(-56deg) scale(1.28); }
  to   { transform: translateY(-4%) rotateX(58deg) rotateZ(-45deg) scale(1); }
}

/* Floor: light glowing up through the gaps between cubes */
.afa-intro-floor {
  position: absolute; inset: 0; overflow: hidden;
  background:
    radial-gradient(circle at 50% 50%, rgba(0, 242, 254, 0.35), transparent 55%),
    repeating-linear-gradient(90deg, transparent 0 var(--size), rgba(56, 152, 255, 0.38) var(--size) var(--step)),
    repeating-linear-gradient(0deg, transparent 0 var(--size), rgba(56, 152, 255, 0.38) var(--size) var(--step)),
    #030713;
  animation: afaIntroFloor 1.6s ease-out 0.55s both;
}
@keyframes afaIntroFloor { from { opacity: 0; } to { opacity: 1; } }
.afa-intro-streak { position: absolute; border-radius: 2px; opacity: 0; mix-blend-mode: screen; }
.afa-intro-streak-h { left: 0; width: 28%; height: 3px; background: linear-gradient(90deg, transparent, #bffcff, var(--cyan), transparent); animation: afaStreakH 2.4s ease-in-out infinite; }
.afa-intro-streak-v { top: 0; height: 28%; width: 3px; background: linear-gradient(180deg, transparent, #bffcff, var(--cyan), transparent); animation: afaStreakV 2.6s ease-in-out infinite; }
@keyframes afaStreakH { 0% { transform: translateX(-30%); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateX(380%); opacity: 0; } }
@keyframes afaStreakV { 0% { transform: translateY(-30%); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(380%); opacity: 0; } }

/* Cubes */
.afa-cube { position: absolute; transform-style: preserve-3d; }
.afa-cube-lift {
  position: absolute; inset: 0; transform-style: preserve-3d;
  animation: afaCubeRise 1s cubic-bezier(0.16, 1, 0.3, 1) var(--d) both;
}
@keyframes afaCubeRise { from { transform: translateZ(-320px); } to { transform: translateZ(0); } }
.afa-cube-float .afa-cube-lift { animation: afaCubeRise 1s cubic-bezier(0.16, 1, 0.3, 1) var(--d) both, afaCubeFloat 3.2s ease-in-out calc(var(--d) + 1s) infinite alternate; }
@keyframes afaCubeFloat { from { transform: translateZ(0); } to { transform: translateZ(14px); } }

.afa-face { position: absolute; left: 50%; top: 50%; -webkit-backface-visibility: hidden; backface-visibility: hidden; animation: afaFaceIn 0.6s ease-out var(--d) both; }
@keyframes afaFaceIn { from { opacity: 0; } to { opacity: 1; } }
.afa-face-top {
  width: 100%; height: 100%; margin: -50% 0 0 -50%;
  transform: translateZ(var(--h));
  background: linear-gradient(135deg, #1d3a78 0%, #0f1f45 45%, #0a1530 100%);
  box-shadow: inset 0 0 0 1px rgba(127, 200, 255, 0.22), inset 2px 2px 0 rgba(191, 252, 255, 0.18);
  border-radius: 6px;
}
/* Walls are centred on the cube, rotated outward, then pushed to their side. Local "up" = top of the cube. */
.afa-wall { background: linear-gradient(to bottom, #12285a, #050b1c); box-shadow: inset 0 0 0 1px rgba(80, 160, 255, 0.12); }
.afa-wall-py, .afa-wall-ny { width: var(--size); height: var(--h); margin-left: calc(var(--size) / -2); margin-top: calc(var(--h) / -2); }
.afa-wall-px, .afa-wall-nx { width: var(--h); height: var(--size); margin-left: calc(var(--h) / -2); margin-top: calc(var(--size) / -2); background: linear-gradient(to right, #0d1f48, #040915); }
.afa-wall-py { transform: translateY(calc(var(--size) / 2)) translateZ(calc(var(--h) / 2)) rotateX(-90deg); }
.afa-wall-ny { transform: translateY(calc(var(--size) / -2)) translateZ(calc(var(--h) / 2)) rotateX(90deg) rotateZ(180deg); }
.afa-wall-px { transform: translateX(calc(var(--size) / 2)) translateZ(calc(var(--h) / 2)) rotateY(90deg); }
.afa-wall-nx { transform: translateX(calc(var(--size) / -2)) translateZ(calc(var(--h) / 2)) rotateY(-90deg) rotateZ(180deg); }
.afa-cube-lit .afa-face-top { background: linear-gradient(135deg, #2f6fd6 0%, #173b86 50%, #0d214d 100%); box-shadow: inset 0 0 0 1px rgba(127, 248, 255, 0.45), 0 0 24px rgba(0, 170, 255, 0.35); }

/* Centre cube with the logo */
.afa-cube-centre .afa-face-top {
  background: linear-gradient(135deg, #0f4c8a 0%, #0a2b5c 55%, #071a3a 100%);
  box-shadow: inset 0 0 0 1.5px rgba(127, 248, 255, 0.85), 0 0 50px rgba(0, 242, 254, 0.55), 0 0 120px rgba(0, 120, 255, 0.35);
  display: flex; align-items: center; justify-content: center;
}
.afa-cube-centre .afa-wall {
  background-size: 60px 60px, 100% 100%;
  box-shadow: inset 0 0 0 1px rgba(127, 248, 255, 0.55), inset 0 0 30px rgba(0, 242, 254, 0.35);
}
.afa-cube-logo { width: 78%; height: 78%; transform: rotateZ(45deg); filter: drop-shadow(0 0 14px rgba(0, 242, 254, 0.8)); }
.afa-cube-logo > * { width: 100%; height: 100%; }

/* Light above the centre cube and dark edges */
.afa-intro-halo {
  position: absolute; left: 50%; top: 38%; width: 75vmin; height: 75vmin; transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(0, 242, 254, 0.28) 0%, rgba(0, 120, 255, 0.12) 35%, transparent 70%);
  pointer-events: none; animation: afaHalo 2.4s ease-out 0.9s both;
}
@keyframes afaHalo { from { opacity: 0; transform: translate(-50%, -50%) scale(0.6); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
.afa-intro-vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 42%, transparent 30%, rgba(3, 6, 15, 0.7) 72%, #03060f 100%), linear-gradient(to top, rgba(3, 6, 15, 0.85) 0%, transparent 32%); }

/* Title */
.afa-intro-text { position: absolute; left: 0; right: 0; bottom: 9%; text-align: center; pointer-events: none; padding: 0 16px; }
.afa-intro-title { display: inline-flex; font-weight: 900; letter-spacing: 0.25em; font-size: clamp(2rem, 5vw, 3.25rem); }
.afa-intro-title span { color: transparent; background: linear-gradient(180deg, #ffffff 20%, #a5f3fc 70%, #22d3ee); -webkit-background-clip: text; background-clip: text; text-shadow: none; filter: drop-shadow(0 0 18px rgba(0, 242, 254, 0.45)); }
.afa-intro-title span, .afa-intro-text p { opacity: 0; animation: afaIntroUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) both; }
.afa-intro-text p { margin-top: 14px; font: 500 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(34, 211, 238, 0.75); }
@keyframes afaIntroUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
.afa-intro-skip { position: absolute; bottom: 18px; left: 0; right: 0; text-align: center; font: 10px ui-monospace, monospace; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(148, 163, 184, 0.45); }

/* Reduced motion: show the finished scene without movement */
.afa-intro-reduced *, .afa-intro-reduced *::before, .afa-intro-reduced *::after { animation-duration: 0.01ms !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; }
.afa-intro-reduced .afa-intro-streak { display: none; }
`;
