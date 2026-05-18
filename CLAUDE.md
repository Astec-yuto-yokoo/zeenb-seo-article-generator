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
```

`VITE_` プレフィックスのある変数のみブラウザ側で参照可能。

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

## 参考資料（H2別選択・執筆反映）

### データフロー
```
types.ts: OutlineSectionV2.referenceMaterialIds?: string[]
  → OutlineDisplayV2.tsx: 各H2下に参考資料チェックボックスUI（expandedMaterialSections state）
  → App.tsx: referenceMaterialIds → availableMaterials（ReferenceMaterial[]）でID→名前変換
     → sectionReferenceMaterials: Record<number, string[]> を ArticleWriter.tsx に渡す
  → ArticleWriter.tsx: WritingRequest.sectionReferenceMaterials として generateArticleV3() に渡す
  → writingAgentV3.ts: buildSectionRefMaterialText() でH2別プロンプト指示文を生成
     → プロンプトに「H2-N: 「資料名」の情報を重点的に活用」として注入
```

### 必須ルール
- `OutlineSectionV2` に `referenceMaterialIds?: string[]` が必須（`types.ts` で定義）
- `buildSectionRefMaterialText()` を削除・無効化してはならない
- 参考資料が設定されている場合、プロンプトに「最低でも3箇所以上を記事本文に反映」ルールが自動追加される
- `writingCheckerV3.ts` の `countSourceCitations()` で `<p class="source-citation">` タグの数を検証し、不足時は最大-15点のペナルティを適用

## スラッグ生成

- `ArticleDisplay.tsx` の `handleOpenImageGenerator` は **async関数** でなければならない
- スラッグ未設定時は `generateSlug(keyword)` を呼び出してGeminiがキーワードを英訳したslugを生成
- **`"auto-generated"` 文字列をフォールバック値として使用することは禁止**（フォールバックは `"post"` を使う）
- `slugGenerator.ts` を削除・無効化してはならない

```typescript
// ✅ 正しい実装
let slug = (article as any).slug as string | undefined;
if (!slug) {
  try { slug = await generateSlug(keyword); }
  catch (e) { slug = "post"; }
}
```

## Gemini API リトライ処理

- `writingAgentV3.ts` に `callGeminiWithRetry<T>(fn, context, maxRetries=3)` が実装されている
- 503 / 429 / UNAVAILABLE / overloaded エラーを自動リトライ（指数バックオフ、最大16秒）
- **この関数を削除・無効化してはならない**
- すべてのGemini API呼び出しはこの関数でラップすること

```typescript
// ✅ 正しい使用例
const result = await callGeminiWithRetry(
  () => model.generateContent(prompt),
  "セクション執筆"
);
```

## 最終校閲マルチエージェント（速度設定）

`MultiAgentOrchestrator` のインスタンス化時に以下を **必ず** 指定すること（`ArticleWriter.tsx` 内に2箇所）:

```typescript
const orchestrator = new MultiAgentOrchestrator({
  // ...他のオプション...
  enableMoA: false,             // MoA相互検証スキップ（時短）
  enableSelfEvaluation: false,  // 自己評価ループスキップ（時短）
});
```

- `enableMoA: true` にすると Gemini + GPT-5 + Claude の3モデル相互検証が走り処理時間が大幅増加
- `enableSelfEvaluation: true` にすると各エージェントの自己評価ループが走り処理時間が大幅増加
- **両者ともデフォルト `false` を維持すること**（明示的な承認なしに変更禁止）

## 出典数チェック（writingCheckerV3）

- `countSourceCitations(article)` — `<p class="source-citation">` タグを正規表現でカウント（AI非依存・決定論的）
- `minSourceCitations` — `ArticleWriter.tsx` で文字数に応じて自動算出（6000字以上→3, 3000字以上→2, それ以下→1）
- チェック結果は `CheckResult.sourceCitationStats: SourceCitationStats` に格納
- 出典数が `minSourceCitations` 未満の場合、スコアから最大-15点を減算

## 処理フロー

```
キーワード入力
  → 競合調査（competitorResearchWithWebFetch → scraping-server）
  → 構成生成V2（outlineGeneratorV2 → outlineCheckerV2）
  → [任意] 構成案H2修正（reviseOutlineSection）
  → [任意] 構成案H2別参考資料選択（OutlineDisplayV2の参考資料チェックボックス）
  → [自動] BOX画像取得（boxImageService → /api/box-images）
  → 執筆（writingAgentV3: Gemini 2.5 Pro + Grounding、目標5000〜6000文字、BOX画像自動挿入）
      ※ H2別参考資料が設定されている場合、buildSectionRefMaterialText()でプロンプトに注入
  → 執筆チェック（writingCheckerV3: 出典数チェック含む）
  → [任意] 本文H2修正（reviseArticleH2Section）
  → 最終校閲マルチエージェント（enableMoA:false / enableSelfEvaluation:false）
      Phase 1（並列）: 7専門エージェント
      Phase 2（順次）: 出典エージェント3個
      Phase 3（統合）: IntegrationAgent（75点以上で合格）
  → 記事修正（人間確認後ボタン押下時のみ）
  → 画像生成エージェント起動（スラッグ: generateSlug()で英訳）
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

