import * as THREE from "three";

/**
 * Frame-rate independent exponential easing. `lambda` is roughly "how fast",
 * higher converges sooner.
 */
export function damp(current: number, target: number, lambda: number, delta: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * delta));
}

export function dampVector(
  current: THREE.Vector3,
  target: THREE.Vector3,
  lambda: number,
  delta: number,
): void {
  const t = 1 - Math.exp(-lambda * delta);
  current.lerp(target, t);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
