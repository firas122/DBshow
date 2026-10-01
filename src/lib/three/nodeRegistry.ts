import * as THREE from "three";

/**
 * Live, per-frame positions of the table cards.
 *
 * Cards ease toward their layout target inside their own useFrame callback, so
 * relation lines cannot read the target from the store — they would lag behind
 * the mesh. Instead each card publishes its animated position here and the
 * lines read from it, which keeps edges welded to the cards while they move.
 */
const positions = new Map<string, THREE.Vector3>();

export function nodePosition(id: string): THREE.Vector3 {
  let vector = positions.get(id);
  if (!vector) {
    vector = new THREE.Vector3();
    positions.set(id, vector);
  }
  return vector;
}

export function hasNodePosition(id: string): boolean {
  return positions.has(id);
}

export function clearNodePositions(): void {
  positions.clear();
}
