# API使用ガイドライン

## 重要な取り決め

### ❌ 使用禁止
- **Gemini検索機能（Grounding）は使用しない**
  - 理由：検索精度が著しく低く、信頼性のあるURLを取得できない
  - 代替：Google Custom Search APIのみを使用

### ✅ 推奨する動作フロー

#### 競合分析時の処理
1. **Google Custom Search API**で正確なURLを取得
2. 取得したURLを**Puppeteer**でスクレイピング
3. 正確なH2/H3構造を分析

#### Google Search APIが使えない場合
- エラーメッセージを明確に表示
- ユーザーに以下の選択肢を提示：
  1. 午後4時（日本時間）のリセットまで待つ
  2. 別のAPIキーに変更する
  3. 競合サイトのURLを直接入力してもらう

### 📊 Google Custom Search API制限

#### 無料枠
- **1日100クエリまで無料**
- 超過時：403エラー（API_KEY_SERVICE_BLOCKED）
- 追加料金：$5/1000クエリ

#### リセット時間
- **太平洋時間（PT）午前0時**にリセット
- 日本時間換算：
  - 夏時間（3月〜11月）：**午後4時**
  - 冬時間（11月〜3月）：**午後5時**

### 実装上の注意点

```typescript
// ❌ 悪い例：Gemini検索を使う
if (googleSearchFailed) {
  // Geminiの検索機能を使用
  const results = await searchWithGemini(query);
}

// ✅ 良い例：エラーを明確に表示
if (googleSearchFailed) {
  throw new Error('Google Search APIの制限に達しました。午後4時以降に再試行してください。');
}
```

### エラーハンドリング

Google Search APIエラー時のメッセージ例：
```
❌ Google Search APIエラー
- 本日の無料枠（100回）を使い切りました
- リセット時刻：本日午後4時（日本時間）
- 対処法：
  1. 午後4時まで待つ
  2. 別のAPIキーを.envファイルに設定
  3. URLを直接入力して分析
```

## 更新履歴
- 2025-09-03: 初版作成 - Gemini検索機能の使用禁止を明文化