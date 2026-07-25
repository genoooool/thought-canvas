# v12.6 Continuation Plan

Mode: Complex continuation

## Gate 1 — Interface language infrastructure — PASS

- Add Chinese, English and Japanese choices to Settings → General.
- Apply language changes immediately and persist them in local non-sensitive settings.
- Localize static and dynamic UI, accessibility labels, placeholders, dates and counts.
- Keep project titles, user/model content, annotations and reasoning artifacts outside UI translation.
- Add selected-language instructions to future model requests.

## Gate 2 — Mojibake diagnosis and migration — PASS

- Confirm the screenshot signature as UTF-8 bytes decoded through Windows-1252/CP1252.
- Keep static HTML/JS/JSON/NDJSON explicitly UTF-8.
- Add conservative string/deep-object repair with false-positive guards.
- Repair project, backup, settings, import, request/response and provider/Codex boundaries.
- Create a pre-repair project backup and persist migration metadata.
- Preserve ambiguous or irreversibly damaged text rather than fabricating a repair.

## Gate 3 — Regression and evidence — PASS

- Add pure i18n and encoding tests.
- Extend local HTTP tests for UTF-8 headers, project/settings/backup migration, provider output and language instructions.
- Extend Chromium tests for live Chinese/English/Japanese switching, user-content isolation and browser-side migration persistence.
- Re-run selection, reasoning, API-key, Codex, streaming, annotations, folding, restore and export workflows.

## Gate 4 — Documentation and clean release — PASS

- Synchronize product docs and `docs/ai` memory to v12.6.
- Run the complete worktree suite twice with captured exit status.
- Build a sanitized staging tree and pass the strict package scanner.
- Create the final ZIP, validate integrity, clean-extract it, and rerun scanner plus complete tests.

## Gate 5 — Deterministic semantic-column layout — PASS

- Place each `decomposition:*` group in one ordered vertical column.
- Derive every ordinary child x from its actual parent and semantic depth.
- Pack uneven sibling subtrees with per-depth contours and direct-child centering.
- Resolve cross-tree collisions by deterministic whole-unit vertical translation only.
- Preserve unrelated stable branches during incremental placement and keep manual annotations fixed.
- Prove no overlap, no foldback, exact second-run idempotence and dense nested behavior in pure and Chromium tests.
