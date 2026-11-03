"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/** Direction the light comes from: early-morning sun, low in the south-east (faces seen from the default view are lit). */
export const SUN_DIR = new THREE.Vector3(0.55, 0.6, 0.58).normalize();
/** The moon hangs in the north-east, behind the city as seen from the default view. */
export const MOON_DIR = new THREE.Vector3(0.45, 0.42, -0.79).normalize();

/**
 * Sky dome around the diorama, following the camera (so it is never clipped):
 * - day: blue zenith fading to a warm morning horizon, the sun with its glow,
 *   drifting cumulus clouds lit warm on the sun side
 * - night: deep blue zenith, violet horizon with a warm city glow, twinkling
 *   stars, the moon with a halo, thin moonlit clouds
 * Below the horizon (seen around the edges of the map) there is no dark void:
 * a soft sea of clouds stretches out under the diorama, so the city model
 * floats in the sky. Pure shader, one draw call, no textures.
 */
export function Sky({ dark }: { dark: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false, // drawn first, behind everything
        fog: false,
        uniforms: {
          uTime: { value: 0 },
          uNight: { value: 0 },
          uSun: { value: SUN_DIR.clone() },
          uMoon: { value: MOON_DIR.clone() },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww; // always on the far plane
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uNight;
          uniform vec3 uSun, uMoon;
          varying vec3 vDir;
          float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n2(vec2 p) {
            vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
          }
          float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            // ---- base gradients
            vec3 dayZen = vec3(0.36, 0.64, 0.86), dayHor = vec3(1.0, 0.9, 0.76);
            vec3 nightZen = vec3(0.03, 0.06, 0.17), nightHor = vec3(0.24, 0.17, 0.34);
            float up = pow(clamp(h, 0.0, 1.0), 0.45);
            vec3 day = mix(dayHor, dayZen, up);
            vec3 night = mix(nightHor, nightZen, up);
            // warm glow of the morning sun / of the city lights on the horizon
            float sunAmt = max(dot(d, uSun), 0.0);
            day += vec3(1.0, 0.7, 0.4) * pow(sunAmt, 6.0) * 0.35 * (1.0 - up * 0.6);
            night += vec3(1.0, 0.55, 0.25) * exp(-abs(h) * 9.0) * 0.28;
            // ---- clouds above the horizon (projected on a dome)
            vec2 cp = d.xz / max(h + 0.12, 0.05) * 1.6 + vec2(uTime * 0.004, uTime * 0.002);
            float c = smoothstep(0.52, 0.78, fbm(cp));
            float above = smoothstep(0.0, 0.08, h);
            vec3 dayCloud = mix(vec3(0.97, 0.94, 0.9), vec3(1.0, 0.92, 0.78), sunAmt);
            vec3 nightCloud = vec3(0.16, 0.18, 0.3) + vec3(0.25, 0.27, 0.35) * pow(max(dot(d, uMoon), 0.0), 8.0);
            day = mix(day, dayCloud, c * above * 0.85);
            night = mix(night, nightCloud, c * above * 0.6);
            // ---- sun disc
            day += vec3(1.0, 0.92, 0.75) * smoothstep(0.9993, 0.9997, sunAmt) * (1.0 - c * 0.7);
            // ---- stars and moon (night only)
            vec2 sg = d.xz / (abs(h) + 0.25) * 140.0;
            float st = step(0.996, h21(floor(sg))) * smoothstep(0.05, 0.3, h) * (1.0 - c);
            st *= 0.55 + 0.45 * sin(uTime * 2.0 + h21(floor(sg) + 3.1) * 40.0);
            night += vec3(0.95, 0.95, 1.0) * st;
            float m = dot(d, uMoon);
            night += vec3(1.0, 0.97, 0.88) * smoothstep(0.9988, 0.9992, m);
            night += vec3(0.5, 0.55, 0.75) * pow(max(m, 0.0), 60.0) * 0.5;
            // ---- below the horizon: a soft sea of clouds under the diorama
            vec2 sp = d.xz / max(-h + 0.08, 0.05) * 0.9 + vec2(uTime * 0.003, 0.0);
            float sea = fbm(sp);
            vec3 daySea = mix(vec3(0.86, 0.9, 0.92), vec3(1.0, 0.97, 0.92), smoothstep(0.35, 0.7, sea));
            // night: the clouds under the city are lit from above by its lights (warm violet), not a black void
            vec3 nightSea = mix(vec3(0.27, 0.2, 0.33), vec3(0.47, 0.34, 0.42), smoothstep(0.35, 0.7, sea));
            float below = smoothstep(0.02, -0.06, h);
            day = mix(day, mix(daySea, dayHor, exp(h * 14.0) * 0.6), below);
            night = mix(night, mix(nightSea, vec3(0.55, 0.36, 0.4), exp(h * 10.0) * 0.6), below);
            // colours above are display (sRGB) values: written as they are, no conversion
            gl_FragColor = vec4(mix(day, night, uNight), 1.0);
          }`,
      }),
    [],
  );
  useEffect(() => {
    mat.uniforms.uNight.value = dark ? 1 : 0;
  }, [dark, mat]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((s) => {
    mat.uniforms.uTime.value = s.clock.elapsedTime;
    mesh.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={mesh} material={mat} renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[100, 48, 32]} />
    </mesh>
  );
}
