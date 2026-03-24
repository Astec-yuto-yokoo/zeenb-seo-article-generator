# 推奨フォルダ構成

## セキュアな構成例

```
Google Drive/
├── 公開データ/                    ← このフォルダを「リンクを知っている全員」に設定
│   ├── pdf_segments_index.csv     ← 実績データ（公開OK）
│   ├── company_cases.csv          ← 事例集（公開OK）
│   └── public_resources.csv       ← 公開リソース
│
├── 非公開データ/                   ← 制限付き（共有しない）
│   ├── 顧客情報.xlsx
│   ├── 売上データ.csv
│   └── 機密文書.pdf
│
└── その他のファイル...
```

## 設定手順

### 方法1: 専用の公開フォルダを作る（推奨）

1. Google Driveで「公開データ」フォルダを新規作成
2. CSVファイルをそのフォルダに移動
3. フォルダを右クリック→「共有」
4. 「リンクを知っている全員」に設定
5. フォルダIDを取得：
   ```
   https://drive.google.com/drive/folders/{FOLDER_ID}
   ```

### 方法2: 個別ファイル共有（最もセキュア）

各ファイルを個別に共有設定する方法。
手間はかかるが、最もセキュア。

## コードの更新（フォルダ対応版）

```typescript
// companyDataService.ts に追加

class CompanyDataService {
  // フォルダIDから複数ファイルを取得する場合
  private readonly SHARED_FOLDER_ID = process.env.SHARED_FOLDER_ID;
  
  // フォルダ内のファイル一覧を取得
  async listFilesInFolder(): Promise<string[]> {
    // Google Drive APIを使う必要があります
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });
    
    const response = await drive.files.list({
      q: `'${this.SHARED_FOLDER_ID}' in parents`,
      fields: 'files(id, name)',
    });
    
    return response.data.files || [];
  }
}
```

## セキュリティのベストプラクティス

### ✅ やるべきこと
- 公開データ専用のフォルダを作る
- 定期的にアクセスログを確認
- 不要になったらすぐに共有を解除
- ファイル名に機密情報を含めない

### ❌ やってはいけないこと
- ドライブ全体を公開共有
- 個人情報を含むファイルの公開
- 共有リンクをSNSやGitHubに投稿
- パスワードやAPIキーを含むファイルの共有

## リスク評価

| データの種類 | 公開可否 | 理由 |
|------------|---------|------|
| 実績データ（匿名化済み） | ○ | 企業名が伏せられていればOK |
| マーケティング資料 | ○ | 公開前提の内容ならOK |
| 顧客リスト | ✕ | 個人情報保護法違反の恐れ |
| 内部文書 | ✕ | 情報漏洩リスク |
| APIキー・パスワード | ✕✕✕ | 絶対NG |

## 推奨設定

**開発・テスト環境：**
- 個別ファイル共有（pdf_segments_index.csvのみ）
- またはテスト用の公開フォルダを作成

**本番環境：**
- Google Drive API + サービスアカウント認証
- 公開共有は使用しない