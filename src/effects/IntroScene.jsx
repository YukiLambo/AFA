import React, { useEffect, useMemo, useState } from 'react';
import { prefersReducedMotion } from './gl';

/*
 * Opening animation: an isometric field of glossy cubes that rises in a ripple from the centre and then
 * keeps drifting slowly up and down, with a steady light glowing up through the gaps and the A.F.A. "A"
 * written on top of the centre cube.
 * Original implementation in CSS 3D (no libraries, no WebGL), styled in the A.F.A. blue palette.
 *
 * Props:
 *   logo      – optional element for the centre cube (defaults to the neon A.F.A. mark)
 *   duration  – total length in ms before onDone fires
 *   onDone    – called when the intro finishes or the user skips it (click / Esc / Enter)
 */

// Small deterministic hash so cube heights look random but stay the same on every visit
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// The A.F.A. mark: written like an "A" without the crossbar. The upstroke draws from bottom-left to the
// top, then the downstroke to bottom-right; each node appears as the pen reaches it, and everything then
// stays still. Solid colours only (gradient strokes can fail to paint inside 3D transforms in Safari).
function NeonLogo({ reduced }) {
  const d = (s) => (reduced ? '0s' : s);
  return (
    <svg viewBox="17 13 66 72" className="afa-neon-logo" aria-hidden="true">
      <g fill="none" stroke="#5fe6ff" strokeWidth="8" strokeLinecap="round">
        <path className="afa-neon-stroke" d="M 26 76 L 50 22" style={{ '--ld': d('1.15s') }} />
        <path className="afa-neon-stroke" d="M 50 22 L 74 76" style={{ '--ld': d('1.75s') }} />
      </g>
      <circle className="afa-neon-node" cx="26" cy="76" r="5.5" fill="#7ff8ff" style={{ '--ld': d('1.0s') }} />
      <circle className="afa-neon-node" cx="50" cy="22" r="6.5" fill="#ffffff" style={{ '--ld': d('1.65s') }} />
      <circle className="afa-neon-node" cx="74" cy="76" r="5.5" fill="#7ff8ff" style={{ '--ld': d('2.25s') }} />
    </svg>
  );
}

