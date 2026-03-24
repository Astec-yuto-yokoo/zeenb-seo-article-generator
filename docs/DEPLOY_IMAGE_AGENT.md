# 画像生成エージェント Cloud Run デプロイ手順

このドキュメントでは、画像生成エージェント（ai-article-imager-for-wordpress）をGoogle Cloud Runにデプロイする手順を説明します。

## 前提条件

- GCPプロジェクトが作成済み
- gcloud CLIがインストール済み（Cloud Shellを使用する場合は不要）
- Secret Managerに以下のシークレットが登録済み：
  - `GEMINI_API_KEY`
  - `BACKEND_URL`
  - `INTERNAL_API_KEY`
  - `MAIN_APP_URL`

## 必要なファイル

デプロイには以下のファイルが必要です：

### 0. Secret Managerにシークレットを登録

以下のシークレットをSecret Managerに登録してください：

| シークレット名 | 説明 |
|---------------|------|
| `GEMINI_API_KEY` | Gemini API認証キー |
| `BACKEND_URL` | バックエンドサーバーのURL |
| `INTERNAL_API_KEY` | 内部API認証用キー |
| `MAIN_APP_URL` | SEOエージェントのURL（記事連携用） |

> **注意**: Cloud Buildが自動的にSecret Managerから値を取得します。

### 1. Dockerfile

`ai-article-imager-for-wordpress/Dockerfile`:

```dockerfile
# 画像生成エージェント用 Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 依存関係インストール
COPY package*.json ./
RUN npm ci

# ソースコードをコピー
COPY . .

# ビルド時の環境変数
ARG VITE_GEMINI_API_KEY
ARG VITE_BACKEND_URL
ARG VITE_INTERNAL_API_KEY
ARG VITE_MAIN_APP_URL

# .envファイルを作成（Viteが読み込めるように）
RUN echo "GEMINI_API_KEY=${VITE_GEMINI_API_KEY}" > .env && \
    echo "VITE_GEMINI_API_KEY=${VITE_GEMINI_API_KEY}" >> .env && \
    echo "VITE_BACKEND_URL=${VITE_BACKEND_URL}" >> .env && \
    echo "VITE_API_URL=${VITE_BACKEND_URL}/api" >> .env && \
    echo "VITE_INTERNAL_API_KEY=${VITE_INTERNAL_API_KEY}" >> .env && \
    echo "VITE_MAIN_APP_URL=${VITE_MAIN_APP_URL}" >> .env

# ビルド
RUN npm run build

# 本番用イメージ
FROM nginx:alpine

# ビルド成果物をコピー
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx設定
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
```

### 2. nginx.conf

`ai-article-imager-for-wordpress/nginx.conf`:

```nginx
server {
    listen 8080;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # gzip圧縮
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # SPAのルーティング対応
    location / {
        try_files $uri $uri/ /index.html;
    }

    # キャッシュ設定
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. cloudbuild.yaml

`ai-article-imager-for-wordpress/cloudbuild.yaml`:

```yaml
steps:
  - name: gcr.io/cloud-builders/docker
    entrypoint: bash
    args:
      - -c
      - "docker build --build-arg VITE_GEMINI_API_KEY=$$GEMINI_API_KEY --build-arg VITE_BACKEND_URL=$$BACKEND_URL --build-arg VITE_INTERNAL_API_KEY=$$INTERNAL_API_KEY --build-arg VITE_MAIN_APP_URL=$$MAIN_APP_URL -t asia-northeast1-docker.pkg.dev/$PROJECT_ID/seo-app/ai-article-imager:latest ."
    secretEnv:
      - GEMINI_API_KEY
      - BACKEND_URL
      - INTERNAL_API_KEY
      - MAIN_APP_URL
images:
  - asia-northeast1-docker.pkg.dev/$PROJECT_ID/seo-app/ai-article-imager:latest
availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/GEMINI_API_KEY/versions/latest
      env: GEMINI_API_KEY
    - versionName: projects/$PROJECT_ID/secrets/BACKEND_URL/versions/latest
      env: BACKEND_URL
    - versionName: projects/$PROJECT_ID/secrets/INTERNAL_API_KEY/versions/latest
      env: INTERNAL_API_KEY
    - versionName: projects/$PROJECT_ID/secrets/MAIN_APP_URL/versions/latest
      env: MAIN_APP_URL
```

> **注意**: `$PROJECT_ID` はCloud Buildが自動的に現在のプロジェクトIDに置き換えます。Secret Managerから環境変数を自動取得するため、手動での設定は不要です。

### 環境変数の説明

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `GEMINI_API_KEY` | Gemini API認証キー | Secret Managerから自動取得 |
| `BACKEND_URL` | バックエンドサーバーのURL | `https://backend-server-xxx.run.app` |
| `INTERNAL_API_KEY` | バックエンドAPI認証キー | Secret Managerから自動取得 |
| `MAIN_APP_URL` | SEOエージェントのURL（記事連携用） | `https://seo-frontend-xxx.run.app` |

