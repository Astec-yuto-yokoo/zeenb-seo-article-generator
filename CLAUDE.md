# プロジェクト概要

SEO最適化された記事構成・記事本文を自動生成するツール（zeenb クライアント専用カスタマイズ版）。Gemini API を軸に、競合調査・構成生成・執筆・校閲までをワンストップで処理する。

# コマンド

```bash
# 推奨: 全サーバー一括起動
bash ./start.sh

# 個別起動
npm run dev          # フロントエンド（ポート 5180）
npm run server       # スクレイピングサーバー（ポート 3003）
cd ai-article-imager-for-wordpress && npm run dev  # 画像生成エージェント（ポート 5181）

# ビルド
npm run build

# サーバー疎通確認
curl http://localhost:3003/api/health
```

# 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フロントエンド | React 19, Vite 6, TypeScript, Tailwind CSS |
| バックエンド | Node.js, Express 4 |
| AI（構成・執筆・修正） | Gemini 2.5 Pro（`@google/generative-ai`） |
| AI（最終校閲） | GPT-5 / gpt-5-mini / gpt-5-nano（OpenAI Responses API） |
| AI（MoA相互検証） | Claude（`@anthropic-ai/sdk`） |
| スクレイピング | Puppeteer（開発）/ puppeteer-core + @sparticuz/chromium（本番） |
| 外部データ | Google Custom Search API, Google Drive API（ADC認証） |
| DB | Supabase |
| OCR | Tesseract.js, Sharp（eng/jpn 訓練データ同梱） |
| その他 | kuromoji（形態素解析）, docx（Word出力）, pdf-parse（PDF解析） |

# ディレクトリ構成

```
zeenb-seo-article-generator/
├── App.tsx                    # メインアプリ（タブ管理・全体統合）
├── types.ts                   # グローバル型定義
├── vite.config.ts             # Vite設定（ポート5180、/api→3003プロキシ）
├── start.sh                   # 全サーバー一括起動スクリプト
├── components/                # React UIコンポーネント（32ファイル）
│   ├── ArticleWriter.tsx      # 執筆フロー全体UI（執筆・チェック・校閲）
│   ├── OutlineDisplayV2.tsx   # 構成V2表示・編集
│   ├── CompetitorResearchWebFetch.tsx  # 競合調査UI
│   ├── ArticleRevisionForm.tsx        # 修正指示UI
│   └── FrequencyWordsTab.tsx  # 頻出単語分析UI
├── services/                  # サービス層（43ファイル）
│   ├── outlineGeneratorV2.ts  # 構成V2生成（ルール定義含む）
│   ├── outlineCheckerV2.ts    # 構成V2バリデーション
│   ├── writingAgentV3.ts      # 記事執筆（Gemini 2.5 Pro + Grounding）
│   ├── writingCheckerV3.ts    # 執筆品質チェック
│   ├── articleRevisionService.ts  # 記事修正（手動ボタン後のみ）
│   ├── competitorResearchWithWebFetch.ts  # 競合調査（現行）
│   ├── driveAutoAuth.cjs      # Google Drive ADC認証（CommonJS形式）
│   └── finalProofreadingAgents/  # マルチエージェント校閲（現行）
│       ├── MultiAgentOrchestrator.ts
│       ├── IntegrationAgent.ts    # 100点満点スコア統合（75点以上で合格）
│       ├── MixtureOfAgentsVerifier.ts  # Gemini+GPT-5+Claude の3モデル相互検証
│       └── （専門エージェント7個＋出典エージェント3個）
├── utils/                     # ヘルパー関数（8ファイル）
├── hooks/
│   └── useImageAgent.ts       # 画像生成エージェント連携
├── server/                    # バックエンド（Express）
│   ├── scraping-server.js     # メインサーバー（SearchAPI + Puppeteer）
│   ├── eng.traineddata        # Tesseract OCR 英語データ
│   ├── jpn.traineddata        # Tesseract OCR 日本語データ
│   └── api/                   # 補助エンドポイント（Drive, Sheets, リンク検証）
├── ai-article-imager-for-wordpress/  # 画像生成エージェント（サブプロジェクト・ポート5181）
│   └── image-generation-agent/      # Vue/Vite副プロジェクト
├── docs/                      # デプロイ・セットアップドキュメント
└── dist/                      # ビルド出力
```

