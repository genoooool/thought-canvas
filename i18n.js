export const DEFAULT_UI_LANGUAGE = 'zh-CN';

export const UI_LANGUAGE_OPTIONS = Object.freeze([
  { id: 'zh-CN', label: '简体中文', nativeLabel: '简体中文' },
  { id: 'en', label: 'English', nativeLabel: 'English' },
  { id: 'ja', label: '日本語', nativeLabel: '日本語' }
]);

const TRANSLATION_ROWS = [
  ['对话形成结构，本地自动保存', 'Turn conversations into structure, saved locally', '会話を構造化し、ローカルに自動保存'],
  ['尚未连接可用模型。先用 API Key 或 ChatGPT OAuth 完成连接。', 'No usable model is connected yet. Connect one with an API key or ChatGPT OAuth.', '利用可能なモデルがまだ接続されていません。API キーまたは ChatGPT OAuth で接続してください。'],
  ['从一个问题开始，分支探索，再汇总为新主线的 AI 思考画布', 'An AI thinking canvas for branching from one question and converging on a new direction', 'ひとつの問いから分岐し、新しい主線へ収束する AI 思考キャンバス'],
  ['项目状态栏', 'Project status bar', 'プロジェクトステータスバー'],
  ['项目栏', 'Project bar', 'プロジェクトバー'],
  ['返回项目首页', 'Back to project home', 'プロジェクトホームに戻る'],
  ['项目首页', 'Project home', 'プロジェクトホーム'],
  ['新建项目', 'New project', '新規プロジェクト'],
  ['打开设置', 'Open settings', '設定を開く'],
  ['设置', 'Settings', '設定'],
  ['最终目标是方向性约束。AI 的推测必须由你确认后才会进入模型上下文。', 'The final goal guides direction. An AI suggestion enters model context only after you confirm it.', '最終目標は方向性を示す制約です。AI の推測は、確認後にのみモデルのコンテキストへ入ります。'],
  ['最终目标', 'Final goal', '最終目標'],
  ['AI 可提出建议，但只有你确认后才会生效', 'AI can suggest a goal, but it only takes effect after you confirm it', 'AI は目標を提案できますが、確認するまで有効になりません'],
  ['未设定', 'Not set', '未設定'],
  ['AI 推测你的目标', 'AI-suggested goal', 'AI が推測した目標'],
  ['采用', 'Accept', '採用'],
  ['编辑后采用', 'Edit and accept', '編集して採用'],
  ['暂不设置', 'Not now', '今は設定しない'],
  ['已保存', 'Saved', '保存済み'],
  ['本地文件', 'Local file', 'ローカルファイル'],
  ['画布工具', 'Canvas tools', 'キャンバスツール'],
  ['框选', 'Select area', '範囲選択'],
  ['拖动画布', 'Pan canvas', 'キャンバスを移動'],
  ['适配全部', 'Fit all', '全体を表示'],
  ['适配全部节点', 'Fit all nodes', 'すべてのノードを表示'],
  ['自动排布', 'Auto layout', '自動レイアウト'],
  ['自动排布节点', 'Auto-layout nodes', 'ノードを自動配置'],
  ['显示归档', 'Show archived', 'アーカイブを表示'],
  ['隐藏归档', 'Hide archived', 'アーカイブを非表示'],
  ['版本记录', 'Version history', 'バージョン履歴'],
  ['查看版本记录', 'View version history', 'バージョン履歴を表示'],
  ['导出', 'Export', 'エクスポート'],
  ['导出画布', 'Export canvas', 'キャンバスをエクスポート'],
  ['导入', 'Import', 'インポート'],
  ['导入画布', 'Import canvas', 'キャンバスをインポート'],
  ['今天想理清什么？', 'What do you want to clarify today?', '今日は何を整理しますか？'],
  ['从一个问题开始，分支探索，再把有价值的内容汇成新的主线。', 'Start with one question, explore branches, then converge valuable insights into a new direction.', 'ひとつの問いから始め、分岐を探索し、価値ある内容を新しい主線へまとめます。'],
  ['＋ 新建项目', '+ New project', '＋ 新規プロジェクト'],
  ['输入你想探索、学习或做出决定的问题…', 'Enter a question you want to explore, learn about, or decide…', '探索・学習・意思決定したい問いを入力…'],
  ['首页供应商', 'Home provider', 'ホームのプロバイダー'],
  ['首页模型', 'Home model', 'ホームのモデル'],
  ['首页思考等级', 'Home reasoning level', 'ホームの思考レベル'],
  ['使用全局默认，可在设置中修改', 'Using global defaults; change them in Settings', 'グローバル既定値を使用中。設定で変更できます'],
  ['连接模型', 'Connect model', 'モデルを接続'],
  ['创建项目并开始', 'Create project and start', 'プロジェクトを作成して開始'],
  ['开始', 'Start', '開始'],
  ['最近项目', 'Recent projects', '最近のプロジェクト'],
  ['项目与画布自动保存到本机项目目录；模型配置与密钥也仅保存在本机。', 'Projects and canvases are saved automatically in the local project folder. Model settings and keys also stay on this device.', 'プロジェクトとキャンバスはローカルのプロジェクトフォルダーへ自動保存されます。モデル設定とキーもこの端末だけに保存されます。'],
  ['无限思考画布', 'Infinite thinking canvas', '無限思考キャンバス'],
  ['已选择 0 个节点', '0 nodes selected', '0 個のノードを選択'],
  ['汇总', 'Synthesize', '統合'],
  ['比较', 'Compare', '比較'],
  ['完成', 'Done', '完了'],
  ['归档', 'Archive', 'アーカイブ'],
  ['取消选择', 'Clear selection', '選択を解除'],
  ['画布导航', 'Canvas navigation', 'キャンバスナビゲーション'],
  ['搜索节点、观点或问题', 'Search nodes, claims, or questions', 'ノード・主張・質問を検索'],
  ['搜索画布节点', 'Search canvas nodes', 'キャンバスノードを検索'],
  ['清除搜索', 'Clear search', '検索をクリア'],
  ['当前路径', 'Current path', '現在のパス'],
  ['只显示当前路径、当前节点与直接下一步', 'Show only the current path, selected node, and immediate next steps', '現在のパス、選択中のノード、直近の次ステップだけを表示'],
  ['推理对象', 'Reasoning objects', '推論オブジェクト'],
  ['查看观点、证据、假设与它们的关系', 'View claims, evidence, assumptions, and their relationships', '主張・証拠・仮定と、その関係を表示'],
  ['返回来源', 'Back to source', '参照元へ戻る'],
  ['返回当前节点的来源', 'Return to the source of the current node', '現在のノードの参照元へ戻る'],
  ['拖动空白处框选', 'Drag empty space to select', '空白部分をドラッグして範囲選択'],
  ['空格拖动画布', 'Hold Space to pan', 'Space を押しながら移動'],
  ['滚轮平滑缩放', 'Scroll to zoom smoothly', 'ホイールでスムーズにズーム'],
  ['画布小地图', 'Canvas minimap', 'キャンバスミニマップ'],
  ['地图', 'Map', 'マップ'],
  ['适配', 'Fit', '全体表示'],
  ['缩放控制', 'Zoom controls', 'ズーム操作'],
  ['缩小', 'Zoom out', '縮小'],
  ['放大', 'Zoom in', '拡大'],
  ['拖动调整面板宽度', 'Drag to resize the panel', 'ドラッグしてパネル幅を変更'],
  ['节点对话面板', 'Node conversation panel', 'ノード会話パネル'],
  ['模型供应商与上下文', 'Model providers and context', 'モデルプロバイダーとコンテキスト'],
  ['为不同模型服务分别维护 Base URL、API Key 与模型列表。', 'Manage the Base URL, API key, and model list for each model service.', 'モデルサービスごとに Base URL、API キー、モデル一覧を管理します。'],
  ['关闭', 'Close', '閉じる'],
  ['通用', 'General', '一般'],
  ['供应商', 'Provider', 'プロバイダー'],
  ['默认回答模型', 'Default response model', '既定の回答モデル'],
  ['应用到所有未单独覆盖的聊天框', 'Used by every chat that does not override it', '個別設定のないすべてのチャットに適用'],
  ['模型', 'Model', 'モデル'],
  ['思考等级', 'Reasoning level', '思考レベル'],
  ['保存时清除已有聊天框的临时模型选择', 'Clear temporary model overrides in existing chats when saving', '保存時に既存チャットの一時的なモデル選択を解除'],
  ['汇总模型', 'Synthesis model', '統合モデル'],
  ['界面语言', 'Interface language', '表示言語'],
  ['切换应用界面；项目标题、用户输入和模型回答不会被自动翻译', 'Switch the application interface. Project titles, user input, and model responses are not translated automatically.', 'アプリの表示言語を切り替えます。プロジェクト名、ユーザー入力、モデル回答は自動翻訳されません。'],
  ['语言', 'Language', '言語'],
  ['简体中文', 'Simplified Chinese', '簡体字中国語'],
  ['切换后立即预览，并在保存设置后写入本机配置。新生成的系统提示会使用所选语言。', 'Preview the change immediately. It is saved to local settings when you save. New system-guided generations use the selected language.', '切り替えはすぐにプレビューされ、設定保存時にローカルへ保存されます。以後のシステム指示付き生成には選択言語が使われます。'],
  ['刚刚', 'Just now', 'たった今'],
  ['已修复文本编码', 'Text encoding repaired', '文字コードを修復しました'],
  ['检测到 {count} 处 UTF-8 文本被按 Windows-1252 解读；已恢复可读文字，并在项目保存时写回修复结果。', 'Detected {count} UTF-8 text value(s) that had been decoded as Windows-1252. Readable text was restored and will be written back when the project is saved.', 'UTF-8 テキストが Windows-1252 として解釈された箇所を {count} 件検出しました。読める文字へ復元し、プロジェクト保存時に修復結果を書き戻します。'],
  ['长期约束', 'Long-term constraints', '長期的な制約'],
  ['每行一条，例如：不想出镜；预算有限；目标是单人起步', 'One per line, for example: avoid appearing on camera; limited budget; start solo', '1 行に 1 件。例：顔出ししない、予算が限られる、1 人で始める'],
  ['回答拆解方式', 'Answer decomposition', '回答の分解方法'],
  ['拆现有内容，不生成后续问题', 'Split existing content without generating follow-up questions', '既存内容を分解し、追加質問は生成しない'],
  ['按内容结构', 'By content structure', '内容構造で分解'],
  ['按章节主题', 'By section or topic', '章・テーマで分解'],
  ['按观点与依据', 'By claims and evidence', '主張と根拠で分解'],
  ['按执行步骤', 'By execution steps', '実行手順で分解'],
  ['按学习难点', 'By learning difficulty', '学習上の難所で分解'],
  ['完全自定义', 'Fully custom', '完全カスタム'],
  ['每条回答下方可拆解整条回答，也可先框选文字后只拆选中部分。', 'Under each answer, split the whole answer or select text first to split only that passage.', '各回答の下で全文を分解するか、先に文字を選択してその部分だけを分解できます。'],
  ['可选：补充你的拆解要求，例如：每个模块保留原文案例，不要超过5个模块。', 'Optional: add decomposition rules, such as keeping source examples and limiting the result to five modules.', '任意：原文の例を残す、5 モジュール以内にする、などの分解条件を追加します。'],
  ['只压缩发给模型的上下文，不删除原始消息', 'Compress only the context sent to the model; original messages are never deleted', 'モデルへ送るコンテキストだけを圧縮し、元のメッセージは削除しません'],
  ['自动 Compact', 'Automatic Compact', '自動 Compact'],
  ['消息数量触发阈值', 'Message-count threshold', 'メッセージ数のしきい値'],
  ['也可在节点顶部手动执行、查看、重新生成或删除 Compact。删除 Compact 不影响任何原始聊天记录。', 'You can also run, inspect, regenerate, or delete Compact manually from the node header. Deleting Compact never changes original chat history.', 'ノード上部から Compact の実行・確認・再生成・削除もできます。Compact を削除しても元の会話履歴には影響しません。'],
  ['画布连线', 'Canvas connectors', 'キャンバス接続線'],
  ['控制普通节点之间的连接方式', 'Control how regular nodes are connected', '通常ノード間の接続方法を設定'],
  ['线条形状', 'Line shape', '線の形状'],
  ['弧线', 'Curved', '曲線'],
  ['直角线', 'Orthogonal', '直角線'],
  ['线条样式', 'Line style', '線のスタイル'],
  ['实线', 'Solid', '実線'],
  ['虚线', 'Dashed', '破線'],
  ['生成中的节点仍会临时使用流动虚线，完成后恢复这里选择的样式。', 'Nodes being generated temporarily use an animated dashed line, then return to the selected style.', '生成中のノードは一時的に流れる破線を使い、完了後に選択したスタイルへ戻ります。'],
  ['最终目标的作用', 'How the final goal is used', '最終目標の役割'],
  ['方向约束，不覆盖当前追问', 'Guides direction without overriding the current question', '現在の質問を上書きせず、方向性を示す'],
  ['优先级固定为：当前明确追问 → 当前节点与祖先路径 → 用户长期约束 → 最终目标。目标修改只影响之后的新分支和汇总，历史节点保留创建时的目标版本。', 'Priority is fixed: explicit current question → current node and ancestor path → long-term constraints → final goal. Goal changes affect only future branches and syntheses; historical nodes keep the goal version used when they were created.', '優先順位は固定です：現在の明示的な質問 → 現在のノードと祖先パス → 長期的な制約 → 最終目標。目標の変更は以後の分岐と統合だけに影響し、過去のノードは作成時の目標バージョンを保持します。'],
  ['分为预设与自定义两类', 'Preset and custom providers', 'プリセットとカスタムの 2 種類'],
  ['＋ 自定义', '+ Custom', '＋ カスタム'],
  ['搜索预设或自定义供应商', 'Search preset or custom providers', 'プリセットまたはカスタムのプロバイダーを検索'],
  ['当前配置', 'Current configuration', '現在の設定'],
  ['未连接', 'Not connected', '未接続'],
  ['连接并同步模型', 'Connect and sync models', '接続してモデルを同期'],
  ['名称', 'Name', '名前'],
  ['接口协议', 'API protocol', 'API プロトコル'],
  ['未保存', 'Not saved', '未保存'],
  ['仅用于连接验证；成功后保存到 .env.local', 'Used only to verify the connection; saved to .env.local after success', '接続確認にのみ使用し、成功後に .env.local へ保存'],
  ['清除', 'Clear', 'クリア'],
  ['一行一个模型 ID；显示名称可选', 'One model ID per row; display name is optional', '1 行に 1 つのモデル ID。表示名は任意'],
  ['＋ 新增模型', '+ Add model', '＋ モデルを追加'],
  ['高级设置', 'Advanced settings', '詳細設定'],
  ['认证方式和自定义请求头只在部分代理商要求特殊 Header 时使用。普通 OpenAI 兼容接口通常保持默认即可。', 'Authentication mode and custom headers are only needed when a gateway requires special headers. Standard OpenAI-compatible APIs can usually keep the defaults.', '認証方式とカスタムヘッダーは、一部のゲートウェイが特殊なヘッダーを要求する場合だけ必要です。通常の OpenAI 互換 API は既定値のままで構いません。'],
  ['认证方式', 'Authentication', '認証方式'],
  ['思考参数适配', 'Reasoning parameter mapping', '思考パラメータの適用'],
  ['连接测试模型', 'Connection test model', '接続テスト用モデル'],
  ['自定义请求头（JSON，可选）', 'Custom request headers (optional JSON)', 'カスタムリクエストヘッダー（任意の JSON）'],
  ['在聊天模型下拉框中启用', 'Enable in chat model menus', 'チャットのモデルメニューで有効化'],
  ['输入 API Key 后点击“连接并同步模型”：验证凭据、读取可用模型，并把模型与思考等级同步到所有选择器。', 'Enter an API key and choose “Connect and sync models” to verify credentials, discover available models, and update every model and reasoning selector.', 'API キーを入力して「接続してモデルを同期」を押すと、認証情報を確認し、利用可能なモデルを取得して、すべてのモデル・思考レベル選択へ反映します。'],
  ['仅测试当前模型', 'Test current model only', '現在のモデルだけテスト'],
  ['重新同步模型', 'Resync models', 'モデルを再同期'],
  ['设为默认回答', 'Set as default response', '既定の回答モデルに設定'],
  ['复制为自定义', 'Duplicate as custom', 'カスタムとして複製'],
  ['恢复预设', 'Restore preset', 'プリセットを復元'],
  ['删除', 'Delete', '削除'],
  ['保存非敏感配置', 'Save non-sensitive settings', '機密情報以外を保存'],
  ['检测中', 'Checking', '確認中'],
  ['点击后由本机官方 Codex App Server 完成 ChatGPT 授权、账号状态读取和模型同步。Thought Canvas 不读取、不复制，也不保存 OAuth Token。', 'The local official Codex App Server handles ChatGPT authorization, account status, and model sync. Thought Canvas does not read, copy, or store OAuth tokens.', 'ローカルの公式 Codex App Server が ChatGPT 認証、アカウント状態の取得、モデル同期を行います。Thought Canvas は OAuth トークンを読み取り、コピー、保存しません。'],
  ['Codex 登录方式', 'Codex sign-in methods', 'Codex のログイン方法'],
  ['连接 Codex', 'Connect Codex', 'Codex に接続'],
  ['推荐', 'Recommended', '推奨'],
  ['打开官方 ChatGPT 授权页面；完成后自动同步当前账号可用模型与思考等级。', 'Open the official ChatGPT authorization page, then automatically sync models and reasoning levels available to the account.', '公式 ChatGPT 認証ページを開き、完了後にアカウントで利用可能なモデルと思考レベルを自動同期します。'],
  ['设备码连接', 'Connect with device code', 'デバイスコードで接続'],
  ['浏览器回调不便时，打开一次性验证网址并输入设备码。', 'Use a one-time verification page and device code when browser callbacks are not convenient.', 'ブラウザーのコールバックが使いにくい場合、一時的な確認ページでデバイスコードを入力します。'],
  ['正在检测本机 Codex App Server…', 'Checking the local Codex App Server…', 'ローカルの Codex App Server を確認中…'],
  ['刷新状态与模型', 'Refresh status and models', '状態とモデルを更新'],
  ['立即使用 Codex', 'Use Codex now', 'Codex を今すぐ使用'],
  ['取消授权', 'Cancel authorization', '認証をキャンセル'],
  ['退出登录', 'Sign out', 'ログアウト'],
  ['可作为本地桥接', 'Available as a local bridge', 'ローカルブリッジとして利用可能'],
  ['OpenClaw 可以自己管理 OpenAI OAuth。当前版本不读取其令牌；可把 OpenClaw 暴露的兼容端点作为自定义供应商接入。', 'OpenClaw can manage OpenAI OAuth itself. This version does not read its tokens; add an OpenClaw-compatible endpoint as a custom provider.', 'OpenClaw は OpenAI OAuth を自身で管理できます。このバージョンはそのトークンを読み取らず、OpenClaw が公開する互換エンドポイントをカスタムプロバイダーとして追加できます。'],
  ['暂不内置', 'Not built in yet', 'まだ内蔵していません'],
  ['订阅认证与第三方调用边界仍在变化。正式产品优先使用 Anthropic API Key，避免直接搬运用户令牌。', 'Subscription authentication and third-party usage boundaries are still evolving. Production use should prefer Anthropic API keys instead of moving user tokens.', 'サブスクリプション認証と第三者利用の境界は変化中です。本番利用ではユーザートークンを転用せず、Anthropic API キーを優先してください。'],
  ['需要自建 OAuth Client', 'Requires your own OAuth client', '独自の OAuth クライアントが必要'],
  ['需要 Google Cloud OAuth Client、Redirect URI、令牌刷新与安全存储，不适合无后端静态页面。', 'Requires a Google Cloud OAuth client, redirect URI, token refresh, and secure storage, so it is not suitable for a backend-free static page.', 'Google Cloud OAuth クライアント、リダイレクト URI、トークン更新、安全な保存が必要なため、バックエンドのない静的ページには向きません。'],
  ['完成并关闭', 'Save and close', '保存して閉じる'],
  ['保存全部设置', 'Save all settings', 'すべての設定を保存'],
  ['建立一张新的思考画布', 'Create a new thinking canvas', '新しい思考キャンバスを作成'],
  ['项目名称可以留空；最终目标也可以在首问后由 AI 提议。', 'The project name can be blank. AI can also suggest a final goal after the first question.', 'プロジェクト名は空欄でも構いません。最初の質問後に AI が最終目標を提案することもできます。'],
  ['项目名称', 'Project name', 'プロジェクト名'],
  ['例如：研究新的商业方向', 'For example: Explore a new business direction', '例：新しい事業の方向性を調べる'],
  ['最终目标（可选）', 'Final goal (optional)', '最終目標（任意）'],
  ['例如：在四周内选出一个可以低成本验证的方向', 'For example: Choose a direction that can be validated cheaply within four weeks', '例：4 週間以内に低コストで検証できる方向を選ぶ'],
  ['模型与思考等级会作为根节点的初始配置。', 'The selected model and reasoning level become the root node’s initial configuration.', '選択したモデルと思考レベルがルートノードの初期設定になります。'],
  ['取消', 'Cancel', 'キャンセル'],
  ['创建项目', 'Create project', 'プロジェクトを作成'],
  ['新建分支', 'New branch', '新規分岐'],
  ['从当前节点平行延伸', 'Branch in parallel from the current node', '現在のノードから並行して分岐'],
  ['这次提问会创建新的子节点；当前聊天记录不会被修改。', 'This question creates a new child node. The current chat history is not modified.', 'この質問は新しい子ノードを作成します。現在の会話履歴は変更されません。'],
  ['输入要在新分支中讨论的问题。Enter 发送，Shift + Enter 换行', 'Enter the question for the new branch. Enter to send; Shift + Enter for a new line', '新しい分岐で扱う質問を入力。Enter で送信、Shift + Enter で改行'],
  ['创建分支并发送', 'Create branch and send', '分岐を作成して送信'],
  ['本次上下文', 'Request context', '今回のコンテキスト'],
  ['模型会看到什么', 'What the model will see', 'モデルが見る内容'],
  ['查看当前节点最近一次请求的不可变上下文快照，或预览下一次请求。', 'Inspect the immutable context snapshot from the latest request on this node, or preview the next request.', 'このノードの直近リクエストに使われた不変コンテキストのスナップショットを確認するか、次回をプレビューします。'],
  ['预计输入', 'Estimated input', '推定入力'],
  ['快照', 'Snapshot', 'スナップショット'],
  ['预览', 'Preview', 'プレビュー'],
  ['目标', 'Goal', '目標'],
  ['未确认', 'Unconfirmed', '未確認'],
  ['当前问题与当前节点消息始终包含；其他层可以为下一次请求单独开关。', 'The current question and current-node messages are always included. Other layers can be toggled for the next request.', '現在の質問と現在ノードのメッセージは常に含まれます。その他のレイヤーは次回リクエストごとに切り替えられます。'],
  ['思维导图标注', 'Mind-map annotation', 'マインドマップ注釈'],
  ['新建标注模块', 'New annotation module', '新規注釈モジュール'],
  ['标注会通过密集虚线连接到当前节点，不会影响主分支完成度。', 'The annotation is linked to the current node with a dense dashed line and does not affect main-branch completion.', '注釈は密な破線で現在のノードに接続され、主分岐の完了度には影響しません。'],
  ['类型', 'Type', '種類'],
  ['标注', 'Note', '注釈'],
  ['想法', 'Idea', 'アイデア'],
  ['问题', 'Question', '質問'],
  ['风险', 'Risk', 'リスク'],
  ['行动', 'Action', 'アクション'],
  ['标题', 'Title', 'タイトル'],
  ['例如：这里需要验证用户成本', 'For example: User cost needs validation here', '例：ここではユーザーコストの検証が必要'],
  ['内容', 'Content', '内容'],
  ['记录批注、补充说明、风险、下一步或任何不想混进主对话的内容。', 'Record a note, clarification, risk, next step, or anything you do not want mixed into the main conversation.', '注記、補足、リスク、次のステップなど、主会話に混ぜたくない内容を記録します。'],
  ['删除标注', 'Delete annotation', '注釈を削除'],
  ['保存标注', 'Save annotation', '注釈を保存'],
  ['提炼为推理对象', 'Promote to reasoning object', '推論オブジェクトへ抽出'],
  ['从原回答中保留可追溯的观点', 'Preserve a traceable idea from the original answer', '元の回答から追跡可能な考えを保存'],
  ['对象会保留节点、消息与原文范围。', 'The object keeps its source node, message, and source-text range.', 'オブジェクトには参照元ノード、メッセージ、原文範囲が保持されます。'],
  ['观点', 'Claim', '主張'],
  ['证据', 'Evidence', '証拠'],
  ['假设', 'Assumption', '仮定'],
  ['方案', 'Option', '選択肢'],
  ['可信状态', 'Confidence status', '信頼状態'],
  ['未验证', 'Unverified', '未検証'],
  ['部分证据', 'Partial evidence', '一部証拠あり'],
  ['已验证', 'Verified', '検証済み'],
  ['有争议', 'Contested', '議論あり'],
  ['用一句话说明这个对象', 'Describe this object in one sentence', 'このオブジェクトを 1 文で説明'],
  ['原文内容', 'Source content', '原文内容'],
  ['提炼不会修改原回答；后续可以把对象设置为支持、反驳或依赖关系。', 'Promoting does not change the original answer. You can later connect objects as support, refutation, or dependency.', '抽出しても元の回答は変わりません。後から支持・反論・依存の関係を設定できます。'],
  ['保存推理对象', 'Save reasoning object', '推論オブジェクトを保存'],
  ['推理对象库', 'Reasoning object library', '推論オブジェクトライブラリ'],
  ['观点、证据、假设与决策', 'Claims, evidence, assumptions, and decisions', '主張・証拠・仮定・意思決定'],
  ['工作是否完成和内容是否可信分开记录；所有对象都能回到原节点与原消息。', 'Completion and credibility are tracked separately. Every object can return to its source node and message.', '作業完了と内容の信頼性は別々に記録されます。すべてのオブジェクトから参照元ノードとメッセージへ戻れます。'],
  ['全部类型', 'All types', 'すべての種類'],
  ['可信', 'Confidence', '信頼性'],
  ['全部状态', 'All statuses', 'すべての状態'],
  ['对象', 'Objects', 'オブジェクト'],
  ['关系', 'Relations', '関係'],
  ['建立语义关系', 'Create semantic relation', '意味関係を作成'],
  ['连接推理对象', 'Connect reasoning objects', '推論オブジェクトを接続'],
  ['关系方向为“当前对象 → 目标对象”。', 'The relation direction is “current object → target object.”', '関係の向きは「現在のオブジェクト → 対象オブジェクト」です。'],
  ['支持', 'Supports', '支持'],
  ['反驳', 'Refutes', '反論'],
  ['依赖', 'Depends on', '依存'],
  ['目标对象', 'Target object', '対象オブジェクト'],
  ['建立关系', 'Create relation', '関係を作成'],
  ['分支比较', 'Branch comparison', '分岐比較'],
  ['并排检查上下文、结论与风险', 'Compare context, conclusions, and risks side by side', 'コンテキスト・結論・リスクを並べて確認'],
  ['比较不调用模型，先展示可验证的结构差异与来源。', 'Comparison does not call a model. It first shows verifiable structural differences and sources.', '比較ではモデルを呼び出さず、検証可能な構造差と参照元を先に表示します。'],
  ['确认输入范围', 'Confirm input scope', '入力範囲を確認'],
  ['系统不会静默漏掉节点。重复、结构节点和压缩规则都会在这里说明。', 'The system never silently omits nodes. Duplicates, structural nodes, and compression rules are explained here.', 'システムはノードを黙って省きません。重複、構造ノード、圧縮ルールをここで説明します。'],
  ['这次最想解决什么，可留空', 'What should this synthesis resolve? Optional', '今回もっとも解決したいこと（任意）'],
  ['例如：基于这些分支，我现在最应该优先选择哪条路径？', 'For example: Based on these branches, which path should I prioritize now?', '例：これらの分岐を踏まえ、今もっとも優先すべき道はどれですか？'],
  ['生成汇总节点', 'Generate synthesis node', '統合ノードを生成'],
  ['本地版本', 'Local versions', 'ローカルバージョン'],
  ['版本记录与恢复', 'Version history and restore', 'バージョン履歴と復元'],
  ['关键操作完成时会保留本地恢复版本；恢复前也会先备份当前版本。', 'A local restore point is kept after key operations. The current version is also backed up before a restore.', '重要な操作後にローカル復元ポイントを保存し、復元前にも現在の状態をバックアップします。'],
  ['正在读取本地备份…', 'Loading local backups…', 'ローカルバックアップを読み込み中…'],
  ['刷新', 'Refresh', '更新'],
  ['开放导出', 'Open export', 'オープンエクスポート'],
  ['选择导出格式', 'Choose export format', 'エクスポート形式を選択'],
  ['项目原始格式用于完整恢复；JSON Canvas 和 Markdown 便于迁移与长期阅读。', 'The native format supports full restoration. JSON Canvas and Markdown are convenient for migration and long-term reading.', 'ネイティブ形式は完全復元用です。JSON Canvas と Markdown は移行や長期閲覧に適しています。'],
  ['完整项目、上下文快照、生成记录和推理关系', 'Complete project, context snapshots, generation records, and reasoning relations', '完全なプロジェクト、コンテキストスナップショット、生成記録、推論関係'],
  ['节点、分支与推理关系，可导入兼容画布工具', 'Nodes, branches, and reasoning relations for compatible canvas tools', '対応キャンバスツールへ取り込めるノード・分岐・推論関係'],
  ['目标、对话、观点、证据、关系与最终决策', 'Goals, conversations, claims, evidence, relations, and final decisions', '目標・会話・主張・証拠・関係・最終決定'],
  ['归档所选分支', 'Archive selected branches', '選択した分岐をアーカイブ'],
  ['归档父节点时会一起归档其后代，但内容和关系仍然保留。', 'Archiving a parent also archives its descendants, while preserving content and relations.', '親ノードをアーカイブすると子孫も一緒にアーカイブされますが、内容と関係は保持されます。'],
  ['归档原因', 'Archive reason', 'アーカイブ理由'],
  ['已完成或暂时不进入主线', 'Completed or temporarily outside the main line', '完了、または一時的に主線へ入れない'],
  ['确认归档', 'Confirm archive', 'アーカイブを確定'],
  ['请确认', 'Please confirm', '確認してください'],
  ['确认操作', 'Confirm action', '操作を確認'],
  ['确认', 'Confirm', '確認'],

  // Dynamic application chrome and statuses.
  ['从一个问题开始，建立可追溯的思考结构', 'Start with one question and build a traceable thinking structure', 'ひとつの問いから、追跡可能な思考構造を作ります'],
  ['等待继续探索', 'Waiting for further exploration', '次の探索を待っています'],
  ['建立一张新的思考画布', 'Create a new thinking canvas', '新しい思考キャンバスを作成'],
  ['删除项目', 'Delete project', 'プロジェクトを削除'],
  ['项目文件及其本地版本会一起移除，该操作无法恢复。', 'The project file and its local versions will be removed. This cannot be undone.', 'プロジェクトファイルとローカルバージョンが削除されます。この操作は元に戻せません。'],
  ['打开项目失败', 'Could not open project', 'プロジェクトを開けませんでした'],
  ['删除项目失败', 'Could not delete project', 'プロジェクトを削除できませんでした'],
  ['刚刚更新', 'Updated just now', 'たった今更新'],
  ['页面重载后恢复为部分回答', 'Recovered as a partial answer after page reload', 'ページ再読み込み後に部分回答として復元'],
  ['待确认', 'Pending confirmation', '確認待ち'],
  ['根问题', 'Root question', 'ルート質問'],
  ['讲解模块', 'Explanation module', '解説モジュール'],
  ['整理结果', 'Organized result', '整理結果'],
  ['追问分支', 'Follow-up branch', '追加質問の分岐'],
  ['汇总节点', 'Synthesis node', '統合ノード'],
  ['思考对象', 'Reasoning object', '思考オブジェクト'],
  ['思考节点', 'Thinking node', '思考ノード'],
  ['标注模块', 'Annotation module', '注釈モジュール'],
  ['本地标注', 'Local annotation', 'ローカル注釈'],
  ['背景色', 'Background color', '背景色'],
  ['标注背景色', 'Annotation background color', '注釈の背景色'],
  ['跟随类型', 'Follow type', 'タイプに合わせる'],
  ['雾紫', 'Misty violet', '霞んだ紫'],
  ['石板', 'Slate', 'スレート'],
  ['晴蓝', 'Clear blue', '青'],
  ['薄荷', 'Mint', 'ミント'],
  ['琥珀', 'Amber', 'アンバー'],
  ['玫瑰', 'Rose', 'ローズ'],
  ['显示全部', 'Show all', 'すべて表示'],
  ['返回', 'Back', '戻る'],
  ['没有找到匹配节点', 'No matching nodes found', '一致するノードがありません'],
  ['待理解', 'To understand', '未理解'],
  ['讨论中', 'In progress', '検討中'],
  ['已完成', 'Completed', '完了'],
  ['已归档', 'Archived', 'アーカイブ済み'],
  ['处理中', 'Processing', '処理中'],
  ['来自回答拆解', 'From answer decomposition', '回答の分解から作成'],
  ['本地模块', 'Local module', 'ローカルモジュール'],
  ['拖到画布空白处创建标注；点击快速新建', 'Drag to empty canvas space to create an annotation, or click for quick creation', 'キャンバスの空白へドラッグして注釈を作成。クリックで簡単作成'],
  ['为这个节点创建标注', 'Create an annotation for this node', 'このノードに注釈を作成'],
  ['从这个节点新建分支', 'Create a branch from this node', 'このノードから分岐を作成'],
  ['松开创建标注', 'Release to create annotation', '離して注釈を作成'],
  ['根节点', 'Root node', 'ルートノード'],
  ['从这里开始提出问题。', 'Start asking a question here.', 'ここから質問を始めます。'],
  ['工作状态', 'Work status', '作業状態'],
  ['上下文', 'Context', 'コンテキスト'],
  ['查看本次模型上下文', 'Inspect this model context', '今回のモデルコンテキストを確認'],
  ['更多节点操作', 'More node actions', 'その他のノード操作'],
  ['更多', 'More', 'その他'],
  ['展开后续节点', 'Expand descendants', '後続ノードを展開'],
  ['折叠后续节点', 'Collapse descendants', '後続ノードを折りたたむ'],
  ['重新 Compact', 'Regenerate Compact', 'Compact を再生成'],
  ['Compact 上下文', 'Compact context', 'コンテキストを Compact'],
  ['恢复节点', 'Restore node', 'ノードを復元'],
  ['归档节点', 'Archive node', 'ノードをアーカイブ'],
  ['不计入主分支完成度', 'Excluded from main-branch completion', '主分岐の完了度には含めない'],
  ['批量处理', 'Batch actions', '一括操作'],
  ['选择节点开始', 'Select nodes to begin', 'ノードを選択して開始'],
  ['比较两个分支', 'Compare two branches', '2 つの分岐を比較'],
  ['本地标注 · 可编辑', 'Local annotation · Editable', 'ローカル注釈 · 編集可能'],
  ['标注模块操作', 'Annotation module actions', '注釈モジュール操作'],
  ['编辑标注', 'Edit annotation', '注釈を編集'],
  ['拆解标注内容', 'Decompose annotation content', '注釈内容を分解'],
  ['拆解选中文字', 'Decompose selected text', '選択した文字を分解'],
  ['提炼选中文字', 'Promote selected text', '選択した文字を抽出'],
  ['可见选区 · 原文位置未定位', 'Visible selection · Source position unresolved', '表示上の選択範囲 · 原文位置は未特定'],
  ['讲解模块操作', 'Explanation module actions', '解説モジュール操作'],
  ['继续拆解这个模块', 'Decompose this module further', 'このモジュールをさらに分解'],
  ['删除当前 Compact', 'Delete current Compact', '現在の Compact を削除'],
  ['原始消息始终完整保留。', 'Original messages are always preserved in full.', '元のメッセージは常に完全な形で保持されます。'],
  ['（下一次输入尚未填写）', '(The next input has not been entered)', '（次の入力はまだありません）'],
  ['上下文截至消息', 'Context ends at message', 'コンテキストの終点メッセージ'],
  ['；快照创建后不会被后续消息改写。', '; later messages cannot modify the snapshot.', '。スナップショット作成後は後続メッセージで変更されません。'],
  ['当前节点尚无消息锚点。', 'This node has no message anchor yet.', 'このノードにはまだメッセージアンカーがありません。'],
  ['预览（未保存）', 'Preview (not saved)', 'プレビュー（未保存）'],
  ['已确认', 'Confirmed', '確認済み'],
  ['未确认 / 未包含', 'Unconfirmed / Not included', '未確認 / 未包含'],
  ['原文来源', 'Source text', '原文の参照元'],
  ['祖先路径', 'Ancestor path', '祖先パス'],
  ['已确认目标', 'Confirmed goal', '確認済み目標'],
  ['最近快照', 'Latest snapshot', '最新スナップショット'],
  ['下一次预览', 'Next request preview', '次回リクエストのプレビュー'],
  ['下一次请求上下文开关', 'Next-request context toggles', '次回リクエストのコンテキスト切り替え'],
  ['用户', 'User', 'ユーザー'],
  ['你', 'You', 'あなた'],
  ['AI', 'AI', 'AI'],
  ['上方是从原回答中拆出的讲解。阅读后，可以针对不懂的地方继续追问。', 'The explanation above was decomposed from the original answer. After reading it, ask about anything that remains unclear.', '上の解説は元の回答から分解したものです。読んだ後、不明点を続けて質問できます。'],
  ['上方是独立标注。你可以直接编辑，也可以围绕这条标注继续追问或建立新的分支。', 'The item above is an independent annotation. Edit it directly, ask follow-up questions, or create a new branch from it.', '上は独立した注釈です。直接編集するほか、この注釈について質問を続けたり、新しい分岐を作ったりできます。'],
  ['输入第一个问题。AI 会先完整回答；你可以阅读、追问、换模型或手动拆解。', 'Enter the first question. AI answers in full; then you can read, ask follow-ups, switch models, or decompose it manually.', '最初の質問を入力します。AI がまず全文で回答し、その後に閲覧、追加質問、モデル変更、手動分解ができます。'],
  ['可在当前节点继续对话；需要平行探索时点击画布节点右侧的 +。', 'Continue the conversation in this node. For parallel exploration, click + on the right side of a canvas node.', '現在のノードで会話を続けられます。並行して探索するには、キャンバスノード右側の ＋ をクリックします。'],
  ['围绕标注继续思考', 'Continue thinking from the annotation', '注釈から思考を続ける'],
  ['继续理解这个模块', 'Continue understanding this module', 'このモジュールの理解を続ける'],
  ['连接中断 · 已保留部分结果', 'Connection interrupted · Partial result preserved', '接続中断 · 部分結果を保持'],
  ['已恢复为部分回答', 'Recovered as a partial answer', '部分回答として復元'],
  ['已停止 · 可继续', 'Stopped · Can continue', '停止済み · 続行可能'],
  ['正在接收模型输出', 'Receiving model output', 'モデル出力を受信中'],
  ['尚未收到正文；可以继续生成或从这里分支。', 'No response text has arrived yet. Continue generation or branch from here.', '本文はまだ届いていません。生成を続けるか、ここから分岐できます。'],
  ['正在接收', 'Receiving', '受信中'],
  ['从这里分支', 'Branch from here', 'ここから分岐'],
  ['重试本次请求', 'Retry this request', 'このリクエストを再試行'],
  ['继续生成', 'Continue generation', '生成を続ける'],
  ['拆解这条回答', 'Decompose this answer', 'この回答を分解'],
  ['已拆解', 'Decomposed', '分解済み'],
  ['测试', 'Test', 'テスト'],
  ['当前节点生成中', 'This node is generating', 'このノードは生成中'],
  ['当前模型尚未连接，请先打开设置完成连接', 'The current model is not connected. Open Settings to connect it first.', '現在のモデルは未接続です。先に設定を開いて接続してください。'],
  ['发送会继续当前节点；从画布节点右侧 + 新建分支', 'Send to continue this node; use + on a canvas node to create a branch', '送信すると現在のノードを続行します。分岐はキャンバスノード右側の ＋ から作成します'],
  ['当前节点使用单独模型或思考等级；从画布节点右侧 + 新建分支', 'This node uses its own model or reasoning level; use + on a canvas node to create a branch', 'このノードは個別のモデルまたは思考レベルを使用中です。分岐はキャンバスノード右側の ＋ から作成します'],
  ['正在等待当前模型回答…', 'Waiting for the current model…', '現在のモデルの回答を待っています…'],
  ['继续当前节点对话。Enter 发送，Shift + Enter 换行', 'Continue this node. Enter to send; Shift + Enter for a new line', 'このノードの会話を続けます。Enter で送信、Shift + Enter で改行'],
  ['请先在设置中连接模型供应商', 'Connect a model provider in Settings first', '先に設定でモデルプロバイダーを接続してください'],
  ['停止生成', 'Stop generation', '生成を停止'],
  ['停止', 'Stop', '停止'],
  ['发送', 'Send', '送信'],
  ['请先连接模型供应商', 'Connect a model provider first', '先にモデルプロバイダーを接続してください'],
  ['暂无可用项', 'No available options', '利用可能な項目がありません'],
  ['尚未选择文字', 'No text selected', '文字が選択されていません'],
  ['请在这条回答正文中拖动选择一段文字，再点击“拆解选中文字”。', 'Select a passage in this answer, then choose “Decompose selected text.”', 'この回答本文で文字を選択し、「選択した文字を分解」をクリックしてください。'],
  ['请在这条回答正文中拖动选择一段文字，再点击“提炼选中文字”。', 'Select a passage in this answer, then choose “Promote selected text.”', 'この回答本文で文字を選択し、「選択した文字を抽出」をクリックしてください。'],
  ['提炼', 'Promote', '抽出'],
  ['拆解', 'Decompose', '分解'],
  ['待处理', 'Open', '未処理'],
  ['已处理', 'Processed', '処理済み'],
  ['无来源', 'No source', '参照元なし'],
  ['已删除对象', 'Deleted object', '削除済みオブジェクト'],
  ['来源', 'Source', '参照元'],
  ['返回原消息', 'Return to source message', '元のメッセージへ戻る'],
  ['结构化推理', 'Structured reasoning', '構造化推論'],
  ['查看全部', 'View all', 'すべて表示'],
  ['新的推理对象', 'New reasoning object', '新しい推論オブジェクト'],
  ['无法打开标注', 'Could not open annotation', '注釈を開けませんでした'],
  ['来源节点或标注模块已经不存在。', 'The source node or annotation module no longer exists.', '参照元ノードまたは注釈モジュールが存在しません。'],
  ['编辑标注模块', 'Edit annotation module', '注釈モジュールを編集'],
  ['标注及从它继续产生的后续节点会一起移除，来源主节点不会受到影响。', 'The annotation and all descendants created from it will be removed. The source node is unaffected.', '注釈と、そこから作成された後続ノードが削除されます。参照元の主ノードには影響しません。'],
  ['无法提炼', 'Could not promote selection', '抽出できませんでした'],
  ['来源节点、消息或所选文字已不存在，请重新选择。', 'The source node, message, or selected text no longer exists. Select it again.', '参照元ノード、メッセージ、または選択文字が存在しません。もう一度選択してください。'],
  ['推理对象内容不能为空。', 'Reasoning object content cannot be empty.', '推論オブジェクトの内容は空にできません。'],
  ['已保留推理对象', 'Reasoning object saved', '推論オブジェクトを保存しました'],
  ['删除推理对象', 'Delete reasoning object', '推論オブジェクトを削除'],
  ['与它相连的支持、反驳或依赖关系也会一并删除。', 'Connected support, refutation, and dependency relations will also be deleted.', '接続している支持・反論・依存関係も削除されます。'],
  ['删除对象', 'Delete object', 'オブジェクトを削除'],
  ['无法建立关系', 'Could not create relation', '関係を作成できませんでした'],
  ['至少需要另一个未归档的推理对象。', 'At least one other non-archived reasoning object is required.', 'アーカイブされていない別の推論オブジェクトが少なくとも 1 つ必要です。'],
  ['关系无效', 'Invalid relation', '無効な関係'],
  ['推理对象不能连接到自身。', 'A reasoning object cannot connect to itself.', '推論オブジェクトを自身へ接続することはできません。'],
  ['关系已存在', 'Relation already exists', '関係はすでに存在します'],
  ['相同方向与类型的关系不需要重复建立。', 'A relation with the same direction and type does not need to be created twice.', '同じ方向・種類の関係を重複して作成する必要はありません。'],
  ['当前筛选下没有推理对象。选中 AI 回答文字后点击“提炼选中文字”。', 'No reasoning objects match the current filters. Select text in an AI answer and choose “Promote selected text.”', '現在の絞り込み条件に一致する推論オブジェクトはありません。AI 回答の文字を選択し、「選択した文字を抽出」をクリックしてください。'],
  ['尚未建立支持、反驳或依赖关系。', 'No support, refutation, or dependency relations have been created.', '支持・反論・依存関係はまだ作成されていません。'],
  ['最新消息', 'Latest message', '最新メッセージ'],
  ['无快照', 'No snapshot', 'スナップショットなし'],
  ['尚无独立回答。', 'No independent answer yet.', '独立した回答はまだありません。'],
  ['分叉锚点', 'Branch anchor', '分岐アンカー'],
  ['目标版本', 'Goal version', '目標バージョン'],
  ['上下文快照', 'Context snapshot', 'コンテキストスナップショット'],
  ['已提炼的结论与风险', 'Promoted conclusions and risks', '抽出済みの結論とリスク'],
  ['结构差异摘要', 'Structural difference summary', '構造差の要約'],
  ['请选择两个分支', 'Select two branches', '2 つの分岐を選択してください'],
  ['分支比较需要且只需要两个节点。', 'Branch comparison requires exactly two nodes.', '分岐比較にはちょうど 2 つのノードが必要です。'],
  ['两个分支来自相同消息锚点', 'Both branches use the same message anchor', '両方の分岐は同じメッセージアンカーから作成されています'],
  ['两个分支使用相同模型', 'Both branches use the same model', '両方の分岐は同じモデルを使用しています'],
  ['上下文快照不同，可分别打开节点上下文核查', 'The context snapshots differ. Open each node’s context to inspect them.', 'コンテキストスナップショットが異なります。各ノードのコンテキストを開いて確認できます。'],
  ['两个分支引用同一上下文快照', 'Both branches reference the same context snapshot', '両方の分岐は同じコンテキストスナップショットを参照しています'],
  ['已复制', 'Copied', 'コピーしました'],
  ['复制失败', 'Copy failed', 'コピーに失敗しました'],
  ['复制', 'Copy', 'コピー'],
  ['AI 正在生成这个节点…', 'AI is generating this node…', 'AI がこのノードを生成中…'],
  ['正在停止…', 'Stopping…', '停止中…'],
  ['用户停止生成', 'Stopped by user', 'ユーザーが生成を停止'],
  ['连接中断', 'Connection interrupted', '接続中断'],
  ['生成已停止，可从当前部分继续。', 'Generation stopped. You can continue from the current partial result.', '生成を停止しました。現在の部分結果から続行できます。'],
  ['没有返回可显示的正文。', 'No displayable response text was returned.', '表示できる本文が返されませんでした。'],
  ['生成中断，可继续。', 'Generation was interrupted and can be continued.', '生成が中断されました。続行できます。'],
  ['请求失败，可检查模型设置后重试；旧消息未被修改。', 'The request failed. Check model settings and retry; existing messages were not changed.', 'リクエストに失敗しました。モデル設定を確認して再試行してください。既存メッセージは変更されていません。'],
  ['请求失败，可检查模型设置后重试；父节点与旧分支未被修改。', 'The request failed. Check model settings and retry; the parent and existing branches were not changed.', 'リクエストに失敗しました。モデル設定を確認して再試行してください。親ノードと既存分岐は変更されていません。'],
  ['无法创建分支', 'Could not create branch', '分岐を作成できませんでした'],
  ['所选消息已不存在，请重新选择分叉位置。', 'The selected message no longer exists. Choose the branch point again.', '選択したメッセージが存在しません。分岐位置を選び直してください。'],
  ['当前节点起点', 'Start of current node', '現在ノードの開始点'],
  ['ChatGPT OAuth · 已连接', 'ChatGPT OAuth · Connected', 'ChatGPT OAuth · 接続済み'],
  ['尚未连接', 'Not connected', '未接続'],
  ['当前可用', 'Available now', '現在利用可能'],
  ['没有可用模型', 'No available models', '利用可能なモデルがありません'],
  ['拆解失败', 'Decomposition failed', '分解に失敗しました'],
  ['当前节点不存在，可能已被删除。', 'The current node no longer exists and may have been deleted.', '現在のノードが存在しません。削除された可能性があります。'],
  ['这条回答已被删除，无法拆解。', 'This answer was deleted and cannot be decomposed.', 'この回答は削除されているため分解できません。'],
  ['尚未选择文字。', 'No text has been selected.', '文字が選択されていません。'],
  ['这条回答没有可拆解的正文。', 'This answer has no decomposable body text.', 'この回答には分解できる本文がありません。'],
  ['模型没有返回可用且能对应原文的内容模块。', 'The model did not return usable modules that map to the source text.', 'モデルは原文に対応する利用可能な内容モジュールを返しませんでした。'],
  ['拆解已安全完成', 'Decomposition completed safely', '安全に分解しました'],
  ['已按可见文字拆解', 'Decomposed from visible text', '表示文字をもとに分解しました'],
  ['这段跨格式选区无法稳定映射到 Markdown 字符位置，系统已保留所见文字并标记为“原文位置未定位”。', 'This cross-format selection could not be mapped reliably to Markdown character offsets. The visible text was preserved and marked as “source position unresolved.”', 'この書式をまたぐ選択範囲は Markdown の文字位置へ安定して対応付けできませんでした。表示文字を保持し、「原文位置は未特定」として記録しました。'],
  ['当前内容模块已不存在。', 'The current content module no longer exists.', '現在の内容モジュールは存在しません。'],
  ['这个内容模块没有可拆解正文。', 'This content module has no decomposable body text.', 'この内容モジュールには分解できる本文がありません。'],
  ['模型没有返回可用内容模块。', 'The model did not return usable content modules.', 'モデルは利用可能な内容モジュールを返しませんでした。'],
  ['整理失败', 'Organization failed', '整理に失敗しました'],
  ['当前节点没有可整理的对话。', 'This node has no conversation to organize.', 'このノードには整理できる会話がありません。'],
  ['整理当前节点', 'Organize current node', '現在のノードを整理'],
  ['原始消息会完整保留，整理结果作为新的可追溯回答加入当前节点，不会自动拆成子节点。', 'Original messages remain intact. The organized result is added to the current node as a traceable answer and is not automatically split into child nodes.', '元のメッセージは完全に保持されます。整理結果は追跡可能な回答として現在のノードに追加され、自動的に子ノードへ分解されません。'],
  ['开始整理', 'Start organizing', '整理を開始'],
  ['整理本节点', 'Organize this node', 'このノードを整理'],
  ['Compact 当前节点', 'Compact current node', '現在のノードを Compact'],
  ['Compact 失败', 'Compact failed', 'Compact に失敗しました'],
  ['内容模块', 'Content module', '内容モジュール'],
  ['分叉锚点对应的消息已不存在，请重新选择分叉位置。', 'The message at the branch anchor no longer exists. Choose the branch point again.', '分岐アンカーのメッセージが存在しません。分岐位置を選び直してください。'],
  ['上下文快照无法定位所选消息，请重新选择。', 'The context snapshot cannot locate the selected message. Select it again.', 'コンテキストスナップショットで選択したメッセージを特定できません。選び直してください。'],
  ['当前明确问题', 'Explicit current question', '現在の明示的な質問'],
  ['当前原文来源', 'Current source text', '現在の原文参照元'],
  ['已确认目标（无）', 'Confirmed goal (none)', '確認済み目標（なし）'],
  ['无额外长期约束', 'No additional long-term constraints', '追加の長期的制約なし'],
  ['当前节点暂无局部消息。', 'The current node has no local messages yet.', '現在のノードにはまだローカルメッセージがありません。'],
  ['无祖先节点，或本次已关闭祖先路径。', 'There are no ancestor nodes, or the ancestor path is disabled for this request.', '祖先ノードがないか、今回のリクエストでは祖先パスが無効です。'],
  ['未知错误', 'Unknown error', '不明なエラー'],
  ['当前操作接口不可用，请确认已启动 v12 服务。', 'This operation endpoint is unavailable. Confirm that the v12 service is running.', 'この操作用エンドポイントは利用できません。v12 サービスが起動していることを確認してください。'],
  ['模型返回格式异常，已保留普通文本和现有数据。', 'The model returned an unexpected format. Plain text and existing data were preserved.', 'モデルの返却形式が不正です。通常テキストと既存データは保持されました。'],
  ['无法连接本地服务，请检查 Node 服务是否仍在运行。', 'Could not connect to the local service. Check whether the Node service is still running.', 'ローカルサービスへ接続できません。Node サービスが動作中か確認してください。'],
  ['当前 Codex App Server 仍返回已废弃的只读权限字段。请升级 Codex CLI，并完全退出旧的 Thought Canvas 服务后重新运行 npm start。', 'The current Codex App Server still returns a deprecated read-only permission field. Upgrade Codex CLI, fully stop the old Thought Canvas service, then run npm start again.', '現在の Codex App Server は廃止された読み取り専用権限フィールドを返しています。Codex CLI を更新し、古い Thought Canvas サービスを完全に停止してから npm start を再実行してください。'],
  ['还没有目标版本', 'No goal versions yet', '目標バージョンはまだありません'],
  ['非敏感供应商配置、默认模型与长期约束已写入本地配置。API Key 仅在“连接并同步模型”验证成功后保存。', 'Non-sensitive provider settings, default models, and long-term constraints were saved locally. API keys are saved only after “Connect and sync models” succeeds.', '機密情報以外のプロバイダー設定、既定モデル、長期的制約をローカルへ保存しました。API キーは「接続してモデルを同期」が成功した場合だけ保存されます。'],
  ['保存本地配置失败', 'Could not save local settings', 'ローカル設定を保存できませんでした'],
  ['预设', 'Preset', 'プリセット'],
  ['自定义', 'Custom', 'カスタム'],
  ['没有匹配的供应商', 'No matching providers', '一致するプロバイダーがありません'],
  ['已保存到 .env.local', 'Saved to .env.local', '.env.local に保存済み'],
  ['可选', 'Optional', '任意'],
  ['当前默认回答', 'Current default response', '現在の既定回答'],
  ['请到 OAuth 连接', 'Connect in OAuth', 'OAuth で接続してください'],
  ['配置已保存', 'Configuration saved', '設定を保存しました'],
  ['连接失败', 'Connection failed', '接続に失敗しました'],
  ['测试失败', 'Test failed', 'テストに失敗しました'],
  ['连接成功', 'Connected successfully', '接続しました'],
  ['模型目录已同步。', 'Model catalog synchronized.', 'モデルカタログを同期しました。'],
  ['供应商没有返回可用模型列表。', 'The provider did not return an available model list.', 'プロバイダーは利用可能なモデル一覧を返しませんでした。'],
  ['授权已取消，Thought Canvas 未保存任何 OAuth Token。', 'Authorization was cancelled. Thought Canvas did not store any OAuth token.', '認証をキャンセルしました。Thought Canvas は OAuth トークンを保存していません。'],
  ['授权未完成。请修复后重新尝试。', 'Authorization did not complete. Resolve the issue and try again.', '認証が完了しませんでした。問題を解決して再試行してください。'],
  ['授权完成，正在同步账号、模型与思考等级…', 'Authorization complete. Syncing account, models, and reasoning levels…', '認証が完了しました。アカウント、モデル、思考レベルを同期中…'],
  ['正在获取设备码…', 'Requesting device code…', 'デバイスコードを取得中…'],
  ['正在获取官方授权链接…', 'Requesting official authorization link…', '公式認証リンクを取得中…'],
  ['已退出 Codex 登录。', 'Signed out of Codex.', 'Codex からログアウトしました。'],
  ['已退出 Codex ChatGPT 登录。', 'Signed out of Codex ChatGPT.', 'Codex ChatGPT からログアウトしました。'],
  ['Codex 已设为当前模型', 'Codex is now the current model', 'Codex を現在のモデルに設定しました'],
  ['去重', 'Deduplicated', '重複除外'],
  ['进入汇总的内容', 'Content included in synthesis', '統合に含める内容'],
  ['如果内容超过上下文预算，系统会把较浅、较旧的节点压缩为问题与节点摘要，但不会静默删除节点。每一项的输入方式已标在右侧。', 'If content exceeds the context budget, shallower and older nodes are compressed into questions and node summaries. No node is silently removed, and each item’s input mode is shown on the right.', '内容がコンテキスト予算を超える場合、浅く古いノードを質問とノード要約へ圧縮します。ノードを黙って削除せず、各項目の入力方法を右側に表示します。'],
  ['至少保留两个节点才能汇总。', 'Keep at least two nodes to synthesize.', '統合には少なくとも 2 つのノードを残してください。'],
  ['所选内容汇总', 'Selected-content synthesis', '選択内容の統合'],
  ['汇总失败', 'Synthesis failed', '統合に失敗しました'],
  ['无法汇总', 'Could not synthesize', '統合できませんでした'],
  ['无​​法导出', 'Could not export', 'エクスポートできませんでした'],
  ['无法导出', 'Could not export', 'エクスポートできませんでした'],
  ['请先打开一个项目。', 'Open a project first.', '先にプロジェクトを開いてください。'],
  ['导出已创建', 'Export created', 'エクスポートを作成しました'],
  ['已交给浏览器保存。', 'The browser is saving the file.', 'ブラウザーへ保存を引き渡しました。'],
  ['时间未知', 'Unknown time', '時刻不明'],
  ['正在读取版本记录…', 'Loading version history…', 'バージョン履歴を読み込み中…'],
  ['当前还没有可恢复的旧版本', 'There are no restorable versions yet', '復元できる過去バージョンはまだありません'],
  ['读取失败', 'Load failed', '読み込みに失敗しました'],
  ['恢复此版本', 'Restore this version', 'このバージョンを復元'],
  ['继续编辑并保存项目后，这里会出现覆盖保存前的版本。\n项目正文、节点位置和推理关系都会一起恢复。', 'After you continue editing and save, versions from before overwrites appear here.\nProject content, node positions, and reasoning relations are restored together.', '編集を続けて保存すると、上書き前のバージョンがここに表示されます。\nプロジェクト本文、ノード位置、推論関係がまとめて復元されます。'],
  ['恢复本地版本', 'Restore local version', 'ローカルバージョンを復元'],
  ['用所选版本替换当前画布？', 'Replace the current canvas with the selected version?', '選択したバージョンで現在のキャンバスを置き換えますか？'],
  ['恢复前会先自动备份当前版本，因此之后仍可再次找回。', 'The current version is backed up automatically before restoring, so it can still be recovered later.', '復元前に現在のバージョンを自動バックアップするため、後から再び戻せます。'],
  ['恢复失败', 'Restore failed', '復元に失敗しました'],
  ['导入失败', 'Import failed', 'インポートに失敗しました'],
  ['模型尚未连接', 'Model not connected', 'モデルが未接続です'],
  ['未选择模型', 'No model selected', 'モデル未選択'],
  ['未知协议', 'Unknown protocol', '不明なプロトコル'],
  ['本地项目文件写入失败，请检查目录权限', 'Could not write the local project file. Check folder permissions.', 'ローカルプロジェクトファイルへ書き込めません。フォルダー権限を確認してください。'],
  ['正在保存…', 'Saving…', '保存中…'],
  ['保存失败 · 点击重试', 'Save failed · Click to retry', '保存に失敗 · クリックして再試行'],
  ['检查目录权限', 'Check folder permissions', 'フォルダー権限を確認'],
  ['生成失败', 'Generation failed', '生成に失敗しました'],

  // Provider categories and descriptions.
  ['官方', 'Official', '公式'],
  ['OAuth / 本地', 'OAuth / Local', 'OAuth / ローカル'],
  ['常用服务', 'Common services', 'よく使うサービス'],
  ['中国云 / 聚合', 'China cloud / Aggregators', '中国クラウド / アグリゲーター'],
  ['国际聚合', 'Global aggregators', '海外アグリゲーター'],
  ['本地', 'Local', 'ローカル'],
  ['CC Switch 模板', 'CC Switch templates', 'CC Switch テンプレート'],
  ['通过本机 Codex App Server 连接 ChatGPT，并动态读取账号可用模型。', 'Connect to ChatGPT through the local Codex App Server and discover models available to the account.', 'ローカルの Codex App Server で ChatGPT に接続し、アカウントで利用可能なモデルを動的に取得します。'],
  ['官方 Responses API。', 'Official Responses API.', '公式 Responses API。'],
  ['官方 Messages API。', 'Official Messages API.', '公式 Messages API。'],
  ['OpenAI Chat Completions 兼容接口。', 'OpenAI Chat Completions-compatible API.', 'OpenAI Chat Completions 互換 API。'],
  ['请按 OpenCode Go 控制台填写 Base URL 与模型 ID。', 'Enter the Base URL and model ID shown in the OpenCode Go console.', 'OpenCode Go コンソールに表示された Base URL とモデル ID を入力してください。'],
  ['MiniMax OpenAI 兼容接口。', 'MiniMax OpenAI-compatible API.', 'MiniMax OpenAI 互換 API。'],
  ['MiniMax 国内 OpenAI 兼容接口。', 'MiniMax China OpenAI-compatible API.', 'MiniMax 中国向け OpenAI 互換 API。'],
  ['Kimi OpenAI 兼容接口。', 'Kimi OpenAI-compatible API.', 'Kimi OpenAI 互換 API。'],
  ['模型 ID 通常是 Ark Endpoint ID。', 'The model ID is usually an Ark endpoint ID.', 'モデル ID は通常 Ark Endpoint ID です。'],
  ['供应商模板：请从服务商控制台填写 Base URL、API Key 与模型列表。', 'Provider template: enter the Base URL, API key, and model list from the provider console.', 'プロバイダーテンプレート：サービスのコンソールから Base URL、API キー、モデル一覧を入力してください。'],
  ['填写模型 ID', 'Enter model ID', 'モデル ID を入力'],
  ['填写 Ark Endpoint ID', 'Enter Ark endpoint ID', 'Ark Endpoint ID を入力'],
  ['当前已加载模型', 'Currently loaded model', '現在読み込み済みのモデル'],
  ['通用 OpenAI 兼容', 'Generic OpenAI-compatible', '汎用 OpenAI 互換'],
  ['通用 Anthropic 兼容', 'Generic Anthropic-compatible', '汎用 Anthropic 互換'],
  ['通用 Gemini 兼容', 'Generic Gemini-compatible', '汎用 Gemini 互換'],
  ['无需认证', 'No authentication', '認証不要'],
  ['自动', 'Auto', '自動'],
  ['关闭思考', 'Reasoning off', '思考をオフ'],
  ['极简', 'Minimal', '最小'],
  ['低', 'Low', '低'],
  ['中', 'Medium', '中'],
  ['高', 'High', '高'],
  ['很高', 'Very high', '非常に高い'],
  ['最高', 'Maximum', '最大'],
  ['自动识别', 'Auto-detect', '自動判定'],
  ['不发送思考参数', 'Do not send reasoning parameters', '思考パラメータを送信しない'],
  ['采用模型默认', 'Use model default', 'モデル既定値を使用'],
  ['部分回答', 'Partial answer', '部分回答'],
  ['错误', 'Error', 'エラー'],
  ['关联', 'Related', '関連'],
  ['提炼自', 'Promoted from', '抽出元'],
  ['决策', 'Decision', '意思決定']
];

