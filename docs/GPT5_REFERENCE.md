# GPT-5 & Responses API リファレンス

## 概要
このドキュメントは、OpenAI GPT-5モデルとResponses APIの仕様をまとめたものです。
最終校閲エージェントの実装で使用します。

## GPT-5 モデル仕様

### モデルバリエーション
| モデル名 | 入力料金 | 出力料金 | 用途 |
|---------|---------|---------|------|
| gpt-5 (Full) | $1.25/1M tokens | $10.00/1M tokens | 高精度・複雑なタスク |
| gpt-5-mini | $0.25/1M tokens | $2.00/1M tokens | バランス型 |
| gpt-5-nano | $0.05/1M tokens | $0.40/1M tokens | 高速・低コスト |

### 技術仕様
- **コンテキストウィンドウ**: 400,000 tokens
- **最大出力トークン**: 128,000 tokens
- **推論トークン**: サポート
- **構造化出力**: JSONスキーマ対応
- **ツール使用**: web_search, file_search, code_interpreter, MCP対応

## Responses API

### エンドポイント
```
POST https://api.openai.com/v1/responses
```

### 基本的な使用方法
```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await client.responses.create({
  model: "gpt-5",
  messages: [
    {
      role: "system",
      content: "You are a helpful assistant."
    },
    {
      role: "user",
      content: "What's the weather like in Tokyo?"
    }
  ],
  tools: [
    {
      type: "web_search"
    }
  ],
  tool_choice: "auto"
});
```

### Responses API vs Chat Completions API
- **Responses API**: ツール使用が組み込まれた新しいAPIプリミティブ
- **Chat Completions API**: 従来のチャット完了API
- Responses APIはweb_searchなどのツールを自動的に呼び出し、結果を統合

## Web Search ツール

### 設定方法
```typescript
const tools = [
  {
    type: "web_search"
  }
];
```

### 使用例
```typescript
const response = await client.responses.create({
  model: "gpt-5",
  messages: [
    {
      role: "user",
      content: "What are the latest developments in quantum computing?"
    }
  ],
  tools: [
    {
      type: "web_search"
    }
  ],
  tool_choice: "auto"
});
```

### Web Searchの特徴
- リアルタイムのウェブ情報取得
- 自動的に複数のソースから情報を収集
- ファクトチェックに最適
- 最新情報の確認が可能

## 最終校閲エージェントでの活用

### 主な用途
1. **ファクトチェック**: 企業名、数値、統計データの検証
2. **最新情報の確認**: 価格、日付、イベント情報の更新確認
3. **固有名詞の検証**: ブランド名、製品名の正確性確認
4. **競合情報の収集**: 業界動向、競合サービスの最新情報

### 実装のポイント
```typescript
// Responses APIを使用した実装例
async function performFactCheck(content: string) {
  const response = await client.responses.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: FACT_CHECK_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: `以下の内容をファクトチェックしてください：\n${content}`
      }
    ],
    tools: [
      {
        type: "web_search"
      }
    ],
    tool_choice: "auto",
    temperature: 0.1,  // 正確性重視
    max_tokens: 8000
  });
  
  return response.choices[0].message;
}
```

## パフォーマンス最適化

### モデル選択の指針
- **gpt-5 (Full)**: 最終校閲、重要なファクトチェック
- **gpt-5-mini**: 通常の校閲、中規模のコンテンツ
- **gpt-5-nano**: 簡易チェック、リアルタイム処理

### コスト最適化
1. 初回チェックは`gpt-5-nano`で実施
2. 問題箇所のみ`gpt-5`で詳細チェック
3. バッチ処理でコスト削減

## 注意事項

### APIキー管理
- 環境変数`OPENAI_API_KEY`で管理
- 本番環境では適切な権限設定を実施

### レート制限
- Tier 5: 10,000 RPM (Requests Per Minute)
- 適切なリトライロジックの実装が必要

### エラーハンドリング
```typescript
try {
  const response = await client.responses.create({...});
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    console.error('API Error:', error.status, error.message);
    // リトライロジック
  }
}
```

## 参考リンク
- [OpenAI Platform Documentation](https://platform.openai.com/docs)
- [Responses API Reference](https://platform.openai.com/docs/api-reference/responses)
- [GPT-5 Model Overview](https://platform.openai.com/docs/models/gpt-5)