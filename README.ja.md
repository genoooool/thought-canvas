# Thought Canvas — 分岐型AI対話とビジュアル知識キャンバス

<p align="center">
  <a href="README.md"><img alt="English README" src="https://img.shields.io/badge/README-English-374151?style=for-the-badge"></a>
  <a href="README.zh-CN.md"><img alt="简体中文 README" src="https://img.shields.io/badge/README-简体中文-374151?style=for-the-badge"></a>
  <a href="README.ja.md"><img alt="日本語 README" src="https://img.shields.io/badge/README-日本語-2563EB?style=for-the-badge"></a>
</p>

Thought Canvasは、直線的なAIチャットを、分岐・追跡・比較・整理できる思考キャンバスへ変えるローカルファーストのビジュアルAIワークスペースです。同じ問いに複数のAIモデルで回答させ、共通認識と反対意見を比較し、それらを新しい分岐へ統合して議論を続けられます。結果はMarkdownとしてObsidianや個人Wikiへ書き出せます。

**分岐型AIチャット、複数AIモデルの回答比較、AIマインドマップ、ビジュアルAIリサーチ、ローカルファーストな知識管理、Codex OAuthクライアント、Markdown/Obsidianワークフロー**を探している人のためのツールです。

![Thought Canvas デモ](docs/assets/thought-canvas-demo.png)

> 展開されたリサーチキャンバス。中央の問いから複数の調査ルートが分岐し、右側のパネルには選択中ノードの文脈、構造化された内容、追加質問が表示されます。

## Thought Canvasを作った理由

多くのAI対話は、今も縦に伸び続ける一本の履歴です。

AIが長い回答を返すと、読むだけでも疲れます。さらに、その回答の複数箇所に同時に疑問が生まれることがあります。しかし直線的なチャットでは、まず一つの疑問を選んで追質問するしかありません。その分岐を深く掘り下げているうちに、ほかの未解決の疑問を忘れ、有用な主張も長い履歴の中へ埋もれてしまいます。

一つのモデルから得られるのは、一つの見方だけです。重要な調査や意思決定では、Codex、ChatGPT、Claude、Gemini、DeepSeekなどに同じ問いを投げ、回答を比較したいことがあります。複数のチャット画面へプロンプトをコピーする方法では、比較が手作業になり、最終結論と元回答とのつながりも失われます。

Thought Canvasは、この過程を操作可能な思考マップに変えます。

- 回答中の任意の箇所を個別に追質問し、ほかの内容を失わない。
- 未解決の疑問をそれぞれ独立した分岐として残す。
- 同じ文脈から、複数のAIモデルに同じ問いを回答させる。
- 共通結論、本質的な相違、前提、各回答だけの洞察を比較する。
- 共通認識と反対意見を追跡可能な新ノードへ統合し、その分岐から対話を続ける。
- 長い回答から主張、証拠、仮説、リスク、行動、意思決定を抽出する。
- 結果をMarkdownとしてObsidian Vault、Git管理のWiki、長期知識ベースへ保存する。

ワークフローは一つの循環になります。

```text
問いを立てる
    → 未解決の疑問を分岐する
    → 複数のAIモデルが同じ文脈から回答する
    → 共通認識・反対意見・前提を比較する
    → 新しい分岐へ統合して推論を続ける
    → MarkdownをObsidian / Wikiへ書き出す
    → 次の調査や執筆の長期的な文脈として再利用する
```

目的は、AIにより多く語らせることではありません。長い回答を読みやすくし、複数の疑問を管理し、意見の相違を明確にし、一度きりの対話を再利用可能な知識へ変えることです。

## 主な特徴

