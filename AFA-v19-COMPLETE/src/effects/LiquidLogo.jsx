import React, { useEffect, useRef, useState } from 'react';
import { useFx } from './FxContext';
import { QUAD_VERT, LIQUID_METAL_FRAG } from './shaders';
import { mountCanvas, createContext as createGL, createQuadProgram, createTexture, releaseContext, METAL_PRESETS, METAL_UNIFORMS, setMetalUniforms } from './gl';

// The A.F.A. "A" mark drawn as a mask, using the same 100x100 geometry as <AppIcon />,
// so the liquid metal sits exactly on top of the original strokes.
function drawLogoMask(size) {
  const mask = document.createElement('canvas');
  mask.width = mask.height = size;
  const ctx = mask.getContext('2d');
  const k = size / 100;
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 9 * k;
  ctx.beginPath();
  ctx.moveTo(28 * k, 72 * k); ctx.lineTo(50 * k, 25 * k); ctx.lineTo(72 * k, 72 * k);
  ctx.stroke();
  [[50, 25, 6.5], [28, 72, 5.5], [72, 72, 5.5]].forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x * k, y * k, r * k, 0, Math.PI * 2);
    ctx.fill();
  });
  return mask;
}

// Liquid-metal version of the logo (liquid-logo shader), layered over <AppIcon />.
// `children` is the normal AppIcon, which is shown on its own when effects are off or WebGL fails.
// `delay` lets the original stroke-drawing animation finish before the metal fades in.
export default function LiquidLogo({ size = 32, delay = 0, fps = 30, children }) {
  const fx = useFx();
  const holderRef = useRef(null);
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (!fx.enabled || delay === 0) return undefined;
    setVisible(false);
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [fx.enabled, delay]);

  useEffect(() => {
    if (!fx.enabled) return undefined;
    const canvas = mountCanvas(holderRef.current);
    // Always render at least 2x and let the browser scale down: smoother edges on standard screens
    const px = Math.round(size * Math.min(Math.max(window.devicePixelRatio || 1, 2), 3));
    canvas.width = canvas.height = px;
    const gl = createGL(canvas, { alpha: true, antialias: true });
    const prog = gl && createQuadProgram(gl, QUAD_VERT, LIQUID_METAL_FRAG, METAL_UNIFORMS);
    if (!prog) { releaseContext(gl); canvas.remove(); return undefined; }

    gl.viewport(0, 0, px, px);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0);
    createTexture(gl, drawLogoMask(Math.max(256, px)));

    const start = performance.now();
    const frameGap = 1000 / fps;
    let last = 0;
    let raf = 0;
    let onScreen = true;
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }) : null;
    observer?.observe(canvas);

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || !onScreen || now - last < frameGap) return;
      last = now;
      gl.clear(gl.COLOR_BUFFER_BIT);
      setMetalUniforms(gl, prog.uniforms, METAL_PRESETS.logo, px, px, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      releaseContext(gl);
      canvas.remove();
    };
  }, [fx.enabled, size, fps]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {children}
      {fx.enabled && (
        <div
          ref={holderRef}
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 900ms ease',
            filter: 'drop-shadow(0 0 6px rgba(0, 242, 254, 0.55))'
          }}
        />
      )}
    </div>
  );
}