export default function IntroScene({ logo, duration = 4600, onDone }) {
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
          height: centre ? Math.round(layout.size * 0.82) : Math.round(layout.size * (0.18 + r * 0.42) * Math.min(1, Math.max(0.55, dist / 2.4))),
          delay: reduced ? 0 : 0.08 + dist * 0.11 + r * 0.08,
          lit: !centre && r > 0.82, // a few cubes catch extra light
          // slow, continuous drift up and down (like the reference), each cube on its own rhythm
          amp: centre ? Math.round(layout.size * 0.08) : Math.round(layout.size * (0.1 + r * 0.16)),
          period: centre ? 3.6 : 2.6 + hash(y + 7, x + 3) * 2.4,
          phase: -((x + y) * 0.45 + r * 1.5)
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
          </div>

          {cubes.map(cube => (
            <div
              key={cube.key}
              className={`afa-cube ${cube.centre ? 'afa-cube-centre' : ''} ${cube.lit ? 'afa-cube-lit' : ''}`}
              style={{
                left: cube.x * layout.step,
                top: cube.y * layout.step,
                width: layout.size,
                height: layout.size,
                '--h': `${cube.height}px`,
                '--d': `${cube.delay}s`,
                '--amp': `${cube.amp}px`,
                '--fd': `${cube.period}s`,
                '--fp': `${cube.phase}s`
              }}
            >
              <div className="afa-cube-glow" />
              <div className="afa-cube-lift">
               <div className="afa-cube-bob">
                {/* Four outward-facing walls; the browser hides whichever ones face away from the camera */}
                {['py', 'ny', 'px', 'nx'].map(side => (
                  <div
                    key={side}
                    className={`afa-face afa-wall afa-wall-${side}`}
                  />
                ))}
                <div className="afa-face afa-face-top">
                  {cube.centre && (
                    <>
                      <div className="afa-cube-logo">{logo || <NeonLogo reduced={reduced} />}</div>
                    </>
                  )}
                </div>
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
          <span style={{ animationDelay: reduced ? '0s' : '2.0s' }}>A.</span>
          <span style={{ animationDelay: reduced ? '0s' : '2.15s' }}>F.</span>
          <span style={{ animationDelay: reduced ? '0s' : '2.3s' }}>A.</span>
        </div>
        <p style={{ animationDelay: reduced ? '0s' : '2.6s' }}>Automated Financial Assistant</p>
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
/* Bloom: the same gap lines, blurred and breathing, so light seems to spill up between the blocks */
.afa-intro-floor::before {
  content: ''; position: absolute; inset: 0;
  background:
    repeating-linear-gradient(90deg, transparent 0 var(--size), rgba(0, 200, 255, 0.85) var(--size) var(--step)),
    repeating-linear-gradient(0deg, transparent 0 var(--size), rgba(0, 200, 255, 0.85) var(--size) var(--step));
  filter: blur(calc(var(--step) * 0.06));
  mix-blend-mode: screen;
  -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 0%, rgba(0, 0, 0, 0.55) 45%, transparent 78%);
  mask-image: radial-gradient(circle at 50% 50%, #000 0%, rgba(0, 0, 0, 0.55) 45%, transparent 78%);
  opacity: 0; animation: afaGapIn 1.6s ease-out 0.9s forwards;
}
@keyframes afaGapIn { to { opacity: 0.6; } }
/* A soft light pad under each block; its edges leak into the gaps around it */
.afa-cube-glow {
  position: absolute; inset: 4%; border-radius: 8px; pointer-events: none;
  box-shadow: 0 0 calc(var(--step) * 0.16) calc(var(--step) * 0.03) rgba(0, 190, 255, 0.55);
  transform: translateZ(1px);
  opacity: 0; animation: afaIntroFloor 1.4s ease-out calc(var(--d) + 0.4s) both;
}
.afa-cube-centre .afa-cube-glow { box-shadow: 0 0 calc(var(--step) * 0.3) calc(var(--step) * 0.06) rgba(120, 240, 255, 0.75); }

/* Cubes */
.afa-cube { position: absolute; transform-style: preserve-3d; }
.afa-cube-lift {
  position: absolute; inset: 0; transform-style: preserve-3d;
  animation: afaCubeRise 1s cubic-bezier(0.16, 1, 0.3, 1) var(--d) both;
}
@keyframes afaCubeRise { from { transform: translateZ(-320px); } to { transform: translateZ(0); } }
.afa-cube-bob {
  position: absolute; inset: 0; transform-style: preserve-3d;
  animation: afaCubeBob var(--fd) ease-in-out var(--fp) infinite alternate;
}
@keyframes afaCubeBob {
  from { transform: translateZ(calc(var(--amp) * -0.5)); }
  to   { transform: translateZ(calc(var(--amp) * 0.5)); }
}
.afa-face-top { overflow: hidden; }

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
.afa-wall { background: linear-gradient(to bottom, #12285a, #050b1c 72%, #0a2f5a 92%, #1a7fd0 100%); box-shadow: inset 0 0 0 1px rgba(80, 160, 255, 0.12); }
.afa-wall-py, .afa-wall-ny { width: var(--size); height: var(--h); margin-left: calc(var(--size) / -2); margin-top: calc(var(--h) / -2); }
.afa-wall-px, .afa-wall-nx { width: var(--h); height: var(--size); margin-left: calc(var(--h) / -2); margin-top: calc(var(--size) / -2); background: linear-gradient(to right, #0d1f48, #040915 72%, #082851 92%, #1670bd 100%); }
.afa-wall-py { transform: translateY(calc(var(--size) / 2)) translateZ(calc(var(--h) / 2)) rotateX(-90deg); }
.afa-wall-ny { transform: translateY(calc(var(--size) / -2)) translateZ(calc(var(--h) / 2)) rotateX(90deg) rotateZ(180deg); }
.afa-wall-px { transform: translateX(calc(var(--size) / 2)) translateZ(calc(var(--h) / 2)) rotateY(90deg); }
.afa-wall-nx { transform: translateX(calc(var(--size) / -2)) translateZ(calc(var(--h) / 2)) rotateY(-90deg) rotateZ(180deg); }
.afa-cube-lit .afa-face-top { background: linear-gradient(135deg, #2f6fd6 0%, #173b86 50%, #0d214d 100%); box-shadow: inset 0 0 0 1px rgba(127, 248, 255, 0.45), 0 0 24px rgba(0, 170, 255, 0.35); }

/* Centre cube: smoked obsidian glass with hairline edges (no moving light) */
.afa-cube-centre .afa-face-top {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.02) 38%, transparent 52%),
    repeating-linear-gradient(0deg, rgba(127, 248, 255, 0.045) 0 1px, transparent 1px 10px),
    repeating-linear-gradient(90deg, rgba(127, 248, 255, 0.045) 0 1px, transparent 1px 10px),
    radial-gradient(circle at 50% 55%, rgba(0, 170, 255, 0.22) 0%, transparent 62%),
    linear-gradient(160deg, #0d1a33 0%, #060c1b 60%, #03060f 100%);
  box-shadow:
    inset 0 0 0 1px rgba(191, 252, 255, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    inset 0 0 28px rgba(0, 200, 255, 0.16),
    0 0 36px rgba(0, 200, 255, 0.28);
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
}
.afa-cube-centre .afa-wall {
  background:
    repeating-linear-gradient(to bottom, rgba(127, 248, 255, 0.025) 0 1px, transparent 1px 5px),
    linear-gradient(to bottom, #0b1830 0%, #050a17 70%, #0a2f5a 92%, #39b6ff 100%);
  box-shadow: inset 0 0 0 1px rgba(191, 252, 255, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.4);
  overflow: hidden;
}
.afa-cube-centre .afa-wall-px, .afa-cube-centre .afa-wall-nx {
  background:
    repeating-linear-gradient(to right, rgba(127, 248, 255, 0.025) 0 1px, transparent 1px 5px),
    linear-gradient(to right, #081327 0%, #03070f 70%, #082851 92%, #2a9cf0 100%);
}
.afa-cube-logo { position: relative; z-index: 1; width: 74%; height: 74%; transform: none; }
.afa-cube-logo > * { width: 100%; height: 100%; }
.afa-neon-stroke { stroke-dasharray: 60; stroke-dashoffset: 60; animation: afaNeonDraw 0.6s cubic-bezier(0.45, 0, 0.25, 1) var(--ld) forwards; }
@keyframes afaNeonDraw { to { stroke-dashoffset: 0; } }
.afa-neon-node { opacity: 0; animation: afaNeonNode 0.25s ease-out var(--ld) forwards; }
@keyframes afaNeonNode { to { opacity: 1; } }

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
.afa-intro-title span { display: inline-block; color: #e6fdff; text-shadow: 0 0 18px rgba(0, 242, 254, 0.45); }
.afa-intro-title span, .afa-intro-text p { opacity: 0; animation: afaIntroUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) both; }
.afa-intro-text p { margin-top: 14px; font: 500 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(34, 211, 238, 0.75); }
@keyframes afaIntroUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
.afa-intro-skip { position: absolute; bottom: 18px; left: 0; right: 0; text-align: center; font: 10px ui-monospace, monospace; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(148, 163, 184, 0.45); }

/* Reduced motion: show the finished scene without movement */
.afa-intro-reduced *, .afa-intro-reduced *::before, .afa-intro-reduced *::after { animation-duration: 0.01ms !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; }
.afa-intro-reduced .afa-cube-bob { animation: none; }
.afa-intro-reduced .afa-neon-stroke { stroke-dashoffset: 0; }
.afa-intro-reduced .afa-neon-node { opacity: 1; }
`;
