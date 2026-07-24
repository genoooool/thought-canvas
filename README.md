# Thought Canvas — Branching AI Conversations and Visual Knowledge Work

<p align="center">
  <a href="README.md"><img alt="English README" src="https://img.shields.io/badge/README-English-2563EB?style=for-the-badge"></a>
  <a href="README.zh-CN.md"><img alt="简体中文 README" src="https://img.shields.io/badge/README-简体中文-374151?style=for-the-badge"></a>
  <a href="README.ja.md"><img alt="日本語 README" src="https://img.shields.io/badge/README-日本語-374151?style=for-the-badge"></a>
</p>

Thought Canvas is a local-first visual AI workspace that turns linear chat into a branching, traceable thinking canvas. Explore several questions without losing them, ask multiple AI models the same question, compare consensus and dissent, synthesize a new branch, and export the result as Markdown for Obsidian or any personal wiki.

If you are looking for a **branching AI chat interface, multi-model answer comparison, visual AI research tool, AI mind map, local-first knowledge management, Codex OAuth client, or Markdown-to-Obsidian workflow**, Thought Canvas is built for that job.

![Thought Canvas demo](docs/assets/thought-canvas-demo.png)

> An expanded research canvas: one question branches into several lines of inquiry, while the side panel preserves the selected node's context, structured content, and follow-up conversation.

## Why Thought Canvas exists

Most AI conversations are still one long vertical transcript.

When an AI produces a long answer, reading it is tiring. More importantly, the answer often raises several questions at once. A linear chat forces you to choose one follow-up. After exploring that path for a while, the other unresolved questions are easy to forget, and useful claims become buried in an ever-growing context window.

A single model also gives you only one framing of the problem. For important research or decisions, you may want Codex, ChatGPT, Claude, Gemini, DeepSeek, or another model to answer the same question. Copying prompts between separate chat windows makes the comparison manual and disconnects the final conclusion from its sources.

Thought Canvas turns that process into an operational map:

- follow up on any passage without losing the rest of the answer;
- keep every unresolved question visible as its own branch;
- ask different models the same question from the same context;
- compare shared conclusions, genuine disagreements, assumptions, and unique insights;
- synthesize selected answers into a new branch that preserves both consensus and objections;
- extract claims, evidence, hypotheses, risks, actions, and decisions from long responses;
- export the result as Markdown for an Obsidian Vault, Git-backed wiki, or another long-term knowledge base.

The result is a closed loop:

```text
Ask a question
    → branch unresolved questions
    → get answers from multiple AI models
    → compare consensus, dissent, and assumptions
    → synthesize a new branch and continue
    → export Markdown to Obsidian / Wiki
    → reuse the knowledge in future research and writing
```

The goal is not to make AI say more. It is to make long answers readable, follow-ups manageable, disagreements explicit, and one-off chats reusable as durable knowledge.

## Highlights

- **Break long answers into manageable questions** — Select any passage and turn it into a question, claim, piece of evidence, hypothesis, option, risk, action, or decision.
- **Explore several follow-ups in parallel** — Each doubt keeps its own conversation path, so going deep on one branch does not erase the others.
- **Compare multiple AI models on the same question** — Create sibling branches from the same context, choose a different provider or model for each, and inspect the answers side by side.
- **Turn consensus and objections into the next branch** — Merge selected answers into a traceable synthesis node that records common ground, disagreements, hidden assumptions, unresolved issues, and next steps.
- **Move from chat to Obsidian or a wiki** — Export the reasoning process and current conclusions as Markdown instead of leaving them locked inside a chat product.
- **Local-first storage** — Projects, settings, recovery versions, and exports stay on your machine. The server listens on `127.0.0.1` by default.
- **Automatic local Codex OAuth detection** — On startup, Thought Canvas launches the local `codex app-server`, reads the Codex CLI login state and model catalog, and syncs available models into the UI.
- **Precise branching** — Start a branch from an exact message boundary; later messages are not silently inherited.
- **Auditable context** — Every generation references an immutable context snapshot, and you can inspect what the model will see.
- **Structured reasoning** — Maintain support, contradiction, and dependency relationships between claims, evidence, assumptions, risks, and decisions.
- **Multiple providers** — Codex App Server, OpenAI Responses/Chat, DeepSeek, Anthropic, Gemini, OpenAI-compatible services, and local model servers.
- **Streaming and recovery** — NDJSON streaming, stop generation, preserve partial answers, continue a message, and restore from the latest 20 recovery versions.
- **Multilingual UI** — Simplified Chinese, English, and Japanese. User content and model output are never translated automatically.

## Quick start

### Requirements

- Node.js 18 or later;
- for Codex: an official Codex CLI version with App Server support;
- for other providers: the corresponding API key and Base URL.

### Install and run

```bash
git clone https://github.com/genoooool/thought-canvas.git
cd thought-canvas
npm start
```

