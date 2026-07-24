# Handoff

Current release: Thought Canvas v12.5.

## Completed implementation

- Canvas annotation modules now show a local-annotation state instead of ordinary
  work/confidence badges, support persisted background-color presets, and use
  grouped source-content actions.
- Canvas selection dragging supports moving multiple selected nodes together.
- Incremental node placement keeps existing coordinates stable, finds the next
  open slot for new parallel nodes, and lays out descendants of annotation and
  summary/merge nodes to the right without overlap.
- Explicit auto-layout now runs a final whole-canvas collision pass after the
  tree, annotation and merge-specific placement passes.
- Settings → General supports Simplified Chinese, English and Japanese with immediate preview and local persistence.
- Static/dynamic UI, placeholders, accessibility labels, counts, dates and new-request response language are localized.
- Project/user/model content is isolated from UI translation, including content equal to known UI terms.
- Screenshot mojibake is diagnosed as UTF-8 bytes decoded as Windows-1252/CP1252.
- Conservative repair covers project/index/settings/import/restore/request/response/provider/Codex boundaries.
- Historical project repair creates a pre-repair backup and writes repair audit metadata.
- Browser transport repair counts are retained through project persistence.
- New i18n/encoding tests and extended local/Chromium regressions pass.

## Verification

- Complete worktree `npm test` passed twice; one captured run was 36.74 seconds.
- Focused `npm run check && npm run test:node` passed after the canvas layout changes.
- Auto-layout regression coverage now checks for overlap both before and after
  adding summary-node branches.
- Local browser smoke verification confirmed the existing summary node and its
  branch render in separate right-side columns without console warnings.
- Sanitized staging and clean ZIP extraction each passed `npm run verify:package` with 59 files.
- ZIP integrity passed `unzip -t`.
- Clean extraction passed complete `npm test` in about 37 seconds.

## Durable boundaries

- The screenshot signature identifies Windows-1252 mojibake, but not the exact historical ingress without the original file or upstream raw log.
- Repair remains conservative and keeps ambiguous text unchanged.
- Irreversibly replaced or deleted bytes may require manual recovery from `encoding-before-*` backups.
- Real API-key providers and a real Codex account should each receive one short generation on the target machine because automated tests use local substitutes.
