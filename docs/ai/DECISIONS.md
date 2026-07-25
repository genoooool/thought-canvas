# Decisions

- Simplified Chinese is the canonical UI source language for v12.6; English and Japanese are runtime dictionaries in `i18n.js`.
- UI language is a global, non-sensitive local setting (`uiLanguage`) and is not project content. It controls app chrome, locale formatting and the default language instruction for new model requests.
- Project titles, user input, model output, annotations, comparison output and reasoning artifacts must never be auto-translated by the UI layer. User content that exactly matches a UI term remains unchanged.
- Runtime DOM localization is incremental through a MutationObserver because the application has no build step and creates most UI dynamically. New UI text must update the dictionary and tests.
- The screenshot pattern is classified as UTF-8 bytes decoded as Windows-1252/CP1252. The exact original ingress is not asserted without the original corrupt file or upstream raw log.
- Encoding repair is conservative: accept a candidate only when mojibake signals fall materially and no replacement character is introduced. Valid multilingual/Latin text is preferred over aggressive conversion.
- Historical project repair creates an `encoding-before-*` backup before write-back and persists repair version, time and cumulative count.
- Repair occurs at both server and browser boundaries. Server repair owns disk/upstream integrity; browser repair protects compatibility with older/mocked responses and passes transport repair counts to project migration through a non-enumerable Symbol.
- Static HTML, JavaScript, JSON and NDJSON responses must declare UTF-8 explicitly.
- Existing v12.4 decisions remain in force: exact/unknown selection provenance, independent top modules, calm pointer focus, application dialogs, annotation semantics, manual annotation positioning and persisted branch folding.
- Incremental canvas placement preserves unrelated stable coordinates. Each new
  `parentId + groupId` unit uses the parent's next semantic column and resolves
  conflicts by translating the whole pending subtree vertically; it never searches
  extra columns to avoid collisions.
- Explicit “自动排布” is the opt-in full-canvas reflow action. Annotation and
  summary/merge nodes are detached layout parents whose child branches begin one
  column to the right and use sibling spacing.
- Main-tree auto-layout uses deterministic per-depth contour packing. Ordinary
  children are always exactly `COLUMN_GAP` to the right of their actual parent;
  a unique child shares the parent's center Y, while multiple children are centered
  using the first and last direct-child centers.
- Decomposition groups (`decomposition:*`) are vertical, ordered columns. Their
  modules share one x coordinate and follow `layoutOrder`, `sectionOrder`,
  `createdAt`, then `id`; each module's own descendants continue to the right.
- Main trees, orphan trees, merge/summary units and annotation units avoid one
  another using whole-subtree vertical translations. Manual annotation roots are
  fixed obstacles. Collision handling cannot create extra semantic columns or tear
  descendants away from their root.
- Layout is deterministic and invariant-checked: no visible-node overlap, no
  ordinary-edge foldback, exact parent-relative columns, stable decomposition order
  and exact coordinate idempotence on a second full-layout run.
- Decomposition intent is handled at the UI boundary after a successful answer:
  explicit wording auto-creates the existing `content_section` decomposition
  nodes, fuzzy multi-angle wording previews proposed titles for confirmation,
  and ordinary questions do not trigger decomposition. This keeps the answer
  model's response plain text while reusing source-fidelity and layout rules.