---

## デプロイ手順

### ステップ1: Cloud Shellを開く

1. [GCPコンソール](https://console.cloud.google.com)にアクセス
2. 右上の **Cloud Shellアイコン**（`>_` マーク）をクリック

### ステップ2: プロジェクトを確認

```bash
gcloud config get-value project
```

正しいプロジェクトでない場合：
```bash
gcloud config set project YOUR_PROJECT_ID
```

### ステップ3: ソースコードをアップロード（初回のみ）

#### 方法A: GitHubからクローン
```bash
git clone YOUR_REPOSITORY_URL
cd seo-content-generator
```

#### 方法B: ZIPでアップロード
1. Cloud Shell右上の「︙」メニュー → 「アップロード」
2. ZIPファイルを選択してアップロード
3. 解凍:
```bash
unzip seo-content-generator.zip
cd seo-content-generator
```

### ステップ4: Artifact Registryリポジトリを作成（初回のみ）

1. GCPコンソール → 「Artifact Registry」
2. 「リポジトリを作成」をクリック
3. 以下を設定：
   - 名前: `seo-app`
   - 形式: `Docker`
   - リージョン: `asia-northeast1`
4. 「作成」をクリック

### ステップ5: イメージをビルド

```bash
cd ai-article-imager-for-wordpress

# ビルド実行（Secret Managerから自動的に環境変数を取得）
gcloud builds submit --config=cloudbuild.yaml
```

> **注意**: `cloudbuild.yaml` の `availableSecrets` 設定により、Secret Managerから自動的に環境変数が取得されます。手動での設定は不要です。

成功すると以下のように表示されます：
```
STATUS: SUCCESS
```

### ステップ6: Cloud Runにデプロイ（GUI）

1. GCPコンソール → **「Cloud Run」**

2. **「サービスを作成」** をクリック

3. **「既存のコンテナイメージから1つのリビジョンをデプロイする」** を選択

4. **「選択」** → **「Artifact Registry」** タブ → 以下を展開：
   - `asia-northeast1`
   - `seo-app`
   - `ai-article-imager`
   - 最新のイメージを選択

5. 設定：

| 項目 | 値 |
|------|-----|
| サービス名 | `ai-article-imager` |
| リージョン | `asia-northeast1（東京）` |
| 認証 | 「未認証の呼び出しを許可」にチェック |

6. **「作成」** をクリック

### ステップ7: 動作確認

デプロイ完了後、表示されるURL（例: `https://ai-article-imager-xxxxx-an.a.run.app`）にアクセス。

画像生成エージェントの画面が表示されれば成功です。

---

## 更新時のデプロイ手順

コードや環境変数を更新した場合は、以下の手順で再デプロイします：

### 1. 環境変数を変更する場合（必要な場合のみ）

1. GCPコンソール → **「セキュリティ」** → **「Secret Manager」**
2. 変更したいシークレットをクリック
3. **「+ 新しいバージョン」** をクリック
4. 新しい値を入力 → **「バージョンを追加」**

### 2. 再ビルド

```bash
cd ~/seo-content-generator/ai-article-imager-for-wordpress

# ビルド実行（Secret Managerから自動的に環境変数を取得）
gcloud builds submit --config=cloudbuild.yaml
```

### 3. 新しいリビジョンをデプロイ（GUI）

1. Cloud Run → `ai-article-imager` サービスをクリック
2. **「新しいリビジョンの編集とデプロイ」** をクリック
3. コンテナイメージの **「選択」** をクリック
4. 最新のイメージを選択
5. **「デプロイ」** をクリック

---

## トラブルシューティング

### エラー: `npm ci` で失敗

```
npm error A complete log of this run can be found in...
```

**解決方法**: `package-lock.json` を再生成
```bash
rm package-lock.json
npm install
```

### エラー: `gcr.io repo does not exist`

```
denied: gcr.io repo does not exist
```

**解決方法**: Artifact Registryリポジトリを作成（ステップ4参照）

### エラー: `An API Key must be set when running in a browser`

ブラウザコンソールに表示される場合。

**原因**: APIキーがビルド時に埋め込まれていない

**解決方法**:
1. Dockerfileに `.env` ファイル作成の行があるか確認
2. `cloudbuild.yaml` で `--build-arg` が正しく設定されているか確認
3. Secret Managerの `GEMINI_API_KEY` が正しく設定されているか確認

### エラー: `--build-arg unrecognized arguments`

```
ERROR: (gcloud.builds.submit) unrecognized arguments: --build-arg
```

**原因**: `gcloud builds submit` では `--build-arg` は直接使えない

**解決方法**: `cloudbuild.yaml` を使用してビルド

---

## 関連ドキュメント

- [SEOエージェント デプロイ手順](./DEPLOY_SEO_AGENT.md)
- [バックエンドサーバー デプロイ手順](./DEPLOY_BACKEND_SERVER.md)

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-12-23 | Secret Manager自動取得に対応、ビルド手順を簡略化 |
| 2025-12-05 | 初版作成 |
