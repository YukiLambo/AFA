/*
 * GLSL shaders for the A.F.A. visual effects.
 *
 * LIQUID_METAL_FRAG is adapted from "liquid-logo" by Alan Ang (collidingScopes)
 *   https://github.com/collidingScopes/liquid-logo  — MIT License, Copyright (c) 2025 Alan Ang
 *   Changes: removed unused blend modes, added a duotone colour map so the metal matches the
 *   A.F.A. cyan palette, made film grain and brightness configurable, and allowed a fully
 *   opaque mask so the same shader can draw the ambient background.
 *
 * GLASS_FRAG is adapted from "liquid-glass-js" by Armagan Amcalar (dashersw)
 *   https://github.com/dashersw/liquid-glass-js  — MIT License, Copyright (c) 2025 Armagan Amcalar
 *   Changes: samples a live backdrop canvas (updated every frame) instead of a one-time
 *   html2canvas page snapshot, keeps only the rounded-rectangle shape, uses a smaller blur kernel
 *   and a 3x3 sampled tint so it can run every frame, and adds a soft top highlight and a shade
 *   control for text contrast.
 *
 * Full licence texts: THIRD_PARTY_NOTICES.md
 */

export const QUAD_VERT = `
attribute vec2 a_position;
varying vec2 v_texcoord;
void main() {
  v_texcoord = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5); // y grows downwards, like the DOM
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const LIQUID_METAL_FRAG = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_iterations;
uniform float u_scale;
uniform float u_dotFactor;
uniform float u_vOffset;
uniform float u_intensityFactor;
uniform float u_expFactor;
uniform vec3 u_colorFactors;
uniform float u_colorShift;
uniform float u_dotMultiplier;
uniform float u_noiseIntensity;
uniform sampler2D u_logoTexture;
uniform float u_logoInteractStrength;
uniform float u_grain;
uniform float u_brightness;
uniform vec3 u_dark;
uniform vec3 u_mid;
uniform vec3 u_light;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float detectEdges(vec2 uv, float threshold) {
  float dx = 1.0 / u_resolution.x;
  float dy = 1.0 / u_resolution.y;
  vec4 center = texture2D(u_logoTexture, uv);
  vec4 left = texture2D(u_logoTexture, uv - vec2(dx, 0.0));
  vec4 right = texture2D(u_logoTexture, uv + vec2(dx, 0.0));
  vec4 top = texture2D(u_logoTexture, uv - vec2(0.0, dy));
  vec4 bottom = texture2D(u_logoTexture, uv + vec2(0.0, dy));
  float diff = length(center - left) + length(center - right) + length(center - top) + length(center - bottom);
  return smoothstep(0.0, threshold, diff);
}

void main() {
  vec2 r = u_resolution;
  vec2 FC = gl_FragCoord.xy;
  float time = u_time * u_speed;

  vec2 uv = FC.xy / r;
  vec2 logoUV = vec2(uv.x, 1.0 - uv.y);
  float logoAlpha = texture2D(u_logoTexture, logoUV).a;
  if (logoAlpha <= 0.02) discard; // nothing is drawn outside the mask

  float edge = detectEdges(logoUV, 0.2) * u_logoInteractStrength;

  vec2 p = (FC.xy * 2.0 - r) / r.y;
  vec2 l = vec2(0.0);
  l.x += abs(u_dotFactor - dot(p, p)) * u_dotMultiplier;

  vec2 v = p * (1.0 - l.x) / u_scale;
  v += vec2(sin(edge * 10.0), cos(edge * 8.0)) * edge * 20.0;
  float flowNoise = snoise(vec3(p * 2.0, time * 0.15)) * u_noiseIntensity;
  v += vec2(flowNoise, flowNoise * 0.7);

  vec4 o = vec4(0.0);
  for (float i = 0.0; i < 16.0; i++) {
    if (i >= u_iterations) break;
    float idx = i + 1.0;
    vec2 offset = cos(v.yx * idx + vec2(0.0, idx) + time) / idx + u_vOffset;
    if (edge > 0.1) offset *= 1.0 + edge * 4.0; // flow bends around the logo edges
    v += offset;
    o += (sin(vec4(v.x, v.y, v.y, v.x)) + 1.0) * abs(v.x - v.y) * u_intensityFactor;
  }
  if (u_colorShift > 0.0) o = o.wxyz * u_colorShift + o * (1.0 - u_colorShift);

  vec4 expPy = exp(p.y * vec4(u_colorFactors, 0.0));
  float expLx = exp(-u_expFactor * l.x);
  vec4 ratio = expPy * expLx / o;
  vec4 exp2x = exp(2.0 * ratio);
  o = (exp2x - 1.0) / (exp2x + 1.0); // tanh

  // Brand duotone: map the metal's brightness onto dark -> cyan -> white
  float lum = clamp(dot(o.rgb, vec3(0.299, 0.587, 0.114)) * u_brightness, 0.0, 1.0);
  vec3 col = lum < 0.5 ? mix(u_dark, u_mid, lum * 2.0) : mix(u_mid, u_light, (lum - 0.5) * 2.0);
  col += pow(edge * 1.2, 4.0) * vec3(0.6, 0.7, 0.8);                  // metallic edge highlight
  col += (random(FC / 1.5 + time * 0.0004) - 0.6) * u_grain;          // film grain
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), smoothstep(0.02, 0.6, logoAlpha)); // soft, anti-aliased edges
}
`;

