import * as THREE from "three";

/**
 * Fresnel shell for the table spheres.
 *
 * A wireframe globe reads as a volume but drags lat/long lines straight across
 * the text inside it. This does the same job from the silhouette instead: alpha
 * rises toward grazing angles, so the rim glows and the centre — where the type
 * lives — stays essentially clear.
 */

export const SHELL_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

export const SHELL_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uRimPower;
  uniform float uFill;

  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    float facing = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
    float rim = pow(1.0 - facing, uRimPower);
    gl_FragColor = vec4(uColor, (rim + uFill) * uOpacity);
  }
`;

export interface ShellUniforms {
  uColor: { value: THREE.Color };
  uOpacity: { value: number };
  uRimPower: { value: number };
  uFill: { value: number };
  [uniform: string]: THREE.IUniform;
}

export function createShellUniforms(color: string): ShellUniforms {
  return {
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: 0.55 },
    // Tight enough that the glow hugs the silhouette instead of washing inward.
    uRimPower: { value: 2.6 },
    // Barely-there body tint, so the sphere still reads as a solid at a glance.
    uFill: { value: 0.05 },
  };
}
