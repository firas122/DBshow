"use client";

import { useEffect, useMemo, useRef } from "react";
import { Html, Line } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { columnRowOffset, nodeRadius, shellRadiusAtHeight } from "@/lib/graph/geometry";
import { damp } from "@/lib/three/anim";
import { nodePosition } from "@/lib/three/nodeRegistry";
import { DIFF_COLOR, HEALTH_COLOR, PALETTE } from "@/lib/theme";
import { useSchemaStore } from "@/state/useSchemaStore";
import type { Relation, Table } from "@/lib/types";

/** Minimal surface of drei's <Line> (a three-stdlib Line2) that we drive imperatively. */
interface LineHandle extends THREE.Object3D {
  geometry: { setPositions: (array: number[]) => void };
  material: THREE.Material & {
    color: THREE.Color;
    opacity: number;
    linewidth: number;
    dashOffset: number;
  };
  computeLineDistances: () => void;
}

interface RelationLine3DProps {
  relation: Relation;
  sourceTable: Table;
  targetTable: Table;
}

const SEGMENTS = 44;
const PARTICLE_COUNT = 5;

/** Stable pseudo-random in [0,1) from the relation id, so parallel edges fan out. */
function hashUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

export default function RelationLine3D({
  relation,
  sourceTable,
  targetTable,
}: RelationLine3DProps) {
  const lineRef = useRef<LineHandle>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const arrowRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const isSelfReference = relation.sourceTable === relation.targetTable;
  const color = relation.diffStatus
    ? DIFF_COLOR[relation.diffStatus]
    : relation.kind === "implicit"
      ? PALETTE.implicit
      : HEALTH_COLOR[relation.health];
  const dashed = relation.kind === "implicit" || relation.diffStatus === "removed";
  const jitter = useMemo(() => hashUnit(relation.id), [relation.id]);

  // Height of the column's row within the card, and the shell's horizontal
  // radius at that height — together they place the endpoint on the sphere's
  // surface, level with the column it represents.
  const sourceOffset = useMemo(
    () => columnRowOffset(sourceTable, relation.sourceColumn),
    [sourceTable, relation.sourceColumn],
  );
  const targetOffset = useMemo(
    () => columnRowOffset(targetTable, relation.targetColumn),
    [targetTable, relation.targetColumn],
  );
  const sourceReach = useMemo(
    () => shellRadiusAtHeight(sourceTable, sourceOffset),
    [sourceTable, sourceOffset],
  );
  const targetReach = useMemo(
    () => shellRadiusAtHeight(targetTable, targetOffset),
    [targetTable, targetOffset],
  );

  // The curve, the scratch vectors and the position buffer are rewritten every
  // frame, so they live in refs (mutable by contract) rather than useMemo.
  const curveRef = useRef<THREE.CubicBezierCurve3 | null>(null);
  curveRef.current ??= new THREE.CubicBezierCurve3(
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  );
  const curve = curveRef.current;

  const scratchRef = useRef<{
    start: THREE.Vector3;
    end: THREE.Vector3;
    direction: THREE.Vector3;
    lateral: THREE.Vector3;
    perpendicular: THREE.Vector3;
    up: THREE.Vector3;
    camUp: THREE.Vector3;
    camRight: THREE.Vector3;
    point: THREE.Vector3;
    tangent: THREE.Vector3;
    midpoint: THREE.Vector3;
    coneAxis: THREE.Vector3;
  } | null>(null);
  scratchRef.current ??= {
    start: new THREE.Vector3(),
    end: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    lateral: new THREE.Vector3(),
    perpendicular: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    camUp: new THREE.Vector3(0, 1, 0),
    camRight: new THREE.Vector3(1, 0, 0),
    point: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    midpoint: new THREE.Vector3(),
    coneAxis: new THREE.Vector3(0, 1, 0),
  };
  const scratch = scratchRef.current;

  const linePointsRef = useRef<number[] | null>(null);
  linePointsRef.current ??= new Array<number>(SEGMENTS * 3).fill(0);
  const linePoints = linePointsRef.current;
  const initialPoints = useMemo(
    () => Array.from({ length: SEGMENTS }, () => new THREE.Vector3()),
    [],
  );

  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3),
    );
    return geometry;
  }, []);

  useEffect(() => () => particleGeometry.dispose(), [particleGeometry]);

  const hoveredRelationId = useSchemaStore((state) => state.hoveredRelationId);
  const showEdgeLabels = useSchemaStore((state) => state.showEdgeLabels);
  const isHovered = hoveredRelationId === relation.id;

  /**
   * Rebuilds the spline from the spheres' live positions.
   *
   * Endpoints sit on the shell surface, level with the column they represent.
   * Because the text billboards to the camera, "level with the column" means an
   * offset along the camera's up axis, not world Y — so the anchors are derived
   * from the camera basis and slide around the shell as you orbit.
   */
  const updateCurve = (camera: THREE.Camera) => {
    const { start, end, direction, lateral, perpendicular, up, camUp, camRight } = scratch;
    const sourcePosition = nodePosition(relation.sourceTable);
    const targetPosition = nodePosition(relation.targetTable);

    const basis = camera.matrixWorld.elements;
    camRight.set(basis[0], basis[1], basis[2]).normalize();
    camUp.set(basis[4], basis[5], basis[6]).normalize();

    if (isSelfReference) {
      // Leave the shell on one side and arc back into the other.
      const shell = nodeRadius(sourceTable);
      start
        .copy(sourcePosition)
        .addScaledVector(camUp, sourceOffset)
        .addScaledVector(camRight, sourceReach);
      end
        .copy(targetPosition)
        .addScaledVector(camUp, targetOffset)
        .addScaledVector(camRight, -targetReach);

      const loop = shell * (1.25 + jitter * 0.5);
      curve.v0.copy(start);
      curve.v1.copy(start).addScaledVector(camRight, loop).addScaledVector(camUp, loop * 0.9);
      curve.v2.copy(end).addScaledVector(camRight, -loop * 0.7).addScaledVector(camUp, loop * 1.3);
      curve.v3.copy(end);
      return;
    }

    // Direction between the spheres with the camera-up component removed, so
    // the endpoint stays on the shell at the column's height.
    lateral.subVectors(targetPosition, sourcePosition);
    lateral.addScaledVector(camUp, -lateral.dot(camUp));
    if (lateral.lengthSq() < 1e-6) lateral.copy(camRight);
    lateral.normalize();

    start
      .copy(sourcePosition)
      .addScaledVector(camUp, sourceOffset)
      .addScaledVector(lateral, sourceReach);
    end
      .copy(targetPosition)
      .addScaledVector(camUp, targetOffset)
      .addScaledVector(lateral, -targetReach);

    direction.subVectors(end, start);
    const distance = direction.length();

    perpendicular.crossVectors(direction, up);
    if (perpendicular.lengthSq() < 1e-6) perpendicular.set(1, 0, 0);
    perpendicular.normalize();

    // Deterministic bow so edges between the same pair of tables stay distinct.
    const bow = distance * (0.1 + jitter * 0.12);
    const lift = distance * 0.06 * (jitter > 0.5 ? 1 : -1);

    curve.v0.copy(start);
    curve.v3.copy(end);
    curve.v1
      .copy(start)
      .addScaledVector(direction, 0.28)
      .addScaledVector(perpendicular, bow)
      .addScaledVector(up, lift);
    curve.v2
      .copy(end)
      .addScaledVector(direction, -0.28)
      .addScaledVector(perpendicular, bow)
      .addScaledVector(up, lift);
  };

  useFrame((state, delta) => {
    updateCurve(state.camera);

    const line = lineRef.current;
    if (line) {
      for (let i = 0; i < SEGMENTS; i += 1) {
        curve.getPoint(i / (SEGMENTS - 1), scratch.point);
        linePoints[i * 3] = scratch.point.x;
        linePoints[i * 3 + 1] = scratch.point.y;
        linePoints[i * 3 + 2] = scratch.point.z;
      }
      line.geometry.setPositions(linePoints);
      if (dashed) line.computeLineDistances();
    }

    const store = useSchemaStore.getState();
    const focusId = store.hoveredTableId ?? store.selectedTableId;
    const touchesFocus =
      !focusId || relation.sourceTable === focusId || relation.targetTable === focusId;
    const highlighted = store.highlightedRelationId === relation.id;
    const emphasised = isHovered || highlighted;

    // Suspect relations breathe so they read as "look at me" without colour alone.
    const unhealthy = relation.health !== "ok" || relation.kind === "implicit";
    const pulse = unhealthy
      ? 0.22 + 0.22 * Math.sin(state.clock.elapsedTime * (relation.health === "error" ? 4.2 : 2.6))
      : 0;

    const targetOpacity = !touchesFocus
      ? 0.05
      : emphasised
        ? 1
        : (relation.kind === "implicit" ? 0.5 : 0.62) + pulse;

    if (line) {
      line.material.opacity = damp(line.material.opacity, targetOpacity, 10, delta);
      line.material.linewidth = damp(
        line.material.linewidth,
        emphasised ? 4.4 : touchesFocus ? 2.2 : 1.2,
        10,
        delta,
      );
      if (dashed) line.material.dashOffset -= delta * 0.4;
    }

    if (arrowRef.current) {
      curve.getPoint(0.965, scratch.point);
      curve.getTangent(0.965, scratch.tangent).normalize();
      arrowRef.current.position.copy(scratch.point);
      arrowRef.current.quaternion.setFromUnitVectors(scratch.coneAxis, scratch.tangent);
      const arrowMaterial = arrowRef.current.material as THREE.MeshBasicMaterial;
      arrowMaterial.opacity = damp(arrowMaterial.opacity, touchesFocus ? (emphasised ? 1 : 0.8) : 0.06, 10, delta);
      const arrowScale = damp(arrowRef.current.scale.x, emphasised ? 1.4 : 1, 10, delta);
      arrowRef.current.scale.setScalar(arrowScale);
    }

    const particles = particlesRef.current;
    if (particles) {
      const material = particles.material as THREE.PointsMaterial;
      const visible = store.showParticles && touchesFocus;
      material.opacity = damp(material.opacity, visible ? (emphasised ? 1 : 0.75) : 0, 9, delta);

      if (material.opacity > 0.01) {
        const attribute = particleGeometry.getAttribute("position") as THREE.BufferAttribute;
        const speed = 0.16 + jitter * 0.05;
        for (let i = 0; i < PARTICLE_COUNT; i += 1) {
          // Data flows from the foreign key toward the primary key it references.
          const t = (state.clock.elapsedTime * speed + i / PARTICLE_COUNT) % 1;
          curve.getPoint(t, scratch.point);
          attribute.setXYZ(i, scratch.point.x, scratch.point.y, scratch.point.z);
        }
        attribute.needsUpdate = true;
      }
    }

    if (groupRef.current && (isHovered || showEdgeLabels)) {
      curve.getPoint(0.5, scratch.midpoint);
      groupRef.current.position.copy(scratch.midpoint);
    }
  });

  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    useSchemaStore.getState().hoverRelation(relation.id);
    document.body.style.cursor = "pointer";
  };

  const handleOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const store = useSchemaStore.getState();
    if (store.hoveredRelationId === relation.id) store.hoverRelation(null);
    document.body.style.cursor = "auto";
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const store = useSchemaStore.getState();
    store.highlightRelation(relation.id);
    if (relation.warnings.length > 0) store.openHealth(relation.warnings[0].id);
    else store.focusTable(relation.targetTable);
  };

  return (
    <group>
      <Line
        ref={lineRef as never}
        points={initialPoints}
        color={color}
        lineWidth={2.2}
        transparent
        opacity={0.62}
        dashed={dashed}
        dashScale={2.4}
        dashSize={0.5}
        gapSize={0.34}
        depthWrite={false}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      />

      <mesh
        ref={arrowRef}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <coneGeometry args={[0.13, 0.4, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} />
      </mesh>

      <points ref={particlesRef} geometry={particleGeometry} raycast={() => null}>
        <pointsMaterial
          color={color}
          size={0.2}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      {(isHovered || showEdgeLabels) && (
        <group ref={groupRef}>
          <Html center distanceFactor={18} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            <div className="whitespace-nowrap rounded-md border border-white/15 bg-slate-950/90 px-2 py-1 text-[11px] font-medium text-slate-200 shadow-lg backdrop-blur">
              <span className="text-cyan-300">
                {sourceTable.name}.{relation.sourceColumn}
              </span>
              <span className="mx-1 text-slate-500">→</span>
              <span className="text-amber-300">
                {targetTable.name}.{relation.targetColumn}
              </span>
              {relation.kind === "implicit" && (
                <span className="ml-1.5 rounded bg-amber-500/20 px-1 text-amber-300">suggested</span>
              )}
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