const DICTIONARIES = Object.freeze({
  en: Object.freeze(Object.fromEntries(TRANSLATION_ROWS.map(([source, en]) => [source, en]))),
  ja: Object.freeze(Object.fromEntries(TRANSLATION_ROWS.map(([source, , ja]) => [source, ja])))
});

let activeLocale = DEFAULT_UI_LANGUAGE;
let observer = null;
let applying = false;
const textRecords = new WeakMap();
const attributeRecords = new WeakMap();
const observedAttributes = ['aria-label', 'title', 'placeholder', 'data-tooltip', 'content'];

const USER_CONTENT_SELECTOR = [
  '[data-no-i18n]',
  '.message-body',
  '.project-copy strong',
  '.node > h3',
  '.node > p',
  '.project-tile-copy strong',
  '.project-tile-summary',
  '#goalSuggestionText',
  '.oauth-log',
  '.compare-output',
  '.artifact-card h4',
  '.artifact-card p',
  '.reasoning-artifact-card h4',
  '.reasoning-artifact-card p',
  'pre code'
].join(',');

export function normalizeUiLanguage(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'en' || raw.startsWith('en-')) return 'en';
  if (raw === 'ja' || raw.startsWith('ja-')) return 'ja';
  return DEFAULT_UI_LANGUAGE;
}