# ルール・注意点

## ポート割り当て

| ポート | 用途 |
|--------|------|
| 5180 | メインアプリ（Vite） |
| 3003 | スクレイピングサーバー（Puppeteer + SearchAPI） |
| 5181 | 画像生成エージェント |

## コーディング

**Optional Chaining（`?.`）禁止** — Claude Code クラッシュの原因になる。段階的 null チェックに置き換える。

```typescript
// ❌ 禁止
const name = obj?.user?.name;
// ✅ 正しい
const name = obj && obj.user ? obj.user.name : undefined;
```

- Google Drive 関連の Node.js スクリプトは `.cjs` 拡張子（CommonJS形式）で記述
- 技術仕様（モデル名・ライブラリ・バージョン）を勝手に変更しない。変更が必要な場合は提案して承認を得てから実装
- コミットは明示的に指示された時のみ

## OpenAI Responses API（GPT-5用）

```typescript
const response = await (openai as any).responses.create({
  model: 'gpt-5-mini',        // gpt-5 / gpt-5-mini / gpt-5-nano
  input: userInput,            // messages ではなく input
  tools: [{ type: 'web_search' }],
  reasoning: { effort: 'high' },
  max_completion_tokens: 4000  // max_tokens ではない
});
// temperature は GPT-5 では 1.0 固定（変更不可）
```

## 環境変数

```
GEMINI_API_KEY / VITE_GEMINI_API_KEY   # Gemini API（必須）
GOOGLE_API_KEY / VITE_GOOGLE_API_KEY   # Custom Search API（必須）
GOOGLE_SEARCH_ENGINE_ID / VITE_GOOGLE_SEARCH_ENGINE_ID  # カスタム検索エンジンID（必須）
OPENAI_API_KEY                         # GPT-5最終校閲用
ANTHROPIC_API_KEY                      # Claude MoA相互検証用
INTERNAL_API_KEY / VITE_INTERNAL_API_KEY
COMPANY_DATA_FOLDER_ID                 # Google DriveフォルダID
WP_BASE_URL / WP_USERNAME / WP_APP_PASSWORD  # WordPress連携
SLACK_WEBHOOK_URL
VITE_SERVICE_NAME / VITE_COMPANY_NAME  # 自社ブランド情報
VITE_COMPANY_NOTE_URL / VITE_COMPANY_MEDIA_URL / VITE_COMPANY_SITE_URL  # 自社出典URL
GOOGLE_APPLICATION_CREDENTIALS_JSON   # GCP認証（画像生成エージェント用）
BOX_CLIENT_ID / BOX_CLIENT_SECRET / BOX_ENTERPRISE_ID  # BOX JWT認証
BOX_JWT_KEY_ID / BOX_PRIVATE_KEY / BOX_PASSPHRASE      # BOX JWT鍵
BOX_FOLDER_ID                          # BOX画像フォルダID
DIFY_FACTCHECK_API_KEY                 # 社内ライブラリ・ファクトチェッカー（Dify Workflow）APIキー
DIFY_FACTCHECK_ENDPOINT                # 任意。未設定時は https://api.dify.ai/v1/workflows/run
```

`VITE_` プレフィックスのある変数のみブラウザ側で参照可能。

## 見出し番号付与ルール（絶対厳守）

最終記事HTMLの全 `<h2>` / `<h3>` には、文頭に番号を必ず振る。

- **H2**: `N. ` 通し番号（半角数字 + ピリオド + 半角スペース）— FAQ・まとめ・自社サービス訴求も含めて例外なし
- **H3**: `N-M. ` 形式（親H2番号 - H3連番、H2ごとに連番リセット）
- 番号付与は `utils/headingNumberer.ts` の `numberArticleHeadings()` が **冪等**に処理（既存番号は剥がして付け直す）
- 呼び出し箇所: `writingAgentV3.ts` の出力直前 / `sectionBasedArticleWriter.ts` の結合直後 / `ArticleWriter.tsx` の `cleanupArticleContent()` / `articleRevisionService.ts` のH2修正後
- **データ層（`OutlineSectionV2.heading` 等）には番号を入れない**。表示は `buildOutlineLabels()` で計算
- 参考フォーマット: https://zeenb.astecpaints.jp/journal/color/painting-color-48427

