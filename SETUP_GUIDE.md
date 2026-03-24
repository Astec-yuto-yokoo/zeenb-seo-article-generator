# 🔧 SEOコンテンツ生成ツール セットアップガイド

> **NOTE**  
> - `VITE_` で始まる環境変数はフロントエンド（ブラウザ）に埋め込まれます。  
> - 公開デプロイする場合は、APIキー/パスワード/Webhook等の秘匿値を `VITE_` に入れないでください。

## 必要な認証情報チェックリスト

### 1. 🔴 必須（これがないと動かない）

#### Gemini API
- [ ] **Gemini APIキー**
  - 取得先: https://aistudio.google.com/app/apikey
  - 設定場所: `.env`ファイル
  - 設定方法:
    ```
    VITE_GEMINI_API_KEY=AIzaSy...（取得したキー）
    GEMINI_API_KEY=AIzaSy...（同じキー）
    ```
  - 用途: SEO構成生成、競合分析、記事執筆

---

### 2. 🟡 推奨（機能が制限される）

#### 内部APIキー（バックエンドAPI保護）
- [ ] **INTERNAL_API_KEY**
  - 用途: バックエンド（競合調査/スプレッドシート/Slack/WordPress連携等）へのアクセス制御
  - 設定場所: `.env`ファイル
  - 設定方法:
    ```
    INTERNAL_API_KEY=（任意の長いランダム文字列）
    VITE_INTERNAL_API_KEY=（同じ値）
    ```
  - 例: `openssl rand -hex 32` で生成

#### Custom Search API（競合分析の精度向上）
- [ ] **Google APIキー**
  - 取得先: https://console.cloud.google.com/
  - Custom Search APIを有効化
- [ ] **検索エンジンID**
  - 取得先: https://programmablesearchengine.google.com/
  - 設定場所: `.env`ファイル
  - 設定方法:
    ```
    GOOGLE_API_KEY=AIzaSy...
    GOOGLE_SEARCH_ENGINE_ID=0123456789...
    ```

#### OpenAI API（最終校閲エージェント用）
- [ ] **OpenAI APIキー**
  - 取得先: https://platform.openai.com/api-keys
  - 設定場所: `.env`ファイル
  - 設定方法:
    ```
    OPENAI_API_KEY=sk-...
    ```
  - 用途: GPT-5による最終校閲（将来実装）

---

### 3. 🟢 オプション（特定機能を使う場合）

#### WordPress連携
- [ ] **WordPressサイトURL**
  - 例: https://yourdomain.com
- [ ] **ユーザー名**
  - WordPress管理者アカウント
- [ ] **アプリケーションパスワード**
  - 取得方法:
    1. WordPress管理画面にログイン
    2. ユーザー → プロフィール
    3. アプリケーションパスワードセクション
    4. 新しいアプリケーションパスワードを生成
  - 設定場所: `.env`ファイル
  ```
  WP_BASE_URL=https://yourdomain.com
  WP_USERNAME=your_username
  WP_APP_PASSWORD=xxxx xxxx xxxx xxxx
  ```

#### Google Drive（自社データ連携）
- [ ] **フォルダID**
  - 環境変数: `COMPANY_DATA_FOLDER_ID`
  - 共有設定: リンクを知っている全員が閲覧可能に設定

---

## 📝 セットアップ手順

### AIドリブンセットアップ（Cursor / Claude Code 推奨）
- Cursor / Claude Codeでリポジトリを開く
- AIに「`.env.example` から `.env` を作成して、必要な環境変数を埋める」「`npm install`→起動→動作確認」まで依頼する

### ステップ1: 最低限の動作確認
1. Gemini APIキーを取得
2. `.env`ファイルに設定
3. サーバー再起動（自動リロード）
4. ブラウザで http://localhost:5176 にアクセス
5. テストキーワードで構成生成を試す

### ステップ2: 機能拡張
- Custom Search APIを追加 → 競合分析の精度UP
- OpenAI APIを追加 → 最終校閲機能ON

### ステップ3: WordPress連携（必要な場合）
- WordPress認証情報を設定
- 記事の自動投稿が可能に

---

## 🔐 セキュリティ注意事項

1. **`.env`ファイルは絶対にGitにコミットしない**
   - `.gitignore`に登録済み（確認済み）

2. **APIキーの管理**
   - 本番環境では環境変数として設定
   - 定期的にキーをローテーション

3. **アクセス制限**
   - APIキーには最小限の権限のみ付与
   - 使用量制限を設定

---

## ❓ トラブルシューティング

### エラー: "API key not valid"
→ Gemini APIキーが正しく設定されていません
- `.env`ファイルを確認
- 日本語が含まれていないか確認
- キーが`AIzaSy`で始まっているか確認

### エラー: "Failed to execute 'append' on 'Headers'"
→ APIキーに日本語が含まれています
- 実際のAPIキー（英数字のみ）に置き換える

### サーバーが起動しない
→ 依存関係のインストール
```bash
npm install
```

---

## 📞 サポート

問題が解決しない場合は、以下の情報と一緒に質問してください：
- エラーメッセージのスクリーンショット
- `.env`ファイルの設定状況（APIキーは隠して）
- ブラウザのコンソールログ