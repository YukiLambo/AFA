// The A.F.A. entry scene. Light streaks with a slight colour split flare out of the dark, then the A.F.A. coin
// spins in from deep in the scene, slows, and settles face-on inside two glass orbit rings over a glossy floor.
// A light sweep crosses the face, the headline decodes, and the coin keeps floating and leans toward the pointer.
// "Get started" spins the coin into the logo in the top bar. Three.js r128 is passed in (loaded from a CDN).
export function startIntroScene(root, THREE, { onEnter }) {
  const $ = id => root.querySelector('#afl-' + id);
  let raf = 0, disposed = false, onHome = true;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Headline: each letter flickers through a few glyphs, then locks in ----------
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$+/<>';
  const headEl = $('headline'), headText = 'Your personal financial assistant';
  let headTimers = [], textShown = false;
  const clearHead = () => { headTimers.forEach(clearTimeout); headTimers.forEach(clearInterval); headTimers = []; };
  function showText() {
    if (textShown || !headEl) return; textShown = true;
    headEl.setAttribute('aria-label', headText); headEl.textContent = '';
    const spans = [...headText].map(ch => { const sp = document.createElement('span'); sp.className = 'ch'; sp.setAttribute('aria-hidden', 'true'); sp.textContent = ch === ' ' ? ' ' : ch; headEl.appendChild(sp); return sp; });
    headEl.classList.add('on');
    spans.forEach(sp => { sp.style.width = sp.getBoundingClientRect().width + 'px'; });
    spans.forEach((sp, i) => {
      const ch = headText[i];
      if (ch === ' ' || reduce) { sp.classList.add('live', 'done'); return; }
      headTimers.push(setTimeout(() => {
        sp.classList.add('live'); let n = 0;
        const it = setInterval(() => { n++; if (n >= 6) { clearInterval(it); sp.textContent = ch; sp.classList.add('done'); } else sp.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0]; }, 45);
        headTimers.push(it);
      }, i * 38));
    });
  }

  const canvas = $('scene');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { showText(); return { startExit: () => onEnter(), setHome() {}, dispose: clearHead }; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x07090d, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  scene.add(camera);

  const canvasTex = (w, h, draw, srgb) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };

  // ---------- Reflections: a dark studio with cool strip lights, so the chrome reads as chrome ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  {
    const env = new THREE.Scene();
    const sky = canvasTex(4, 256, (x) => { const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#4c5d72'); g.addColorStop(0.4, '#18212c'); g.addColorStop(1, '#040609'); x.fillStyle = g; x.fillRect(0, 0, 4, 256); });
    env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide })));
    const panel = (w, h, color, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m); };
    panel(12, 3, 0xffffff, 0, 12, 0, 0, Math.PI / 2);
    panel(5, 3, 0xffffff, 7, 5, 9, -0.6);
    panel(2, 12, 0x00e5f5, -11, 1, 3, Math.PI / 2);
    panel(2, 12, 0x3d7bff, 11, 1, -2, -Math.PI / 2);
    panel(1.2, 12, 0x8a7dff, 6, 0, -11, -0.4);
    for (let i = 0; i < 5; i++) panel(18, 0.12, 0xeaf8ff, 0, -3 + i * 1.6, -12);
    scene.environment = pmrem.fromScene(env, 0.02).texture;
  }

  // ---------- Background: light streaks that radiate from a point, with red / green / blue fringes ----------
  const bgMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAspect: { value: 1 }, uOrigin: { value: new THREE.Vector2(0.18, 0.12) }, uStreak: { value: 0 } },
    depthWrite: false, depthTest: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float uTime, uAspect, uStreak; uniform vec2 uOrigin;
      float h11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
      float rays(vec2 p, float t){
        float r = length(p), a = atan(p.y, p.x);
        float id = floor(a * 38.0 / 6.2832 * 4.0);
        float n = h11(id + 3.0);
        float lane = smoothstep(0.5, 0.0, abs(fract(a * 38.0 / 6.2832 * 4.0) - 0.5)) ;
        float on = step(0.72, n);
        float run = fract(r * 0.55 - t * (0.18 + 0.25 * h11(id * 7.1)) + n * 9.0);
        float seg = smoothstep(0.0, 0.25, run) * smoothstep(1.0, 0.45, run);
        return on * lane * lane * seg * smoothstep(0.02, 0.35, r) * exp(-r * 0.9);
      }
      void main(){
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        vec2 q = p - uOrigin * vec2(uAspect, 1.0) * 0.5;
        float t = uTime;
        float ca = 0.012 + 0.03 * uStreak;
        vec3 col = vec3(0.027, 0.035, 0.051);
        vec3 s = vec3(rays(q * (1.0 + ca), t), rays(q, t), rays(q * (1.0 - ca), t));
        col += s * vec3(0.55, 0.9, 1.0) * (0.10 + 0.9 * uStreak);
        col += vec3(0.0, 0.35, 0.5) * exp(-length(q) * 3.5) * (0.05 + 0.25 * uStreak);
        float v = smoothstep(1.3, 0.2, length(p * vec2(0.7, 1.1)));
        col *= 0.45 + 0.55 * v;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat); bg.renderOrder = -10; bg.frustumCulled = false; bg.position.z = -30; camera.add(bg);

  // ---------- Materials ----------
  const R = 0.62, T = 0.1, floorY = -0.95;
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xe9f0f6, metalness: 1, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 2.0 });
  const glass = (strength) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uStrength: { value: strength }, uFade: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: `varying vec3 vN; varying vec3 vV; uniform float uStrength, uFade;
      void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; float f = pow(1.0 - abs(dot(n, vV)), 2.0);
        vec3 L = normalize(vec3(0.4, 0.8, 0.6)); float s = pow(max(dot(reflect(-L, n), vV), 0.0), 60.0);
        vec3 col = mix(vec3(0.45, 0.88, 1.0), vec3(1.0), f) + s;
        gl_FragColor = vec4(col, (0.03 + uStrength * f + s * 0.8) * uFade); }`
  });

  // ---------- Coin faces: chrome rim, engine-turned ring with the legend, dark enamel centre, glowing A.F.A. mark ----------
  const S = 1024, C = S / 2;
  const ringText = 'AUTOMATED · FINANCIAL · ASSISTANT · A.F.A. · ';
  const F = { field: 0.6, text: 0.71, gui0: 0.79, gui1: 0.9 };
  const ring = (x, r0, r1, style) => { x.beginPath(); x.arc(C, C, C * r1, 0, Math.PI * 2); x.arc(C, C, C * r0, 0, Math.PI * 2, true); x.fillStyle = style; x.fill('evenodd'); };
  function circleText(x, size, color) {
    x.save(); x.translate(C, C); x.fillStyle = color; x.font = `600 ${size}px "Inter", "Segoe UI", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const chars = [...ringText], step = (Math.PI * 2) / chars.length;
    chars.forEach((ch, i) => { x.save(); x.rotate(-Math.PI / 2 + i * step); x.translate(C * F.text, 0); x.rotate(Math.PI / 2); x.fillText(ch, 0, 0); x.restore(); });
    x.restore();
  }
  function guilloche(x, a, b) {
    x.save(); x.lineWidth = 1.3;
    for (let k = 0; k < 40; k++) {
      const rb = C * (F.gui0 + 0.01 + (F.gui1 - F.gui0 - 0.02) * (k / 39)), ph = k * 0.42;
      x.strokeStyle = k % 2 ? a : b; x.beginPath();
      for (let i = 0; i <= 720; i++) { const th = (i / 720) * Math.PI * 2, r = rb + C * 0.008 * Math.sin(36 * th + ph); const px = C + r * Math.cos(th), py = C + r * Math.sin(th); i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    }
    x.restore();
  }
  // the A.F.A. mark exactly as in the top bar: an open "A" with three nodes
  function mark(x, mode) {
    const box = C * 0.8, ox = C - box / 2, oy = C - box / 2 + C * 0.02, u = box / 100, P = (a, b) => [ox + a * u, oy + b * u];
    x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = 11 * u;
    if (mode === 'color') { const g = x.createLinearGradient(ox, oy, ox + box, oy + box); g.addColorStop(0, '#00f2fe'); g.addColorStop(1, '#4facfe'); x.strokeStyle = g; } else x.strokeStyle = mode;
    x.beginPath(); x.moveTo(...P(27, 74)); x.lineTo(...P(50, 23)); x.lineTo(...P(73, 74)); x.stroke();
    const dot = (a, b, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(...P(a, b), r * u, 0, Math.PI * 2); x.fill(); };
    dot(50, 23, 7.5, mode === 'color' ? '#ffffff' : mode); dot(27, 74, 6, mode === 'color' ? '#00f2fe' : mode); dot(73, 74, 6, mode === 'color' ? '#00f2fe' : mode);
  }
  const makeFaceMat = () => {
    const map = canvasTex(S, S, (x) => {
      x.fillStyle = '#e4ebf2'; x.fillRect(0, 0, S, S);
      const g = x.createRadialGradient(C, C * 0.8, 10, C, C, C * F.field); g.addColorStop(0, '#152438'); g.addColorStop(1, '#060c15');
      x.fillStyle = g; x.beginPath(); x.arc(C, C, C * F.field, 0, Math.PI * 2); x.fill();
      mark(x, 'color');
      ring(x, F.field, F.field + 0.035, '#f2f6fa');
      ring(x, F.field + 0.035, F.gui0, '#d5dee7'); circleText(x, 40, '#4d5e70');
      ring(x, F.gui0, F.gui1, '#d9e1e9'); guilloche(x, 'rgba(255,255,255,0.6)', 'rgba(60,75,92,0.45)');
      ring(x, F.gui1, 1.0, '#f4f8fb');
    }, true);
    const rough = canvasTex(S, S, (x) => {
      x.fillStyle = '#222'; x.fillRect(0, 0, S, S);
      x.fillStyle = '#3a3a3a'; x.beginPath(); x.arc(C, C, C * F.field, 0, Math.PI * 2); x.fill(); mark(x, '#151515');
      ring(x, F.field + 0.035, F.gui0, '#5c5c5c'); circleText(x, 40, '#999');
      ring(x, F.gui0, F.gui1, '#333'); guilloche(x, '#1c1c1c', '#666');
    });
    const metal = canvasTex(S, S, (x) => { x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); x.fillStyle = '#1e1e1e'; x.beginPath(); x.arc(C, C, C * F.field, 0, Math.PI * 2); x.fill(); mark(x, '#fff'); });
    const bump = canvasTex(S, S, (x) => {
      x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, S, S);
      x.fillStyle = '#585858'; x.beginPath(); x.arc(C, C, C * F.field, 0, Math.PI * 2); x.fill(); mark(x, '#e6e6e6');
      ring(x, F.field, F.field + 0.035, '#b8b8b8'); circleText(x, 40, '#4a4a4a'); guilloche(x, '#9a9a9a', '#5c5c5c'); ring(x, F.gui1, 1.0, '#ffffff');
    });
    const em = canvasTex(S, S, (x) => { x.fillStyle = '#000'; x.fillRect(0, 0, S, S); mark(x, '#00e4f2'); x.lineWidth = 3; x.strokeStyle = '#006d78'; x.beginPath(); x.arc(C, C, C * F.field - 2, 0, Math.PI * 2); x.stroke(); }, true);
    return new THREE.MeshPhysicalMaterial({ map, roughnessMap: rough, roughness: 1, metalnessMap: metal, metalness: 1, bumpMap: bump, bumpScale: 0.03, clearcoat: 0.6, clearcoatRoughness: 0.05,
      emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 0.8, envMapIntensity: 2.3 });
  };
  let faceMat = makeFaceMat();
  const reedTex = canvasTex(128, 4, (x) => { for (let i = 0; i < 128; i++) { x.fillStyle = i % 4 < 2 ? '#fff' : '#222'; x.fillRect(i, 0, 1, 4); } });
  reedTex.wrapS = THREE.RepeatWrapping; reedTex.repeat.set(32, 1);
  const edgeMat = new THREE.MeshPhysicalMaterial({ color: 0xe9eff5, metalness: 1, roughness: 0.14, clearcoat: 0.6, bumpMap: reedTex, bumpScale: 0.035, envMapIntensity: 2.4 });

  function buildCoin() {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, 160), edgeMat); body.rotation.x = Math.PI / 2; g.add(body);
    [T / 2, -T / 2].forEach(z => { const r = new THREE.Mesh(new THREE.TorusGeometry(R - 0.01, 0.013, 16, 160), chrome); r.position.z = z; g.add(r); });
    const f = new THREE.Mesh(new THREE.CircleGeometry(R * 0.99, 160), faceMat); f.position.z = T / 2 + 0.002; g.add(f);
    const b = new THREE.Mesh(new THREE.CircleGeometry(R * 0.99, 160), faceMat); b.rotation.y = Math.PI; b.position.z = -T / 2 - 0.002; g.add(b);
    return g;
  }
  const coin = buildCoin(); scene.add(coin);

  // ---------- Two glass orbit rings with a thin light line each, tilted like a gyroscope ----------
  const orbits = [{ r: 1.02, tilt: [1.2, 0.0, 0.35], spin: 0.35 }, { r: 1.18, tilt: [1.45, 0.0, -0.5], spin: -0.22 }].map(o => {
    const g = new THREE.Group(); g.rotation.set(...o.tilt);
    const tube = new THREE.Mesh(new THREE.TorusGeometry(o.r, 0.035, 24, 200), glass(0.9)); tube.renderOrder = 4; g.add(tube);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const line = new THREE.Mesh(new THREE.TorusGeometry(o.r, 0.004, 8, 240, Math.PI * 1.25), lineMat); line.renderOrder = 5; g.add(line);
    scene.add(g); return { ...o, g, tube, line, lineMat };
  });

  // ---------- Floor: polished black with a soft pool of light and a mirrored coin as the reflection ----------
  const floorFade = canvasTex(256, 256, (x) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, '#fff'); g.addColorStop(0.45, '#999'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshPhysicalMaterial({ color: 0x06090d, metalness: 0.4, roughness: 0.14, clearcoat: 0.5, clearcoatRoughness: 0.03, envMapIntensity: 0.35, transparent: true, opacity: 0.86, depthWrite: false, alphaMap: floorFade }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = floorY; floor.renderOrder = 1; scene.add(floor);
  const mirror = new THREE.Group(); mirror.scale.y = -1; mirror.position.y = 2 * floorY; scene.add(mirror);
  const coinMirror = buildCoin(); mirror.add(coinMirror);
  const glowTex = canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(120,250,255,0.55)'); g.addColorStop(1, 'rgba(0,242,254,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x00c8e0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = floorY + 0.004; pool.scale.set(3.2, 3.2, 1); pool.renderOrder = 2; scene.add(pool);
  const ringLine = new THREE.Mesh(new THREE.RingGeometry(0.985, 1.0, 160), new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  ringLine.visible = false; ringLine.rotation.x = -Math.PI / 2; ringLine.position.y = floorY + 0.006; ringLine.renderOrder = 2; scene.add(ringLine);

  // ---------- Fine dust that drifts upward ----------
  const ND = 160, dust = new Float32Array(ND * 3), dSeed = [];
  { let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < ND; i++) dSeed.push([(r() - 0.5) * 9, r() * 5, (r() - 0.5) * 6 - 1.5, 0.05 + r() * 0.15]); }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const dustPts = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.035, color: 0x9ff6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(dustPts);

  // ---------- Light sweep: a bright band that crosses the coin face once it settles ----------
  const sweepMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: -1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uK;
      void main(){ vec2 p = vUv - 0.5; if (length(p) > 0.5) discard; float d = dot(p, normalize(vec2(1.0, 0.55))) - uK * 0.8;
        float b = exp(-d * d * 260.0) * 0.55 + exp(-d * d * 30.0) * 0.12; gl_FragColor = vec4(vec3(0.75, 0.97, 1.0) * b, 1.0); }`
  });
  const sweep = new THREE.Mesh(new THREE.CircleGeometry(R * 0.99, 96), sweepMat); sweep.position.z = T / 2 + 0.004; sweep.renderOrder = 6; coin.add(sweep);

  // ---------- Lights ----------
  scene.add(new THREE.HemisphereLight(0x9fdcff, 0x05080c, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(3, 6, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0x4facfe, 1.1); rim.position.set(-6, 2, -4); scene.add(rim);
  const cyan = new THREE.PointLight(0x00f2fe, 0, 5, 2); cyan.position.set(0, floorY + 0.4, 0.8); scene.add(cyan);

  // ---------- Timeline ----------
  const ease = { outQ: t => 1 - Math.pow(1 - t, 4), outC: t => 1 - Math.pow(1 - t, 3), inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, outBack: t => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); } };
  const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const lerp = (a, b, k) => a + (b - a) * k;
  const TL = { streak: [0, 1.6], fly: [0.35, 2.3], rings: [1.5, 2.6], sweep: [2.25, 3.0], text: 2.3, end: 3.2 };

  let layout;
  function computeLayout() {
    const w = innerWidth, h = innerHeight, aspect = w / h, narrow = w <= 760 || aspect < 0.85;
    layout = narrow ? { cam0: new THREE.Vector3(0, 0.6, 15), cam1: new THREE.Vector3(0, 0.45, 9.6), look: new THREE.Vector3(0, 0.15, 0), coinY: 0.35, fov: 38 }
                    : { cam0: new THREE.Vector3(0, 0.5, 11), cam1: new THREE.Vector3(0, 0.38, 6.6), look: new THREE.Vector3(0, 0.05, 0), coinY: 0.12, fov: 30 };
    renderer.setSize(w, h, false); camera.fov = layout.fov; camera.aspect = aspect; camera.updateProjectionMatrix();
    const dist = 30, hh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist; bg.scale.set(hh * aspect * 1.3, hh * 1.3, 1); bgMat.uniforms.uAspect.value = aspect;
  }

  const ptr = { x: 0, y: 0 }, ptrE = { x: 0, y: 0 };
  const onMove = (e) => { ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = -((e.clientY / innerHeight) * 2 - 1); };

  let t = reduce ? TL.end + 1 : 0, exitT = -1, entered = false;
  const exitFrom = { p: new THREE.Vector3(), s: 1, ry: 0 }, exitTo = new THREE.Vector3(), exitCtrl = new THREE.Vector3();
  let exitScale = 0.1;

  function pose(time, now, dt) {
    ptrE.x += (ptr.x - ptrE.x) * Math.min(1, dt * 2.5); ptrE.y += (ptr.y - ptrE.y) * Math.min(1, dt * 2.5);

    // streaks flare at the start, then rest; their origin drifts toward the pointer
    const ks = seg(time, TL.streak[0], TL.streak[1]);
    bgMat.uniforms.uStreak.value = Math.sin(Math.min(1, ks * 1.6) * Math.PI * 0.5) * (1 - ease.outC(seg(time, 0.7, 2.4))) * 1.2 + 0.12;
    bgMat.uniforms.uOrigin.value.set(0.12 + ptrE.x * 0.25, 0.1 + ptrE.y * 0.15);
    bgMat.uniforms.uTime.value = now;

    // the coin flies in from deep in the scene, spinning fast, and slows to face the camera
    const kf = ease.outQ(seg(time, TL.fly[0], TL.fly[1]));
    const idle = time > TL.end && !reduce ? time - TL.end : 0;
    coin.position.set(lerp(1.6, 0, kf), lerp(layout.coinY + 1.4, layout.coinY, ease.outC(seg(time, TL.fly[0], TL.fly[1]))) + Math.sin(idle * 1.3) * 0.06, lerp(-16, 0, kf));
    const spin = (1 - kf) * Math.PI * 9;
    coin.rotation.set(lerp(0.5, -0.04, kf) + ptrE.y * 0.18 * Math.min(1, idle) + Math.sin(idle * 0.8) * 0.03, spin + ptrE.x * 0.38 * Math.min(1, idle) + Math.sin(idle * 0.6) * 0.12 * Math.min(1, idle), lerp(0.4, 0, kf));
    coin.scale.setScalar(lerp(0.6, 1, kf));
    faceMat.emissiveIntensity = 0.7 + 1.6 * Math.exp(-Math.max(0, time - TL.sweep[0]) * 2.5) * (time > TL.sweep[0] ? 1 : 0) + (reduce ? 0 : Math.sin(now * 1.5) * 0.08);

    // reflection follows the coin
    coinMirror.position.copy(coin.position); coinMirror.rotation.copy(coin.rotation); coinMirror.scale.copy(coin.scale);

    // orbit rings grow in around the settled coin and keep turning slowly
    const kr = ease.outBack(seg(time, TL.rings[0], TL.rings[1]));
    orbits.forEach((o, i) => {
      o.g.position.copy(coin.position);
      o.g.scale.setScalar(Math.max(0.001, kr));
      o.g.rotation.z = o.tilt[2] + now * o.spin * (reduce ? 0 : 1);
      o.g.rotation.x = o.tilt[0] + ptrE.y * 0.1;
      o.tube.material.uniforms.uFade.value = seg(time, TL.rings[0], TL.rings[0] + 0.5);
      o.lineMat.opacity = 0.85 * seg(time, TL.rings[0] + 0.2 + i * 0.1, TL.rings[1]);
    });

    // floor light and ring appear as the coin arrives
    const kl = seg(time, TL.fly[1] - 0.6, TL.fly[1] + 0.4);
    pool.material.opacity = 0.32 * kl; pool.position.x = coin.position.x;
    ringLine.material.opacity = 0.5 * seg(time, TL.rings[0], TL.rings[1]); ringLine.scale.setScalar(lerp(0.4, 0.95, ease.outC(seg(time, TL.rings[0], TL.rings[1]))));
    cyan.intensity = 1.6 * kl;

    // light sweep across the face
    const kw = seg(time, TL.sweep[0], TL.sweep[1]);
    sweepMat.uniforms.uK.value = kw > 0 && kw < 1 ? lerp(-0.9, 0.9, ease.inOut(kw)) : -2;

    // dust
    dustPts.material.opacity = 0.55 * seg(time, 0.6, 2.0);
    for (let i = 0; i < ND; i++) { const d = dSeed[i]; dust[i * 3] = d[0] + Math.sin(now * 0.3 + i) * 0.1; dust[i * 3 + 1] = floorY + ((d[1] + now * d[3]) % 5); dust[i * 3 + 2] = d[2]; }
    dustGeo.attributes.position.needsUpdate = true;

    // camera dollies in
    const kc = ease.inOut(seg(time, 0, TL.end));
    camera.position.lerpVectors(layout.cam0, layout.cam1, kc);
    camera.position.x += ptrE.x * 0.25 * Math.min(1, idle); camera.position.y += ptrE.y * 0.12 * Math.min(1, idle);
    camera.lookAt(layout.look);

    if (time >= TL.text) showText();
  }

  // ---------- Get started: the coin spins along an arc into the logo, then the app fades in ----------
  const EXIT = 1.05;
  function startExit() {
    if (exitT >= 0) return;
    if (!onHome || reduce) { onEnter(); return; }
    if (t < TL.end) t = TL.end;
    exitT = 0;
    exitFrom.p.copy(coin.position); exitFrom.s = coin.scale.x; exitFrom.ry = coin.rotation.y;
    const r = root.querySelector('.afl-brand svg').getBoundingClientRect();
    const depth = 5;
    const ndc = new THREE.Vector3(((r.left + r.width / 2) / innerWidth) * 2 - 1, -((r.top + r.height / 2) / innerHeight) * 2 + 1, 0.5).unproject(camera);
    exitTo.copy(camera.position).add(ndc.sub(camera.position).normalize().multiplyScalar(depth));
    const worldPerPx = (2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / innerHeight;
    exitScale = (r.height * 0.86 * worldPerPx) / (2 * R);
    exitCtrl.lerpVectors(exitFrom.p, exitTo, 0.4); exitCtrl.y += 0.8; exitCtrl.z += 0.6;
    root.querySelector('.afl-brand').classList.remove('absorb');
  }
  function exitPose(dt, now) {
    exitT += dt;
    const u = Math.min(1, exitT / EXIT), k = ease.inOut(u), a1 = 1 - k;
    coin.position.set(
      a1 * a1 * exitFrom.p.x + 2 * a1 * k * exitCtrl.x + k * k * exitTo.x,
      a1 * a1 * exitFrom.p.y + 2 * a1 * k * exitCtrl.y + k * k * exitTo.y,
      a1 * a1 * exitFrom.p.z + 2 * a1 * k * exitCtrl.z + k * k * exitTo.z);
    coin.lookAt(camera.position); coin.rotateY(Math.PI * 4 * (1 - ease.outC(u)));
    coin.scale.setScalar(lerp(exitFrom.s, exitScale, k));
    coinMirror.visible = false;
    orbits.forEach(o => { o.g.scale.setScalar(Math.max(0.001, 1 + k * 1.5)); o.tube.material.uniforms.uFade.value = 1 - k; o.lineMat.opacity = 0.85 * (1 - k); });
    pool.material.opacity = 0.32 * (1 - k); ringLine.material.opacity = 0.5 * (1 - k);
    bgMat.uniforms.uStreak.value = 0.12 + Math.sin(u * Math.PI) * 0.9; bgMat.uniforms.uTime.value = now;
    faceMat.emissiveIntensity = 0.8 + 1.8 * k;
    if (u >= 1 && coin.visible) { coin.visible = false; root.querySelector('.afl-brand').classList.add('absorb'); }
    if (exitT > EXIT + 0.35 && !entered) { entered = true; onEnter(); }
  }

  let last = performance.now();
  function frame(n) {
    const dt = Math.min((n - last) / 1000, 1 / 20); last = n;
    const now = n / 1000;
    if (onHome) {
      if (exitT < 0) { t += dt; pose(t, now, dt); } else exitPose(dt, now);
      renderer.render(scene, camera);
    }
    if (!disposed) raf = requestAnimationFrame(frame);
  }

  computeLayout();
  addEventListener('resize', computeLayout);
  addEventListener('pointermove', onMove);
  // redraw the faces once Inter has loaded, so the legend is not drawn in a fallback font
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
    if (disposed) return;
    const old = faceMat; faceMat = makeFaceMat();
    scene.traverse(o => { if (o.material === old) o.material = faceMat; });
    Object.values(old).forEach(v => { if (v && v.isTexture) v.dispose(); }); old.dispose();
  });
  raf = requestAnimationFrame(n => { last = n; frame(n); });

  return {
    startExit,
    setHome(v) { onHome = v; last = performance.now(); },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); clearHead();
      removeEventListener('resize', computeLayout); removeEventListener('pointermove', onMove);
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach(m => { Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
      });
      pmrem.dispose(); renderer.dispose();
    }
  };
}