export function getUiLanguage() {
  return activeLocale;
}

export function localeForIntl(locale = activeLocale) {
  return normalizeUiLanguage(locale) === 'en' ? 'en-US' : normalizeUiLanguage(locale) === 'ja' ? 'ja-JP' : 'zh-CN';
}

export function t(source, variables = {}, locale = activeLocale) {
  const canonical = String(source ?? '');
  const normalizedLocale = normalizeUiLanguage(locale);
  let translated = normalizedLocale === DEFAULT_UI_LANGUAGE
    ? canonical
    : DICTIONARIES[normalizedLocale]?.[canonical] ?? translatePattern(canonical, normalizedLocale) ?? canonical;
  for (const [key, value] of Object.entries(variables || {})) {
    translated = translated.replaceAll(`{${key}}`, String(value));
  }
  return translated;
}

export function hasTranslation(source) {
  const canonical = String(source ?? '').trim();
  return Boolean(DICTIONARIES.en[canonical] || DICTIONARIES.ja[canonical] || translatePattern(canonical, 'en') || translatePattern(canonical, 'ja'));
}

export function setUiLanguage(locale, { localize = true } = {}) {
  activeLocale = normalizeUiLanguage(locale);
  const root = globalThis.document?.documentElement;
  if (root) {
    root.lang = activeLocale;
    root.dataset.uiLanguage = activeLocale;
    if (localize) localizeUi(root);
  }
  return activeLocale;
}

