# Tasks

## Completed in v12.5

- [x] Gate 1: Chinese / English / Japanese interface switching, persistence and user-content isolation
- [x] Gate 2: conservative UTF-8/Windows-1252 mojibake repair, migration metadata and pre-repair backups
- [x] Gate 3: pure, local API and Chromium evidence for language/encoding plus full workflow regression
- [x] Gate 4: documentation synchronization, two complete worktree suites, sanitized packaging, ZIP integrity and clean-extract regression

## Completed in v12.6

- [x] Annotation presentation, color presets and source-content action hierarchy
- [x] Multi-select drag movement for canvas nodes
- [x] Incremental whole-unit vertical avoidance that preserves unrelated stable nodes
- [x] Branch placement for annotation and summary/merge nodes, including spaced siblings
- [x] Pure deterministic contour layout with fixed parent-relative semantic columns
- [x] Auto-layout keeps ordered decomposition modules in one vertical column
- [x] Complete subtree avoidance for merge/summary/annotation roots without extra collision columns
- [x] Layout invariants and dense fixtures for no overlap, no foldback, idempotence and manual annotation stability
- [x] Intent-aware answer decomposition: explicit “帮我拆解” requests auto-create content nodes, while fuzzy requests ask for confirmation

## Possible future work

- [ ] Move from runtime source-string dictionaries to stable message IDs if the UI grows substantially
- [ ] Add a translation coverage lint for every newly introduced UI string
- [ ] Add an advanced encoding diagnostic view showing original/repaired text before migration
- [ ] Arbitrary user-created semantic edges between existing nodes
- [ ] Multi-level/bulk folding presets and saved canvas views
- [ ] Rich annotation shapes, images or freehand drawing
- [ ] Full screen-reader and browser-zoom accessibility audit