## 構成 Ver.2 ルール（絶対厳守）

- タイトル: **29〜35文字**（32文字前後が理想）、自社サービス名・【】記号を含めない
- H2見出し: 【】等記号で囲まない。「○選」等の数字があればH3は**その数と同数**で**通し番号**を付ける
- H3配分: H2ごとに「0個」または「2個以上」（**1個は禁止**）
- 最後3つのH2（固定順序）:
  1. FAQ・よくある質問（任意）
  2. **自社サービス訴求**（必須・H3を2〜3個）
  3. **まとめ**（必須・H3は0個）— 形式: `まとめ：[キーワード]を含む総括的なサブタイトル`

## 記事文字数制御

- **目標**: 5,000〜6,000文字（デフォルト5,500文字）
- `writingAgentV3.ts` の `WritingRequest.targetCharCount` で制御
- `ArticleWriter.tsx` で `characterCountAnalysis.average` を上限6,000でキャップして渡す
- プロンプトで「±10%以内、超過禁止」と明示指示
- `maxOutputTokens: 8192` でトークン上限も制限
- **1段落（`<p>`タグ）あたり最大140字**を厳守。超える場合は分割する
- **注意**: `maxOutputTokens` や `length_control`、段落文字数上限のプロンプト文言を勝手に緩和しないこと

## H2ブロック単位修正機能

### 構成案H2修正（構成生成後・執筆前）
- `services/outlineGeneratorV2.ts` の `reviseOutlineSection()` — 対象H2セクションの構成をGemini 2.5 Proで修正
- `components/OutlineDisplayV2.tsx` — 各H2ブロック下にtextarea＋「AI修正」ボタン
- `App.tsx` — `onOutlineUpdate` コールバックで構成案stateを更新

### 本文H2修正（執筆後）
- `services/articleRevisionService.ts` の `reviseArticleH2Section()` — 記事HTMLからH2セクションを正規表現で抽出→修正→再結合
- `components/ArticleWriter.tsx` — 記事プレビュー下に折りたたみ式「H2セクション単位で修正」パネル
- 修正後は `fixWordPressListBlocks()` / `fixWordPressTableBlocks()` で自動整形

## 処理フロー

```
キーワード入力
  → 競合調査（competitorResearchWithWebFetch → scraping-server）
  → 構成生成V2（outlineGeneratorV2 → outlineCheckerV2）
  → [任意] 構成案H2修正（reviseOutlineSection）
  → [自動] BOX画像取得（boxImageService → /api/box-images）
  → 執筆（writingAgentV3: Gemini 2.5 Pro + Grounding、目標5000〜6000文字、BOX画像自動挿入）
  → 執筆チェック（writingCheckerV3）
  → [任意] 本文H2修正（reviseArticleH2Section）
  → 最終校閲マルチエージェント
      Phase 1（並列）: 7専門エージェント
      Phase 2（順次）: 出典エージェント3個 + 社内ライブラリ照合（Dify Workflow）
      Phase 3（統合）: IntegrationAgent（75点以上で合格）
  → 記事修正（人間確認後ボタン押下時のみ）
```

## Google Drive ADC認証

初回セットアップ（1回のみ）:
```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/drive.readonly
```

ADC認証が失敗する場合: `gcloud auth application-default login --force`

## BOX画像連携（zeenbのみ）

BOXに保存された画像を記事生成時にAIが自動選択・挿入する機能。JWT認証でBOX APIに接続。

