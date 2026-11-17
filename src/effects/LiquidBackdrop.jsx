import React, { useEffect, useRef } from 'react';
import { useFx } from './FxContext';
import { QUAD_VERT, LIQUID_METAL_FRAG } from './shaders';
import { mountCanvas, createContext as createGL, createQuadProgram, createTexture, releaseContext, METAL_PRESETS, METAL_UNIFORMS, setMetalUniforms } from './gl';

// Slow liquid-metal field behind the whole app (liquid-logo shader with a fully opaque mask).
// Rendered at a fraction of screen resolution and a capped frame rate, paused when the tab is hidden.
// Glass panels (LiquidGlass) refract this canvas, so it also publishes each new frame to them.
export default function LiquidBackdrop({ opacity = 0.6, resolution = 0.35, fps = 30 }) {
  const fx = useFx();
  const holderRef = useRef(null);

  useEffect(() => {
    if (!fx.enabled) return undefined;
    const canvas = mountCanvas(holderRef.current);
    const gl = createGL(canvas, { alpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    const prog = gl && createQuadProgram(gl, QUAD_VERT, LIQUID_METAL_FRAG, METAL_UNIFORMS);
    if (!prog) { releaseContext(gl); canvas.remove(); fx.disable(); return undefined; }

    // 1x1 white texture = "everything is inside the logo"
    const mask = document.createElement('canvas');
    mask.width = mask.height = 1;
    const ctx = mask.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1, 1);
    gl.activeTexture(gl.TEXTURE0);
    createTexture(gl, mask);

    const resize = () => {
      canvas.width = Math.max(64, Math.round(window.innerWidth * resolution));
      canvas.height = Math.max(64, Math.round(window.innerHeight * resolution));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();
    const frameGap = 1000 / fps;
    let last = 0;
    let raf = 0;
    let lost = false;
    const onLost = (e) => { e.preventDefault(); lost = true; };
    canvas.addEventListener('webglcontextlost', onLost);

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (lost || document.hidden || now - last < frameGap) return;
      last = now;
      setMetalUniforms(gl, prog.uniforms, METAL_PRESETS.backdrop, canvas.width, canvas.height, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      fx.backdrop.canvas = canvas;
      fx.backdrop.listeners.forEach(draw => draw(canvas));
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', onLost);
      if (fx.backdrop.canvas === canvas) fx.backdrop.canvas = null;
      releaseContext(gl);
      canvas.remove();
    };
  }, [fx.enabled]);

  if (!fx.enabled) return null;
  return (
    <div ref={holderRef} aria-hidden="true" className="fixed inset-0 pointer-events-none" style={{ opacity, zIndex: 0 }} />
  );
}
