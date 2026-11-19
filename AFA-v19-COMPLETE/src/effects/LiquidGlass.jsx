import React, { useEffect, useRef } from 'react';
import { useFx } from './FxContext';
import { QUAD_VERT, GLASS_FRAG } from './shaders';
import { mountCanvas, createContext as createGL, createQuadProgram, createTexture, releaseContext } from './gl';

// Default look from liquid-glass-js (controls.js), slightly softened for a data-heavy UI
const GLASS_DEFAULTS = {
  blurRadius: 5.0, edgeIntensity: 0.01, rimIntensity: 0.05, baseIntensity: 0.01, edgeDistance: 0.15,
  rimDistance: 0.8, baseDistance: 0.1, cornerBoost: 0.02, rippleEffect: 0.1, tintOpacity: 0.12, highlight: 0.18, shade: 0.0
};

const GLASS_UNIFORMS = [
  'u_image', 'u_resolution', 'u_rect', 'u_texel', 'u_blurRadius', 'u_borderRadius', 'u_edgeIntensity',
  'u_rimIntensity', 'u_baseIntensity', 'u_edgeDistance', 'u_rimDistance', 'u_baseDistance', 'u_cornerBoost',
  'u_rippleEffect', 'u_tintOpacity', 'u_highlight', 'u_shade'
];

// A glass layer that refracts the live LiquidBackdrop behind its parent element.
// Put it as the first child of a `relative` element; the parent's other children sit on top.
// Draws only when the backdrop draws, at half resolution, so the cost stays small.
export default function LiquidGlass({ radius = 24, resolution = 0.5, options = {} }) {
  const fx = useFx();
  const holderRef = useRef(null);
  const settings = { ...GLASS_DEFAULTS, ...options };

  useEffect(() => {
    if (!fx.enabled) return undefined;
    const canvas = mountCanvas(holderRef.current);
    const gl = createGL(canvas, { alpha: true });
    const prog = gl && createQuadProgram(gl, QUAD_VERT, GLASS_FRAG, GLASS_UNIFORMS);
    if (!prog) { releaseContext(gl); canvas.remove(); return undefined; } // the CSS glass underneath still shows

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    const texture = createTexture(gl, null);
    const u = prog.uniforms;
    gl.uniform1i(u.u_image, 0);
    Object.entries(settings).forEach(([key, value]) => {
      const loc = u[`u_${key}`];
      if (loc) gl.uniform1f(loc, value);
    });
    gl.uniform1f(u.u_borderRadius, radius);

    let lost = false;
    const onLost = (e) => { e.preventDefault(); lost = true; };
    canvas.addEventListener('webglcontextlost', onLost);

    const draw = (source) => {
      if (lost) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const w = Math.round(rect.width * resolution);
      const h = Math.round(rect.height * resolution);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform2f(u.u_resolution, rect.width, rect.height);
      gl.uniform4f(u.u_rect, rect.left / window.innerWidth, rect.top / window.innerHeight, rect.width / window.innerWidth, rect.height / window.innerHeight);
      gl.uniform2f(u.u_texel, 1 / source.width, 1 / source.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    fx.backdrop.listeners.add(draw);
    if (fx.backdrop.canvas) draw(fx.backdrop.canvas);

    return () => {
      fx.backdrop.listeners.delete(draw);
      canvas.removeEventListener('webglcontextlost', onLost);
      releaseContext(gl);
      canvas.remove();
    };
  }, [fx.enabled, radius, resolution]);

  if (!fx.enabled) return null;
  return (
    <div
      ref={holderRef}
      aria-hidden="true"
      className="afa-glass-canvas absolute inset-0 pointer-events-none overflow-hidden"
      style={{ borderRadius: radius, zIndex: -1 }}
    />
  );
}
