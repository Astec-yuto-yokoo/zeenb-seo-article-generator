# バックエンドサーバー Cloud Run デプロイ手順

このドキュメントでは、バックエンドサーバー（スクレイピングサーバー）をGoogle Cloud Runにデプロイする手順を説明します。

---

## 概要

バックエンドサーバーは以下の機能を提供します：
- Puppeteerを使用したWebスクレイピング
- 競合サイトのH2/H3タグ取得
- APIエンドポイントの提供

---

## 前提条件

- GCPプロジェクトが作成済み（[SEOエージェント デプロイ手順](./DEPLOY_SEO_AGENT.md)を参照）
- 以下のAPIが有効化済み：
  - Cloud Run Admin API
  - Cloud Build API
  - Artifact Registry API
- Artifact Registryに `seo-app` リポジトリが作成済み

---

## 必要なファイル

### 1. Dockerfile

`server/Dockerfile`:

```dockerfile
# Cloud Run用 Dockerfile (scraping-server-full.js対応)
FROM node:18-slim

# Puppeteer用の依存関係をインストール
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 作業ディレクトリを設定
WORKDIR /app

# Puppeteerのダウンロードをスキップ（システムのChromeを使用）
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# package.jsonをコピー
COPY package.json ./

# 依存関係をインストール
RUN npm install --omit=dev --omit=optional

# アプリケーションのソースコードをコピー
COPY . .

# Puppeteerがインストール済みのChromiumを使用するように設定
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# ポートを環境変数から取得（Cloud Runのデフォルト）
ENV PORT=8080

# 非rootユーザーを作成してセキュリティを向上
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads /home/pptruser/.cache \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

# Chrome用の追加設定
RUN chmod 755 /usr/bin/google-chrome-stable

# 非rootユーザーに切り替え
USER pptruser

# アプリケーションを起動
CMD ["node", "scraping-server-full.js"]
```

### 2. cloudbuild.yaml

`server/cloudbuild.yaml`:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'asia-northeast1-docker.pkg.dev/$PROJECT_ID/seo-app/backend-server'
      - '.'
images:
  - 'asia-northeast1-docker.pkg.dev/$PROJECT_ID/seo-app/backend-server'