Open [http://127.0.0.1:8787](http://127.0.0.1:8787).

Use another port if necessary:

```bash
PORT=8790 npm start
```

You can also specify the listen address and Codex executable:

```bash
HOST=127.0.0.1 PORT=8790 CODEX_BIN=/path/to/codex npm start
```

## Automatic Codex OAuth detection

Thought Canvas does not ask you to paste a ChatGPT or Codex token into the browser, `.env.local`, or a project file.

At startup:

1. the local server starts `codex app-server`;
2. `account/read` checks the current Codex CLI login state;
3. if you are signed in, `model/list` loads the account's available models;
4. models and reasoning levels are synced into the Thought Canvas selectors;
5. if you are not signed in, **Settings → OAuth** offers the official browser or device-code login flow.

Detection uses `refreshToken: false`. Thought Canvas stores only non-sensitive summaries such as account type, email, plan, and model metadata. OAuth tokens remain managed by the local Codex CLI and are never written to project JSON, exports, or Git.

If Codex is not in `PATH`, set `CODEX_BIN`. An outdated CLI without App Server support will produce an explicit status message in Settings.

## Other model providers

Open **Settings → Providers**, choose a provider, enter the API key, and select **Connect and sync models**. Keys are stored only in local `.env.local`; they do not enter browser storage, projects, backups, or exports.

Supported protocols include:

- Codex App Server with ChatGPT OAuth
- OpenAI Responses
- OpenAI Chat Completions
- Anthropic Messages
- Gemini `generateContent`

Model-level reasoning options are normalized according to each provider's capabilities and request protocol.

## Core workflow

1. Enter a question and choose a provider, model, and reasoning level.
2. Select passages that deserve a follow-up or should become a claim, evidence item, hypothesis, risk, action, or decision.
3. Create separate branches for different questions.
4. To compare models, create sibling branches from the same question and assign a different model to each branch.
5. Select the answers and synthesize them into a new node containing common ground, disagreements, assumptions, unique value, unresolved questions, and next steps.
6. Continue the conversation from that synthesis branch, with a traceable link back to every source answer.
7. Export Markdown to an Obsidian Vault or personal wiki, export JSON/JSON Canvas, or restore an earlier version.

## Who it is for

- people using ChatGPT, Codex, Claude, Gemini, or DeepSeek for research and complex problem solving;
- readers overwhelmed by long AI answers who need to follow up on several passages;
- researchers who want to compare models instead of trusting a single answer;
- people who want to preserve the reasoning process, not just copy the final response;
- Obsidian, Markdown, and personal-wiki users building a long-term knowledge base;
- teams or individuals comparing options, evidence, risks, and decisions.

## Frequently asked questions

### How is Thought Canvas different from ordinary AI chat?

Ordinary chat organizes messages by time. Thought Canvas organizes them by question and context branch. Several doubts can be extracted from one answer, explored independently, compared, and later merged without losing their source paths.

### Can it compare answers from different AI models?

Yes. Start several branches from the same question, choose a different provider or model for each, then select those answer nodes for synthesis. The synthesis prompt explicitly separates shared conclusions, real disagreements, underlying assumptions, unique insights, unresolved issues, and next steps. The resulting node becomes a new branch you can continue.

### Is it an AI mind-mapping tool?

It has a mind-map-like visual structure, but nodes are not static notes. A node can contain conversation history, context snapshots, claims, evidence, relationships, model metadata, and generation records. It is closer to an executable reasoning graph.

### Can I use it with Obsidian?

Yes. Export the current work as Markdown and place it in an Obsidian Vault, Git-backed wiki, or any Markdown knowledge base. The current workflow is export-based; Thought Canvas does not modify your Obsidian repository without your action.

### Does it read or upload my local Codex OAuth token?

No. Thought Canvas uses the official Codex App Server to read login status and model metadata. Tokens remain under Codex CLI management and never enter project files, exports, or Git.

## Local data and security boundaries

Runtime files:

```text
.env.local                         Provider API keys, local only
data/settings.local.json          Non-sensitive settings and model metadata
data/runtime.local.json           Active project pointer
data/projects/*.json              Complete local projects
data/backups/*.json               Latest 20 recovery and migration backups
```

These files are excluded by `.gitignore`. Additional boundaries:

- loopback Host headers only by default;
- mutations require a per-run session token;
- local Origin validation rejects cross-origin writes;
- Codex generation uses the built-in `:read-only` permission profile, with a narrowly scoped compatibility fallback to `sandbox: "read-only"`;
- authorization headers, cookies, tokens, and similar provider secrets are never forwarded to the frontend.

## Development and verification

```bash
# Syntax checks and Node/API tests
npm run test:node

# Full suite, including Chromium UI tests
npm test

# Release package scan
npm run verify:package
```

Coverage includes UI languages, UTF-8 repair and migration, Markdown selections, branching and context snapshots, multi-branch synthesis, provider capabilities, local API boundaries, Codex OAuth/models/streaming/read-only permissions, browser interactions, recovery, and exports.

Further documentation:

- [`START_HERE.md`](START_HERE.md) — shortest startup and manual acceptance path
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture
- [`docs/MERGE_POLICY.md`](docs/MERGE_POLICY.md) — branch comparison and synthesis policy
- [`docs/PROVIDER_CONFIG.md`](docs/PROVIDER_CONFIG.md) — providers and model configuration
- [`docs/OAUTH_DECISION.md`](docs/OAUTH_DECISION.md) — Codex OAuth boundaries
- [`docs/GATES.md`](docs/GATES.md) — verifiable release gates
- [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md) — test evidence
- [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) — known limitations
- [`docs/ai/`](docs/ai/) — project memory for future development

## Project structure

```text
index.html                 Page structure
styles.css                 Visual design
app.js                     Frontend state, canvas interactions, persistence
server.mjs                 Local HTTP/API server and provider routing
codex-app-server.mjs       Codex App Server JSONL client
providers.js               Built-in provider catalog
provider-capabilities.js   Model and reasoning capability normalization
thinking-core.js           Core reasoning-graph data structures
tests/                     Node, API, Codex, and browser tests
docs/                      Design, acceptance, and research documents
```

## Version

The current application version is **v12.5**, represented as `1.2.5` in `package.json`.

## License

This repository does not currently include an open-source license. Add an appropriate `LICENSE` file before redistributing the project under a specific open-source license.
