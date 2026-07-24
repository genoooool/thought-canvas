# Decisions

- Simplified Chinese is the canonical UI source language for v12.5; English and Japanese are runtime dictionaries in `i18n.js`.
- UI language is a global, non-sensitive local setting (`uiLanguage`) and is not project content. It controls app chrome, locale formatting and the default language instruction for new model requests.
- Project titles, user input, model output, annotations, comparison output and reasoning artifacts must never be auto-translated by the UI layer. User content that exactly matches a UI term remains unchanged.
- Runtime DOM localization is incremental through a MutationObserver because the application has no build step and creates most UI dynamically. New UI text must update the dictionary and tests.
- The screenshot pattern is classified as UTF-8 bytes decoded as Windows-1252/CP1252. The exact original ingress is not asserted without the original corrupt file or upstream raw log.
- Encoding repair is conservative: accept a candidate only when mojibake signals fall materially and no replacement character is introduced. Valid multilingual/Latin text is preferred over aggressive conversion.
- Historical project repair creates an `encoding-before-*` backup before write-back and persists repair version, time and cumulative count.
- Repair occurs at both server and browser boundaries. Server repair owns disk/upstream integrity; browser repair protects compatibility with older/mocked responses and passes transport repair counts to project migration through a non-enumerable Symbol.
- Static HTML, JavaScript, JSON and NDJSON responses must declare UTF-8 explicitly.
- Existing v12.4 decisions remain in force: exact/unknown selection provenance, independent top modules, calm pointer focus, application dialogs, annotation semantics, manual annotation positioning and persisted branch folding.
- Incremental canvas placement preserves existing node coordinates. New nodes search the
  current parent column first (same level, then nearby vertical lanes), then move to a
  later column only when needed; existing nodes are never displaced automatically.
- Explicit “自动排布” is the opt-in full-canvas reflow action. Annotation and
  summary/merge nodes are detached layout parents whose child branches begin one
  column to the right and use sibling spacing.
- Explicit auto-layout finishes with a global collision pass across all visible
  nodes, including annotation and merge descendants; incremental placement does
  not run this pass so existing coordinates remain stable.