export function startUiLocalization(root = globalThis.document?.documentElement) {
  if (!root || typeof MutationObserver === 'undefined') return null;
  localizeUi(root);
  if (observer) return observer;
  observer = new MutationObserver(mutations => {
    if (applying) return;
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') localizeTextNode(mutation.target);
      if (mutation.type === 'attributes') localizeAttribute(mutation.target, mutation.attributeName);
      for (const node of mutation.addedNodes || []) localizeUi(node);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: observedAttributes });
  return observer;
}

export function stopUiLocalization() {
  observer?.disconnect();
  observer = null;
}

export function localizeUi(root = globalThis.document?.documentElement) {
  if (!root || typeof Node === 'undefined' || typeof document === 'undefined') return;
  applying = true;
  try {
    if (root.nodeType === Node.TEXT_NODE) {
      localizeTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) localizeElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let current;
    while ((current = walker.nextNode())) {
      if (current.nodeType === Node.TEXT_NODE) localizeTextNode(current);
      else localizeElement(current);
    }
  } finally {
    applying = false;
  }
}

export function responseLanguageInstruction(locale = activeLocale) {
  const normalized = normalizeUiLanguage(locale);
  if (normalized === 'en') return 'Response language: English. Use another language only when the user explicitly requests it.';
  if (normalized === 'ja') return '回答言語：日本語。ユーザーが明示的に別の言語を求めた場合だけ、その言語へ切り替えてください。';
  return '回答语言：简体中文。只有用户明确要求其他语言时才切换。';
}

