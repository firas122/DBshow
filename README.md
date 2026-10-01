# DBShow — 3D database schema visualiser

Turns a SQL DDL dump, a SQLite file or a JSON schema into an interactive, animated 3D
diagram, lints the relationships and flags the ones that look wrong, and can diff two
versions of a schema to show exactly what a migration changed.

Everything is parsed **in the browser** — schemas are never uploaded. The only server
code is a small proxy used when you load a schema by URL (browsers can't fetch arbitrary
origins directly).

## Running it

```bash
npm install     # also copies sql.js into public/sql-wasm/
npm run dev      # http://localhost:3000
```

```bash
npm run build && npm start   # production
npm run lint
```

If `public/sql-wasm/` is ever missing (it's gitignored), restore it with
`node scripts/copy-sql-wasm.mjs`.

## Sample schemas

Four bundled samples cover different scenarios — pick one from the home screen:

| Sample | Tables | What it shows |
| --- | --- | --- |
| E-Commerce | 13 | One deliberate instance of every defect the linter detects |
| Blog Platform | 5 | A v1 → v2 migration pair — use **Compare schemas** to diff them |
| SaaS Platform | 29 | A much larger, fully healthy schema — stress-tests layout at scale |
| Library Catalog | 9 | A normal-sized, fully healthy schema — Health 100, empty ticker |

## Input formats

| Input | How it's read |
| --- | --- |
| `.sql`, `.ddl` | Dialect-tolerant DDL reader: `CREATE TABLE`, inline and table-level constraints, `CREATE INDEX`, `ALTER TABLE … ADD CONSTRAINT`. Handles MySQL backticks, `[bracket]` and `"quoted"` identifiers. |
| `.sqlite`, `.sqlite3`, `.db` | `sql.js` (WebAssembly): reads `sqlite_master`, `PRAGMA table_info`, `PRAGMA foreign_key_list`, `PRAGMA index_list/index_info`. |
| `.json` | Several shapes: `{ tables: [...] }`, a bare array, or `{ "users": { "id": "INTEGER PRIMARY KEY" } }`, with optional top-level `relations`. |
| URL | Fetched through `/api/fetch-schema`, then sniffed as SQLite or text. |

Files with an unknown extension are sniffed by content (SQLite magic bytes, then JSON vs SQL).

Live connection strings (`postgres://…`) can't be opened from a browser; export the schema
first with `pg_dump --schema-only`, `mysqldump --no-data` or `sqlite3 .schema`.

## What the linter checks

Implemented in `src/lib/validators/schemaLinter.ts`. Every finding carries a plain-English
explanation, why it matters, and copyable fix DDL.

- **Dangling reference** *(error)* — an FK targets a table or column that doesn't exist.
- **Type mismatch** *(warning)* — FK and referenced PK fall in different type families
  (`INT` → `UUID`). Types are compared by family, so `INT`/`INTEGER` and SQLite's
  affinity rules don't produce false positives. A narrower text FK than its parent is
  reported separately as a note.
- **Missing index** *(warning)* — an FK column with no index leading on it.
- **Suggested relation** *(warning)* — a column named like a foreign key (`customer_id`,
  `productId`) that resolves to a real table but has no constraint. These are drawn as
  dashed edges.
- **Circular dependency** — reported as an error when every key on the cycle is
  `NOT NULL` (no insertion order exists), a warning when one is nullable, and a note for
  a self-referencing hierarchy.
- **No primary key** *(warning)* and **isolated table** *(note)*.

### Issue ticker

Every warning scrolls across the footer as an issue → fix pair, weighted so errors repeat
more often than notes. Click a chip to fly to that table and expand it in the Health
drawer; double-click to mute it (hides it from the ticker and the score, but leaves it
visible — dimmed — in the Health drawer for later review). Mutes persist in
`localStorage`. The ticker pauses on hover and while any drawer is open.

### Health drawer

Open it from the **Health** button. Shows the overall score (muted warnings excluded),
filterable by severity or by "Muted", with **Copy N fixes** (concatenates every visible
fix into one pasteable script) and **Export report** (downloads a Markdown snapshot).

## Schema diffing

Click **Compare schemas** to diff the loaded schema against an earlier version — the
bundled baseline a sample ships with (Blog Platform does), an uploaded file, or pasted
DDL. Added, removed and modified tables and relations are tinted directly in the 3D
view (green / rose-dashed / violet) and listed with column-level detail in the Diff
drawer. Implemented in `src/lib/diff/schemaDiff.ts`, which builds a union "view graph"
tagged with `diffStatus` so the normal rendering path draws it with no special-casing.

## Shareable links

Loading a bundled sample or a URL, then focusing a table, is reflected in the address bar
as `?sample=`/`?url=` and `&table=`. Copying the link (the share icon in the toolbar) and
opening it elsewhere reproduces the same schema and focused table.

## Language

DBShow is available in **English and French**. Toggle with the language button in
the left-edge tool dock (or the top-right corner of the home screen before a schema is
loaded). This covers every piece of UI chrome as well as the linter's generated warning
titles, messages and suggested fixes — SQL fix snippets themselves are never translated.
The choice persists in `localStorage`; switching language re-lints the already-loaded
schema in place rather than requiring a reload. Implemented in `src/lib/i18n/` (`ui.ts`
for interface strings, `linterText.ts` for the linter's message templates).

## Controls

Drag to orbit, scroll to zoom, click a table to fly to it, click empty space to deselect.
`/` focuses search, `Esc` closes drawers. The toolbar switches between **Force**,
**Sphere** and **Layered** layouts and toggles data-flow particles, edge labels and
auto-rotate.

Navigation is deliberately caged so the diagram never leaves the frame: zoom stops just
past the fit-everything distance and just short of entering a sphere, panning is clamped
to a bubble around the graph, and the camera stops short of the poles. Hitting a limit
feels like a wall rather than a snap-back — the camera and its target move together.

Colours: gold primary keys, cyan healthy foreign keys, pulsing amber for suspect or
suggested relations, pulsing red for errors. A schema diff overrides this with green
(added), rose dashed (removed) and violet (modified).

## Architecture

```
src/
  app/
    page.tsx                   Reads ?sample=/?url=/?table= on load
    api/fetch-schema/          URL-loading proxy
  lib/
    types.ts                   SchemaGraph — the one model everything speaks
    parsers/
      sqlParser.ts            SQL DDL  -> SchemaGraph
      sqliteParser.ts         SQLite   -> SchemaGraph (sql.js / WASM)
      jsonParser.ts           JSON     -> SchemaGraph
      index.ts                dispatch by extension, content sniffing, URL loading
    schema/
      finalize.ts             resolves FK targets, derives isForeignKey / isIndexed
      types-util.ts           SQL type -> type family, compatibility rules
    validators/schemaLinter.ts
    diff/schemaDiff.ts          Two SchemaGraphs -> SchemaDiff + tagged view graph
    i18n/
      ui.ts                    English/French UI string dictionary + useT()
      linterText.ts            English/French linter message templates
    samples/                     Bundled demo schemas (ecommerce, blog, saas, library)
    report.ts                    Markdown health-report export
    graph/
      geometry.ts             text-block metrics, shell radius, column row offsets
      layouts.ts              force (d3-force-3d), sphere, layered
    three/
      tableTexture.ts         draws each table's text to a 2D canvas used as a texture
      nodeRegistry.ts         live sphere positions, so edges stay welded while they move
      anim.ts                 frame-rate independent easing
  components/
    Canvas3D.tsx              <Canvas>, renderer settings
    scene/{Backdrop,CameraRig,SchemaScene}.tsx
    TableNode3D.tsx           one table sphere
    RelationLine3D.tsx        one bezier edge + particles + arrowhead
    IssueTicker.tsx           scrolling issue/fix ticker along the footer
    WarningsDrawer.tsx         health score, mute, copy-fixes, export report
    CompareDrawer.tsx, DiffDrawer.tsx   schema-diff baseline picker + results
    FileUpload.tsx, UIOverlay.tsx, TableInspector.tsx
  state/                      zustand store + loader hook
```

A table is a translucent glass sphere with its text floating at the centre — there is no
card or panel, just glyphs inside the shell. The shell is kept very faint because it is
drawn over the text; a rim glow and a wireframe on the far hemisphere carry the volume
instead.

Four decisions worth knowing about:

**Text is a canvas texture, not 3D text.** Each table's text is drawn with the 2D canvas
API and used as a single transparent texture. That keeps a table to one draw call, renders
the 🔑/🔗 glyphs with the system emoji font, and needs no font file at runtime.

**There are two textures per table, crossfaded by distance.** A transparent texture's thin
glyphs are averaged away by minification mips, so a zoomed-out sphere would look empty.
Once a column row would be under ~7px tall the detailed text fades out and a large
table-name label fades in.

**Spheres publish their animated position to a registry.** They ease toward their layout
target inside their own `useFrame`, so edges can't read the target from the store without
lagging a frame behind the mesh. They read `nodeRegistry` instead.

**Edge endpoints are derived from the camera basis.** The text fully billboards, so a
column's row sits at an offset along the camera's *up* axis rather than world Y. Each edge
recomputes its anchors per frame — offset along camera-up by the row height, then out to
the shell surface by `sqrt(r² - h²)` — so edges stay attached to the right column and slide
around the sphere as you orbit.

**Schema diffs reuse the normal rendering path.** Comparing two schemas builds a single
union `SchemaGraph` (every table/relation from both, tagged `diffStatus`) rather than a
parallel rendering mode — `TableNode3D` and `RelationLine3D` just read that tag to pick a
colour, the same way they already read health status.

## License

MIT © 2026 firas122 — see [LICENSE](./LICENSE).
