# Changelog

Notable changes to DBShow, newest first.

## Unreleased

- Slowed the issue ticker (roughly 2× the time per item) — it was scrolling
  past faster than it could be read.
- Added two sample schemas: **SaaS Platform** (29 tables, fully healthy —
  a scale stress-test for the layout) and **Library Catalog** (9 tables,
  fully healthy — Health 100, empty ticker).

## French localisation

- DBShow is now available in **English and French** — toggle with the
  language button in the left-edge tool dock (also shown on the home
  screen). Covers every UI string, including the linter's generated warning
  titles, messages and suggestions; SQL fix snippets are never translated.
- The chosen language persists in `localStorage`, re-lints the already
  loaded schema in place (no re-upload needed), and is applied correctly
  even on a cold load of a shared link or bundled sample.

## Blueprint Console redesign

- Full visual rework: ink-navy ground and a single warm marigold accent
  replace the glass-panel / neon-on-black look; severities and schema-diff
  tints read as desaturated ink stamps rather than glowing pills.
- The top bar is now a corner title-block (schema name, source, health
  score and legend in one place); the horizontal icon row is now a
  left-edge vertical tool dock.
- Search is now a `/`-triggered command palette instead of an
  always-visible input. The issue ticker reads as ticket-stub chips, and
  the schema-diff panel is styled as a drafting "change order" sheet.
- Enlarged the far-distance 3D table label (name + column count, shown
  before you get close enough for the full column list) — it was legible
  but small.

## Schema diffing, mutable warnings, shareable links

- **Schema diff**: compare the loaded schema against a bundled or uploaded
  baseline. Added/removed/modified tables and relations are tinted directly
  in the 3D view and listed in a new Diff drawer.
- **Mute warnings** from the ticker (double-click) or the Health drawer;
  mutes persist in `localStorage`, exclude the warning from the score, but
  stay visible (dimmed) for later review.
- Ticker now weights errors to repeat more often than notes, so they aren't
  buried in a long rotation.
- **Copy all fixes** and **Export report** (Markdown) from the Health drawer.
- **Shareable links**: loading a sample/URL schema and focusing a table
  round-trips through `?sample=`/`?url=`/`?table=` query params.
- Added the **Blog Platform** sample (v1/v2 pair) to demo schema diffing.

## Issue ticker

- Added a scrolling issue/fix ticker along the footer, generated from the
  linter's existing warnings. Pauses on hover or while a drawer is open;
  respects `prefers-reduced-motion`. Clicking a chip focuses the table and
  opens the matching warning in the Health drawer.

## Initial release

- SQL DDL, SQLite and JSON parsers into a shared `SchemaGraph` model.
- Animated 3D diagram (Force / Sphere / Layered layouts) with click-to-focus
  camera flight, data-flow particles, and caged orbit navigation.
- Schema linter: dangling references, type mismatches, missing indexes,
  suggested (unconstrained) relations, circular dependencies, missing
  primary keys, isolated tables — each with an explanation and copyable fix
  DDL.
- Table inspector and Health drawer.
- E-Commerce sample schema exercising every linter rule.