**アーキテクチャ:**
- `server/api/box-images.js` — BOX JWT認証 + フォルダ内画像一覧取得 + 共有リンク作成（サーバー側）
- `services/boxImageService.ts` — `/api/box-images` エンドポイントを呼び出すフロントエンドサービス
- `services/contextBuilder.ts` — `ImageAsset[]` をAIプロンプト用テキストに整形
- `services/writingAgentV3.ts` — `WritingRequest.imageAssets` で画像コンテキストを受け取りプロンプトに注入

**画像使用ルール（AIプロンプト内で指示）:**
- 画像は記事内容に関連がある場合のみ使用（無理に使わない）
- 各H2セクションにつき最大1枚
- `<figure><img src="URL" alt="説明"><figcaption>説明</figcaption></figure>` 形式で出力
- BOX環境変数未設定時は空配列を返し、画像なしで記事生成を続行

**依存パッケージ:** `box-node-sdk`（サーバー側のみ）

## 社内ライブラリ・ファクトチェッカー（Dify Workflow連携）

記事内の表現や情報が社内定義に則しているかをチェックする機能。Phase 2の最後に「社内ライブラリ照合エージェント」として組み込まれる。

**アーキテクチャ:**
- `server/api/internal-fact-check.js` — Dify Workflow API（`https://api.dify.ai/v1/workflows/run`）へのプロキシ（APIキーはサーバー側で保持）
- `services/internalLibraryFactCheck.ts` — `/api/internal-fact-check` を呼ぶフロントエンド薄ラッパー
- `services/finalProofreadingAgents/InternalLibraryFactCheckAgent.ts` — Phase 2エージェント本体（BaseAgentのexecuteを上書き、OpenAI不要）

**Dify ワークフロー側の前提:**
- 入力: `article_text`（記事HTMLをそのまま送信）
- 出力: `outputs.fact_check_result`（人間可読のレポートテキスト）
- レスポンスモード: `blocking`
- Dify側処理時間目安: 35〜75秒（クライアント側タイムアウトは120秒で設定）

**スコア反映:**
- IntegrationAgentの `factChecking` バケットに最大5点ボーナス（上限45点でcap）
- 失敗時はステータス `error` で記録され、他エージェント同様に記事生成は続行
- APIキー未設定（`DIFY_FACTCHECK_API_KEY` なし）時はスキップして続行

**指摘の整形:**
- `fact_check_result` の「■」または「【〜】」始まりブロックを `Issue` として分割登録
- severity: `major` / type: `factual-error`
- ポジティブのみのレポート（「問題なし」「合致」など）はスコア95で `issues` 空

## 姉妹プロジェクト（3プロジェクト共通管理）

同一コードベースのクライアント別カスタマイズ版が3つ存在する。共通修正は必ず3プロジェクトすべてに適用すること。

| プロジェクト | フロント | バックエンド | 画像生成 |
|---|---|---|---|
| zeenb-seo-article-generator | 5180 | 3003 | 5181 |
| factory-seo-article-generator | 5178 | 3002 | 5179 |
| apaman-seo-article-generator | 5176 | 3001 | 5177 |

- バックエンドポートのハードコード箇所が多数あるため、ポート変更時はサービスファイル全体を `localhost:旧ポート` で検索して漏れなく置換すること

## WordPress ブロックエディタ互換

記事HTMLは WordPress Gutenberg 互換フォーマットで出力する。

- **リスト**: `fixWordPressListBlocks()` で `<!-- wp:list -->` + `wp-block-list` クラスに変換（factory・apaman のみ。zeenb はリストタグ自体を除去）
- **テーブル**: `fixWordPressTableBlocks()` で `<!-- wp:table -->` + `<figure class="wp-block-table">` ラッパーに変換（3プロジェクト共通）
- 両関数とも冪等性あり（既にブロック構造の場合も正しく処理）
- クリーンアップ処理（`cleanupArticleContent`）内で順に呼び出される

## テーブル生成ルール

- Markdown記法（`|` や `---`）は禁止。必ず `<table>` HTMLで出力
- **セル結合（rowspan/colspan）は禁止**。同じ値が複数行に跨がる場合でも各行すべてに同じ値を繰り返し記載する（WordPress エディタにセル結合機能がないため）
- テーブルスタイルは `index.css` の `.article-content table` で定義
