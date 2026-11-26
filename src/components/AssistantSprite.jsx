import React, { useEffect, useRef } from 'react';

// A small glass capsule holding A.F.A.'s assistant: a blue core with two pill-shaped eyes.
// The eyes glance toward the pointer or finger, blink now and then, and the capsule bobs gently.
// Pure CSS and SVG, so it costs almost nothing on phones.
export default function AssistantSprite({ size = 40 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    let raf = 0, tx = 0, ty = 0, x = 0, y = 0;
    const onMove = (e) => {
      const p = e.touches ? e.touches[0] : e; if (!p) return;
      const r = el.getBoundingClientRect();
      const dx = p.clientX - (r.left + r.width / 2), dy = p.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 160);
      tx = (dx / d) * k; ty = (dy / d) * k;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const step = () => {
      x += (tx - x) * 0.18; y += (ty - y) * 0.18;
      el.style.setProperty('--gx', x.toFixed(3)); el.style.setProperty('--gy', y.toFixed(3));
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('touchstart', onMove, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); window.removeEventListener('touchstart', onMove); };
  }, []);
  return (
    <span ref={ref} className="afa-sprite" style={{ '--s': `${size}px` }} aria-hidden="true">
      <span className="cap"><span className="core" /><span className="eyes"><i /><i /></span><span className="gloss" /></span>
    </span>
  );
}

export const SPRITE_CSS = `
.afa-sprite { --gx: 0; --gy: 0; display: inline-block; width: var(--s); height: calc(var(--s) * 1.25); flex: none; animation: afaBob 3.6s ease-in-out infinite; }
.afa-sprite .cap { position: relative; display: block; width: 100%; height: 100%; border-radius: 999px; overflow: hidden;
  transform: rotate(calc(var(--gx) * 6deg));
  background: linear-gradient(180deg, rgba(220, 245, 255, 0.10) 0%, rgba(160, 220, 255, 0.06) 48%, rgba(40, 120, 255, 0.55) 52%, rgba(120, 200, 255, 0.75) 100%);
  box-shadow: inset 0 0 0 1px rgba(200, 240, 255, 0.35), inset 0 -6px 12px rgba(160, 225, 255, 0.45), 0 6px 18px -6px rgba(30, 120, 255, 0.7); transition: transform .3s; }
.afa-sprite .core { position: absolute; left: 14%; right: 14%; top: 16%; bottom: 16%; border-radius: 999px;
  background: radial-gradient(circle at 50% 35%, #2f7bff, #0a2fd6 60%, #061a8a); box-shadow: 0 0 14px rgba(40, 110, 255, 0.8); }
.afa-sprite .eyes { position: absolute; left: 50%; top: 40%; display: flex; gap: calc(var(--s) * 0.12);
  transform: translate(calc(-50% + var(--gx) * var(--s) * 0.09), calc(-50% + var(--gy) * var(--s) * 0.08)); }
.afa-sprite .eyes i { display: block; width: calc(var(--s) * 0.1); height: calc(var(--s) * 0.22); border-radius: 99px; background: #eefbff; box-shadow: 0 0 6px rgba(220, 245, 255, 0.9);
  transform-origin: 50% 50%; animation: afaBlink 5.2s infinite; }
.afa-sprite .gloss { position: absolute; left: 18%; top: 6%; width: 30%; height: 22%; border-radius: 999px; background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0)); }
@keyframes afaBlink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
@keyframes afaBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@media (prefers-reduced-motion: reduce) { .afa-sprite, .afa-sprite .eyes i { animation: none; } }
`;