function localizeElement(element) {
  if (!(element instanceof Element)) return;
  for (const attribute of observedAttributes) localizeAttribute(element, attribute);
}

function localizeAttribute(element, attribute) {
  if (!(element instanceof Element) || !attribute || !element.hasAttribute(attribute)) return;
  const current = element.getAttribute(attribute) || '';
  let records = attributeRecords.get(element);
  if (!records) {
    records = new Map();
    attributeRecords.set(element, records);
  }
  const previous = records.get(attribute);
  const source = previous && current === previous.rendered ? previous.source : current;
  const rendered = translatePreservingSpace(source);
  records.set(attribute, { source, rendered });
  if (current !== rendered) element.setAttribute(attribute, rendered);
}

function localizeTextNode(node) {
  if (!(node instanceof Text)) return;
  const parent = node.parentElement;
  if (!parent || shouldSkip(parent)) return;
  const current = node.nodeValue || '';
  if (!current.trim()) return;
  const previous = textRecords.get(node);
  const source = previous && current === previous.rendered ? previous.source : current;
  const rendered = translatePreservingSpace(source);
  if (!hasTranslation(source.trim()) && rendered === source) return;
  textRecords.set(node, { source, rendered });
  if (current !== rendered) node.nodeValue = rendered;
}

function shouldSkip(element) {
  if (element.closest('[data-i18n-ui]')) return false;
  return Boolean(element.closest(USER_CONTENT_SELECTOR));
}

