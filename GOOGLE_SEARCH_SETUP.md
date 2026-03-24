# Google Custom Search API セットアップガイド

## なぜGoogle Custom Search APIが必要？

現在のGemini APIの制限により、Google検索結果のURLが取得できません。
Google Custom Search APIを使用することで、**正確なURL**を取得できます。

## 料金

- **無料枠**: 100検索/日
- **有料**: $5/1000検索（約750円）
- 1日100キーワードまでなら**完全無料**！

## セットアップ手順

### 1. Google Cloud ConsoleでAPIを有効化

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または選択
3. 左メニューから「APIとサービス」→「ライブラリ」
4. 「Custom Search API」を検索
5. 「有効にする」をクリック

### 2. APIキーを作成

1. 「APIとサービス」→「認証情報」
2. 「+ 認証情報を作成」→「APIキー」
3. 作成されたAPIキーをコピー
4. （推奨）「キーを制限」でCustom Search APIのみに制限

### 3. Programmable Search Engineを作成

1. [Programmable Search Engine](https://programmablesearchengine.google.com/)にアクセス
2. 「Get started」または「新しい検索エンジン」をクリック
3. 設定:
   - **検索するサイト**: 「ウェブ全体を検索」を選択
   - **検索エンジンの名前**: 任意（例：SEO Competition Analyzer）
   - **言語**: 日本語
4. 「作成」をクリック
5. 「検索エンジンID」（cx:で始まる文字列）をコピー

### 4. 環境変数を設定

`.env`ファイルに以下を追加：

```env
# Google API（複数機能で共通使用）
GOOGLE_API_KEY=あなたのAPIキー
GOOGLE_SEARCH_ENGINE_ID=あなたの検索エンジンID
```

> **⚠️ 重要: GOOGLE_API_KEYの用途**
>
> このAPIキーは**2つの機能**で共通使用されます：
> 1. **Custom Search API** - 競合サイトの検索（このページの主目的）
> 2. **Google Drive API** - 自社実績データ（CSVファイル）の取得
>
> 自社実績データ機能も使う場合は、Google Cloud Consoleで**Google Drive API**も有効化してください：
> 「APIとサービス」→「ライブラリ」→「Google Drive API」→ 有効にする

### 5. 動作確認

アプリを再起動して、キーワード検索を実行。
コンソールに以下が表示されれば成功：

```
✅ Using Google Custom Search API for exact URLs
```

## トラブルシューティング

### エラー: 403 Forbidden
- APIが有効化されているか確認
- APIキーが正しいか確認
- 日次制限（100回）を超えていないか確認

### エラー: Invalid search engine ID
- 検索エンジンIDが正しくコピーされているか確認
- cx:を含めていないか確認（IDのみを入力）

### URLが取得できない
- Programmable Search Engineで「ウェブ全体を検索」が選択されているか確認

## 使用量の確認

[Google Cloud Console](https://console.cloud.google.com/)の「APIとサービス」→「ダッシュボード」で使用量を確認できます。

## 注意事項

- 1日100回まで無料
- 101回目から$5/1000回の課金
- 1回の検索で最大10件の結果を取得（15件必要な場合は2回のAPI呼び出し = 2クエリ消費）