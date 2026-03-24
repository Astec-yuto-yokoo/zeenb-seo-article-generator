# SEOエージェント Cloud Run デプロイ手順

このドキュメントでは、SEOエージェント（seo-content-generator）をGoogle Cloud Runにデプロイする手順を、GCPプロジェクトの作成から説明します。

---

## 目次

1. [GCPプロジェクトの作成](#1-gcpプロジェクトの作成)
2. [必要なAPIの有効化](#2-必要なapiの有効化)
3. [Secret Managerの設定](#3-secret-managerの設定)
4. [Artifact Registryの設定](#4-artifact-registryの設定)
5. [ソースコードの準備](#5-ソースコードの準備)
6. [イメージのビルド](#6-イメージのビルド)
7. [Cloud Runへのデプロイ](#7-cloud-runへのデプロイ)
8. [動作確認](#8-動作確認)

---

## 前提条件

- Googleアカウントを持っている
- クレジットカードまたは請求先アカウントが設定可能
- 以下のAPIキーを取得済み：
  - Gemini APIキー
  - Custom Search APIキー + カスタム検索エンジンID
  - OpenAI APIキー（GPT-5 最終校閲エージェント用）
  - Supabase URL + Anon Key（一次情報データベース用）

---

## 1. GCPプロジェクトの作成

### 1.1 GCPコンソールにアクセス

1. ブラウザで [https://console.cloud.google.com](https://console.cloud.google.com) にアクセス
2. Googleアカウントでログイン

### 1.2 新規プロジェクトを作成

1. 画面上部のプロジェクト選択ドロップダウンをクリック
2. **「新しいプロジェクト」** をクリック
3. 以下を入力：

| 項目 | 値 |
|------|-----|
| プロジェクト名 | `seo-agent`（任意の名前） |
| 場所 | 組織を選択（個人の場合は「組織なし」） |

4. **「作成」** をクリック

### 1.3 請求先アカウントの設定

1. 左メニュー → **「お支払い」**
2. **「請求先アカウントをリンク」** をクリック
3. 既存のアカウントを選択、または新規作成

> **注意**: 請求先アカウントがないとCloud Runは使用できません

---

## 2. 必要なAPIの有効化

### 2.1 APIを有効化

GCPコンソールの検索バーで以下のAPIを検索し、それぞれ **「有効にする」** をクリック：

1. **Cloud Run Admin API**
2. **Cloud Build API**
3. **Artifact Registry API**
4. **Secret Manager API**

### 2.2 一括有効化（Cloud Shell使用）

または、Cloud Shellで以下を実行：

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

---

## 3. Secret Managerの設定

APIキーなどの機密情報をSecret Managerに保存します。

### 3.1 シークレットを作成（GUI）

1. GCPコンソール左メニュー → **「Secret Manager」**
2. **「シークレットを作成」** をクリック
3. 以下のシークレットを**それぞれ作成**：

| シークレット名 | 説明 |
|---------------|------|
| `GEMINI_API_KEY` | Gemini API認証キー |
| `GOOGLE_API_KEY` | Custom Search API用キー |
| `GOOGLE_SEARCH_ENGINE_ID` | カスタム検索エンジンID |
| `OPENAI_API_KEY` | OpenAI API認証キー（GPT-5用） |
| `SUPABASE_URL` | SupabaseプロジェクトURL |
| `SUPABASE_ANON_KEY` | Supabase匿名キー |

4. 各シークレットに対して **「シークレットを作成」** をクリック

### 3.2 Cloud Buildにアクセス権限を付与

**すべてのシークレットに対して**以下を実行：

1. 作成したシークレットをクリック
2. **「権限」** タブをクリック
3. **「アクセスを許可」** をクリック
4. 以下を入力：

| 項目 | 値 |
|------|-----|
| 新しいプリンシパル | `PROJECT_NUMBER@cloudbuild.gserviceaccount.com` |
| ロール | `Secret Manager のシークレット アクセサー` |

> **注意**: `PROJECT_NUMBER` はプロジェクト番号（プロジェクトIDではない）。
> 確認方法: プロジェクトダッシュボード → 「プロジェクト番号」

**重要**: 6つのシークレットすべてに権限を付与してください。

---

## 4. Artifact Registryの設定

Dockerイメージを保存するリポジトリを作成します。

### 4.1 リポジトリを作成（GUI）

1. GCPコンソール左メニュー → **「Artifact Registry」**
2. **「リポジトリを作成」** をクリック
3. 以下を入力：

| 項目 | 値 |
|------|-----|
| 名前 | `seo-app` |
| 形式 | `Docker` |
| モード | `標準` |
| ロケーションタイプ | `リージョン` |
| リージョン | `asia-northeast1（東京）` |

4. **「作成」** をクリック

---

## 5. ソースコードの準備

### 5.1 Cloud Shellを開く

1. GCPコンソール右上の **Cloud Shellアイコン**（`>_`）をクリック
2. 画面下部にターミナルが表示される

### 5.2 ソースコードをアップロード

#### 方法A: ZIPでアップロード

1. ローカルで `seo-content-generator` フォルダをZIPに圧縮
2. Cloud Shell右上の **「︙」メニュー** → **「アップロード」**
3. ZIPファイルを選択
4. Cloud Shellで解凍：

```bash
unzip seo-content-generator.zip
cd seo-content-generator
```

#### 方法B: GitHubからクローン

```bash
git clone YOUR_REPOSITORY_URL
cd seo-content-generator
```

### 5.3 必要なファイルを確認

以下のファイルが存在することを確認：

```bash
ls -la Dockerfile nginx.conf
```

---

## 6. イメージのビルド

### 6.1 cloudbuild.yamlを作成

Cloud Shellエディタ（右上の鉛筆アイコン）で `seo-content-generator/cloudbuild.yaml` を作成：

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'VITE_GEMINI_API_KEY=$_GEMINI_API_KEY'
      - '--build-arg'
      - 'VITE_GOOGLE_API_KEY=$_GOOGLE_API_KEY'
      - '--build-arg'
      - 'VITE_GOOGLE_SEARCH_ENGINE_ID=$_GOOGLE_SEARCH_ENGINE_ID'
      - '--build-arg'
      - 'VITE_OPENAI_API_KEY=$_OPENAI_API_KEY'
      - '--build-arg'
      - 'VITE_SUPABASE_URL=$_SUPABASE_URL'
      - '--build-arg'
      - 'VITE_SUPABASE_ANON_KEY=$_SUPABASE_ANON_KEY'
      - '--build-arg'
      - 'VITE_API_URL=$_API_URL'
      - '-t'
      - 'asia-northeast1-docker.pkg.dev/$PROJECT_ID/seo-app/seo-frontend'
      - '.'
    secretEnv: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_SEARCH_ENGINE_ID', 'OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']
images:
  - 'asia-northeast1-docker.pkg.dev/$PROJECT_ID/seo-app/seo-frontend'
availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/GEMINI_API_KEY/versions/latest
      env: 'GEMINI_API_KEY'
    - versionName: projects/$PROJECT_ID/secrets/GOOGLE_API_KEY/versions/latest
      env: 'GOOGLE_API_KEY'
    - versionName: projects/$PROJECT_ID/secrets/GOOGLE_SEARCH_ENGINE_ID/versions/latest
      env: 'GOOGLE_SEARCH_ENGINE_ID'
    - versionName: projects/$PROJECT_ID/secrets/OPENAI_API_KEY/versions/latest
      env: 'OPENAI_API_KEY'
    - versionName: projects/$PROJECT_ID/secrets/SUPABASE_URL/versions/latest
      env: 'SUPABASE_URL'
    - versionName: projects/$PROJECT_ID/secrets/SUPABASE_ANON_KEY/versions/latest
      env: 'SUPABASE_ANON_KEY'
```

### 6.2 ビルドを実行

Cloud Shellで以下を実行：

```bash
cd ~/seo-content-generator

# Secret Managerからキーを取得
export GEMINI_KEY=$(gcloud secrets versions access latest --secret=GEMINI_API_KEY)
export GOOGLE_KEY=$(gcloud secrets versions access latest --secret=GOOGLE_API_KEY)
export SEARCH_ENGINE_ID=$(gcloud secrets versions access latest --secret=GOOGLE_SEARCH_ENGINE_ID)
export OPENAI_KEY=$(gcloud secrets versions access latest --secret=OPENAI_API_KEY)
export SUPABASE_URL=$(gcloud secrets versions access latest --secret=SUPABASE_URL)
export SUPABASE_KEY=$(gcloud secrets versions access latest --secret=SUPABASE_ANON_KEY)

# バックエンドサーバーのURL（デプロイ後に取得）
# 例: https://backend-server-xxxxx-an.a.run.app/api
export API_URL="YOUR_BACKEND_SERVER_URL/api"

# ビルド実行
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_GEMINI_API_KEY="$GEMINI_KEY",_GOOGLE_API_KEY="$GOOGLE_KEY",_GOOGLE_SEARCH_ENGINE_ID="$SEARCH_ENGINE_ID",_OPENAI_API_KEY="$OPENAI_KEY",_SUPABASE_URL="$SUPABASE_URL",_SUPABASE_ANON_KEY="$SUPABASE_KEY",_API_URL="$API_URL"
```

> **重要**: `_API_URL` はバックエンドサーバーをデプロイした後のURLに置き換えてください。

成功すると以下のように表示されます：

```
STATUS: SUCCESS
```

---

## 7. Cloud Runへのデプロイ

### 7.1 サービスを作成（GUI）

1. GCPコンソール左メニュー → **「Cloud Run」**
2. **「サービスを作成」** をクリック

### 7.2 コンテナイメージを選択

1. **「既存のコンテナイメージから1つのリビジョンをデプロイする」** を選択
2. **「選択」** をクリック
3. **「Artifact Registry」** タブを選択
4. 以下の順で展開：
   - `asia-northeast1`
   - `seo-app`
   - `seo-frontend`
   - 最新のイメージを選択
5. **「選択」** をクリック

### 7.3 サービスを設定

| 項目 | 値 |
|------|-----|
| サービス名 | `seo-frontend` |
| リージョン | `asia-northeast1（東京）` |
| 認証 | **「未認証の呼び出しを許可」** にチェック |

### 7.4 コンテナ設定（オプション）

**「コンテナ、ボリューム、ネットワーキング、セキュリティ」** を展開：

| 項目 | 推奨値 |
|------|--------|
| コンテナポート | `8080` |
| メモリ | `512Mi` |
| CPU | `1` |
| 最小インスタンス | `0` |
| 最大インスタンス | `10` |

### 7.5 デプロイ

**「作成」** をクリック

デプロイには2〜5分かかります。

---

## 8. 動作確認

### 8.1 URLにアクセス

デプロイ完了後、表示されるURL（例: `https://seo-frontend-xxxxx-an.a.run.app`）にアクセス。

SEOエージェントの画面が表示されれば成功です。

### 8.2 動作テスト

1. キーワードを入力
2. 「構成生成」ボタンをクリック
3. 構成が生成されることを確認

---

## 必要なファイル一覧

### Dockerfile

```dockerfile
# SEOエージェント フロントエンド用 Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 依存関係インストール
COPY package*.json ./
RUN npm ci

# ソースコードをコピー
COPY . .

# ビルド時の環境変数（ARGで受け取る）
ARG VITE_GEMINI_API_KEY
ARG VITE_GOOGLE_API_KEY
ARG VITE_GOOGLE_SEARCH_ENGINE_ID
ARG VITE_OPENAI_API_KEY
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL

# .env ファイルを作成（Viteが読み込めるように）
RUN echo "GEMINI_API_KEY=${VITE_GEMINI_API_KEY}" > .env && \
    echo "VITE_GOOGLE_API_KEY=${VITE_GOOGLE_API_KEY}" >> .env && \
    echo "VITE_GOOGLE_SEARCH_ENGINE_ID=${VITE_GOOGLE_SEARCH_ENGINE_ID}" >> .env && \
    echo "VITE_OPENAI_API_KEY=${VITE_OPENAI_API_KEY}" >> .env && \
    echo "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" >> .env && \
    echo "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}" >> .env && \
    echo "VITE_API_URL=${VITE_API_URL}" >> .env

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

### nginx.conf

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

### cloudbuild.yaml

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'VITE_GEMINI_API_KEY=$_GEMINI_API_KEY'
      - '--build-arg'
      - 'VITE_GOOGLE_API_KEY=$_GOOGLE_API_KEY'
      - '--build-arg'
      - 'VITE_GOOGLE_SEARCH_ENGINE_ID=$_GOOGLE_SEARCH_ENGINE_ID'
      - '--build-arg'
      - 'VITE_OPENAI_API_KEY=$_OPENAI_API_KEY'
      - '--build-arg'
      - 'VITE_SUPABASE_URL=$_SUPABASE_URL'
      - '--build-arg'
      - 'VITE_SUPABASE_ANON_KEY=$_SUPABASE_ANON_KEY'
      - '--build-arg'
      - 'VITE_API_URL=$_API_URL'
      - '-t'
      - 'asia-northeast1-docker.pkg.dev/$PROJECT_ID/seo-app/seo-frontend'
      - '.'
images:
  - 'asia-northeast1-docker.pkg.dev/$PROJECT_ID/seo-app/seo-frontend'
```

---

## 更新時のデプロイ手順

コードを更新した場合は、以下の手順で再デプロイします：

### 1. 再ビルド

```bash
cd ~/seo-content-generator

# Secret Managerからキーを取得
export GEMINI_KEY=$(gcloud secrets versions access latest --secret=GEMINI_API_KEY)
export GOOGLE_KEY=$(gcloud secrets versions access latest --secret=GOOGLE_API_KEY)
export SEARCH_ENGINE_ID=$(gcloud secrets versions access latest --secret=GOOGLE_SEARCH_ENGINE_ID)
export OPENAI_KEY=$(gcloud secrets versions access latest --secret=OPENAI_API_KEY)
export SUPABASE_URL=$(gcloud secrets versions access latest --secret=SUPABASE_URL)
export SUPABASE_KEY=$(gcloud secrets versions access latest --secret=SUPABASE_ANON_KEY)
export API_URL="YOUR_BACKEND_SERVER_URL/api"

gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_GEMINI_API_KEY="$GEMINI_KEY",_GOOGLE_API_KEY="$GOOGLE_KEY",_GOOGLE_SEARCH_ENGINE_ID="$SEARCH_ENGINE_ID",_OPENAI_API_KEY="$OPENAI_KEY",_SUPABASE_URL="$SUPABASE_URL",_SUPABASE_ANON_KEY="$SUPABASE_KEY",_API_URL="$API_URL"
```

### 2. 新しいリビジョンをデプロイ（GUI）

1. Cloud Run → `seo-frontend` サービスをクリック
2. **「新しいリビジョンの編集とデプロイ」** をクリック
3. コンテナイメージの **「選択」** をクリック
4. 最新のイメージを選択
5. **「デプロイ」** をクリック

---

## トラブルシューティング

### エラー: 請求先アカウントが設定されていない

```
Billing account not configured
```

**解決方法**: 「お支払い」から請求先アカウントをリンク

### エラー: APIが有効化されていない

```
API [run.googleapis.com] not enabled
```

**解決方法**: 該当のAPIを有効化（セクション2参照）

### エラー: `npm ci` で失敗

```
npm error A complete log of this run can be found in...
```

**解決方法**: `package-lock.json` を再生成

```bash
rm package-lock.json
npm install
```

### エラー: リポジトリが存在しない

```
denied: gcr.io repo does not exist
```

**解決方法**: Artifact Registryリポジトリを作成（セクション4参照）

### エラー: シークレットにアクセスできない

```
Permission denied on secret
```

**解決方法**: Cloud BuildサービスアカウントにSecret Managerアクセス権限を付与（セクション3.2参照）

### 画面が表示されない / APIキーエラー

ブラウザコンソールに以下が表示される場合：

```
An API Key must be set when running in a browser
```

**原因**: ビルド時にAPIキーが埋め込まれていない

**解決方法**:
1. Dockerfileに `.env` ファイル作成の行があるか確認
2. cloudbuild.yamlの `--build-arg` が正しいか確認
3. Secret Managerの値が正しいか確認
4. 再ビルド＆再デプロイ

---

## 関連ドキュメント

- [画像生成エージェント デプロイ手順](./DEPLOY_IMAGE_AGENT.md)
- [バックエンドサーバー デプロイ手順](./DEPLOY_BACKEND_SERVER.md)

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-12-05 | 初版作成 |
