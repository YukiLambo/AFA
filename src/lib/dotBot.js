// A.F.A.'s assistant drawn in particles (Canvas 2D): a clear glass sphere holding a round blue sprite
// with two pill eyes. The lower half of the glass is frosted into a bowl with a bright double rim, light
// catches the silhouette, and a few highlight streaks sit on the upper right. The eyes follow the pointer,
// the sprite blinks and bobs, and the whole sphere leans slightly toward the pointer.
// startDotBot(canvas) draws into a transparent canvas and returns { exit(done), setActive(on), dispose() }.

export function startDotBot(canvas) {
  const ctx = canvas.getContext('2d');
  const noop = { exit: (d) => d(), setActive() {}, dispose() {} };
  if (!ctx) return noop;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dpr = 1, R = 100, cell = 5, raf = 0, active = true, disposed = false;
  let t0 = performance.now(), last = t0, exitAt = -1, exitDone = null, dots = [];
  const ptr = { x: null, y: null }, sm = { gx: 0.2, gy: 0.1, lean: 0 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

  function layout() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    R = Math.min(w, h) * 0.44; cell = Math.max(3.6, R / 34);
    dots = [];
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const lim = R * 1.04;
    for (let y = -lim; y <= lim; y += cell) for (let x = -lim; x <= lim; x += cell) {
      if (x * x + y * y > lim * lim) continue;
      dots.push({ x, y, d: rnd(), a: rnd() * Math.PI * 2 });
    }
  }

  // returns [brightness, kind] where kind 0 = glass (cyan to white), 1 = sprite body (blue), 2 = eye (white)
  const out = [0, 0];
  function shade(x, y, blink, gx, gy) {
    out[0] = 0; out[1] = 0;
    const r = Math.hypot(x, y);
    if (r > R) return out;
    const inner = 1 - r / R;
    let b = 0;
    // silhouette: light caught at the edge, strongest on the lower half
    b += Math.exp(-inner * 26) * (y > 0 ? 1.05 : 0.6);
    // frosted lower bowl: milky glow that thickens toward the rim
    const eq = R * 0.24;
    if (y > eq) b += 0.12 + (1 - inner) * 0.34 * clamp((y - eq) / (R * 0.5), 0, 1);
    else b += 0.03;
    // the bowl's double rim, an ellipse seen slightly from above
    const rx = R * 0.96, ry = R * 0.2;
    const e = Math.hypot(x / rx, (y - eq) / ry);
    if (Math.abs(e - 1) < 0.045) b = Math.max(b, 0.95);
    if (Math.abs(e - 0.9) < 0.035 && y > eq - ry * 0.2) b = Math.max(b, 0.7);
    // highlight streaks on the upper right of the glass
    for (let k = 0; k < 4; k++) {
      const ang = -1.05 + k * 0.2, rr = R * (0.86 - (k % 2) * 0.03);
      const sx = Math.cos(ang) * rr, sy = Math.sin(ang) * rr;
      const tx = -Math.sin(ang), ty = Math.cos(ang);
      const along = (x - sx) * tx + (y - sy) * ty, across = (x - sx) * Math.cos(ang) + (y - sy) * Math.sin(ang);
      if (Math.abs(along) < R * (0.07 + (k === 1 ? 0.04 : 0)) && Math.abs(across) < R * 0.022) b = Math.max(b, 1.2);
    }
    out[0] = b;
    // the round sprite inside
    const bx = 0, by = R * 0.04, br = R * 0.58;
    const dx = x - bx, dy = y - by, dr = Math.hypot(dx, dy);
    if (dr < br) {
      const nz = Math.sqrt(1 - (dr / br) ** 2);
      const lam = clamp((-dx * 0.45 - dy * 0.6) / br + nz * 0.65, 0, 1);
      let sb = 0.46 + lam * 0.6;
      const sp = Math.hypot(dx + br * 0.5, dy + br * 0.55) / br; // small specular spot upper left
      if (sp < 0.09) sb = 1.0;
      // seen through the frosted bowl, the lower part of the sprite softens
      if (y > eq) sb *= 0.78;
      // eyes
      const ex = br * 0.3, ey = -br * 0.24, ew = br * 0.09, eh = br * 0.25 * (1 - blink * 0.92);
      for (const s of [-1, 1]) {
        const cx = s * ex + gx * br * 0.16, cy = ey + gy * br * 0.1;
        const qx = Math.abs(dx - cx), qq = Math.max(Math.abs(dy - cy) - Math.max(0, eh - ew), 0);
        if (Math.hypot(qx, qq) < ew) { out[0] = 1.2; out[1] = 2; return out; }
      }
      // glass streaks and rims stay on top of the sprite
      if (b >= 0.7) { out[0] = b; out[1] = 0; return out; }
      out[0] = Math.max(sb, b * 0.5); out[1] = 1;
    }
    return out;
  }

  const COLS = [
    ['60,120,210', '70,150,235', '90,190,250', '140,225,255', '200,245,255', '240,252,255'], // glass
    ['20,50,190', '30,70,225', '45,95,250', '70,125,255', '110,160,255', '200,220,255'],      // sprite
    ['235,245,255', '235,245,255', '245,250,255', '250,252,255', '255,255,255', '255,255,255'], // eyes
  ];
  const buckets = Array.from({ length: 18 }, () => []);

  function frame(now) {
    raf = 0; if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = reduce ? 3 : (now - t0) / 1000;
    let kOut = 0;
    if (exitAt >= 0) { kOut = clamp((now - exitAt) / 650, 0, 1); if (kOut >= 1 && exitDone) { const d = exitDone; exitDone = null; d(); } }
    // gaze and lean follow the pointer
    const rc = canvas.getBoundingClientRect(), cx = rc.left + w / 2, cy = rc.top + h / 2;
    let tgx = 0.2, tgy = 0.1, tl = 0;
    if (ptr.x != null) { const dx = ptr.x - cx, dy = ptr.y - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 320); tgx = dx / d * k; tgy = dy / d * k; tl = clamp(dx / 900, -1, 1); }
    const f = Math.min(1, dt * 6);
    sm.gx += (tgx - sm.gx) * f; sm.gy += (tgy - sm.gy) * f; sm.lean += (tl - sm.lean) * Math.min(1, dt * 3);
    const ph = (t % 4.4) / 4.4, blink = ph > 0.955 ? Math.sin((ph - 0.955) / 0.045 * Math.PI) : 0;
    const bob = reduce ? 0 : Math.sin(t * 1.5) * R * 0.025;
    const lean = sm.lean * 0.12, cl = Math.cos(lean), sl = Math.sin(lean);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const b of buckets) b.length = 0;
    const kIn = reduce ? 9 : t;
    for (const p of dots) {
      const lx = p.x * cl + p.y * sl, ly = -p.x * sl + p.y * cl;
      const [b, kind] = shade(lx, ly, blink, sm.gx, sm.gy);
      if (b <= 0.05) continue;
      const appear = ease((kIn - 0.15 - p.d * 0.6) * 2.5);
      if (appear <= 0) continue;
      let x = w / 2 + p.x, y = h / 2 + p.y + bob;
      // particles gather in from a looser cloud on load
      const loose = 1 - appear; x += Math.cos(p.a) * loose * R * 0.5; y += Math.sin(p.a) * loose * R * 0.5;
      if (kOut > 0) { const k = ease(kOut); x += Math.cos(p.a) * k * R * 2.2 * (0.4 + p.d); y += Math.sin(p.a) * k * R * 2.2 * (0.4 + p.d); }
      const bi = Math.min(5, (b * 4.8) | 0);
      buckets[kind * 6 + bi].push(x, y, Math.min(1, b) * appear * (1 - kOut));
    }
    ctx.globalCompositeOperation = 'lighter';
    buckets.forEach((list, i) => {
      if (!list.length) return;
      ctx.fillStyle = `rgb(${COLS[(i / 6) | 0][i % 6]})`;
      ctx.beginPath();
      for (let j = 0; j < list.length; j += 3) {
        const rr = cell * (0.14 + 0.3 * list[j + 2]);
        ctx.moveTo(list[j] + rr, list[j + 1]); ctx.arc(list[j], list[j + 1], rr, 0, Math.PI * 2);
      }
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    if (active && !document.hidden && (!reduce || exitAt >= 0)) raf = requestAnimationFrame(frame);
  }

  const kick = () => { if (!raf && active && !disposed) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const onMove = (e) => { ptr.x = e.clientX; ptr.y = e.clientY; if (reduce) kick(); };
  const onResize = () => { layout(); kick(); };
  const onVis = () => { if (!document.hidden) kick(); };
  layout();
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVis);
  kick();
  return {
    exit(done) { if (exitAt >= 0) return; if (reduce) { done(); return; } exitAt = performance.now(); exitDone = done; kick(); },
    setActive(on) { active = on; if (on) kick(); },
    dispose() { disposed = true; cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); },
  };
}
