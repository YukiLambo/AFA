// Small WebGL helpers shared by the effect components.

let webglSupport;

// True when the browser can create a WebGL context (checked once, then cached)
export function supportsWebGL() {
  if (webglSupport !== undefined) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    webglSupport = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch (e) {
    webglSupport = false;
  }
  return webglSupport;
}

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
}

export function createContext(canvas, options = {}) {
  try {
    return canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, premultipliedAlpha: false, ...options }) || null;
  } catch (e) {
    return null;
  }
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[A.F.A. effects] shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Compiles a program and binds a full-screen quad to its a_position attribute.
// Returns { program, uniforms } or null when anything fails (the caller then hides the effect).
export function createQuadProgram(gl, vertexSource, fragmentSource, uniformNames) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[A.F.A. effects] program link error:', gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {};
  uniformNames.forEach(name => { uniforms[name] = gl.getUniformLocation(program, name); });
  return { program, uniforms };
}

export function createTexture(gl, source) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  return texture;
}

// Creates a fresh <canvas> inside `container` for one effect lifetime. A new element per mount matters:
// a canvas whose context was released cannot get a working context again (React StrictMode mounts twice).
export function mountCanvas(container, style = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }, style);
  container.appendChild(canvas);
  return canvas;
}

// Frees the GPU context straight away (browsers allow only ~16 live WebGL contexts per page)
export function releaseContext(gl) {
  try {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch (e) { /* already gone */ }
}

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// Liquid-metal looks. Pattern values come from liquid-logo's presets, tuned for this palette.
export const METAL_PRESETS = {
  // Bright chrome with cyan highlights, for the logo
  logo: {
    speed: 0.4, iterations: 15, scale: 3.12, dotFactor: 0.04, dotMultiplier: 0.21, vOffset: 5.1,
    intensityFactor: 0.07, expFactor: 0.2, noiseIntensity: 0.8, colorFactors: [1.1, 0.7, 0.9],
    colorShift: 0.9, logoInteractStrength: 0.4, grain: 0.0, brightness: 0.8,
    dark: hexToRgb('#0a3d55'), mid: hexToRgb('#00d4ee'), light: hexToRgb('#f2feff')
  },
  // Slow, dark flow for the page background
  backdrop: {
    speed: 0.18, iterations: 11, scale: 0.35, dotFactor: 0.28, dotMultiplier: 0.3, vOffset: 4.8,
    intensityFactor: 0.14, expFactor: 0.9, noiseIntensity: 1.2, colorFactors: [0.6, 0.4, 0.8],
    colorShift: 0.4, logoInteractStrength: 0.0, grain: 0.0, brightness: 1.0,
    dark: hexToRgb('#0d1117'), mid: hexToRgb('#0b3a4a'), light: hexToRgb('#1fd6e8')
  }
};

export const METAL_UNIFORMS = [
  'u_resolution', 'u_time', 'u_speed', 'u_iterations', 'u_scale', 'u_dotFactor', 'u_vOffset',
  'u_intensityFactor', 'u_expFactor', 'u_colorFactors', 'u_colorShift', 'u_dotMultiplier',
  'u_noiseIntensity', 'u_logoTexture', 'u_logoInteractStrength', 'u_grain', 'u_brightness',
  'u_dark', 'u_mid', 'u_light'
];

export function setMetalUniforms(gl, u, preset, width, height, seconds) {
  gl.uniform2f(u.u_resolution, width, height);
  gl.uniform1f(u.u_time, seconds);
  gl.uniform1f(u.u_speed, preset.speed);
  gl.uniform1f(u.u_iterations, preset.iterations);
  gl.uniform1f(u.u_scale, preset.scale);
  gl.uniform1f(u.u_dotFactor, preset.dotFactor);
  gl.uniform1f(u.u_vOffset, preset.vOffset);
  gl.uniform1f(u.u_intensityFactor, preset.intensityFactor);
  gl.uniform1f(u.u_expFactor, preset.expFactor);
  gl.uniform3f(u.u_colorFactors, ...preset.colorFactors);
  gl.uniform1f(u.u_colorShift, preset.colorShift);
  gl.uniform1f(u.u_dotMultiplier, preset.dotMultiplier);
  gl.uniform1f(u.u_noiseIntensity, preset.noiseIntensity);
  gl.uniform1i(u.u_logoTexture, 0);
  gl.uniform1f(u.u_logoInteractStrength, preset.logoInteractStrength);
  gl.uniform1f(u.u_grain, preset.grain);
  gl.uniform1f(u.u_brightness, preset.brightness);
  gl.uniform3f(u.u_dark, ...preset.dark);
  gl.uniform3f(u.u_mid, ...preset.mid);
  gl.uniform3f(u.u_light, ...preset.light);
}
