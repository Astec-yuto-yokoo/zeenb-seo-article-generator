# Google Drive API設定ガイド

## 方法1: 公開共有リンク（最も簡単・現在の実装）

### 設定手順
1. Google DriveでCSVファイルを右クリック
2. 「共有」→「リンクを取得」
3. 「リンクを知っている全員」に変更
4. これで以下のURLでアクセス可能：
   ```
   https://drive.google.com/uc?export=download&id=YOUR_FILE_ID_HERE
   ```

### メリット
- APIキー不要
- 設定が簡単
- 無料で無制限

### デメリット
- ファイルが公開状態になる（URLを知っている人はアクセス可能）

## 方法2: Google Drive API（セキュア）

### 必要なもの
1. Google Cloud Projectの作成
2. Drive APIの有効化
3. 認証情報の作成

### 設定手順

#### 1. Google Cloud Consoleでプロジェクトを作成
```
https://console.cloud.google.com/
```

#### 2. Drive APIを有効化
1. 「APIとサービス」→「ライブラリ」
2. 「Google Drive API」を検索
3. 「有効にする」をクリック

#### 3. サービスアカウントを作成
1. 「APIとサービス」→「認証情報」
2. 「認証情報を作成」→「サービスアカウント」
3. サービスアカウント名を入力（例：seo-content-generator）
4. 作成後、「キー」タブで「新しいキーを作成」→JSON形式
5. ダウンロードされたJSONファイルを安全に保管

#### 4. CSVファイルへのアクセス権を付与
1. Google DriveでCSVファイルを右クリック→「共有」
2. サービスアカウントのメールアドレス（xxx@xxx.iam.gserviceaccount.com）を追加
3. 「閲覧者」権限を付与

### 実装コード例

```typescript
import { google } from 'googleapis';

// サービスアカウントの認証
const auth = new google.auth.GoogleAuth({
  keyFile: './service-account-key.json', // ダウンロードしたJSONファイル
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

// ファイルをダウンロード
async function downloadFile(fileId: string) {
  const res = await drive.files.get({
    fileId: fileId,
    alt: 'media',
  }, {
    responseType: 'stream'
  });
  
  return res.data;
}
```

## 方法3: OAuth2（ユーザー認証）

ユーザーのGoogleアカウントでログインして認証する方法。
個人利用には向いていますが、自動化には不向き。

## 推奨方法

### テスト環境での推奨設定

1. **最も簡単**: 公開共有リンクを使う（現在の実装）
   - `.env`ファイルは不要
   - CSVファイルを「リンクを知っている全員」に設定するだけ

2. **セキュアにしたい場合**: Google Drive APIを使う
   - サービスアカウントのJSONキーが必要
   - 設定は複雑だが、ファイルは非公開のまま

### 環境変数の設定例

```bash
# .env ファイル

# 方法1: 公開共有リンク（APIキー不要）
COMPANY_DATA_FILE_ID=YOUR_FILE_ID_HERE

# 方法2: Google Drive API（サービスアカウント）
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
COMPANY_DATA_FILE_ID=YOUR_FILE_ID_HERE
```

## トラブルシューティング

### エラー: 403 Forbidden
- ファイルの共有設定を確認
- 「リンクを知っている全員」になっているか確認

### エラー: 404 Not Found
- ファイルIDが正しいか確認
- URLの形式: `https://drive.google.com/file/d/{FILE_ID}/view`

### CORSエラー（ブラウザから直接アクセスする場合）
- サーバーサイドでプロキシを作成する必要がある
- または、Google Drive APIを使用する