export const GLASS_FRAG = `
precision mediump float;

uniform sampler2D u_image;      // the live backdrop canvas
uniform vec2 u_resolution;      // glass element size in CSS pixels
uniform vec4 u_rect;            // element rectangle in backdrop UV space: x, y, width, height
uniform vec2 u_texel;           // 1 / backdrop size in pixels
uniform float u_blurRadius;
uniform float u_borderRadius;
uniform float u_edgeIntensity;
uniform float u_rimIntensity;
uniform float u_baseIntensity;
uniform float u_edgeDistance;
uniform float u_rimDistance;
uniform float u_baseDistance;
uniform float u_cornerBoost;
uniform float u_rippleEffect;
uniform float u_tintOpacity;
uniform float u_highlight;
uniform float u_shade;          // darkens the glass so text on top stays readable
varying vec2 v_texcoord;

float roundedRectDistance(vec2 coord, vec2 size, float radius) {
  vec2 center = size * 0.5;
  vec2 pixelCoord = coord * size;
  vec2 toCorner = abs(pixelCoord - center) - (center - radius);
  float outsideCorner = length(max(toCorner, 0.0));
  float insideCorner = min(max(toCorner.x, toCorner.y), 0.0);
  return outsideCorner + insideCorner - radius;
}

void main() {
  vec2 coord = v_texcoord;
  vec2 textureCoord = u_rect.xy + coord * u_rect.zw;

  // Refraction strongest near the rim, using the shape normal (same model as liquid-glass-js)
  float minDim = min(u_resolution.x, u_resolution.y);
  float distFromEdge = max(-roundedRectDistance(coord, u_resolution, u_borderRadius), 0.0);
  vec2 shapeNormal = normalize(coord - 0.5 + 1e-5);
  float baseIntensity = 1.0 - exp(-distFromEdge * u_baseDistance);
  float edgeIntensity = exp(-distFromEdge * u_edgeDistance);
  float rimIntensity = exp(-distFromEdge * u_rimDistance);
  float totalIntensity = baseIntensity * u_baseIntensity + edgeIntensity * u_edgeIntensity + rimIntensity * u_rimIntensity;
  vec2 refraction = shapeNormal * totalIntensity;

  float cornerDistance = max(min(coord.x, 1.0 - coord.x), min(coord.y, 1.0 - coord.y)) * minDim;
  refraction += shapeNormal * exp(-cornerDistance * 0.3) * u_cornerBoost;
  vec2 perpendicular = vec2(-shapeNormal.y, shapeNormal.x);
  refraction += perpendicular * sin(distFromEdge / minDim * 25.0) * u_rippleEffect * rimIntensity;
  textureCoord += refraction; // offsets are relative to the backdrop size, as in the original

  // Gaussian blur (7x7 disc)
  vec4 color = vec4(0.0);
  float sigma = max(u_blurRadius / 2.0, 0.5);
  vec2 blurStep = u_texel * sigma;
  float totalWeight = 0.0;
  for (float i = -3.0; i <= 3.0; i += 1.0) {
    for (float j = -3.0; j <= 3.0; j += 1.0) {
      float d = length(vec2(i, j));
      if (d > 3.0) continue;
      float w = exp(-(d * d) / 2.0);
      color += texture2D(u_image, textureCoord + vec2(i, j) * blurStep) * w;
      totalWeight += w;
    }
  }
  color /= totalWeight;

  // Light vertical tint, as in the original
  vec3 gradientTint = mix(vec3(1.0), vec3(0.7), coord.y);
  color.rgb = mix(color.rgb, gradientTint, u_tintOpacity);

  // Tint towards the average colour behind the glass (3x3 samples)
  vec3 avg = vec3(0.0);
  for (float x = 0.0; x < 3.0; x += 1.0) {
    for (float y = 0.0; y < 3.0; y += 1.0) {
      avg += texture2D(u_image, u_rect.xy + (vec2(x, y) + 0.5) / 3.0 * u_rect.zw).rgb;
    }
  }
  color.rgb = mix(color.rgb, avg / 9.0, u_tintOpacity * 0.3);

  color.rgb *= 1.0 - u_shade;

  // Soft specular highlight along the top rim
  color.rgb += rimIntensity * u_highlight * (1.0 - coord.y);

  float mask = 1.0 - smoothstep(-1.0, 1.0, roundedRectDistance(coord, u_resolution, u_borderRadius));
  gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), mask);
}
`;