```

### 3. package.json

`server/package.json`:

```json
{
  "name": "scraping-server-full",
  "version": "1.0.0",
  "description": "High-performance web scraping server with Puppeteer",
  "main": "scraping-server-full.js",
  "scripts": {
    "start": "node scraping-server-full.js",
    "dev": "nodemon scraping-server-full.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.6.1",
    "express": "^4.21.2",
    "express-rate-limit": "^7.5.1",
    "form-data": "^4.0.0",
    "googleapis": "^166.0.0",
    "helmet": "^7.2.0",
    "node-fetch": "^2.7.0",
    "puppeteer": "^21.11.0",
    "puppeteer-core": "^21.11.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## デプロイ手順

### ステップ1: Cloud Shellを開く

1. [GCPコンソール](https://console.cloud.google.com)にアクセス
2. 右上の **Cloud Shellアイコン**（`>_`）をクリック

### ステップ2: serverフォルダに移動

```bash
cd ~/seo-content-generator/server
```

### ステップ3: ファイルを確認

```bash
ls -la Dockerfile cloudbuild.yaml package.json scraping-server-full.js
```

すべてのファイルが存在することを確認。

### ステップ4: イメージをビルド

```bash
gcloud builds submit --config=cloudbuild.yaml
```

> **注意**: Puppeteer（Chrome）を含むため、ビルドには **5〜10分** かかります。
> `npm warn deprecated` の警告が出ても、エラーでなければ問題ありません。

成功すると以下のように表示されます：

```
STATUS: SUCCESS
```

### ステップ5: Cloud Runにデプロイ（GUI）

1. GCPコンソール左メニュー → **「Cloud Run」**

2. **「サービスを作成」** をクリック

3. **「既存のコンテナイメージから1つのリビジョンをデプロイする」** を選択

4. **「選択」** → **「Artifact Registry」** タブ → 以下を展開：
   - `asia-northeast1`
   - `seo-app`
   - `backend-server`
   - 最新のイメージを選択

5. **「選択」** をクリック

6. 基本設定：

| 項目 | 値 |
|------|-----|
| サービス名 | `backend-server` |
| リージョン | `asia-northeast1（東京）` |
| 認証 | **「未認証の呼び出しを許可」** にチェック |

7. **「コンテナ、ボリューム、ネットワーキング、セキュリティ」** を展開

8. **「コンテナ」** タブで以下を設定：

| 項目 | 値 | 理由 |
|------|-----|------|
| コンテナポート | `8080` | Cloud Runのデフォルト |
| メモリ | `2 GiB` | Puppeteer（Chrome）に必要 |
| CPU | `2` | スクレイピング処理に必要 |
| リクエストタイムアウト | `900` | 長時間のスクレイピングに対応 |
| 最大インスタンス | `10` | コスト管理 |

9. **「作成」** をクリック

### ステップ6: 動作確認

デプロイ完了後、表示されるURL + `/api/health` にアクセス：

```
https://backend-server-xxxxx-an.a.run.app/api/health
```

**期待される応答:**
```json
{"status":"ok","message":"スクレイピングサーバーは正常に動作しています"}
```

---

## 更新時のデプロイ手順

### 1. 再ビルド

```bash
cd ~/seo-content-generator/server

gcloud builds submit --config=cloudbuild.yaml
```

### 2. 新しいリビジョンをデプロイ（GUI）

1. Cloud Run → `backend-server` サービスをクリック
2. **「新しいリビジョンの編集とデプロイ」** をクリック
3. コンテナイメージの **「選択」** をクリック
4. 最新のイメージを選択
5. **「デプロイ」** をクリック

---

## 環境変数（重要）

Cloud Runの環境変数に以下を設定してください：

### CORS設定用環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `SEO_FRONTEND_URL` | SEOエージェントのCloud Run URL | `https://seo-frontend-xxxxx-an.a.run.app` |
| `IMAGE_AGENT_URL` | 画像生成エージェントのCloud Run URL | `https://ai-article-imager-xxxxx-an.a.run.app` |
| `PRODUCTION_DOMAIN` | その他の本番ドメイン（必要に応じて） | `https://example.com` |

### API認証用環境変数

| 変数名 | 説明 |
|--------|------|
| `INTERNAL_API_KEY` | 内部API認証用キー（Secret Managerから設定推奨） |

> **重要**: CORS設定がないと、フロントエンドからバックエンドへのAPIリクエストがブロックされます。

### 自動許可されるオリジン

コード内で以下のオリジンは自動的に許可されます：
- `localhost:5176`, `localhost:5177`（ローカル開発環境）
- `*.vercel.app`（Vercelドメイン）
- `*.run.app`（Cloud Runドメイン）

### 設定方法（GUI）

1. Cloud Run → `backend-server` をクリック
2. **「新しいリビジョンの編集とデプロイ」**
3. **「変数とシークレット」** タブ
4. **「変数を追加」** で以下を設定：
   - `SEO_FRONTEND_URL`: SEOエージェントのURL
   - `IMAGE_AGENT_URL`: 画像生成エージェントのURL
5. **「シークレットを参照」** で `INTERNAL_API_KEY` を設定（Secret Manager使用時）
6. **「デプロイ」**

### 設定方法（CLI）

```bash
gcloud run services update backend-server \
  --region=asia-northeast1 \
  --set-env-vars="SEO_FRONTEND_URL=https://seo-frontend-xxxxx-an.a.run.app,IMAGE_AGENT_URL=https://ai-article-imager-xxxxx-an.a.run.app"
```

---

## トラブルシューティング

### エラー: npm install で500エラー

```
npm error 500 Internal Server Error - GET https://registry.npmjs.org/...
```

**原因**: npmレジストリの一時的な問題

**解決方法**: 数分待って再ビルド

```bash
gcloud builds submit --config=cloudbuild.yaml
```

### エラー: `--no-optional` の警告

```
npm warn config optional Use `--omit=optional` to exclude optional dependencies
```

**解決方法**: Dockerfileの該当行を修正

```dockerfile
# 変更前
RUN npm install --omit=dev --no-optional --prefer-offline

# 変更後
RUN npm install --omit=dev --omit=optional
```

### ビルドが5分以上止まる

`npm warn deprecated` の後に止まっている場合：

**これは正常です。** Puppeteerの依存関係インストールに5〜10分かかります。
15分以上動きがなければキャンセルして再試行。

### エラー: メモリ不足

```
Container memory limit exceeded
```

**解決方法**: Cloud Runのメモリを増やす（2GiB → 4GiB）

### ヘルスチェックが失敗

`/api/health` にアクセスできない場合：

1. Cloud Run → サービス → **「ログ」** タブを確認
2. 起動時のエラーをチェック
3. ポートが `8080` になっているか確認

### エラー: CORSエラー（フロントエンドからのリクエストがブロック）

ブラウザコンソールに以下が表示される場合：

```
Access to fetch at 'https://backend-server-xxx.run.app/api/...' from origin 'https://seo-frontend-xxx.run.app' has been blocked by CORS policy
```

**原因**: バックエンドのCORS設定にフロントエンドのURLが登録されていない

**解決方法**:

1. Cloud Run → `backend-server` → **「新しいリビジョンの編集とデプロイ」**
2. **「変数とシークレット」** タブで以下を追加：
   - `SEO_FRONTEND_URL`: SEOエージェントのURL
   - `IMAGE_AGENT_URL`: 画像生成エージェントのURL
3. **「デプロイ」** をクリック

または、CLI で：

```bash
gcloud run services update backend-server \
  --region=asia-northeast1 \
  --set-env-vars="SEO_FRONTEND_URL=https://seo-frontend-xxxxx-an.a.run.app,IMAGE_AGENT_URL=https://ai-article-imager-xxxxx-an.a.run.app"
```

> **注意**: `*.run.app` ドメインは自動許可されますが、明示的に設定することを推奨します。

---

## APIエンドポイント一覧

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/health` | GET | ヘルスチェック |
| `/api/scrape` | POST | URLからH2/H3を取得 |
| `/api/company-data` | GET | 企業実績データ取得 |

---

## フロントエンドとの接続

SEOエージェント・画像生成エージェントからバックエンドを使用するには、フロントエンドの環境変数を設定：

```
VITE_API_URL=https://backend-server-xxxxx-an.a.run.app/api
```

---

## 関連ドキュメント

- [SEOエージェント デプロイ手順](./DEPLOY_SEO_AGENT.md)
- [画像生成エージェント デプロイ手順](./DEPLOY_IMAGE_AGENT.md)

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-12-05 | 初版作成 |
