# SEO記事自動生成ツール — 他部署展開・引き継ぎガイド

このツールを別のサイト（別ブランド・別部署）向けに展開する際の手順書です。
基本的な操作はターミナルへのコピペだけで完了します。Claude Code（AIアシスタント）を使うとさらに便利です。

---

## 全体像

このツールは **キーワードを入力すると、SEO記事を自動で作成してくれる** Webアプリです。

```
キーワード入力 → 競合調査 → 構成案作成 → 記事執筆 → 品質チェック → 完成
```

動かすには **2つのサーバー** が必要です：

| サーバー | 役割 | ポート |
|----------|------|--------|
| フロントエンド | 画面（ブラウザで操作する部分） | 5176 |
| バックエンド | 裏側の処理（競合サイトの情報取得など） | 3001 |

---

## STEP 1：必要なアカウントとAPIキーを準備する

> ⚠️ この手順だけは、各サービスのWebサイトにアクセスして **自分の手で** 行う必要があります。

### 必ず必要なもの（これがないと動きません）

#### 1-1. Google AI Studio（Gemini API）
- **何に使う？** → 記事の構成案作成・本文執筆・参考資料の分析
- **取得手順：**
  1. https://makersuite.google.com/app/apikey にアクセス
  2. Googleアカウントでログイン
  3. 「Create API Key」をクリック
  4. 表示されたキー（`AIza...`で始まる文字列）をメモ帳などに保存

#### 1-2. Google Custom Search（検索API）
- **何に使う？** → 競合サイトの調査（上位記事の構成を分析）
- **取得手順：**
  1. https://console.cloud.google.com/ にアクセス
  2. プロジェクトを作成（名前は自由）
  3. 「APIとサービス」→「ライブラリ」→「Custom Search API」を有効化
  4. 「認証情報」→「認証情報を作成」→「APIキー」で取得 → メモ帳に保存
  5. https://programmablesearchengine.google.com/ にアクセス
  6. 検索エンジンを作成（「ウェブ全体を検索」をON）
  7. 作成後に表示される「検索エンジンID」をメモ帳に保存

#### 1-3. OpenAI API
- **何に使う？** → 最終校閲（記事の品質を最終チェックするAI）
- **取得手順：**
  1. https://platform.openai.com/api-keys にアクセス
  2. アカウント作成・ログイン
  3. 「Create new secret key」でAPIキーを取得 → メモ帳に保存

### ここまでで手元に揃えておくもの

```
✅ Gemini APIキー（AIza...で始まる文字列）
✅ Google APIキー（Custom Search用）
✅ 検索エンジンID
✅ OpenAI APIキー（sk-...で始まる文字列）
```

---

## STEP 2：必要なソフトをインストールする

### 2-1. Node.js をインストールする

このツールを動かすのに必要なソフトです。

1. https://nodejs.org/ にアクセス
2. **「LTS」（推奨版）** をダウンロードしてインストール
3. インストール後、ターミナル（Mac: 「ターミナル」アプリ / Windows: 「PowerShell」）を開いて確認：

```bash
node --version
```

`v20.xx.x` 以上の数字が出ればOKです。

### 2-2. Git をインストールする

GitHubからコードを取得するために必要です。

- **Mac：** ターミナルで `git --version` を実行。未インストールの場合は自動でインストールが始まります
- **Windows：** https://git-scm.com/ からダウンロードしてインストール

---

## STEP 3：GitHubリポジトリを新規作成し、コードをセットアップする

各部署ごとに **独立したGitHubリポジトリ** を作成します。元のプロジェクトとは紐づけません。

### 3-1. GitHubアカウントを作る（まだ持っていない場合）

1. https://github.com/ にアクセス
2. 「Sign up」からアカウントを作成（無料プランでOK）

### 3-2. 新しいリポジトリを作る

1. GitHubにログインした状態で https://github.com/new にアクセス
2. 以下を入力：
   - **Repository name：** 好きな名前（例：`seo-article-generator-yoursite`）
   - **Description：** 任意（例：「SEO記事自動生成ツール」）
   - **Public / Private：** Privateを選択（非公開）
3. 「Create repository」をクリック

### 3-3. コードを受け取ってセットアップする

管理者（横尾）から共有された **コード一式のZIPファイル** を使います。

ターミナルで以下を**1行ずつ**コピー＆ペーストして実行してください：

```bash
cd ~/Desktop
```

ZIPファイルをデスクトップに置いて展開したら、フォルダ名をリポジトリ名に合わせてリネームしてください。

```bash
cd ~/Desktop/（展開したフォルダ名）
npm install
cd server && npm install && cd ..
```

### 3-4. GitHubリポジトリと紐づける

