
// The A.F.A. entry scene: a platinum coin drops onto a black stage, rolls to the press, is stamped with the
// A.F.A. mark, and on "Get started" flies into the logo. Three.js r128 is passed in (loaded from a CDN).
export function startIntroScene(root, THREE, { onEnter }) {
  const $ = id => root.querySelector('#afl-' + id);
  let raf = 0, disposed = false;
  // Headline types itself out like a terminal: each letter flickers through random glyphs, then locks in
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$+/<>';
  const headEl = $('headline'), headText = 'Your personal financial assistant';
  let headTimers = [];
  function buildHeadline() {
    headEl.setAttribute('aria-label', headText); headEl.textContent = '';
    return [...headText].map(ch => { const sp = document.createElement('span'); sp.className = 'ch'; sp.setAttribute('aria-hidden', 'true'); sp.textContent = ch === ' ' ? '\u00a0' : ch; headEl.appendChild(sp); return sp; });
  }
  let headSpans = buildHeadline();
  function resetHeadline() { headTimers.forEach(clearTimeout); headTimers.forEach(clearInterval); headTimers = []; headEl.classList.remove('on'); headSpans = buildHeadline(); textShown = false; }
  const showText = () => {
    headEl.classList.add('on');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    headSpans.forEach(sp => { sp.style.width = sp.getBoundingClientRect().width + 'px'; });
    headSpans.forEach((sp, i) => {
      const ch = headText[i];
      if (ch === ' ' || reduceMotion) { sp.classList.add('live', 'done'); return; }
      headTimers.push(setTimeout(() => {
        sp.classList.add('live'); let n = 0;
        const it = setInterval(() => { n++; if (n >= 9) { clearInterval(it); sp.textContent = ch; sp.classList.add('done'); } else sp.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0]; }, 60);
        headTimers.push(it);
      }, 300 + i * 95));
    });
  };

  let onHome = true;

  const canvas = $('scene');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { showText(); return { startExit: () => onEnter(), setHome() {}, dispose() { headTimers.forEach(clearTimeout); headTimers.forEach(clearInterval); } }; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x0b0f15, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0f15, 14, 32);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  scene.add(camera);

  // ---------- Reflections: a photo studio of soft boxes and strip lights, so metal reads as metal ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  {
    const env = new THREE.Scene();
    const sky = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#6b7d92'); g.addColorStop(0.35, '#26313e'); g.addColorStop(0.6, '#10161e'); g.addColorStop(1, '#06090d'); x.fillStyle = g; x.fillRect(0, 0, 4, 256); return new THREE.CanvasTexture(c); })();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide })));
    const panel = (w, h, color, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m); };
    panel(14, 4, 0xffffff, 0, 12, 0, 0, Math.PI / 2);                 // overhead soft box
    panel(6, 4, 0xffffff, 6, 6, 9, -0.6);                              // key soft box, front right
    panel(4, 3, 0xdff4ff, -8, 4, 8, 0.8);                              // fill, front left
    panel(2.5, 10, 0x00e5f5, -12, 2, 0, Math.PI / 2);                  // cyan wall
    panel(2.5, 10, 0x3d8cff, 12, 1, -3, -Math.PI / 2);                 // blue wall
    for (let i = 0; i < 6; i++) panel(16, 0.14, 0xffffff, 0, -2 + i * 1.3, -12);          // strip lights behind
    for (let i = 0; i < 4; i++) panel(0.16, 10, 0xeaf8ff, -7.5 + i * 5, 2, 12, Math.PI); // strip lights in front
    scene.environment = pmrem.fromScene(env, 0.015).texture;
  }

  // ---------- Background light streaks (fixed to the camera) ----------
  const bgMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAspect: { value: 1 } }, depthWrite: false, depthTest: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float uTime; uniform float uAspect;
      float band(vec2 p, float ang, float off, float w){ vec2 d = vec2(cos(ang), sin(ang)); float s = dot(p, vec2(-d.y, d.x)) - off; return exp(-s*s/(w*w)); }
      void main(){
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        vec3 col = vec3(0.043, 0.059, 0.082);
        float t = uTime * 0.05;
        float a = band(p, -0.22, 0.10 + 0.04*sin(t*3.0), 0.045) * smoothstep(0.7, -0.6, p.x);
        float b = band(p, -0.10, 0.02 + 0.03*cos(t*2.0), 0.03) * smoothstep(-0.8, 0.6, p.x);
        float c = band(p, -0.30, 0.24 + 0.03*sin(t*2.6+1.0), 0.06);
        col += vec3(0.0, 0.85, 0.95) * a * 0.18;
        col += vec3(0.31, 0.67, 1.0) * b * 0.16;
        col += vec3(0.50, 0.42, 1.0) * c * 0.08;
        float v = smoothstep(1.25, 0.15, length(p * vec2(0.75, 1.15)));
        col *= 0.5 + 0.5 * v;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat); bg.renderOrder = -10; bg.frustumCulled = false; bg.position.z = -30; camera.add(bg);

  // ---------- Shared materials ----------
  const R = 0.6, T = 0.12;
  const floorY = -R;
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xe9f0f6, metalness: 1, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.9 });
  const blackChrome = new THREE.MeshPhysicalMaterial({ color: 0x1a222c, metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.7 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x00f2fe, toneMapped: false });
  const glassFresnel = (strength = 0.8) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uStrength: { value: strength } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: `varying vec3 vN; varying vec3 vV; uniform float uStrength;
      void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; float f = pow(1.0 - abs(dot(n, vV)), 2.2);
        vec3 L = normalize(vec3(0.3, 0.9, 0.6)); float s = pow(max(dot(reflect(-L, n), vV), 0.0), 70.0);
        vec3 col = mix(vec3(0.6, 0.92, 1.0), vec3(1.0), f) + s; gl_FragColor = vec4(col, 0.025 + uStrength * f + s * 0.9); }`
  });
  const canvasTex = (w, h, draw, srgb) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };

  // ---------- Stage floor: polished black, semi-transparent so a mirrored coin shows through as a reflection ----------
  {
    const fade = canvasTex(256, 256, (x) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#bbb'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshPhysicalMaterial({ color: 0x080b10, metalness: 0.3, roughness: 0.12, clearcoat: 0.4, clearcoatRoughness: 0.03, envMapIntensity: 0.3, transparent: true, opacity: 0.8, depthWrite: false, alphaMap: fade }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(-2, floorY, 1); floor.renderOrder = 1; scene.add(floor);
  }
  const mirror = new THREE.Group(); mirror.scale.y = -1; mirror.position.y = 2 * floorY; scene.add(mirror);

  // ---------- Path the coin rolls along, and the light it leaves behind ----------
  const path = new THREE.CatmullRomCurve3([[-12.5, 0, 6.2], [-8.0, 0, 5.0], [-4.4, 0, 2.5], [-1.8, 0, 0.45], [0, 0, 0]].map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const L = path.getLength();
  const side = new THREE.Vector3(), tan = new THREE.Vector3(), pt = new THREE.Vector3();
  const frameAt = (s) => { const u = Math.min(1, Math.max(0, s / L)); path.getPointAt(u, pt); path.getTangentAt(u, tan); side.set(-tan.z, 0, tan.x).normalize(); return pt; };
  const TRAIL_SEG = 400;
  const trailCurve = new THREE.CatmullRomCurve3(Array.from({ length: 121 }, (_, i) => { const p = frameAt((i / 120) * (L - 1.05)).clone(); p.y = floorY + 0.004; return p; }));
  const trail = new THREE.Mesh(new THREE.TubeGeometry(trailCurve, TRAIL_SEG, 0.006, 6), glow); scene.add(trail);
  const trailGlowTex = canvasTex(64, 64, (x) => { const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(0,242,254,0)'); g.addColorStop(0.5, 'rgba(0,242,254,0.9)'); g.addColorStop(1, 'rgba(0,242,254,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  const trailGlow = (() => {
    const pos = [], uv = [], idx = [], n = 200, w = 0.16;
    for (let i = 0; i <= n; i++) { const u = i / n; const p = trailCurve.getPointAt(u); const tg = trailCurve.getTangentAt(u); const sx = -tg.z, sz = tg.x; pos.push(p.x + sx * w, floorY + 0.002, p.z + sz * w, p.x - sx * w, floorY + 0.002, p.z - sz * w); uv.push(u, 0, u, 1); if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: trailGlowTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); scene.add(m); return { m, n };
  })();
  const setTrail = (k0, k1) => { const a = Math.floor(TRAIL_SEG * k0), b = Math.max(a, Math.floor(TRAIL_SEG * k1)); trail.geometry.setDrawRange(a * 36, (b - a) * 36); const c = Math.floor(trailGlow.n * k0), d = Math.max(c, Math.floor(trailGlow.n * k1)); trailGlow.m.geometry.setDrawRange(c * 6, (d - c) * 6); };

  // ---------- Dais: the coin stage (black chrome, satin plate, light rings) ----------
  const DAIS = 0.1;
  const dais = new THREE.Group(); scene.add(dais);
  { const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.06, DAIS, 128), blackChrome); body.position.y = floorY + DAIS / 2; dais.add(body);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.93, 0.93, 0.012, 128), new THREE.MeshPhysicalMaterial({ color: 0xe6eef6, metalness: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.6 })); plate.position.y = floorY + DAIS + 0.006; dais.add(plate);
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.965, 0.008, 8, 160), glow); r1.rotation.x = Math.PI / 2; r1.position.y = floorY + DAIS + 0.004; dais.add(r1);
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.005, 8, 160), glow); r2.rotation.x = Math.PI / 2; r2.position.y = floorY + 0.003; dais.add(r2);
    const r3 = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.012, 8, 160), chrome); r3.rotation.x = Math.PI / 2; r3.position.y = floorY + 0.006; dais.add(r3);
    // the dais and its rings, reflected
    const m = dais.clone(); mirror.add(m);
  }

  // ---------- Press: chrome head with a light band, glowing rod in a glass sleeve, minting die ----------
  const press = new THREE.Group(); scene.add(press);
  const dieR = 0.8;
  press.add(new THREE.Mesh(new THREE.TorusGeometry(dieR, 0.045, 24, 128), chrome));
  const dieGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  press.add(new THREE.Mesh(new THREE.TorusGeometry(dieR, 0.1, 16, 128), dieGlowMat));
  [-0.34, 0.34].forEach(x => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.5, 16), chrome); s.position.set(x, dieR + 0.2, 0); press.add(s); });
  const headY = dieR + 0.45 + 0.24;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.48, 128), chrome); head.position.y = headY; press.add(head);
  const headBand = new THREE.Mesh(new THREE.CylinderGeometry(0.625, 0.625, 0.035, 128, 1, true), glow); headBand.position.y = headY; press.add(headBand);
  const headCap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.12, 128), blackChrome); headCap.position.y = headY + 0.3; press.add(headCap);
  const rodTex = canvasTex(4, 256, (x) => { const gr = x.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, '#effeff'); gr.addColorStop(0.12, '#00f2fe'); gr.addColorStop(0.55, '#3c7dff'); gr.addColorStop(1, '#0b0f15'); x.fillStyle = gr; x.fillRect(0, 0, 4, 256); }, true);
  const rodY = headY + 0.36 + 3.5;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7, 24), new THREE.MeshBasicMaterial({ map: rodTex, toneMapped: false })); rod.position.y = rodY; press.add(rod);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6.8, 36, 1, true), glassFresnel(0.7)); sleeve.position.y = rodY + 0.1; sleeve.renderOrder = 3; press.add(sleeve);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.08, 48), chrome); collar.position.y = headY + 0.4; press.add(collar);
  const pressLight = new THREE.PointLight(0x00f2fe, 0, 6, 2); press.add(pressLight);

  // ---------- Lights ----------
  scene.add(new THREE.HemisphereLight(0xa8e2ff, 0x0a0f18, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(4, 7, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0x4facfe, 1.0); rim.position.set(-6, 2, -4); scene.add(rim);

  // ---------- Coin: platinum with a guilloché band, engraved legend, enamel centre and the A.F.A. mark ----------
  const S = 1024, C = S / 2;
  const ringText = 'AUTOMATED · FINANCIAL · ASSISTANT · A.F.A. · ';
  const F = { field: 0.6, band: 0.64, text0: 0.645, text1: 0.775, gui0: 0.78, gui1: 0.9, rim: 0.9 };
  function circleText(x, radius, size, color) {
    x.save(); x.translate(C, C); x.fillStyle = color; x.font = `600 ${size}px "Inter", "Segoe UI", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const chars = [...ringText]; const step = (Math.PI * 2) / chars.length;
    chars.forEach((ch, i) => { x.save(); x.rotate(-Math.PI / 2 + i * step); x.translate(radius, 0); x.rotate(Math.PI / 2); x.fillText(ch, 0, 0); x.restore(); });
    x.restore();
  }
  function ring(x, r0, r1, style) { x.beginPath(); x.arc(C, C, C * r1, 0, Math.PI * 2); x.arc(C, C, C * r0, 0, Math.PI * 2, true); x.fillStyle = style; x.fill('evenodd'); }
  function guilloche(x, a, b) {
    // overlapping sine rings, like an engine-turned watch dial
    x.save(); x.lineWidth = 1.4;
    for (let k = 0; k < 46; k++) {
      const rb = C * (F.gui0 + 0.012 + (F.gui1 - F.gui0 - 0.024) * (k / 45)); const ph = k * 0.42;
      x.strokeStyle = k % 2 ? a : b; x.beginPath();
      for (let i = 0; i <= 720; i++) { const th = (i / 720) * Math.PI * 2; const r = rb + C * 0.009 * Math.sin(36 * th + ph); const px = C + r * Math.cos(th), py = C + r * Math.sin(th); i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    }
    x.restore();
  }
  function concentric(x, r0, r1, a, b) { let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; x.lineWidth = 1.1; for (let r = C * r0; r < C * r1; r += 1.8) { x.strokeStyle = rnd() > 0.5 ? a : b; x.beginPath(); x.arc(C, C, r, 0, Math.PI * 2); x.stroke(); } }
  function logo(x, mode) {
    const box = C * 0.78, ox = C - box / 2, oy = C - box / 2 + C * 0.015, u = box / 100, P = (a, b) => [ox + a * u, oy + b * u];
    x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = 11 * u;
    if (mode === 'color') { const g = x.createLinearGradient(ox, oy, ox + box, oy + box); g.addColorStop(0, '#5ff8ff'); g.addColorStop(1, '#4facfe'); x.strokeStyle = g; }
    else x.strokeStyle = mode;
    x.beginPath(); x.moveTo(...P(27, 74)); x.lineTo(...P(50, 23)); x.lineTo(...P(73, 74)); x.stroke();
    const dot = (a, b, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(...P(a, b), r * u, 0, Math.PI * 2); x.fill(); };
    if (mode === 'color') { dot(50, 23, 7.5, '#ffffff'); dot(27, 74, 6, '#5ff8ff'); dot(73, 74, 6, '#5ff8ff'); } else { dot(50, 23, 7.5, mode); dot(27, 74, 6, mode); dot(73, 74, 6, mode); }
  }
  // Four maps per face: colour, roughness, metalness (via the blue channel), relief, plus glow for the stamped mark
  function faceMaterial(stamped) {
    const map = canvasTex(S, S, (x) => {
      x.fillStyle = '#e7edf3'; x.fillRect(0, 0, S, S);
      concentric(x, 0, F.field, 'rgba(255,255,255,0.18)', 'rgba(90,105,120,0.14)');
      if (stamped) {
        const g = x.createRadialGradient(C, C * 0.85, 10, C, C, C * F.field); g.addColorStop(0, '#16263a'); g.addColorStop(1, '#08111c');
        x.fillStyle = g; x.beginPath(); x.arc(C, C, C * F.field, 0, Math.PI * 2); x.fill();
        logo(x, 'color');
      }
      ring(x, F.field, F.band, '#f4f8fb');
      ring(x, F.text0, F.text1, '#dfe6ed'); if (stamped) circleText(x, C * 0.71, 40, '#5a6b7c');
      ring(x, F.gui0, F.gui1, '#d9e1e9'); guilloche(x, 'rgba(255,255,255,0.55)', 'rgba(70,85,100,0.45)');
      ring(x, F.rim, 1.0, '#f6f9fc');
    }, true);
    const rough = canvasTex(S, S, (x) => {
      x.fillStyle = '#2a2a2a'; x.fillRect(0, 0, S, S);                                   // polished blank
      concentric(x, 0, F.field, 'rgba(70,70,70,1)', 'rgba(30,30,30,1)');
      if (stamped) { x.fillStyle = '#4a4a4a'; x.beginPath(); x.arc(C, C, C * F.field, 0, Math.PI * 2); x.fill(); logo(x, '#1c1c1c'); }
      ring(x, F.field, F.band, '#141414');
      ring(x, F.text0, F.text1, '#6a6a6a'); if (stamped) circleText(x, C * 0.71, 40, '#a0a0a0');
      ring(x, F.gui0, F.gui1, '#3a3a3a'); guilloche(x, '#202020', '#6e6e6e');
      ring(x, F.rim, 1.0, '#121212');
    });
    const metal = canvasTex(S, S, (x) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S); if (stamped) { x.fillStyle = '#262626'; x.beginPath(); x.arc(C, C, C * F.field, 0, Math.PI * 2); x.fill(); logo(x, '#ffffff'); } });
    const bump = canvasTex(S, S, (x) => {
      x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, S, S);
      if (stamped) { x.fillStyle = '#5a5a5a'; x.beginPath(); x.arc(C, C, C * F.field, 0, Math.PI * 2); x.fill(); logo(x, '#e0e0e0'); }
      ring(x, F.field, F.band, '#b0b0b0');
      if (stamped) circleText(x, C * 0.71, 40, '#505050');
      guilloche(x, '#9a9a9a', '#606060');
      ring(x, F.rim, 1.0, '#ffffff');
    });
    const em = canvasTex(S, S, (x) => { x.fillStyle = '#000'; x.fillRect(0, 0, S, S); if (stamped) { logo(x, '#00e1f0'); x.lineWidth = 3; x.strokeStyle = '#00727a'; x.beginPath(); x.arc(C, C, C * F.field - 2, 0, Math.PI * 2); x.stroke(); } }, true);
    return new THREE.MeshPhysicalMaterial({ map, roughnessMap: rough, roughness: 1, metalnessMap: metal, metalness: 1, bumpMap: bump, bumpScale: 0.03, clearcoat: 0.5, clearcoatRoughness: 0.06,
      emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 0, envMapIntensity: 2.4 });
  }
  const reedTex = canvasTex(128, 4, (x) => { for (let i = 0; i < 128; i++) { x.fillStyle = i % 4 < 2 ? '#fff' : '#222'; x.fillRect(i, 0, 1, 4); } });
  reedTex.wrapS = THREE.RepeatWrapping; reedTex.repeat.set(30, 1);
  const edgeMat = new THREE.MeshPhysicalMaterial({ color: 0xe9eff5, metalness: 1, roughness: 0.16, clearcoat: 0.6, bumpMap: reedTex, bumpScale: 0.035, envMapIntensity: 2.4 });
  let blankMat = faceMaterial(false), logoMat = faceMaterial(true);

  const coin = new THREE.Group(); coin.rotation.order = 'YXZ';
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, 192), edgeMat); body.rotation.x = Math.PI / 2; coin.add(body);
  const rimF = new THREE.Mesh(new THREE.TorusGeometry(R - 0.01, 0.012, 16, 192), chrome); rimF.position.z = T / 2; coin.add(rimF);
  const rimB = rimF.clone(); rimB.position.z = -T / 2; coin.add(rimB);
  const front = new THREE.Mesh(new THREE.CircleGeometry(R * 0.99, 192), blankMat); front.position.z = T / 2 + 0.002; coin.add(front);
  const back = new THREE.Mesh(new THREE.CircleGeometry(R * 0.99, 192), blankMat); back.rotation.y = Math.PI; back.position.z = -T / 2 - 0.002; coin.add(back);
  scene.add(coin);
  const coinMirror = coin.clone(); coinMirror.rotation.order = 'YXZ'; mirror.add(coinMirror);
  const mFront = coinMirror.children[3], mBack = coinMirror.children[4];

  // ---------- Stamp effects ----------
  const glowTex = canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(120,250,255,0.6)'); g.addColorStop(1, 'rgba(0,242,254,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
  const sprite = (color, order) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); s.renderOrder = order; scene.add(s); return s; };
  const flash = sprite(0xffffff, 9), halo = sprite(0x00f2fe, 2);
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.0, 128), new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); shock.renderOrder = 9; scene.add(shock);
  const NSP = 70, spPos = new Float32Array(NSP * 3), spVel = [];
  { let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < NSP; i++) { const a = r() * Math.PI * 2, v = 1.5 + r() * 3; spVel.push([Math.cos(a) * v, Math.sin(a) * v * 0.9 + 0.8, (r() - 0.3) * 2]); } }
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.06, color: 0xbffcff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); sparks.renderOrder = 9; scene.add(sparks);

  // ---------- Timeline: follow the coin, pull back to the full view, stamp, reveal ----------
  const ease = { inC: t => t * t * t, outC: t => 1 - Math.pow(1 - t, 3), outQ: t => 1 - Math.pow(1 - t, 4), inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, sine: t => 0.5 - 0.5 * Math.cos(Math.PI * t) };
  const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, x) => { const k = seg(x, a, b); return k * k * (3 - 2 * k); };
  const TL = { roll: [0.25, 3.5], pull: [2.7, 4.3], press: [3.85, 4.35], lift: [4.6, 5.25], pop: [4.7, 6.2], text: 4.1, end: 6.3 };
  // Drop: the coin falls onto the stage and bounces twice before it settles into a roll (simple gravity + restitution)
  const G = 7.2, H0 = 1.7, REST = 0.4;
  const tFall = Math.sqrt(2 * H0 / G);
  const impacts = (() => { const a = [tFall]; let v = G * tFall * REST, tt = tFall; for (let i = 0; i < 3; i++) { tt += 2 * v / G; a.push(tt); v *= REST; } return a; })();
  function dropY(td) {
    if (td <= 0) return H0;
    if (td < tFall) return H0 - 0.5 * G * td * td;
    let v = G * tFall * REST, t0 = tFall;
    for (let i = 0; i < 4; i++) { const d = 2 * v / G; if (td < t0 + d) { const x = td - t0; return v * x - 0.5 * G * x * x; } t0 += d; v *= REST; }
    return 0;
  }
  const travel = 2 * Math.PI * R * 3;       // whole turns, so the coin stops upright under the die
  const sStart = L - travel;
  const endYaw = (() => { frameAt(L); return -Math.atan2(tan.z, tan.x); })();
  const coinY = (s) => DAIS * smooth(L - 1.25, L - 0.9, s);   // eases up onto the dais
  // Distance along the path: constant rolling friction, so the coin slows evenly and stops on the dais
  const sAt = (time) => { const u = seg(time, TL.roll[0], TL.roll[1]); return sStart + travel * (1 - (1 - u) * (1 - u)); };
  const sLand = sAt(TL.roll[0] + tFall);
  // Ripples of light where the coin lands
  const ripples = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 96), new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; scene.add(m); return m; });
  // A pool of light that travels with the coin on the floor, plus a small cyan light so the floor and coin edge pick it up
  const poolTex = canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(160,250,255,0.95)'); g.addColorStop(0.25, 'rgba(0,242,254,0.55)'); g.addColorStop(1, 'rgba(0,242,254,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2; pool.renderOrder = 2; scene.add(pool);
  const poolLight = new THREE.PointLight(0x00f2fe, 0, 3.2, 2); scene.add(poolLight);
  // Slow concentric waves across the stage once the coin is minted
  const waveTex = canvasTex(256, 256, (x) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(120,230,255,0)'); g.addColorStop(0.72, 'rgba(120,230,255,0)'); g.addColorStop(0.86, 'rgba(150,235,255,0.9)'); g.addColorStop(1, 'rgba(120,230,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); });
  const waves = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: waveTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.y = floorY + 0.004; m.renderOrder = 2; scene.add(m); return m; });

  let layout;
  function computeLayout() {
    const w = innerWidth, h = innerHeight, aspect = w / h, narrow = w <= 760 || aspect < 0.85;
    layout = narrow
      ? { narrow, wideCam: new THREE.Vector3(0.6, 5.6, 22.5), wideLook: new THREE.Vector3(-0.3, 0.2, 0), follow: 1.45, hover: new THREE.Vector3(0.0, 1.4, 4.0), coinS: 1.5, rest: 4.2 }
      : { narrow, wideCam: new THREE.Vector3(0.6, 3.4, 15.5), wideLook: new THREE.Vector3(-0.15, 0.25, 0), follow: 1, hover: new THREE.Vector3(0, 1.15, 2.4), coinS: 1.45, rest: 3.0 };
    renderer.setSize(w, h, false); camera.fov = narrow ? 40 : 30; scene.fog.near = narrow ? 22 : 14; scene.fog.far = narrow ? 44 : 32; camera.aspect = aspect; camera.updateProjectionMatrix();
    const dist = 30, hh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist; bg.scale.set(hh * aspect * 1.4, hh * 1.4, 1); bgMat.uniforms.uAspect.value = aspect;
  }

  let t = 0, playing = true, exitT = -1, textShown = false;
  const camTmp = new THREE.Vector3(), lookTmp = new THREE.Vector3(), fCam = new THREE.Vector3(), fLook = new THREE.Vector3(), exitFrom = { p: new THREE.Vector3(), s: 1 }, exitTo = new THREE.Vector3(), tmp = new THREE.Vector3();

  function pose(time, now) {
    // coin position along the path
    let sNow = L;
    const td = time - TL.roll[0];
    if (time < TL.pop[0]) {
      sNow = sAt(time);
      const p = frameAt(sNow);
      const yaw = -Math.atan2(tan.z, tan.x);
      coin.position.set(p.x, coinY(sNow) + dropY(td), p.z);
      // lean: a wobble after each landing that dies away, plus a gentle sway while rolling fast
      let lean = 0.06;
      impacts.forEach((ti, i) => { const d = td - ti; if (d > 0) lean += 0.18 * Math.pow(REST, i) * Math.exp(-d * 3.0) * Math.sin(d * 13 + i * 1.3); });
      const u = seg(time, TL.roll[0], TL.roll[1]);
      lean = lean * (1 - u) + Math.sin(td * 4.2) * 0.03 * (1 - u) * (1 - u);
      coin.rotation.set(lean, yaw, (L - sNow) / R);
      coin.scale.setScalar(1);
      // ground glow follows the coin; it brightens as the coin touches down and fades as it slows
      const h = Math.max(0, coin.position.y - coinY(sNow));
      const speed = 1 - u;
      const near = Math.exp(-h * 2.4);
      pool.position.set(p.x, floorY + 0.005 + coinY(sNow), p.z);
      pool.scale.set(1.9 + h * 0.8, 1.9 + h * 0.8, 1);
      pool.material.opacity = (0.25 + 0.45 * speed) * near;
      poolLight.position.set(p.x, floorY + 0.35, p.z);
      poolLight.intensity = (0.8 + 1.6 * speed) * near;
      ripples.forEach((r, i) => { const d = td - impacts[i]; if (d > 0 && d < 0.9) { const q = frameAt(sAt(TL.roll[0] + impacts[i])); r.position.set(q.x, floorY + 0.006, q.z); r.scale.setScalar(0.35 + d * 2.0); r.material.opacity = 0.55 * Math.pow(REST, i) * (1 - d / 0.9); } else r.material.opacity = 0; });
    } else {
      pool.material.opacity = Math.max(0, pool.material.opacity - 0.04); poolLight.intensity = 0;
      const k = ease.outQ(seg(time, TL.pop[0], TL.pop[1])), arc = Math.sin(seg(time, TL.pop[0], TL.pop[1]) * Math.PI) * 0.35;
      coin.position.set(lerp(0, layout.hover.x, k), lerp(DAIS, layout.hover.y, k) + arc, lerp(0, layout.hover.z, k));
      const idle = time > TL.pop[1] && !reduce ? time - TL.pop[1] : 0;
      coin.rotation.set(-0.06 * k + Math.sin(idle * 0.9) * 0.03, lerp(endYaw, Math.PI * 2, k) + Math.sin(idle * 0.7) * 0.32 * Math.min(1, idle), 0);
      coin.position.y += Math.sin(idle * 1.4) * 0.05;
      coin.scale.setScalar(lerp(1, layout.coinS, k));
    }
    coinMirror.position.copy(coin.position); coinMirror.rotation.copy(coin.rotation); coinMirror.scale.copy(coin.scale);
    coinMirror.visible = exitT < 0;
    setTrail(Math.min(1, Math.max(0, sLand / (L - 1.05))), td > tFall ? Math.min(1, Math.max(0, sNow / (L - 1.05))) : 0);

    // camera: low tracking shot beside the coin, then a smooth pull back to the full stage
    frameAt(Math.min(sNow, L - 0.4));
    const fs = layout.follow;
    fCam.copy(coin.position).addScaledVector(side, 2.9 * fs).addScaledVector(tan, -2.3 * fs); fCam.y = floorY + 0.75 * fs + 0.3 + 0.55 * Math.max(0, coin.position.y);
    fLook.copy(coin.position).addScaledVector(tan, 1.1); fLook.y = floorY + 0.45 + 0.9 * Math.max(0, coin.position.y);
    const kp = ease.inOut(seg(time, TL.pull[0], TL.pull[1]));
    camTmp.lerpVectors(fCam, layout.wideCam, kp);
    lookTmp.lerpVectors(fLook, layout.wideLook, kp);
    camera.position.copy(camTmp);
    const dc = time - TL.press[1];
    if (dc > 0 && dc < 0.35 && !reduce) { const a = (1 - dc / 0.35) * 0.03; camera.position.x += Math.sin(dc * 90) * a; camera.position.y += Math.cos(dc * 70) * a; }
    camera.lookAt(lookTmp);

    // stamp swaps the blank face for the A.F.A. face
    const stamped = time >= TL.press[1], mat = stamped ? logoMat : blankMat;
    if (front.material !== mat) { front.material = back.material = mFront.material = mBack.material = mat; }
    logoMat.emissiveIntensity = stamped ? (dc < 1.2 ? lerp(3.0, 0.75, ease.outC(dc / 1.2)) : 0.75 + Math.sin(now * 1.6) * (reduce ? 0 : 0.12)) : 0;

    // press comes down onto the dais, stamps, and lifts away
    const down = ease.inC(seg(time, TL.press[0], TL.press[1])), up = ease.outC(seg(time, TL.lift[0], TL.lift[1]));
    press.position.set(0, time < TL.lift[0] ? lerp(layout.rest + 3, DAIS, down) : lerp(DAIS, layout.rest + 5, up), 0);
    press.rotation.y = endYaw;
    dieGlowMat.opacity = dc > -0.25 && dc < 0.9 ? (dc < 0 ? (dc + 0.25) / 0.25 * 0.5 : 0.9 * (1 - dc / 0.9)) : 0;
    pressLight.intensity = dc > 0 && dc < 1 ? 6 * (1 - dc) : dc > -0.3 && dc <= 0 ? 2 : 0;

    const f = dc > 0 && dc < 0.6 ? 1 - dc / 0.6 : 0;
    flash.material.opacity = f * 0.9; flash.position.set(0, DAIS, 0.3); flash.scale.setScalar(1.4 + (1 - f) * 3.2);
    const sk = dc > 0 && dc < 0.8 ? dc / 0.8 : -1;
    shock.material.opacity = sk >= 0 ? 0.7 * (1 - sk) : 0; shock.scale.setScalar(sk >= 0 ? 0.9 + ease.outC(sk) * 3.0 : 1); shock.rotation.y = endYaw; shock.position.y = DAIS;
    const sp = dc > 0 && dc < 1.2 ? dc : -1;
    sparks.material.opacity = sp >= 0 ? Math.max(0, 1 - sp / 1.2) : 0;
    if (sp >= 0) { const d = 1 - Math.exp(-sp * 2.4); for (let i = 0; i < NSP; i++) { const v = spVel[i]; spPos[i * 3] = v[0] * d * 0.5; spPos[i * 3 + 1] = DAIS + v[1] * d * 0.5 - 0.35 * sp * sp; spPos[i * 3 + 2] = v[2] * d * 0.4 + 0.2; } spGeo.attributes.position.needsUpdate = true; }
    const hk = seg(time, TL.pop[0] + 0.5, TL.pop[1] + 0.4);
    halo.material.opacity = 0.28 * hk * (exitT >= 0 ? 0 : 1); halo.position.copy(coin.position).add(tmp.set(0, 0, -0.6)); halo.scale.setScalar(4 * coin.scale.x);

    const dw = time - TL.press[1];
    waves.forEach((w, i) => { if (dw <= 0) { w.material.opacity = 0; return; } const ph = (dw * 0.22 + i / waves.length) % 1; const born = Math.min(1, dw * 0.22 * waves.length - i + 1); w.scale.setScalar(2.2 + ph * 13); w.material.opacity = born > 0 ? 0.16 * Math.sin(ph * Math.PI) * Math.min(1, born) : 0; });
    if (time >= TL.text && !textShown) { textShown = true; showText(); }
    bgMat.uniforms.uTime.value = now;
  }

  // ---------- Get started: the coin shrinks into the logo, then the app fades in ----------
  const exitCtrl = new THREE.Vector3(), qFrom = new THREE.Quaternion(), qTo = new THREE.Quaternion(), qSpin = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
  const EXIT = 1.15;
  let exitScale = 0.12, absorbed = false, entered = false;
  function startExit() {
    if (exitT >= 0) return;
    if (!onHome) { onEnter(); return; }
    if (t < TL.end) { t = TL.end; pose(t, 0); }
    exitT = 0; absorbed = false;
    exitFrom.p.copy(coin.position); exitFrom.s = coin.scale.x; qFrom.copy(coin.quaternion);
    halo.material.opacity = 0; pool.material.opacity = 0; coinMirror.visible = false;
    // the landing point: on the ray through the centre of the logo, at a fixed depth
    const r = root.querySelector('.afl-brand svg').getBoundingClientRect();
    const depth = 6;
    const ndc = new THREE.Vector3(((r.left + r.width / 2) / innerWidth) * 2 - 1, -((r.top + r.height / 2) / innerHeight) * 2 + 1, 0.5).unproject(camera);
    exitTo.copy(camera.position).add(ndc.sub(camera.position).normalize().multiplyScalar(depth));
    // scale so the coin's on-screen diameter matches the logo
    const worldPerPx = (2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / innerHeight;
    exitScale = (r.height * 0.86 * worldPerPx) / (2 * R);
    // a gentle arc: rise first, then glide into the logo
    exitCtrl.lerpVectors(exitFrom.p, exitTo, 0.35); exitCtrl.y += 1.2;
    // end facing the camera
    const m = new THREE.Matrix4().lookAt(exitTo, camera.position, camera.up); qTo.setFromRotationMatrix(m);
    qTo.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, Math.PI));
    root.querySelector('.afl-brand').classList.remove('absorb');
  }
  function exitPose(dt) {
    exitT += dt;
    const u = Math.min(1, exitT / EXIT), k = ease.inOut(u);
    // quadratic Bezier along the arc
    const a1 = 1 - k;
    coin.position.set(
      a1 * a1 * exitFrom.p.x + 2 * a1 * k * exitCtrl.x + k * k * exitTo.x,
      a1 * a1 * exitFrom.p.y + 2 * a1 * k * exitCtrl.y + k * k * exitTo.y,
      a1 * a1 * exitFrom.p.z + 2 * a1 * k * exitCtrl.z + k * k * exitTo.z);
    // one smooth turn that settles face-on
    qSpin.setFromAxisAngle(yAxis, Math.PI * 2 * (1 - ease.outC(u)));
    coin.quaternion.copy(qFrom).slerp(qTo, ease.outC(Math.min(1, u * 1.2))).multiply(qSpin);
    coin.scale.setScalar(lerp(exitFrom.s, exitScale, ease.inOut(u)));
    logoMat.emissiveIntensity = 0.8 + 1.6 * k;
    if (u >= 1 && !absorbed) { absorbed = true; coin.visible = false; root.querySelector('.afl-brand').classList.add('absorb'); }
    if (exitT > EXIT + 0.4 && !entered) { entered = true; onEnter(); }
  }
  function reset() { exitT = -1; t = reduce ? TL.end + 1 : 0; playing = true; coin.visible = true; coinMirror.visible = true; root.querySelector('.afl-brand').classList.remove('absorb'); resetHeadline(); }

  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05), now = clock.elapsedTime;
    if (onHome) {
      if (playing && exitT < 0) t += dt;
      if (exitT < 0) pose(t, now); else { bgMat.uniforms.uTime.value = now; exitPose(dt); }
      renderer.render(scene, camera);
    }
    if (!disposed) raf = requestAnimationFrame(frame);
  }

  computeLayout(); reset();
  addEventListener('resize', computeLayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (disposed) return; const old = logoMat; logoMat = faceMaterial(true); if (front.material === old) { front.material = back.material = mFront.material = mBack.material = logoMat; } });
  raf = requestAnimationFrame(frame);

  return {
    startExit,
    setHome(v) { onHome = v; },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', computeLayout);
      headTimers.forEach(clearTimeout); headTimers.forEach(clearInterval);
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach(m => { Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
      });
      [blankMat, logoMat].forEach(m => { Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
      pmrem.dispose(); renderer.dispose();
    }
  };
}
