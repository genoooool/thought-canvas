# Handoff

Current release: Thought Canvas v12.6.

## Completed implementation

- Canvas annotation modules now show a local-annotation state instead of ordinary
  work/confidence badges, support persisted background-color presets, and use
  grouped source-content actions.
- Canvas selection dragging supports moving multiple selected nodes together.
- `layout-engine.js` now owns a deterministic, DOM-free contour-packing tree
  layout. Every ordinary child is exactly one semantic column to the right of
  its actual parent; unique children share the parent center line.
- A `decomposition:*` group is one ordered vertical column. Sibling subtrees are
  packed by their per-depth contours and recentered using the first and last
  direct-child centers, keeping uneven deep branches compact.
- Full layout places main/orphan trees plus merge, summary and annotation
  subtrees as whole units. Cross-unit conflicts are resolved by the nearest
  deterministic vertical translation, never by adding collision columns.
- Incremental layout fixes unrelated stable coordinates, locally lays out one
  pending `parentId + groupId` subtree and moves that whole unit only along Y.
- Manual annotation roots remain fixed obstacles. Merge and annotation children
  start from their root's actual x and extend right without foldback.
- Prompt intent detection now supports automatic answer decomposition: explicit
  requests such as “帮我拆解” create content-section nodes after the answer
  completes, while softer multi-angle requests show a title preview for
  confirmation. Ordinary questions remain single answer nodes.
- Settings → General supports Simplified Chinese, English and Japanese with immediate preview and local persistence.
- Static/dynamic UI, placeholders, accessibility labels, counts, dates and new-request response language are localized.
- Project/user/model content is isolated from UI translation, including content equal to known UI terms.
- Screenshot mojibake is diagnosed as UTF-8 bytes decoded as Windows-1252/CP1252.
- Conservative repair covers project/index/settings/import/restore/request/response/provider/Codex boundaries.
- Historical project repair creates a pre-repair backup and writes repair audit metadata.
- Browser transport repair counts are retained through project persistence.
- New i18n/encoding tests and extended local/Chromium regressions pass.

## Verification

- `tests/layout-engine-test.mjs` covers mixed-height decomposition groups,
  multi-level chains, nested uneven branches, exact determinism, incremental
  vertical avoidance, merge units and manual annotations.
- Chromium E2E checks world coordinates for vertical decomposition, exact
  parent-relative columns, dense recursive layouts, stable incremental creation,
  summary branches, manual annotations, no DOM overlap and second-run idempotence.
- A local browser smoke check of a real 27-node project found zero visible-node
  overlaps, exact 430px ordinary parent/child column deltas and no coordinate
  changes after a second auto-layout action.
- Node-level and branch-level generation paths both invoke the same guarded
  decomposition flow; explicit requests are capped at eight modules and
  preview titles render one per line.
- Final command logs, sanitized package verification and clean-extract results are
  recorded in `LAYOUT_FIX_REPORT.md` for the v12.6 delivery.

## Durable boundaries

- The screenshot signature identifies Windows-1252 mojibake, but not the exact historical ingress without the original file or upstream raw log.
- Repair remains conservative and keeps ambiguous text unchanged.
- Irreversibly replaced or deleted bytes may require manual recovery from `encoding-before-*` backups.
- Real API-key providers and a real Codex account should each receive one short generation on the target machine because automated tests use local substitutes.