function translatePreservingSpace(value) {
  const raw = String(value ?? '');
  const leading = raw.match(/^\s*/)?.[0] || '';
  const trailing = raw.match(/\s*$/)?.[0] || '';
  const core = raw.slice(leading.length, raw.length - trailing.length);
  if (!core) return raw;
  const translated = t(core);
  return `${leading}${translated}${trailing}`;
}

function translatePattern(source, locale) {
  const rules = locale === 'ja' ? JA_PATTERN_RULES : EN_PATTERN_RULES;
  for (const [pattern, formatter] of rules) {
    const match = String(source || '').match(pattern);
    if (match) return formatter(...match.slice(1));
  }
  return null;
}

const plural = (count, singular, pluralForm = `${singular}s`) => Number(count) === 1 ? singular : pluralForm;

const EN_PATTERN_RULES = [
  [/^(\d+) 个项目$/, count => `${count} ${plural(count, 'project')}`],
  [/^(\d+) 个节点$/, count => `${count} ${plural(count, 'node')}`],
  [/^(\d+) 个节点 · (.+)$/, (count, rest) => `${count} ${plural(count, 'node')} · ${t(rest, {}, 'en')}`],
  [/^已选择 (\d+) 个节点$/, count => `${count} ${plural(count, 'node')} selected`],
  [/^(\d+) 个所选节点$/, count => `${count} selected ${plural(count, 'node')}`],
  [/^(\d+) 分钟前$/, count => `${count} ${plural(count, 'minute')} ago`],
  [/^(\d+) 小时前$/, count => `${count} ${plural(count, 'hour')} ago`],
  [/^已采用 · v(\d+)$/, version => `Accepted · v${version}`],
  [/^用户确认 · v(\d+)$/, version => `User-confirmed · v${version}`],
  [/^已确认目标 v(\d+)$/, version => `Confirmed goal v${version}`],
  [/^目标 v(\d+)$/, version => `Goal v${version}`],
  [/^Compact v(\d+)$/, version => `Compact v${version}`],
  [/^查看 Compact v(\d+) · 覆盖 (\d+) 条消息$/, (version, count) => `View Compact v${version} · ${count} ${plural(count, 'message')} covered`],
  [/^\+(\d+) 已折叠$/, count => `+${count} collapsed`],
  [/^(\d+)\/(\d+) 子分支完成$/, (done, total) => `${done}/${total} child branches complete`],
  [/^折叠后续节点（(\d+)）$/, count => `Collapse descendants (${count})`],
  [/^返回 (.+)$/, title => `Back to ${title}`],
  [/^返回来源节点：(.+)$/, title => `Return to source node: ${title}`],
  [/^已选 (\d+) 字$/, count => `${count} characters selected`],
  [/^拆解已选 (\d+) 字$/, count => `Decompose ${count} selected characters`],
  [/^提炼已选 (\d+) 字$/, count => `Promote ${count} selected characters`],
  [/^(\d+) 字符 · 约 (\d+) tokens$/, (chars, tokens) => `${chars} characters · about ${tokens} tokens`],
  [/^约 (\d+) tokens$/, tokens => `About ${tokens} tokens`],
  [/^当前节点历史（继承 (\d+) 条）$/, count => `Current-node history (${count} inherited)`],
  [/^祖先路径（(\d+) 个节点）$/, count => `Ancestor path (${count} ${plural(count, 'node')})`],
  [/^长期约束（(\d+) 条）$/, count => `Long-term constraints (${count})`],
  [/^(\d+) 个可追溯对象$/, count => `${count} traceable ${plural(count, 'object')}`],
  [/^(\d+) 个对象$/, count => `${count} ${plural(count, 'object')}`],
  [/^(\d+) 条关系$/, count => `${count} ${plural(count, 'relation')}`],
  [/^(\d+) 个已验证$/, count => `${count} verified`],
  [/^(\d+) 个待处理$/, count => `${count} open`],
  [/^更新 (.+)$/, value => `Updated ${value}`],
  [/^汇总 (\d+) 个所选节点$/, count => `Synthesize ${count} selected ${plural(count, 'node')}`],
  [/^汇总输入（(\d+) 个节点）$/, count => `Synthesis input (${count} ${plural(count, 'node')})`],
  [/^保留最近 (\d+) 个本地版本$/, count => `Keeping the latest ${count} local versions`],
  [/^(\d+) 个推理对象 · 当前可见 (\d+) 个$/, (total, visible) => `${total} reasoning objects · ${visible} visible`],
  [/^自动使用模型默认等级(.+)$/, suffix => `Use the model’s default reasoning level${suffix}`],
  [/^从“(.+)”中的(.+)之后分叉；更晚的消息不会进入新分支上下文。$/, (node, anchor) => `Branch after ${anchor} in “${node}”; later messages are excluded from the new branch context.`],
  [/^围绕“(.+)”继续追问。$/, title => `Continue asking about “${title}”.`],
  [/^整理 (\d+) 条消息？$/, count => `Organize ${count} ${plural(count, 'message')}?`],
  [/^(.+) 还没有完成连接验证。请在设置中使用 API Key 连接并同步模型，或通过 ChatGPT OAuth 连接 Codex。$/, provider => `${provider} has not completed connection verification. Connect and sync it with an API key in Settings, or connect Codex through ChatGPT OAuth.`]
];

