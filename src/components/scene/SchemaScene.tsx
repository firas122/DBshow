"use client";

import { useEffect, useMemo } from "react";

import RelationLine3D from "@/components/RelationLine3D";
import TableNode3D from "@/components/TableNode3D";
import { clearNodePositions } from "@/lib/three/nodeRegistry";
import { useActiveGraph } from "@/state/useSchemaStore";

export default function SchemaScene() {
  const graph = useActiveGraph();

  // Adjacency includes each table itself so hover dimming keeps the hovered
  // card at full strength.
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!graph) return map;
    for (const table of graph.tables) map.set(table.id, new Set([table.id]));
    for (const relation of graph.relations) {
      map.get(relation.sourceTable)?.add(relation.targetTable);
      map.get(relation.targetTable)?.add(relation.sourceTable);
    }
    return map;
  }, [graph]);

  const tablesById = useMemo(
    () => new Map((graph?.tables ?? []).map((table) => [table.id, table])),
    [graph],
  );

  useEffect(() => {
    clearNodePositions();
  }, [graph]);

  if (!graph) return null;

  return (
    <group>
      {graph.tables.map((table) => (
        <TableNode3D key={table.id} table={table} adjacency={adjacency} />
      ))}

      {graph.relations.map((relation) => {
        const sourceTable = tablesById.get(relation.sourceTable);
        const targetTable = tablesById.get(relation.targetTable);
        // A reference to a table that was never defined has nothing to draw to;
        // it surfaces as an error badge on the source card instead.
        if (!sourceTable || !targetTable) return null;

        return (
          <RelationLine3D
            key={relation.id}
            relation={relation}
            sourceTable={sourceTable}
            targetTable={targetTable}
          />
        );
      })}
    </group>
  );
}