## 姉妹プロジェクト（3プロジェクト共通管理）

同一コードベースのクライアント別カスタマイズ版が3つ存在する。共通修正は必ず3プロジェクトすべてに適用すること。

| プロジェクト | フロント | バックエンド | 画像生成 |
|---|---|---|---|
| zeenb-seo-article-generator | 5180 | 3003 | 5181 |
| factory-seo-article-generator | 5178 | 3002 | 5179 |
| apaman-seo-article-generator | 5176 | 3001 | 5177 |

- バックエンドポートのハードコード箇所が多数あるため、ポート変更時はサービスファイル全体を `localhost:旧ポート` で検索して漏れなく置換すること

### 3プロジェクト共通反映ルール（必読）

以下の機能・ロジックを修正した場合、**他2プロジェクトにも必ず同等の修正を適用すること**。ポート番号・ブランド名は各プロジェクト固有なのでそのまま維持し、ロジック部分のみ反映する。

**共通反映が必要な機能一覧:**
- [ ] 参考資料選択UI（`OutlineDisplayV2.tsx` の参考資料セレクタ）
- [ ] 参考資料のH2別活用（`writingAgentV3.ts` の `sectionReferenceMaterials` / `buildSectionRefMaterialText()`）
- [ ] スラッグ生成（`ArticleDisplay.tsx` の `generateSlug()` 呼び出し、`slugGenerator.ts`）
- [ ] WordPress互換フォーマット（`fixWordPressListBlocks()` / `fixWordPressTableBlocks()`）
- [ ] 最終校閲マルチエージェント（`finalProofreadingAgents/` 配下）
- [ ] 執筆品質チェック（`writingCheckerV3.ts`）
- [ ] 記事修正機能（`articleRevisionService.ts`）
- [ ] 型定義の共通フィールド（`types.ts` の `OutlineSectionV2` 等）
- [ ] 画像生成エージェント連携（`useImageAgent.ts`、`ImageGeneratorIframe.tsx`）
- [ ] 構成案表示フォーマット（`OutlineDisplayV2.tsx` のH2/H3見出し表示。`H2-{index+1}:` や `{index+1}.` 等のUI側プレフィックスは付与せず、Gemini生成の見出しテキストをそのまま表示する）

**反映手順:**
1. 修正完了後、上記一覧に該当するか確認
2. 該当する場合、他2プロジェクトの同一ファイルを開いて差分を確認
3. ロジック部分のみ移植（ポート番号・ブランド固有の文言はそのまま維持）
4. 各プロジェクトで `npx vite build` が通ることを確認

**反映不要（プロジェクト固有）:**
- ポート番号（5176/3001/5177 等）
- ブランド名・サービス名・会社名
- ヒートステアリング設定（factory固有）
- 見出し番号ルール（プロジェクトごとに異なる）
- 執筆モードの選択肢（V1/V2/V3の有無はプロジェクトごと）

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
