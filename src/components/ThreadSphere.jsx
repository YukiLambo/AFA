import React, { useEffect, useRef } from 'react';

// A sphere woven from hairline threads (Canvas 2D, no libraries).
// Points sit on a sphere; each joins its nearest neighbours (the faceted rim), some run to a few hubs, and
// a handful of long chords cross the inside. On load the cloud contracts from a loose, bright ball into place;
// afterwards it turns slowly, breathes, and leans toward the finger or pointer.
// `tone` (a CSS colour) tints the hubs, so the sphere can reflect the score.

const N = 300, HUBS = 16, NEAR = 4, LONG = 170;

function build() {
  const pts = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * ga;
    const j = 0.04;
    pts.push([Math.cos(th) * r + (rnd() - 0.5) * j, y + (rnd() - 0.5) * j, Math.sin(th) * r + (rnd() - 0.5) * j]);
  }
  const hubs = [];
  while (hubs.length < HUBS) { const h = (rnd() * N) | 0; if (!hubs.includes(h)) hubs.push(h); }
  const seen = new Set(), edges = [];
  const add = (a, b, kind) => { if (a === b) return; const k = a < b ? a * N + b : b * N + a; if (seen.has(k)) return; seen.add(k); edges.push([a, b, kind]); };
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  for (let i = 0; i < N; i++) {
    const near = [];
    for (let j = 0; j < N; j++) if (j !== i) near.push([d2(pts[i], pts[j]), j]);
    near.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < NEAR; k++) add(i, near[k][1], 0);
    if (rnd() < 0.3) { let best = hubs[0], bd = 9; hubs.forEach(h => { const d = d2(pts[i], pts[h]); if (d < bd && h !== i) { bd = d; best = h; } }); add(i, best, 1); }
  }
  for (let k = 0; k < LONG; k++) add((rnd() * N) | 0, (rnd() * N) | 0, 2);
  const delay = pts.map((p, i) => (Math.atan2(p[2], p[0]) / Math.PI + 1) * 0.25 + (p[1] + 1) * 0.18 + (i % 7) * 0.01);
  return { pts, hubs, edges, delay };
}

export default function ThreadSphere({ tone = '#00f2fe', className = '' }) {
  const ref = useRef(null);
  const toneRef = useRef(tone);
  toneRef.current = tone;

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const { pts, hubs, edges, delay } = build();
    const proj = new Float32Array(N * 3);
    let w = 0, h = 0, dpr = 1, raf = 0, visible = true, t0 = performance.now(), last = t0;
    const lean = { x: 0, y: 0 }, aim = { x: 0, y: 0 };

    const size = () => {
      const r = cv.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    };
    size();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null; ro?.observe(cv);
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }) : null; io?.observe(cv);
    const onMove = (e) => {
      const r = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; if (!p) return;
      aim.x = Math.max(-1, Math.min(1, (p.clientX - (r.left + r.width / 2)) / (r.width * 0.8)));
      aim.y = Math.max(-1, Math.min(1, (p.clientY - (r.top + r.height / 2)) / (r.height * 0.8)));
    };
    const onLeave = () => { aim.x = 0; aim.y = 0; };
    window.addEventListener('pointermove', onMove, { passive: true });
    cv.addEventListener('touchmove', onMove, { passive: true });
    cv.addEventListener('pointerleave', onLeave);

    const easeBack = (x) => { const c = 1.5; x = Math.min(1, Math.max(0, x)); return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
    const BUCKETS = 7;
    const paths = Array.from({ length: BUCKETS }, () => []);

    function frame(now) {
      raf = 0;
      if (!visible) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = reduce ? 10 : (now - t0) / 1000;
      lean.x += (aim.x - lean.x) * Math.min(1, dt * 4); lean.y += (aim.y - lean.y) * Math.min(1, dt * 4);
      const ry = t * 0.16 + lean.x * 0.5, rx = 0.32 + lean.y * 0.35;
      const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
      const R = Math.min(w, h) * 0.39, ox = w / 2, oy = h / 2, cam = 3.4;
      let intro = 1;
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const k = easeBack((t - 0.1 - delay[i]) / 1.3);
        if (k < 1) intro = Math.min(intro, k);
        const breathe = 1 + Math.sin(t * 1.25 + p[1] * 3.2 + p[0] * 1.5) * 0.025;
        const s = (1.75 - 0.75 * k) * breathe;
        let x = p[0] * s, y = p[1] * s, z = p[2] * s;
        const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
        const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
        const f = cam / (cam - z2);
        proj[i * 3] = ox + x1 * R * f; proj[i * 3 + 1] = oy + y2 * R * f; proj[i * 3 + 2] = z2;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // soft core glow
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, R * 1.05);
      g.addColorStop(0, 'rgba(0, 120, 170, 0.20)'); g.addColorStop(0.7, 'rgba(0, 60, 100, 0.06)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, R * 1.05, 0, Math.PI * 2); ctx.fill();

      for (const b of paths) b.length = 0;
      for (const [a, b, kind] of edges) {
        const za = proj[a * 3 + 2], zb = proj[b * 3 + 2];
        let d = ((za + zb) / 2 + 1) / 2; // 0 back, 1 front
        if (kind === 2) d *= 0.55;
        paths[Math.min(BUCKETS - 1, Math.max(0, (d * BUCKETS) | 0))].push(a, b);
      }
      ctx.lineWidth = 0.6;
      ctx.globalCompositeOperation = 'lighter';
      const flash = 1 - intro; // brighter while contracting
      for (let k = 0; k < BUCKETS; k++) {
        const list = paths[k]; if (!list.length) continue;
        const d = (k + 0.5) / BUCKETS;
        const al = (0.05 + 0.42 * d * d) * (1 + flash * 1.2);
        ctx.strokeStyle = d > 0.6 ? `rgba(200, 248, 255, ${al})` : `rgba(80, 170, 255, ${al})`;
        ctx.beginPath();
        for (let i = 0; i < list.length; i += 2) {
          const a = list[i] * 3, b = list[i + 1] * 3;
          ctx.moveTo(proj[a], proj[a + 1]); ctx.lineTo(proj[b], proj[b + 1]);
        }
        ctx.stroke();
      }
      // hubs
      ctx.fillStyle = toneRef.current;
      for (const hI of hubs) {
        const z = proj[hI * 3 + 2]; if (z < -0.2) continue;
        ctx.globalAlpha = 0.35 + 0.65 * ((z + 1) / 2);
        ctx.beginPath(); ctx.arc(proj[hI * 3], proj[hI * 3 + 1], 1.6 + z * 0.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
    }
    const onVis = () => { if (!document.hidden && !raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); ro?.disconnect(); io?.disconnect();
      window.removeEventListener('pointermove', onMove); cv.removeEventListener('touchmove', onMove); cv.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
