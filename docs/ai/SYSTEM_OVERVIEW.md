# System Overview

Thought Canvas v12.5 is a local-first single-page application served by `server.mjs` without a build step.

## Main modules

- `app.js`: project state, canvas/dialog rendering, context snapshots, model streaming, language application, browser-boundary text repair, selections, annotations, folding and exports.
- `i18n.js`: Chinese/English/Japanese dictionaries, dynamic pattern translation, DOM localization observer, locale formatting and response-language instructions.
- `text-encoding.js`: conservative Windows-1252-to-UTF-8 recovery for strings and nested data.
- `selection-utils.js`: pure rendered-Markdown-to-source mapping with unknown-range fallback.
- `styles.css`: canvas, independent top modules, unified modal system, language-specific font stacks, annotations, folding and focus behavior.
- `server.mjs`: UTF-8 static/API responses, local projects/backups/settings, encoding migration, API-key providers, security and Codex bridge.
- `thinking-core.js`: goal, context, artifact, relation and decision records.
- `provider-capabilities.js`: discovered model normalization and protocol-specific reasoning parameters.
- `codex-app-server.mjs`: managed Codex App Server lifecycle, OAuth, model discovery, named read-only permissions, streaming, interrupt and output repair.

## Language flow

```text
load local settings.uiLanguage
→ set document.lang and activate UI dictionary
→ localize existing DOM
→ MutationObserver localizes newly rendered UI
→ protected user-content regions remain untouched
→ save language back to data/settings.local.json
→ append selected response-language instruction to new model requests
```

## Encoding flow

```text
UTF-8 static/API boundaries
→ read project/settings/backup or receive request/provider output
→ conservative deep repair
→ if project repair is explicit: backup original + attach migration metadata
→ render readable data
→ next save persists repaired project
```

The repair signature is auditable, but the historical ingress cannot be proven from a screenshot alone.

## Verification map

- `tests/i18n-test.mjs`: dictionaries, patterns, locale and response-language instructions.
- `tests/text-encoding-test.mjs`: screenshot sample, Japanese/double-decoding and false-positive guards.
- `tests/local-api-test.mjs`: UTF-8 headers, disk/settings/backup/provider migration, language persistence and real local security.
- `tests/browser_e2e.py`: live language switching, user-content isolation, browser-side encoding migration and all existing UI workflows.
- Existing selection/core/Codex suites continue to cover trusted reasoning and provider integration.
