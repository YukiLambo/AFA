// The A.F.A. entry scene: hairline strands of light pour down onto a dark, brushed-metal floor that
// mirrors them. The pour lasts about two seconds and then settles to a calm, slow shimmer, and the headline
// fades in. "Get started" brightens the scene, fades it out and hands over to the app.
// Plain WebGL 1 with one full-screen triangle: no 3D library, no network request.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uT;      // seconds since the scene started
uniform vec2 uPtr;     // eased pointer, same units as p
uniform float uExit;   // 0 -> 1 while leaving

const float HZ = -0.22;              // the floor line
const vec3 BG = vec3(0.043, 0.059, 0.082);

float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }

// Light strands above the floor. p.y > HZ.
vec3 strands(vec2 p) {
  float d = p.y - HZ;
  // strands lean slightly toward the pointer and spread out a little as they fall
  float x = (p.x - uPtr.x * 0.06 * d) * (1.0 + d * 0.3);
  float cx = x * 84.0;
  float id = floor(cx);
  float f = fract(cx) - 0.5;
  float r = h11(id + 7.0);
  if (r < 0.55) return vec3(0.0);
  float w = 0.07 + 0.08 * h11(id * 3.1);
  float line = 1.0 - smoothstep(0.0, w, abs(f));

  float speed = 1.5 + 0.9 * h11(id * 1.7);
  float delay = h11(id * 5.3) * 0.45;
  float front = 1.15 - max(uT - delay, 0.0) * speed;        // height of the falling head
  float lit = smoothstep(front - 0.02, front + 0.16, p.y);  // the part the head has already passed is lit
  float head = exp(-abs(p.y - front) * 38.0) * step(HZ, front);
  float pulse = 0.12 + 0.88 * pow(0.5 + 0.5 * sin((p.y + uT * 0.35 * speed) * 5.0 + r * 40.0), 4.0);  // light running down each strand
  float topFade = 1.0 - smoothstep(-0.05, 0.95, p.y);
  float settle = mix(1.0, 0.45, smoothstep(1.8, 3.2, uT));  // bright pour, then calm

  float k = line * (lit * pulse * topFade * settle + head * 1.6);
  vec3 col = mix(vec3(0.0, 0.78, 1.0), vec3(0.32, 0.62, 1.0), h11(id * 9.7));
  return col * k;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 col = BG + vec3(0.0, 0.03, 0.05) * exp(-abs(p.y - HZ) * 3.0);

  // where the light lands: a glow along the floor line that flares on impact and then rests
  float impact = smoothstep(0.55, 0.95, uT);
  float flare = impact * (0.5 + 1.2 * exp(-max(uT - 0.95, 0.0) * 2.2));
  float spread = exp(-abs(p.x) * (1.2 - 0.6 * impact));
  float glowLine = exp(-abs(p.y - HZ) * 70.0) * flare * spread;

  if (p.y >= HZ) {
    col += strands(p);
  } else {
    float depth = HZ - p.y;
    // mirror image, gently rippled, with a slight colour split like light on brushed steel
    float wob = 0.0025 * sin(p.y * 90.0 + uT * 1.4) * (0.3 + depth * 3.0);
    vec2 q = vec2(p.x + wob, 2.0 * HZ - p.y);
    float ca = 0.002 + 0.012 * depth;
    vec3 refl = vec3(strands(q + vec2(ca, 0.0)).r, strands(q).g, strands(q - vec2(ca, 0.0)).b);
    col += refl * 0.34 * exp(-depth * 3.2);
    // fine horizontal grain of the metal, picked out by the glow
    float grain = h21(vec2(floor(p.x * 36.0 + h11(floor(p.y * 900.0)) * 9.0), floor(p.y * 900.0)));
    col += vec3(0.55, 0.72, 0.85) * (grain - 0.5) * 0.035 * (0.35 + flare * spread);
    // one ring that runs out across the floor when the light lands
    float ring = length(vec2(p.x, depth * 3.4));
    float age = uT - 0.95;
    col += vec3(0.0, 0.7, 1.0) * exp(-abs(ring - age * 0.8) * 26.0) * step(0.0, age) * exp(-age * 1.4) * 0.35;
  }
  col += vec3(0.25, 0.85, 1.0) * glowLine * 0.9;

  // soft light under the pointer
  col += vec3(0.0, 0.5, 0.7) * exp(-length(p - uPtr) * 5.0) * 0.05;

  // leaving: a short brightening, then fade to the background
  col *= 1.0 + 1.6 * uExit * (1.0 - uExit);
  col = mix(col, BG, smoothstep(0.45, 1.0, uExit));

  // gentle tone map, vignette and dither
  col = 1.0 - exp(-col * 1.25);
  col *= 1.0 - 0.35 * dot(p * 0.7, p * 0.7);
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function startLandingScene(root, { onEnter }) {
  const $ = id => root.querySelector('#afl-' + id);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, disposed = false, onHome = true;
  let timers = [];

  // Headline: each letter fades in with a brief glow, left to right
  const headEl = $('headline'), headText = 'Your personal financial assistant';
  let shown = false;
  function showText() {
    if (shown || !headEl) return;
    shown = true;
    headEl.setAttribute('aria-label', headText);
    headEl.textContent = '';
    const spans = [...headText].map(ch => {
      const sp = document.createElement('span');
      sp.className = 'ch'; sp.setAttribute('aria-hidden', 'true');
      sp.textContent = ch === ' ' ? ' ' : ch;
      headEl.appendChild(sp); return sp;
    });
    headEl.classList.add('on');
    spans.forEach((sp, i) => {
      if (reduce) { sp.classList.add('live', 'done'); return; }
      timers.push(setTimeout(() => sp.classList.add('live'), i * 28));
      timers.push(setTimeout(() => sp.classList.add('done'), i * 28 + 260));
    });
  }
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  const canvas = $('scene');
  const gl = canvas && (canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }) || canvas.getContext('experimental-webgl'));
  const fallback = () => {
    showText();
    return { startExit: () => onEnter(), setHome() {}, dispose() { clearTimers(); } };
  };
  if (!gl) return fallback();

  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return fallback();
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return fallback();
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const u = name => gl.getUniformLocation(prog, name);
  const uRes = u('uRes'), uT = u('uT'), uPtr = u('uPtr'), uExit = u('uExit');

  const SETTLED = 3.4;               // the pour is over by then
  let t = reduce ? SETTLED : 0, exitT = -1, entered = false, last = performance.now();
  const ptr = { x: 0, y: 0 }, ptrEase = { x: 0, y: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    if (reduce) draw();
  }
  function onMove(e) {
    const h = canvas.clientHeight || 1;
    ptr.x = (e.clientX - canvas.clientWidth / 2) / h;
    ptr.y = -(e.clientY - h / 2) / h;
  }
  function draw() {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uT, t);
    gl.uniform2f(uPtr, ptrEase.x, ptrEase.y);
    gl.uniform1f(uExit, exitT < 0 ? 0 : Math.min(1, exitT / EXIT));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const EXIT = 0.7;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 15);
    last = now;
    if (onHome) {
      t += dt;
      ptrEase.x += (ptr.x - ptrEase.x) * Math.min(1, dt * 3);
      ptrEase.y += (ptr.y - ptrEase.y) * Math.min(1, dt * 3);
      if (t > 1.3) showText();
      if (exitT >= 0) {
        exitT += dt;
        if (exitT > EXIT * 0.55) root.querySelector('.afl-brand')?.classList.add('absorb');
        if (exitT > EXIT && !entered) { entered = true; onEnter(); }
      }
      draw();
    }
    if (!disposed) raf = requestAnimationFrame(frame);
  }

  function startExit() {
    if (exitT >= 0) return;
    if (!onHome || reduce) { onEnter(); return; }
    exitT = 0;
  }

  resize();
  addEventListener('resize', resize);
  addEventListener('pointermove', onMove);
  if (reduce) { showText(); draw(); }
  else raf = requestAnimationFrame(n => { last = n; frame(n); });

  return {
    startExit,
    setHome(v) { onHome = v; last = performance.now(); },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); clearTimers();
      removeEventListener('resize', resize); removeEventListener('pointermove', onMove);
      gl.deleteBuffer(buf); gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
    }
  };
}