- **長い回答を扱いやすい問いへ分解** — 任意の文章を選択し、質問、主張、証拠、仮説、選択肢、リスク、行動、意思決定へ変換できます。
- **複数の追質問を並行して探索** — 疑問ごとに独立した会話経路を持つため、一つを深掘りしてもほかの疑問を失いません。
- **同じ問いを複数モデルで比較** — 同じ文脈から兄弟分岐を作り、分岐ごとに異なるプロバイダーやモデルを選択できます。
- **合意と反対意見を次の分岐へ統合** — 複数の回答から、共通点、本質的な相違、背後の前提、未解決事項、次のステップを含む統合ノードを生成できます。
- **チャットからObsidian/Wikiへ** — 思考過程と現在の結論をMarkdownで書き出し、チャット製品の中に閉じ込めません。
- **ローカルファースト** — プロジェクト、設定、復元履歴、エクスポートはローカルに保存されます。既定では`127.0.0.1`だけをリッスンします。
- **ローカルCodex OAuthの自動検出** — 起動時に`codex app-server`を開始し、Codex CLIのログイン状態と利用可能モデルをUIへ同期します。
- **正確な分岐** — 特定メッセージの時点から分岐し、それ以降のメッセージを暗黙に継承しません。
- **監査可能なコンテキスト** — 各生成は不変のコンテキストスナップショットを参照し、モデルが見る内容を確認できます。
- **構造化された推論** — 主張、証拠、仮説、リスク、意思決定の間に「支持・反論・依存」関係を持たせられます。
- **複数プロバイダー** — Codex App Server、OpenAI Responses/Chat、DeepSeek、Anthropic、Gemini、OpenAI互換サービス、ローカルモデルに対応します。
- **ストリーミングと復元** — NDJSONストリーミング、生成停止、部分回答の保持、続きの生成、直近20件の復元履歴に対応します。
- **多言語UI** — 簡体字中国語、英語、日本語。ユーザー内容やモデル出力を自動翻訳しません。

## クイックスタート

### 必要な環境

- Node.js 18以降。
- Codexを使う場合：App Server対応の公式Codex CLI。
- その他のプロバイダーを使う場合：対応するAPI KeyとBase URL。

### インストールと起動

```bash
git clone https://github.com/genoooool/thought-canvas.git
cd thought-canvas
npm start
```