引き続きターミナルで以下を実行します。`（あなたのGitHubユーザー名）` と `（リポジトリ名）` は自分のものに置き換えてください。

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/（あなたのGitHubユーザー名）/（リポジトリ名）.git
git push -u origin main
```

> **GitHubのログインを求められた場合：** ターミナルで `gh auth login` を実行し、画面の指示に従ってログインしてください（`gh` コマンドがない場合は https://cli.github.com/ からインストール）。

### 3-5. コードの更新を受け取るとき

管理者からコードの更新版（ZIPファイル）を受け取ったら、上書きして以下を実行：

```bash
cd ~/Desktop/（フォルダ名）
npm install
cd server && npm install && cd ..
git add .
git commit -m "update: コード更新"
git push origin main
```

---

## STEP 4：Claude Codeをセットアップする（任意）

> **Claude Codeなしでも動かせます。** STEP 5の起動手順をそのまま実行すればOKです。
> ただし、設定変更やトラブル対応にはClaude Codeがあると非常に便利です。

Claude Codeは、ターミナル（黒い画面）で動くAIアシスタントです。
「こうして」と日本語でお願いすると、ファイルの作成・編集・コマンド実行をやってくれます。

### 4-1. Claude Code をインストールする

ターミナルで以下を実行します：

```bash
npm install -g @anthropic-ai/claude-code
```

### 4-2. Claude Code を起動する

```bash
cd ~/Desktop/apaman-seo-article-generator
claude
```

初回起動時に **Anthropicアカウントへのログイン** を求められます。画面の指示に従ってログインしてください。

### 4-3. 使い方の基本

Claude Codeが起動すると、チャット画面になります。ここに日本語でお願いを書くだけです。

```
あなた > .envファイルを作って、Gemini APIキーを設定して
Claude > （自動でファイルを作成・編集してくれます）
```

**ポイント：**
- ファイルの変更は必ず「許可しますか？」と聞かれるので、内容を確認して「y」を押す
- 間違えても「元に戻して」と言えばやり直せる
- わからないことは何でもClaudeに聞けばOK

---

## STEP 5：設定ファイル（.env）を作る

STEP 1で取得したAPIキーを設定します。
Claude Codeを使う場合は以下をコピペしてお願いしてください。
Claude Codeを使わない場合は、プロジェクトフォルダ内の `.env.example` をコピーして `.env` にリネームし、テキストエディタで編集してください。

### Claude Codeへのお願い（コピペして使ってください）

```
.envファイルを作成してください。内容は以下の通りです：

GEMINI_API_KEY=（ここにGemini APIキーを貼る）
VITE_GEMINI_API_KEY=（上と同じキーを貼る）

GOOGLE_API_KEY=（ここにGoogle APIキーを貼る）
VITE_GOOGLE_API_KEY=（上と同じキーを貼る）

GOOGLE_SEARCH_ENGINE_ID=（ここに検索エンジンIDを貼る）
VITE_GOOGLE_SEARCH_ENGINE_ID=（上と同じIDを貼る）

VITE_INTERNAL_API_KEY=my-internal-key-2026
INTERNAL_API_KEY=my-internal-key-2026

OPENAI_API_KEY=（ここにOpenAI APIキーを貼る）
VITE_OPENAI_API_KEY=（上と同じキーを貼る）

VITE_API_URL=http://localhost:3001
```

> **注意：** `VITE_INTERNAL_API_KEY` は自分で好きな文字列を決めてOK。フロントとバックで同じ値にしてください。

---

## STEP 6：自社ブランドに合わせる（Claude Codeで実行）

対象サイトが「アステックペイント」以外の場合、Claude Codeに以下のお願いをしてください。

### 6-1. まとめセクションの「お問い合わせ誘導」を変更する

```
services/writingAgentV3.ts の「まとめセクション執筆ルール」にある
お問い合わせ誘導の部分を、以下の自社情報に書き換えてください：

