"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Billboard } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { ROW_HEIGHT, textBlockSize, nodeRadius } from "@/lib/graph/geometry";
import { damp } from "@/lib/three/anim";
import { nodePosition } from "@/lib/three/nodeRegistry";
import {
  createBadgeTexture,
  createTableNameTexture,
  createTableTexture,
} from "@/lib/three/tableTexture";
import {
  SHELL_FRAGMENT_SHADER,
  SHELL_VERTEX_SHADER,
  createShellUniforms,
} from "@/lib/three/shellMaterial";
import { DIFF_COLOR, HEALTH_COLOR, PALETTE } from "@/lib/theme";
import { tableHealth } from "@/lib/validators/schemaLinter";
import { useSchemaStore } from "@/state/useSchemaStore";
import type { Table } from "@/lib/types";

interface TableNode3DProps {
  table: Table;
  /** table id -> ids of everything it links to, for hover dimming. */
  adjacency: Map<string, Set<string>>;
}

const HIDDEN_OPACITY = 0.04;

/**
 * A table is a glass sphere with its text floating at the centre. The text is
 * fully billboarded, so a column's row sits at a fixed offset along the
 * camera's up axis rather than along world Y — which is how the relation lines
 * work out where to meet the shell.
 */
export default function TableNode3D({ table, adjacency }: TableNode3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<THREE.Mesh>(null);
  const nameRef = useRef<THREE.Mesh>(null);
  const badgeRef = useRef<THREE.Mesh>(null);
  const badgeAnchorRef = useRef<THREE.Group>(null);
  const settled = useRef(false);
  const seeded = useRef(false);

  const size = useMemo(() => textBlockSize(table), [table]);
  const radius = useMemo(() => nodeRadius(table), [table]);
  const health = useMemo(() => tableHealth(table), [table]);
  const accent = table.diffStatus ? DIFF_COLOR[table.diffStatus] : HEALTH_COLOR[health];

  const texture = useMemo(() => createTableTexture(table), [table]);
  const nameTexture = useMemo(() => createTableNameTexture(table), [table]);
  const badgeTexture = useMemo(
    () => (table.warnings.length > 0 ? createBadgeTexture(table.warnings.length, accent) : null),
    [table.warnings.length, accent],
  );

  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => nameTexture.dispose(), [nameTexture]);
  useEffect(() => () => badgeTexture?.dispose(), [badgeTexture]);

  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);
  const selectionColor = useMemo(() => new THREE.Color(PALETTE.selection), []);
  // Stable for the component's life so the shader material is built once. The
  // values are driven per frame through the mesh ref below, not through this.
  const [shellUniforms] = useState(() => createShellUniforms(accent));

  const scratchRef = useRef<{ color: THREE.Color; target: THREE.Vector3 } | null>(null);
  scratchRef.current ??= { color: new THREE.Color(), target: new THREE.Vector3() };
  const scratch = scratchRef.current;

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const store = useSchemaStore.getState();
    const position = store.positions[table.id];
    if (position) {
      scratch.target.set(position[0], position[1], position[2]);
      if (!seeded.current) {
        // Appear at the layout position and grow in. Seeding away from the
        // target would put spheres outside the frame the camera just fitted.
        group.position.copy(scratch.target);
        group.scale.setScalar(0.02);
        seeded.current = true;
      }
      group.position.lerp(scratch.target, 1 - Math.exp(-(settled.current ? 9 : 6) * delta));
      if (!settled.current && group.position.distanceToSquared(scratch.target) < 0.0004) {
        settled.current = true;
      }
      nodePosition(table.id).copy(group.position);
    }

    const hovered = store.hoveredTableId === table.id;
    const selected = store.selectedTableId === table.id;
    const focusId = store.hoveredTableId ?? store.selectedTableId;
    const related = focusId ? (adjacency.get(focusId)?.has(table.id) ?? false) : true;
    const dimmed = Boolean(focusId) && !related;
    const emphasis = hovered || selected;

    scratch.color.copy(selected ? selectionColor : accentColor);
    const blend = 1 - Math.exp(-8 * delta);

    const baseOpacity = table.diffStatus === "removed" ? 0.3 : 0.5;
    const shell = shellRef.current?.material as THREE.ShaderMaterial | undefined;
    if (shell) {
      shell.uniforms.uOpacity.value = damp(
        shell.uniforms.uOpacity.value,
        dimmed ? HIDDEN_OPACITY : emphasis ? 1 : baseOpacity,
        8,
        delta,
      );
      (shell.uniforms.uColor.value as THREE.Color).lerp(scratch.color, blend);
    }

    // Swap the full column list for a big name once a row would be too small to
    // read, so a zoomed-out sphere still says which table it is.
    const perspective = state.camera as THREE.PerspectiveCamera;
    const distance = state.camera.position.distanceTo(group.position);
    const pixelsPerUnit =
      state.size.height /
      (2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov ?? 50) / 2) * Math.max(distance, 0.001));
    const rowPixels = ROW_HEIGHT * pixelsPerUnit;
    const detail = THREE.MathUtils.clamp((rowPixels - 6.5) / 4, 0, 1);
    const visible = dimmed ? 0.1 : 1;

    const label = labelRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (label) label.opacity = damp(label.opacity, visible * detail, 8, delta);

    const name = nameRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (name) name.opacity = damp(name.opacity, visible * (1 - detail), 8, delta);

    const halo = haloRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (halo) {
      // Error shells breathe so a broken table reads at a glance.
      const pulse =
        health === "error" ? 0.16 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 3.4)) : 0;
      halo.opacity = damp(
        halo.opacity,
        dimmed ? 0 : (selected ? 0.3 : hovered ? 0.2 : 0.07) + pulse,
        9,
        delta,
      );
      (halo.color as THREE.Color).lerp(scratch.color, blend);
    }

    group.scale.setScalar(damp(group.scale.x, dimmed ? 0.9 : emphasis ? 1.06 : 1, 9, delta));

    if (badgeAnchorRef.current) {
      // Bob on the anchor, not the mesh: the mesh sits inside a billboard whose
      // rotation would otherwise steer the offset off-axis.
      const bob = Math.sin(state.clock.elapsedTime * 2.2 + table.id.length) * 0.07;
      badgeAnchorRef.current.position.y = radius + 0.55 + bob;
    }
    if (badgeRef.current) {
      const badge = badgeRef.current.material as THREE.MeshBasicMaterial;
      badge.opacity = damp(badge.opacity, dimmed ? 0.08 : 1, 8, delta);
    }
  });

  const layout = useSchemaStore((state) => state.layout);
  useEffect(() => {
    settled.current = false;
  }, [layout]);

  useEffect(() => {
    seeded.current = false;
    settled.current = false;
  }, [table]);

  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    useSchemaStore.getState().hoverTable(table.id);
    document.body.style.cursor = "pointer";
  };

  const handleOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const store = useSchemaStore.getState();
    if (store.hoveredTableId === table.id) store.hoverTable(null);
    document.body.style.cursor = "auto";
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const store = useSchemaStore.getState();
    store.focusTable(table.id);
    // A "removed" diff ghost doesn't exist in the real graph the inspector
    // reads from — selecting it would silently blank the drawer.
    if (table.diffStatus !== "removed") store.selectTable(table.id);
  };

  const handleBadgeClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const store = useSchemaStore.getState();
    store.selectTable(table.id);
    store.openHealth(table.warnings[0]?.id ?? null);
  };

  return (
    <group ref={groupRef}>
      {/* Outer atmosphere, drawn from the inside so it reads as a rim glow. */}
      <mesh ref={haloRef} renderOrder={0} raycast={() => null}>
        <sphereGeometry args={[radius * 1.07, 32, 24]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.1}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* The table's text, floating at the centre of the shell and fully
          camera-facing so it stays square-on from every orbit angle. */}
      <Billboard follow>
        <mesh ref={labelRef} renderOrder={1} raycast={() => null}>
          <planeGeometry args={[size.width, size.height]} />
          <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh ref={nameRef} renderOrder={1} raycast={() => null}>
          <planeGeometry args={[size.width, size.height]} />
          <meshBasicMaterial
            map={nameTexture}
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      </Billboard>

      {/* Fresnel shell: glows at the silhouette, clear through the middle so the
          text reads. Also the hit target. */}
      <mesh
        ref={shellRef}
        renderOrder={2}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[radius, 48, 32]} />
        <shaderMaterial
          uniforms={shellUniforms}
          vertexShader={SHELL_VERTEX_SHADER}
          fragmentShader={SHELL_FRAGMENT_SHADER}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {badgeTexture && (
        <group ref={badgeAnchorRef} position={[0, radius + 0.55, 0]}>
          <Billboard follow>
            <mesh ref={badgeRef} onClick={handleBadgeClick}>
              <planeGeometry args={[0.78, 0.78]} />
              <meshBasicMaterial
                map={badgeTexture}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </Billboard>
        </group>
      )}
    </group>
  );
}