// Glass for many panels in one pass (same refraction model as GLASS_FRAG, adapted from liquid-glass-js).
// Each pixel finds the panel it belongs to, then refracts the live backdrop exactly like a single panel.
// One WebGL context covers every card on screen, instead of one context per card.
export const GLASS_LAYER_MAX = 20;
export const GLASS_LAYER_FRAG = `
precision mediump float;
#define MAX_RECTS ${20}

uniform sampler2D u_image;
uniform vec2 u_viewport;               // viewport size in CSS pixels
uniform vec2 u_texel;                  // 1 / backdrop size in pixels
uniform vec4 u_clip;                   // visible content area: x, y, width, height (CSS px)
uniform vec4 u_rects[MAX_RECTS];       // panel rectangles (CSS px)
uniform float u_radii[MAX_RECTS];      // panel corner radii (CSS px)
uniform int u_count;
uniform float u_blurRadius;
uniform float u_edgeIntensity;
uniform float u_rimIntensity;
uniform float u_baseIntensity;
uniform float u_edgeDistance;
uniform float u_rimDistance;
uniform float u_baseDistance;
uniform float u_cornerBoost;
uniform float u_rippleEffect;
uniform float u_tintOpacity;
uniform float u_highlight;
uniform float u_shade;
varying vec2 v_texcoord;

float roundedRectDistance(vec2 coord, vec2 size, float radius) {
  vec2 center = size * 0.5;
  vec2 pixelCoord = coord * size;
  vec2 toCorner = abs(pixelCoord - center) - (center - radius);
  float outsideCorner = length(max(toCorner, 0.0));
  float insideCorner = min(max(toCorner.x, toCorner.y), 0.0);
  return outsideCorner + insideCorner - radius;
}

void main() {
  vec2 p = v_texcoord * u_viewport;
  if (p.x < u_clip.x || p.y < u_clip.y || p.x > u_clip.x + u_clip.z || p.y > u_clip.y + u_clip.w) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec4 rect = vec4(0.0);
  float radius = 0.0;
  bool found = false;
  for (int i = 0; i < MAX_RECTS; i++) {
    if (i >= u_count) break;
    vec4 r = u_rects[i];
    if (p.x >= r.x && p.y >= r.y && p.x <= r.x + r.z && p.y <= r.y + r.w) {
      rect = r;
      radius = u_radii[i];
      found = true;
      break;
    }
  }
  if (!found) { gl_FragColor = vec4(0.0); return; }

  vec2 size = rect.zw;
  vec2 coord = (p - rect.xy) / size;
  float mask = 1.0 - smoothstep(-1.0, 1.0, roundedRectDistance(coord, size, radius));
  if (mask <= 0.0) { gl_FragColor = vec4(0.0); return; }

  float minDim = min(size.x, size.y);
  float distFromEdge = max(-roundedRectDistance(coord, size, radius), 0.0);
  vec2 shapeNormal = normalize(coord - 0.5 + 1e-5);
  float baseIntensity = 1.0 - exp(-distFromEdge * u_baseDistance);
  float edgeIntensity = exp(-distFromEdge * u_edgeDistance);
  float rimIntensity = exp(-distFromEdge * u_rimDistance);
  vec2 refraction = shapeNormal * (baseIntensity * u_baseIntensity + edgeIntensity * u_edgeIntensity + rimIntensity * u_rimIntensity);
  float cornerDistance = max(min(coord.x, 1.0 - coord.x), min(coord.y, 1.0 - coord.y)) * minDim;
  refraction += shapeNormal * exp(-cornerDistance * 0.3) * u_cornerBoost;
  vec2 perpendicular = vec2(-shapeNormal.y, shapeNormal.x);
  refraction += perpendicular * sin(distFromEdge / minDim * 25.0) * u_rippleEffect * rimIntensity;

  vec2 textureCoord = p / u_viewport + refraction;

  vec4 color = vec4(0.0);
  float sigma = max(u_blurRadius / 2.0, 0.5);
  vec2 blurStep = u_texel * sigma;
  float totalWeight = 0.0;
  for (float i = -3.0; i <= 3.0; i += 1.0) {
    for (float j = -3.0; j <= 3.0; j += 1.0) {
      float d = length(vec2(i, j));
      if (d > 3.0) continue;
      float w = exp(-(d * d) / 2.0);
      color += texture2D(u_image, textureCoord + vec2(i, j) * blurStep) * w;
      totalWeight += w;
    }
  }
  color /= totalWeight;

  vec3 gradientTint = mix(vec3(1.0), vec3(0.7), coord.y);
  color.rgb = mix(color.rgb, gradientTint, u_tintOpacity);
  color.rgb *= 1.0 - u_shade;
  color.rgb += rimIntensity * u_highlight * (1.0 - coord.y);

  gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), mask);
}
`;