- 会社名（サービス名）：○○○○
- 強み・特徴：「△△△」「□□□」
- サイトURL：https://example.com
- お問い合わせ誘導のトーン：「お気軽にご相談ください」のような低圧力な表現
```

### 6-2. 競合調査で自社サイトを除外する

```
services/competitorResearchWithWebFetch.ts の競合調査で、
自社サイト「example.com」を除外リストに追加してください。
既存のアステックペイント関連のドメインは削除してください。
```

### 6-3. 自社の実績データを更新する（任意）

Google Driveに自社の導入事例や実績データがある場合：

```
.envファイルに以下を追加してください：
COMPANY_DATA_FOLDER_ID=（Google DriveのフォルダURLの末尾の文字列）
```

---

## STEP 7：動かしてみる

### 7-1. 起動する

> **npm install はSTEP 3で完了済みです。**

ターミナルで以下を実行します：

```bash
cd ~/Desktop/apaman-seo-article-generator
bash ./start.sh
```

> Claude Codeを使う場合は `start.sh を実行してアプリを起動して` とお願いしてもOKです。

### 7-2. 動作確認

ブラウザで以下を開きます：

**http://localhost:5176**

画面が表示されれば成功です！

バックエンドの確認は、別のターミナルウィンドウで以下を実行：

```bash
curl http://localhost:3001/api/health
```

`{"status":"ok"}` と返ってくればバックエンドもOKです。

---

## STEP 8：本番環境にデプロイする（Claude Codeで実行）

ローカルで動作確認できたら、本番環境にデプロイ（公開）します。

### バックエンド → Render

```
Renderにデプロイするための手順を教えて。
GitHubリポジトリは https://github.com/（自分のリポジトリURL） です。
```

Claude Codeが手順を案内してくれます。基本的な流れ：

1. https://render.com/ でアカウント作成
2. GitHubリポジトリを接続
3. 環境変数を設定（.envの中身と同じ）
4. デプロイ実行

### フロントエンド → Docker

```
Dockerでフロントエンドをビルドしてデプロイする手順を教えて。
バックエンドのURLは https://（RenderのURL） です。
```

---

## よくあるトラブルと対処法

問題が起きたら、まず **Claude Codeに状況を伝えて** みてください。

### 例1：画面が表示されない

```
http://localhost:5176 にアクセスしても画面が出ません。原因を調べてください。
```

### 例2：競合調査がエラーになる

```
競合調査を実行するとエラーが出ます。APIキーが正しく設定されているか確認してください。
```

### 例3：記事が生成されない

```
記事の生成ボタンを押してもエラーになります。Gemini APIキーの設定を確認して原因を調べてください。
```

### 例4：参考資料のアップロードでエラーが出る

```
PDFの参考資料をアップロードするとエラーになります。popplerがインストールされているか確認して、
なければインストールしてください。
```

### よくある原因一覧

| 症状 | よくある原因 |
|------|-------------|
| 画面が出ない | フロントエンドが起動していない → `npm run dev` を実行 |
| 「Failed to fetch」エラー | バックエンドが起動していない → `npm run server` を実行 |
| 競合調査が動かない | Google APIキーか検索エンジンIDが間違っている |
| 記事が生成されない | Gemini APIキーが間違っている |
| 最終校閲が動かない | OpenAI APIキーが設定されていない |

---

## Claude Codeでよく使うお願いの例

日々の運用で使えるフレーズ集です。

### 設定変更系

```
CTA（お問い合わせ誘導）の文言を「まずは無料見積りから」に変更して

タイトル生成のルールに「地域名を入れる」というルールを追加して

構成案のH2数を最大8個に制限して
```

### トラブル対応系

```
エラーが出ました。原因を調べてください。エラー内容：（エラーメッセージを貼る）

アプリが動かなくなりました。ログを確認して原因を教えてください。

最新のコードに更新して。GitHubから最新版をpullしてください。
```

### 機能追加・改善系

```
生成される記事の文字数を5000文字以上にしたい

新しいチェック項目を追加したい。「専門用語には必ず説明を入れる」というルール。

構成案に「事例紹介」のセクションを必ず入れるようにして
```

---

## ポート一覧

| ポート | 用途 |
|--------|------|
| 5176 | メインアプリ（画面） |
| 3001 | バックエンド（裏側の処理） |
| 5177 | 画像生成エージェント（将来用） |

---

## ファイル構成（重要なものだけ）

```
プロジェクトルート/
├── .env                    ← 設定ファイル（STEP 5で作成）
├── CLAUDE.md               ← Claude Codeへの指示書（自動で読み込まれる）
├── App.tsx                 ← メイン画面
├── services/
│   ├── writingAgentV3.ts   ← 記事執筆のAI設定（CTA誘導もここ）
│   ├── outlineGeneratorV2.ts ← 構成案生成のAI設定
│   └── referenceMaterialService.ts ← 参考資料の分析
├── server/
│   └── scraping-server.js  ← バックエンドサーバー
├── Dockerfile              ← フロントエンド用
├── render.yaml             ← Renderデプロイ設定
└── start.sh                ← ローカル起動用スクリプト
```

> **CLAUDE.md** はプロジェクト内にある「Claude Codeへの設計書」です。Claude Codeはこのファイルを自動的に読み込んで、プロジェクトのルールを理解した上で作業してくれます。

---

## まとめ：作業の流れ

```
STEP 1 ✋ 手作業    → APIキーを各サービスのサイトで取得
STEP 2 ✋ 手作業    → Node.js・Git をインストール
STEP 3 ✋ 手作業    → GitHubからコードを取得（コピペでOK）
STEP 4 ✋ 手作業    → Claude Codeをインストール・起動（任意）
STEP 5 ✋/🤖       → 設定ファイル（.env）を作成
STEP 6 🤖 Claude   → 自社ブランドに合わせてカスタマイズ
STEP 7 ✋ 手作業    → 起動・動作確認
STEP 8 🤖 Claude   → 本番デプロイ
```

**困ったときは、まずClaude Codeに聞いてみてください。** ほとんどのことは解決してくれます。

---

## 困ったときの連絡先

Claude Codeでも解決できない場合は、このプロジェクトを構築した担当者に確認してください。