[http://127.0.0.1:8787](http://127.0.0.1:8787)を開きます。

ポートを変更する場合：

```bash
PORT=8790 npm start
```

リッスンアドレスとCodex実行ファイルも指定できます。

```bash
HOST=127.0.0.1 PORT=8790 CODEX_BIN=/path/to/codex npm start
```

## Codex OAuthの自動検出

Thought Canvasでは、ChatGPT/Codexのトークンをブラウザ、`.env.local`、プロジェクトファイルへ貼り付ける必要はありません。

起動時の流れ：

1. ローカルサーバーが`codex app-server`を起動する。
2. `account/read`でCodex CLIのログイン状態を確認する。
3. ログイン済みなら`model/list`から利用可能モデルを取得する。
4. モデルと推論レベルをThought Canvasの選択欄へ同期する。
5. 未ログインの場合は「設定 → OAuth」から公式ブラウザ認証またはデバイスコード認証を行う。

検出には`refreshToken: false`を使用し、トークンを能動的に更新しません。Thought Canvasが保存するのは、アカウント種別、メール、プラン、モデル情報などの非機密な要約だけです。OAuthトークンはCodex CLIが管理し、プロジェクトJSON、エクスポート、Gitには書き込まれません。

Codexが`PATH`にない場合は`CODEX_BIN`を設定してください。App Server非対応の古いCLIの場合、設定画面に検出結果が表示されます。

## その他のモデルプロバイダー

「設定 → プロバイダー」でプロバイダーを選び、API Keyを入力して「接続してモデルを同期」を実行します。キーはローカルの`.env.local`だけに保存され、ブラウザストレージ、プロジェクト、バックアップ、エクスポートには入りません。

対応プロトコル：

- Codex App Server（ChatGPT OAuth）
- OpenAI Responses
- OpenAI Chat Completions
- Anthropic Messages
- Gemini `generateContent`

モデルごとの推論オプションは、プロバイダーの能力とリクエスト方式に合わせて正規化されます。

## 基本ワークフロー

1. 問いを入力し、プロバイダー、モデル、推論レベルを選択する。
2. 追質問したい箇所や保存したい文章を選択し、質問、主張、証拠、仮説、リスク、行動、意思決定へ変換する。
3. 疑問ごとに別の分岐を作成する。
4. モデルを比較する場合、同じ問いから兄弟分岐を作り、それぞれ異なるモデルを指定する。
5. 回答ノードを選択して統合し、共通認識、反対意見、前提、独自の価値、未解決事項、次のステップを抽出する。
6. 統合ノードから対話を続け、すべての元回答への追跡可能な関係を保持する。
7. MarkdownをObsidian Vaultや個人Wikiへ書き出す。完全なJSON、JSON Canvasの出力や履歴からの復元も可能。

## 想定ユーザー

- ChatGPT、Codex、Claude、Gemini、DeepSeekで調査や複雑な問題解決を行う人。
- 長いAI回答に圧倒され、複数箇所を個別に追質問したい人。
- 単一モデルだけを信頼せず、複数モデルを比較したい研究者。
- 最終回答だけでなく、推論過程も残したい人。
- Obsidian、Markdown、個人Wikiで長期知識ベースを構築する人。
- 選択肢、証拠、リスク、意思決定を比較したい個人やチーム。

## よくある質問

### 通常のAIチャットと何が違いますか？

通常のチャットはメッセージを時系列で整理します。Thought Canvasは問いと文脈の分岐で整理します。一つの回答から複数の疑問を取り出し、個別に探索・比較・統合しながら、元の経路を保持できます。

### 異なるAIモデルの回答を比較できますか？

はい。同じ問いから複数の兄弟分岐を作り、各分岐で異なるプロバイダーやモデルを選びます。回答ノードを選択して統合すると、共通結論、本質的な相違、背後の前提、独自の洞察、未解決事項、次のステップが分離されます。生成された統合ノードは、そのまま次の対話分岐として継続できます。

### AIマインドマップですか？

マインドマップに似た視覚構造を持ちますが、ノードは静的なメモではありません。会話履歴、コンテキストスナップショット、主張、証拠、関係、モデル情報、生成記録を保持できるため、「実行可能なAI推論グラフ」に近いものです。

### Obsidianと連携できますか？

はい。現在の作業をMarkdownとして書き出し、Obsidian Vault、Git管理のWiki、その他のMarkdown知識ベースへ保存できます。現時点ではエクスポート型の連携であり、ユーザー操作なしにObsidianリポジトリを変更することはありません。

### ローカルのCodex OAuthトークンを読み取ったりアップロードしたりしますか？

いいえ。公式Codex App Serverを通じてログイン状態とモデル情報を取得します。トークンはCodex CLIが管理し、プロジェクトファイル、エクスポート、Gitには入りません。

## ローカルデータとセキュリティ境界

```text
.env.local                         プロバイダーAPI Key、ローカルのみ
data/settings.local.json          非機密の設定とモデル情報
data/runtime.local.json           現在のアクティブプロジェクト
data/projects/*.json              完全なローカルプロジェクト
data/backups/*.json               直近20件の復元・移行バックアップ
```

これらは`.gitignore`で除外されます。その他の境界：

- 既定ではループバックHostだけを受け付ける。
- 書き込み操作には起動ごとのセッショントークンが必要。
- ローカルOriginを検証し、クロスオリジンの書き込みを拒否する。
- Codex生成では組み込みの`:read-only`権限プロファイルを使い、旧App Serverでは明確な互換条件に限って`sandbox: "read-only"`へフォールバックする。
- 認証ヘッダー、Cookie、Tokenなどの機密情報をフロントエンドへ渡さない。

## 開発と検証

```bash
# 構文チェックとNode/APIテスト
npm run test:node

# Chromium UIテストを含む全テスト
npm test

# リリースパッケージのスキャン
npm run verify:package
```

UI言語、UTF-8修復・移行、Markdown選択、分岐とコンテキストスナップショット、複数分岐の統合、プロバイダー能力、ローカルAPI境界、Codex OAuth/モデル/ストリーミング/読み取り専用権限、ブラウザ操作、復元、エクスポートをテストしています。

関連ドキュメント：

- [`START_HERE.md`](START_HERE.md) — 最短の起動・手動確認手順
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — システム構成
- [`docs/MERGE_POLICY.md`](docs/MERGE_POLICY.md) — 分岐比較と統合方針
- [`docs/PROVIDER_CONFIG.md`](docs/PROVIDER_CONFIG.md) — プロバイダーとモデル設定
- [`docs/OAUTH_DECISION.md`](docs/OAUTH_DECISION.md) — Codex OAuthの境界
- [`docs/GATES.md`](docs/GATES.md) — 検証可能なリリースゲート
- [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md) — テスト証跡
- [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) — 既知の制限
- [`docs/ai/`](docs/ai/) — 今後の開発用プロジェクトメモリ

## プロジェクト構成

```text
index.html                 ページ構造
styles.css                 ビジュアルデザイン
app.js                     フロントエンド状態、キャンバス操作、永続化
server.mjs                 ローカルHTTP/APIサーバーとプロバイダー振り分け
codex-app-server.mjs       Codex App Server JSONLクライアント
providers.js               組み込みプロバイダーカタログ
provider-capabilities.js   モデルと推論能力の正規化
thinking-core.js           推論グラフのコアデータ構造
tests/                     Node、API、Codex、ブラウザテスト
docs/                      設計、受け入れ、調査ドキュメント
```

## バージョン

現在のアプリケーションは**v12.5**で、`package.json`では`1.2.5`です。

## ライセンス

このリポジトリには現在オープンソースライセンスが含まれていません。特定のライセンスで再配布する場合は、対応する`LICENSE`ファイルを追加してください。
