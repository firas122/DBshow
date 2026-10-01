"use client";

import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { maxNodeRadius, nodeRadius } from "@/lib/graph/geometry";
import { layoutBounds } from "@/lib/graph/layouts";
import { easeInOutCubic } from "@/lib/three/anim";
import { hasNodePosition, nodePosition } from "@/lib/three/nodeRegistry";
import { useSchemaStore } from "@/state/useSchemaStore";

type OrbitControlsRef = ComponentRef<typeof OrbitControls>;

interface Flight {
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  elapsed: number;
  duration: number;
}

/**
 * The cage that keeps the diagram on screen: how far the orbit target may stray
 * from the graph, and how near/far the camera may sit.
 */
interface NavLimits {
  center: THREE.Vector3;
  panRadius: number;
  minDistance: number;
  maxDistance: number;
}

const DEFAULT_DIRECTION = new THREE.Vector3(0.62, 0.42, 1).normalize();

export default function CameraRig() {
  const controlsRef = useRef<OrbitControlsRef>(null);
  const flight = useRef<Flight | null>(null);
  const limits = useRef<NavLimits | null>(null);
  const { camera } = useThree();

  const focus = useSchemaStore((state) => state.focus);
  const resetNonce = useSchemaStore((state) => state.resetNonce);
  const autoRotate = useSchemaStore((state) => state.autoRotate);

  const scratch = useMemo(
    () => ({
      direction: new THREE.Vector3(),
      tablePosition: new THREE.Vector3(),
      position: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      correction: new THREE.Vector3(),
    }),
    [],
  );

  const startFlight = (toPosition: THREE.Vector3, toTarget: THREE.Vector3, duration = 0.95) => {
    const controls = controlsRef.current;
    if (!controls) return;
    flight.current = {
      fromPosition: camera.position.clone(),
      toPosition: toPosition.clone(),
      fromTarget: controls.target.clone(),
      toTarget: toTarget.clone(),
      elapsed: 0,
      duration,
    };
  };

  /**
   * Smallest distance along `direction` at which every table still projects
   * inside the viewport. Fitting the real projected extents rather than a
   * bounding sphere matters because schemas are rarely spherical — a tall,
   * narrow graph would otherwise be framed for its diagonal and look tiny.
   */
  const distanceToFit = (
    center: THREE.Vector3,
    direction: THREE.Vector3,
    points: Array<[number, number, number]>,
    /** Half-size of the largest sphere, so edge tables are not clipped. */
    padding: number,
  ) => {
    if (!(camera instanceof THREE.PerspectiveCamera) || points.length === 0) return 40;

    const forward = direction.clone().normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanHorizontal = tanVertical * camera.aspect;

    const offset = new THREE.Vector3();
    let distance = 0;

    for (const point of points) {
      offset.set(point[0], point[1], point[2]).sub(center);
      const depth = offset.dot(forward);
      const horizontal = Math.abs(offset.dot(right)) + padding;
      const vertical = Math.abs(offset.dot(up)) + padding;
      distance = Math.max(
        distance,
        depth + horizontal / tanHorizontal,
        depth + vertical / tanVertical,
      );
    }

    // A little extra so spheres never tuck under the top bar, which overlays
    // the canvas.
    return Math.max(distance * 1.12, 6);
  };

  /** How close the camera sits when focusing a single table. */
  const focusDistance = (radius: number) => radius * 3.4 + 4;

  /** Frames the whole graph, and recomputes the navigation cage around it. */
  const frameAll = (duration = 1.1) => {
    const { positions, graph } = useSchemaStore.getState();
    const points = Object.values(positions);
    const bounds = layoutBounds(positions);
    const center = new THREE.Vector3(...bounds.center);
    const largestNode = graph ? maxNodeRadius(graph) : 3;
    const smallestNode = graph
      ? graph.tables.reduce((smallest, table) => Math.min(smallest, nodeRadius(table)), Infinity)
      : 3;
    const fitAll = distanceToFit(center, DEFAULT_DIRECTION, points, largestNode * 1.15);

    limits.current = {
      center,
      // Just enough to centre on the outermost table — anything less would
      // fight the focus flight — and no more, so panning can't reach the void.
      panRadius: bounds.radius + largestNode * 0.5,
      // Close enough to read a sphere, never inside one — but never closer than
      // the tightest focus flight wants to sit, or focusing a small table would
      // bounce back out the moment the flight ends.
      minDistance: Math.min(largestNode * 1.9, focusDistance(smallestNode) * 0.9),
      // A little past the fit-everything distance, so the graph can't shrink away.
      maxDistance: fitAll * 1.3,
    };

    const position = center.clone().addScaledVector(DEFAULT_DIRECTION, fitAll);
    startFlight(position, center, duration);
  };

  useEffect(() => {
    // Wait a frame so the layout has been written to the store before framing.
    const id = requestAnimationFrame(() => frameAll(resetNonce <= 1 ? 0.01 : 1.1));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNonce]);

  useEffect(() => {
    if (!focus) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const { positions, graph } = useSchemaStore.getState();
    const table = graph?.tables.find((t) => t.id === focus.tableId);
    if (!table) return;

    if (hasNodePosition(table.id)) scratch.tablePosition.copy(nodePosition(table.id));
    else {
      const stored = positions[table.id] ?? [0, 0, 0];
      scratch.tablePosition.set(stored[0], stored[1], stored[2]);
    }

    // Approach from wherever the camera already is, so focusing feels like a
    // dolly-in rather than a cut to a fixed angle.
    scratch.direction.subVectors(camera.position, controls.target);
    if (scratch.direction.lengthSq() < 0.01) scratch.direction.copy(DEFAULT_DIRECTION);
    scratch.direction.normalize();

    scratch.position
      .copy(scratch.tablePosition)
      .addScaledVector(scratch.direction, focusDistance(nodeRadius(table)));
    startFlight(scratch.position, scratch.tablePosition, 0.9);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const current = flight.current;
    if (current) {
      current.elapsed += delta;
      const t = Math.min(1, current.elapsed / current.duration);
      const eased = easeInOutCubic(t);

      camera.position.lerpVectors(current.fromPosition, current.toPosition, eased);
      controls.target.lerpVectors(current.fromTarget, current.toTarget, eased);
      if (t >= 1) flight.current = null;
    }

    const cage = limits.current;
    if (cage) {
      controls.minDistance = cage.minDistance;
      controls.maxDistance = cage.maxDistance;

      // Panning is clamped to a sphere around the diagram. Shifting the camera
      // by the same correction keeps the view direction and distance intact, so
      // it reads as hitting a wall rather than being yanked back.
      if (!current) {
        scratch.offset.subVectors(controls.target, cage.center);
        const drift = scratch.offset.length();
        if (drift > cage.panRadius) {
          scratch.correction
            .copy(scratch.offset)
            .multiplyScalar(cage.panRadius / drift - 1);
          controls.target.add(scratch.correction);
          camera.position.add(scratch.correction);
        }
      }
    }

    controls.autoRotate = autoRotate && !current;
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.075}
      rotateSpeed={0.65}
      zoomSpeed={0.9}
      panSpeed={0.8}
      autoRotateSpeed={0.45}
      // Stop short of the poles. Straight down or straight up loses the grid
      // and the horizon, which are the only cues for which way is up.
      minPolarAngle={Math.PI * 0.08}
      maxPolarAngle={Math.PI * 0.92}
    />
  );
}
