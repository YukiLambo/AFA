import React, { useEffect, useRef } from 'react';
import { useFx } from './FxContext';
import { QUAD_VERT, GLASS_LAYER_FRAG, GLASS_LAYER_MAX } from './shaders';
import { mountCanvas, createContext as createGL, createQuadProgram, createTexture, releaseContext } from './gl';

const LOOK = {
  blurRadius: 5.0, edgeIntensity: 0.01, rimIntensity: 0.05, baseIntensity: 0.01, edgeDistance: 0.15,
  rimDistance: 0.8, baseDistance: 0.1, cornerBoost: 0.02, rippleEffect: 0.1, tintOpacity: 0.1, highlight: 0.22, shade: 0.5
};

const UNIFORMS = ['u_image', 'u_viewport', 'u_texel', 'u_clip', 'u_rects', 'u_radii', 'u_count', ...Object.keys(LOOK).map(k => `u_${k}`)];

/*
 * Liquid glass behind every panel matching `selector`, drawn in ONE full-screen WebGL pass.
 * Panels keep their content; this layer sits underneath them and refracts the live LiquidBackdrop.
 * While it runs it adds `afa-glass-on` to <html>, which lets CSS make the panels see-through.
 * If WebGL fails, that class is never added and the panels keep their solid background.
 */
export default function LiquidGlassLayer({ selector, clipSelector, resolution = 0.5, options = {} }) {
  const fx = useFx();
  const holderRef = useRef(null);
  const look = { ...LOOK, ...options };

  useEffect(() => {
    if (!fx.enabled) return undefined;
    const canvas = mountCanvas(holderRef.current);
    const gl = createGL(canvas, { alpha: true });
    const prog = gl && createQuadProgram(gl, QUAD_VERT, GLASS_LAYER_FRAG, UNIFORMS);
    if (!prog) { releaseContext(gl); canvas.remove(); return undefined; }

    const root = document.documentElement;
    root.classList.add('afa-glass-on');
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    const texture = createTexture(gl, null);
    const u = prog.uniforms;
    gl.uniform1i(u.u_image, 0);
    Object.entries(look).forEach(([k, v]) => u[`u_${k}`] && gl.uniform1f(u[`u_${k}`], v));

    // Panels are re-collected every second (React adds and removes them); positions are read every frame
    let panels = [];
    const collect = () => {
      panels = [...document.querySelectorAll(selector)].map(el => ({ el, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 16 }));
    };
    collect();
    const collector = setInterval(collect, 1000);

    const rects = new Float32Array(GLASS_LAYER_MAX * 4);
    const radii = new Float32Array(GLASS_LAYER_MAX);
    let lastSource = null;
    let lost = false;
    const onLost = (e) => { e.preventDefault(); lost = true; };
    canvas.addEventListener('webglcontextlost', onLost);

    const draw = (source) => {
      if (lost || !source) return;
      lastSource = source;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.round(vw * resolution);
      const h = Math.round(vh * resolution);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      const clipEl = clipSelector && document.querySelector(clipSelector);
      const clip = clipEl ? clipEl.getBoundingClientRect() : { left: 0, top: 0, width: vw, height: vh };

      let count = 0;
      for (const { el, radius } of panels) {
        if (count >= GLASS_LAYER_MAX) break;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        if (r.bottom < clip.top || r.top > clip.top + clip.height || r.right < clip.left || r.left > clip.left + clip.width) continue;
        rects.set([r.left, r.top, r.width, r.height], count * 4);
        radii[count] = radius;
        count++;
      }

      gl.clear(gl.COLOR_BUFFER_BIT);
      if (count === 0) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform2f(u.u_viewport, vw, vh);
      gl.uniform2f(u.u_texel, 1 / source.width, 1 / source.height);
      gl.uniform4f(u.u_clip, clip.left, clip.top, clip.width, clip.height);
      gl.uniform4fv(u.u_rects, rects);
      gl.uniform1fv(u.u_radii, radii);
      gl.uniform1i(u.u_count, count);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // Redraw on every backdrop frame, and immediately on scroll so the glass never lags behind a card
    fx.backdrop.listeners.add(draw);
    let scrollRaf = 0;
    const onScroll = () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; draw(lastSource || fx.backdrop.canvas); });
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll);
    if (fx.backdrop.canvas) draw(fx.backdrop.canvas);

    return () => {
      fx.backdrop.listeners.delete(draw);
      clearInterval(collector);
      cancelAnimationFrame(scrollRaf);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
      canvas.removeEventListener('webglcontextlost', onLost);
      root.classList.remove('afa-glass-on');
      releaseContext(gl);
      canvas.remove();
    };
  }, [fx.enabled, selector, clipSelector, resolution]);

  if (!fx.enabled) return null;
  return <div ref={holderRef} aria-hidden="true" className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}
