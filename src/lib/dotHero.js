// Desktop landing scene (Canvas 2D, no libraries).
// An isometric field of cubes rises in on load and keeps a slow wave running through it. A group of cubes
// stands up in cyan in the shape of the A.F.A. "A", the field lifts gently around the pointer, and a cool
// light pools under the assistant. The assistant itself is drawn by dotBot.js on its own canvas, placed over
// the field at bot.x / bot.y (centred, below the headline).
// startDotHero(canvas) returns { exit(done), setActive(on), dispose() }.

// A.F.A. mark as cubes: the "A" chevron with its three nodes (1 = raised, 2 = node, lit brighter)
const MARK = [
  '..2..',
  '.1.1.',
  '.1.1.',
  '1...1',
  '2...2',
];

export function startDotHero(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { exit: (d) => d(), setActive() {}, dispose() {} };
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dpr = 1, raf = 0, active = true, disposed = false;
  let t0 = performance.now(), last = t0, exitAt = -1, exitDone = null;
  const ptr = { x: -9999, y: -9999 };

  // grid and layout
  const N = 34;
  let S = 40, ox = 0, oy = 0, phone = false, bot = { x: 0, y: 0, H: 0 };
  const lift = new Float32Array(N * N);   // smoothed pointer lift per cube
  const markAt = new Int8Array(N * N);

  function layout() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    w = r.width; h = r.height; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    S = Math.max(30, Math.min(46, w / 34));
    // the headline sits centred at the top and the assistant centred below it
    phone = w < 768; const narrow = w < 1100;
    // matches the #afl-bot position in IntroLanding's CSS
    bot = phone ? { x: w * 0.5, y: 56 + h * 0.22, H: Math.min(h * 0.44, w * 0.6) } : { x: w * 0.5, y: h * 0.72, H: Math.min(h * 0.28, w * 0.25) };
    // the field is centred under the assistant
    ox = bot.x; oy = bot.y + bot.H * 0.62 - (N - 1) * S * 0.5;
    markAt.fill(0);
    // the mark lies in the field to the right of the assistant, drawn in grid space like a floor inlay
    const mu = (w * 0.84 - ox) / S, mv = (h * 0.6 - oy) / (S * 0.5);
    const ci = Math.round((mu + mv) / 2), cj = Math.round((mv - mu) / 2);
    if (!narrow) MARK.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      // columns run along +i (down-right on screen), rows along +j (down-left), so the letter reads at an angle
      const i = ci + (c - 2) + (r - 2), j = cj - (c - 2) + (r - 2);
      if (i >= 0 && j >= 0 && i < N && j < N) markAt[i * N + j] = ch === '2' ? 2 : 1;
    }));
  }

  const iso = (i, j) => [ox + (i - j) * S, oy + (i + j) * S * 0.5];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

  function drawCubes(t, kIn, kOut) {
    const s = S * 0.92, half = s * 0.5, base = 10;
    const px = ptr.x, py = ptr.y;
    for (let sum = 0; sum <= 2 * (N - 1); sum++) {
      for (let i = Math.max(0, sum - N + 1); i <= Math.min(N - 1, sum); i++) {
        const j = sum - i, k = i * N + j;
        const [x, y] = iso(i, j);
        if (x < -S * 2 || x > w + S * 2 || y < -S * 6 || y > h + S * 3) continue;
        const m = markAt[k];
        // rise in from the back of the field
        const rise = ease((kIn * 2.2) - (1 - sum / (2 * N)) * 1.2);
        if (rise <= 0) continue;
        const wave = Math.sin(i * 0.42 + t * 1.1) * Math.cos(j * 0.37 - t * 0.8) * 6;
        const dx = x - px, dy = y - py, near = Math.exp(-(dx * dx + dy * dy) / (S * S * 9));
        lift[k] += (near * 22 - lift[k]) * 0.12;
        let z = (wave + lift[k]) * rise + (m ? (m === 2 ? 30 : 22) * rise + Math.sin(t * 2 + sum * 0.5) * 2 : 0);
        z -= kOut * (m ? 0 : 40) * (sum / (2 * N));
        const ty = y - z;
        // fade the field out toward the top under the centred text (phones: toward the bottom)
        const side = phone ? clamp((h * 0.66 - y) / (h * 0.22), 0, 1) : clamp((y - h * 0.46) / (h * 0.16), 0, 1);
        const fade = side * (m ? 1 : clamp((y + S * 4) / (h * 0.35), 0, 1)) * rise * (1 - kOut * 0.8);
        if (fade <= 0.01) continue;
        ctx.globalAlpha = fade;
        // side faces
        ctx.fillStyle = m ? '#06506e' : '#0d131b';
        ctx.beginPath(); ctx.moveTo(x - half * 2, ty); ctx.lineTo(x, ty + half); ctx.lineTo(x, y + half + base); ctx.lineTo(x - half * 2, y + base); ctx.closePath(); ctx.fill();
        ctx.fillStyle = m ? '#043a52' : '#0a0f15';
        ctx.beginPath(); ctx.moveTo(x + half * 2, ty); ctx.lineTo(x, ty + half); ctx.lineTo(x, y + half + base); ctx.lineTo(x + half * 2, y + base); ctx.closePath(); ctx.fill();
        // top face
        const lit = clamp(0.5 + z / 60, 0.3, 1);
        if (m) {
          const pulse = 0.75 + Math.sin(t * 2 + sum * 0.4) * 0.12;
          ctx.fillStyle = m === 2 ? `rgba(220, 252, 255, ${pulse})` : `rgba(0, 222, 240, ${pulse})`;
        } else ctx.fillStyle = `rgb(${14 + lit * 26 | 0}, ${20 + lit * 32 | 0}, ${28 + lit * 40 | 0})`;
        ctx.beginPath(); ctx.moveTo(x, ty - half); ctx.lineTo(x + half * 2, ty); ctx.lineTo(x, ty + half); ctx.lineTo(x - half * 2, ty); ctx.closePath(); ctx.fill();
        // top edge highlight
        ctx.strokeStyle = m ? 'rgba(180, 250, 255, 0.55)' : 'rgba(200, 225, 240, 0.07)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - half * 2, ty); ctx.lineTo(x, ty - half); ctx.lineTo(x + half * 2, ty); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    if (disposed) return;
    last = now;
    const t = reduce ? 30 : (now - t0) / 1000;
    const kIn = reduce ? 9 : t;
    let kOut = 0;
    if (exitAt >= 0) { kOut = clamp((now - exitAt) / 650, 0, 1); if (kOut >= 1 && exitDone) { const d = exitDone; exitDone = null; d(); } }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#080b10'; ctx.fillRect(0, 0, w, h);
    // cool light pooled under the assistant
    const g = ctx.createRadialGradient(bot.x, bot.y + bot.H * 0.55, 0, bot.x, bot.y + bot.H * 0.55, bot.H * 1.1);
    g.addColorStop(0, `rgba(0, 200, 230, ${0.16 * ease(kIn - 0.4)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    drawCubes(t, kIn, kOut);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (active && !document.hidden && (!reduce || exitAt >= 0)) raf = requestAnimationFrame(frame);
  }

  const onMove = (e) => { const r = canvas.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; if (reduce && !raf) raf = requestAnimationFrame(frame); };
  const onLeave = () => { ptr.x = ptr.y = -9999; };
  const onVis = () => { if (!document.hidden && active && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const onResize = () => { layout(); if (!raf) raf = requestAnimationFrame(frame); };
  layout();
  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);

  return {
    exit(done) { if (exitAt >= 0) return; if (reduce) { done(); return; } exitAt = performance.now(); exitDone = done; if (!raf) raf = requestAnimationFrame(frame); },
    setActive(on) { active = on; if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    dispose() {
      disposed = true; cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize); window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave); document.removeEventListener('visibilitychange', onVis);
    },
  };
}
