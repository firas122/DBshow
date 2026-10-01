# Changelog

Notable changes to DBShow, newest first.

## Unreleased

- Slowed the issue ticker (roughly 2× the time per item) — it was scrolling
  past faster than it could be read.
- Added two sample schemas: **SaaS Platform** (29 tables, fully healthy —
  a scale stress-test for the layout) and **Library Catalog** (9 tables,
  fully healthy — Health 100, empty ticker).

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