const JA_PATTERN_RULES = [
  [/^(\d+) 个项目$/, count => `${count} 件のプロジェクト`],
  [/^(\d+) 个节点$/, count => `${count} 個のノード`],
  [/^(\d+) 个节点 · (.+)$/, (count, rest) => `${count} 個のノード · ${t(rest, {}, 'ja')}`],
  [/^已选择 (\d+) 个节点$/, count => `${count} 個のノードを選択`],
  [/^(\d+) 个所选节点$/, count => `選択した ${count} 個のノード`],
  [/^(\d+) 分钟前$/, count => `${count} 分前`],
  [/^(\d+) 小时前$/, count => `${count} 時間前`],
  [/^已采用 · v(\d+)$/, version => `採用済み · v${version}`],
  [/^用户确认 · v(\d+)$/, version => `ユーザー確認済み · v${version}`],
  [/^已确认目标 v(\d+)$/, version => `確認済み目標 v${version}`],
  [/^目标 v(\d+)$/, version => `目標 v${version}`],
  [/^Compact v(\d+)$/, version => `Compact v${version}`],
  [/^查看 Compact v(\d+) · 覆盖 (\d+) 条消息$/, (version, count) => `Compact v${version} を表示 · ${count} 件のメッセージを対象`],
  [/^\+(\d+) 已折叠$/, count => `+${count} 折りたたみ`],
  [/^(\d+)\/(\d+) 子分支完成$/, (done, total) => `子分岐 ${done}/${total} 完了`],
  [/^折叠后续节点（(\d+)）$/, count => `後続ノードを折りたたむ（${count}）`],
  [/^返回 (.+)$/, title => `${title} に戻る`],
  [/^返回来源节点：(.+)$/, title => `参照元ノードへ戻る：${title}`],
  [/^已选 (\d+) 字$/, count => `${count} 文字を選択`],
  [/^拆解已选 (\d+) 字$/, count => `選択した ${count} 文字を分解`],
  [/^提炼已选 (\d+) 字$/, count => `選択した ${count} 文字を抽出`],
  [/^(\d+) 字符 · 约 (\d+) tokens$/, (chars, tokens) => `${chars} 文字 · 約 ${tokens} tokens`],
  [/^约 (\d+) tokens$/, tokens => `約 ${tokens} tokens`],
  [/^当前节点历史（继承 (\d+) 条）$/, count => `現在ノードの履歴（${count} 件を継承）`],
  [/^祖先路径（(\d+) 个节点）$/, count => `祖先パス（${count} 個のノード）`],
  [/^长期约束（(\d+) 条）$/, count => `長期的な制約（${count} 件）`],
  [/^(\d+) 个可追溯对象$/, count => `${count} 個の追跡可能なオブジェクト`],
  [/^(\d+) 个对象$/, count => `${count} 個のオブジェクト`],
  [/^(\d+) 条关系$/, count => `${count} 件の関係`],
  [/^(\d+) 个已验证$/, count => `${count} 件検証済み`],
  [/^(\d+) 个待处理$/, count => `${count} 件未処理`],
  [/^更新 (.+)$/, value => `${value} に更新`],
  [/^汇总 (\d+) 个所选节点$/, count => `選択した ${count} 個のノードを統合`],
  [/^汇总输入（(\d+) 个节点）$/, count => `統合入力（${count} 個のノード）`],
  [/^保留最近 (\d+) 个本地版本$/, count => `直近 ${count} 件のローカルバージョンを保持`],
  [/^(\d+) 个推理对象 · 当前可见 (\d+) 个$/, (total, visible) => `推論オブジェクト ${total} 個 · 現在 ${visible} 個を表示`],
  [/^自动使用模型默认等级(.+)$/, suffix => `モデル既定の思考レベルを自動使用${suffix}`],
  [/^从“(.+)”中的(.+)之后分叉；更晚的消息不会进入新分支上下文。$/, (node, anchor) => `「${node}」の ${anchor} 以降から分岐します。より後のメッセージは新しい分岐のコンテキストに入りません。`],
  [/^围绕“(.+)”继续追问。$/, title => `「${title}」について質問を続けます。`],
  [/^整理 (\d+) 条消息？$/, count => `${count} 件のメッセージを整理しますか？`],
  [/^(.+) 还没有完成连接验证。请在设置中使用 API Key 连接并同步模型，或通过 ChatGPT OAuth 连接 Codex。$/, provider => `${provider} は接続確認が完了していません。設定で API キーを使って接続・モデル同期するか、ChatGPT OAuth で Codex に接続してください。`]
];
