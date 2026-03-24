# Google Drive API クイックスタート（既存プロジェクト）

## 料金
**完全無料** - Google Drive APIは月間10億リクエストまで無料

## 設定手順（5分で完了）

### 1. Drive APIを有効化（1分）
1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 既存のプロジェクトを選択
3. 左メニュー「APIとサービス」→「ライブラリ」
4. 「Google Drive API」を検索
5. 「有効にする」をクリック

### 2. サービスアカウントを作成（2分）
1. 「APIとサービス」→「認証情報」
2. 「+ 認証情報を作成」→「サービスアカウント」
3. 以下を入力：
   - サービスアカウント名: `seo-content-reader`
   - サービスアカウントID: 自動入力されるのでそのまま
4. 「作成して続行」→「完了」

### 3. JSONキーをダウンロード（1分）
1. 作成したサービスアカウントをクリック
2. 「キー」タブを選択
3. 「鍵を追加」→「新しい鍵を作成」
4. 「JSON」を選択→「作成」
5. JSONファイルが自動ダウンロードされる

### 4. CSVファイルに権限を付与（1分）
1. Google DriveでCSVファイル（pdf_segments_index.csv）を開く
2. 右クリック→「共有」
3. サービスアカウントのメールアドレスを追加
   - 形式: `seo-content-reader@プロジェクトID.iam.gserviceaccount.com`
   - JSONファイル内の`client_email`に記載されています
4. 「閲覧者」権限を選択→「送信」

## プロジェクトへの実装

### 1. npmパッケージをインストール
```bash
npm install googleapis
```

### 2. JSONキーファイルを配置
```bash
# プロジェクトルートに配置
cp ~/Downloads/プロジェクト名-xxxxx.json ./service-account-key.json

# .gitignoreに追加（重要！）
echo "service-account-key.json" >> .gitignore
```

### 3. 環境変数を設定
```bash
# .envファイル
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
COMPANY_DATA_FILE_ID=YOUR_FILE_ID_HERE
USE_GOOGLE_DRIVE_API=true
```

### 4. コードを更新（オプション）
既存のcompanyDataService.tsに以下を追加：

```typescript
import { google } from 'googleapis';

class CompanyDataService {
  // Google Drive API版の取得メソッド
  private async fetchFromDriveAPI(): Promise<string> {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });
    
    const response = await drive.files.get({
      fileId: this.DRIVE_FILE_ID,
      alt: 'media',
    });
    
    return response.data as string;
  }
}
```

## セキュリティの比較

| 方法 | セキュリティ | 設定の簡単さ | 料金 |
|------|------------|-------------|------|
| 公開共有リンク | △ URLを知っていれば誰でもアクセス可 | ◎ 超簡単 | 無料 |
| Drive API | ◎ サービスアカウントのみアクセス可 | ○ 5分で設定 | 無料 |

## よくある質問

**Q: 本番環境でJSONキーはどう管理する？**
A: 環境変数に直接JSON文字列を設定するか、シークレット管理サービスを使用

**Q: 複数ファイルにアクセスする場合は？**
A: 同じサービスアカウントで複数ファイルにアクセス可能。各ファイルに権限を付与

**Q: アクセスログは残る？**
A: はい、Google Driveの「アクティビティ」で確認可能