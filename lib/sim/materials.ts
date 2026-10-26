import * as THREE from "three";

/**
 * Animated instanced material for people, pets and birds.
 * Per-vertex:  aLimb  (0 rigid; ±1 legs or wings; ±0.6 arms; 0.3 neck)
 *              aTint  (1 = takes the instance colour, e.g. clothing)
 * Per-instance: aPhase (gait phase offset), aMove (0 standing … 1 walking/flapping)
 * Limbs swing in the vertex shader, so animating thousands of instances costs
 * one float per instance per frame on the CPU.
 */
export function limbMaterial(opts: { mode: "walk" | "wing"; freq: number; amp: number; time: { value: number } }) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: opts.mode === "wing" ? THREE.DoubleSide : THREE.FrontSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = opts.time;
    sh.uniforms.uFreq = { value: opts.freq };
    sh.uniforms.uAmp = { value: opts.amp };
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float aLimb; attribute float aTint; attribute float aPhase; attribute float aMove;
        uniform float uTime; uniform float uFreq; uniform float uAmp;`,
      )
      .replace(
        "#include <begin_vertex>",
        opts.mode === "walk"
          ? `#include <begin_vertex>
          if (abs(aLimb) > 0.01) {
            bool arm = abs(aLimb) < 0.9 && abs(aLimb) > 0.4;
            float pivot = arm ? 1.4 : (abs(aLimb) < 0.4 ? 0.95 : 0.82);
            float sw = sin(uTime * uFreq + aPhase) * uAmp * sign(aLimb) * (abs(aLimb) < 0.4 ? 0.0 : 1.0) * aMove;
            // idle: gentle neck bob / arm sway even when standing
            sw += abs(aLimb) < 0.4 ? sin(uTime * 2.3 + aPhase) * 0.25 : sin(uTime * 1.7 + aPhase) * 0.05 * (1.0 - aMove);
            float y = transformed.y - pivot, z = transformed.z;
            float c = cos(sw), s = sin(sw);
            transformed.y = pivot + y * c - z * s;
            transformed.z = y * s + z * c;
          }
          transformed.y += abs(sin(uTime * uFreq + aPhase)) * 0.025 * aMove;`
          : `#include <begin_vertex>
          if (abs(aLimb) > 0.01) {
            float flap = sin(uTime * uFreq + aPhase) * uAmp * aMove + (1.0 - aMove) * 0.08;
            transformed.y += abs(transformed.x) * sin(flap);
            transformed.x *= cos(flap * 0.6);
          }`,
      )
      .replace(
        "#include <color_vertex>",
        `#include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb = color * mix(vec3(1.0), instanceColor.rgb, aTint);
        #endif`,
      );
  };
  return m;
}

/** Adds the per-instance attributes the limb material expects. */
export function addLimbAttributes(mesh: THREE.InstancedMesh, count: number) {
  const phase = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  const move = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  phase.setUsage(THREE.DynamicDrawUsage);
  move.setUsage(THREE.DynamicDrawUsage);
  mesh.geometry.setAttribute("aPhase", phase);
  mesh.geometry.setAttribute("aMove", move);
  return { phase, move };
}
