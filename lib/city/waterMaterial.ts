import * as THREE from "three";
import { MAX_WAKES } from "@/lib/sim/water";

/**
 * Stylised river water, shared by the city and the buffer band:
 * - ripples: three sine/noise wave sets perturb the shading normal (small
 *   fast ripples, long low swell, slow drifting noise for the current)
 * - colour: soft deeper/lighter patches and faint flow streaks over the base teal
 * - light: low roughness for sun highlights, a Fresnel tint of the sky at
 *   grazing angles and sparse glints on the ripple crests
 * - wakes: every boat (position, heading, speed, size) draws a Kelvin wake —
 *   two foam arms opening at ~19.5° behind it plus churned water in its track —
 *   fading with distance; nothing to allocate per boat, no extra geometry.
 * Uniforms are module-level so the boat simulation can write them every frame.
 */
export const waterUniforms = {
  uTime: { value: 0 },
  uNight: { value: 0 },
  uSky: { value: new THREE.Color("#cfe8e5") },
  /** per boat: x, z, heading (rad), wake strength 0..1 */
  uWakeA: { value: new Float32Array(MAX_WAKES * 4) },
  /** per boat: length, beam, speed, unused */
  uWakeB: { value: new Float32Array(MAX_WAKES * 4) },
  uWakeN: { value: 0 },
};

const NOISE = /* glsl */ `
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1, 0)), u.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), u.x), u.y);
}`;

export function makeWaterMaterial(params: THREE.MeshStandardMaterialParameters = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.14, metalness: 0.12, depthWrite: false, ...params });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, waterUniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWPos;
        uniform float uTime, uNight;
        uniform vec3 uSky;
        uniform vec4 uWakeA[${MAX_WAKES}];
        uniform vec4 uWakeB[${MAX_WAKES}];
        uniform int uWakeN;
        ${NOISE}
        float wakeFoam(vec2 p) {
          float foam = 0.0;
          for (int i = 0; i < ${MAX_WAKES}; i++) {
            if (i >= uWakeN) break;
            vec4 a = uWakeA[i];
            vec4 b = uWakeB[i];
            vec2 d = p - a.xy;
            float reach = b.x * 0.5 + 25.0 + 60.0 * a.w;
            if (dot(d, d) > reach * reach) continue;
            vec2 f = vec2(sin(a.z), cos(a.z));
            float along = dot(d, f);
            float lat = d.x * f.y - d.y * f.x;
            float behind = -along - b.x * 0.45;           // 0 at the stern
            // bow wave hugging the hull
            float hull = length(vec2(along / (b.x * 0.55), lat / (b.y * 0.75)));
            foam += a.w * 0.55 * smoothstep(1.25, 1.0, hull) * smoothstep(0.75, 1.0, hull);
            if (behind < 0.0 || behind > reach) continue;
            float fade = pow(1.0 - behind / reach, 2.0);
            // Kelvin arms (half-angle ~19.5°), widening as they spread
            float arm = abs(abs(lat) - (b.y * 0.5 + behind * 0.354));
            float w = 0.8 + behind * 0.06;
            foam += a.w * fade * exp(-arm * arm / (w * w)) * 0.9;
            // churned water in the track (propeller wash)
            float track = b.y * 0.45 + behind * 0.05;
            foam += a.w * fade * fade * exp(-lat * lat / (track * track)) * 0.7;
          }
          return foam;
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec2 wp0 = vWPos.xz;
        // soft deeper / lighter patches and a faint drift of flow streaks
        float patchN = wNoise(wp0 * 0.006 + vec2(uTime * 0.004, -uTime * 0.003));
        float streak = wNoise(vec2(wp0.x * 0.02 + uTime * 0.05, wp0.y * 0.004)) * wNoise(wp0 * 0.05 - uTime * 0.03);
        diffuseColor.rgb *= 0.9 + patchN * 0.2;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.18 + 0.02, smoothstep(0.55, 0.8, streak) * 0.35);
        float foam = wakeFoam(wp0) * (0.65 + 0.35 * wNoise(wp0 * 0.6 + uTime * 0.8));
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.93, 0.97, 0.96), vec3(0.55, 0.62, 0.7), uNight), clamp(foam, 0.0, 0.85));`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec2 wp = vWPos.xz;
        // small fast ripples + long low swell + slow noise (current)
        float rx = sin(wp.x * 0.2 + uTime * 0.9) + sin(wp.y * 0.28 - uTime * 1.3) * 0.6 + sin((wp.x - wp.y) * 0.55 + uTime * 2.1) * 0.35;
        float rz = cos(wp.y * 0.23 + uTime * 1.1) + cos((wp.x + wp.y) * 0.16 - uTime * 0.7) * 0.5 + cos((wp.x + wp.y) * 0.6 - uTime * 1.9) * 0.3;
        float sw = sin(wp.x * 0.025 + wp.y * 0.018 + uTime * 0.4);
        float cn = wNoise(wp * 0.08 + vec2(uTime * 0.15, uTime * 0.1)) - 0.5;
        float rip = 0.05 + foam * 0.12;
        normal = normalize(normal + (viewMatrix * vec4((rx + sw + cn * 2.0) * rip, 0.0, (rz - sw + cn * 2.0) * rip, 0.0)).xyz);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
        totalEmissiveRadiance += uSky * fres * (0.32 - 0.18 * uNight);
        float glint = smoothstep(0.93, 1.0, wNoise(vWPos.xz * 0.9 + uTime * vec2(0.6, -0.4))) * (0.25 + fres);
        totalEmissiveRadiance += mix(vec3(1.0, 0.95, 0.82), vec3(0.6, 0.7, 0.95), uNight) * glint * (0.35 - 0.2 * uNight);`,
      );
  };
  // one compiled program shared by every water material
  m.customProgramCacheKey = () => "sg3d-water";
  return m;
}

/** Vehicle and boat lights glow at night: trim vertices in the headlight / tail-light colours become emissive. */
export function makeLightsMaterial(params: THREE.MeshStandardMaterialParameters = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, ...params });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = waterUniforms.uNight;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        #ifdef USE_COLOR
        float head = step(0.97, vColor.r) * step(0.85, vColor.g) * step(0.45, vColor.b) * step(vColor.b, 0.65);
        float tail = step(0.6, vColor.r) * step(vColor.g, 0.06) * step(vColor.b, 0.05);
        totalEmissiveRadiance += uNight * (head * vec3(3.0, 2.6, 1.8) + tail * vec3(2.6, 0.3, 0.15));
        #endif`,
      );
  };
  m.customProgramCacheKey = () => "sg3d-lights";
  return m;
}
