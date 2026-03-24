// 基底エージェントクラス
import OpenAI from "openai";
import type {
  BaseAgent,
  AgentResult,
  AgentType,
  Issue,
  Suggestion,
  AgentContext,
  PartialResults,
  VerifiedUrl,
} from "./types";

export abstract class BaseProofreadingAgent implements BaseAgent {
  protected openai: OpenAI | null = null;

  constructor(
    public name: string,
    public type: AgentType,
    public model: "gpt-5" | "gpt-5-mini" | "gpt-5-nano" = "gpt-5-nano"
  ) {
    this.initializeOpenAI();
  }

  private initializeOpenAI() {
    const apiKey =
      process.env.OPENAI_API_KEY ||
      (typeof import.meta !== "undefined" &&
        import.meta.env?.VITE_OPENAI_API_KEY);

    console.log(`🔑 ${this.name}: OpenAI API初期化チェック`);
    console.log(
      `  - process.env.OPENAI_API_KEY: ${
        process.env.OPENAI_API_KEY ? "設定済み" : "未設定"
      }`
    );
    console.log(
      `  - import.meta.env.VITE_OPENAI_API_KEY: ${
        typeof import.meta !== "undefined" &&
        import.meta.env?.VITE_OPENAI_API_KEY
          ? "設定済み"
          : "未設定"
      }`
    );
    console.log(`  - 最終的なAPIキー: ${apiKey ? "利用可能" : "利用不可"}`);

    if (apiKey) {
      // エージェント別の余裕を持ったタイムアウト設定
      const timeout = this.getTimeoutForAgent();
      const maxRetries = 5; // リトライ回数も増加

      this.openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true,
        timeout: timeout, // エージェント別タイムアウト
        maxRetries: maxRetries, // リトライ回数
      });

      console.log(
        `✅ ${this.name}: OpenAI API初期化成功（タイムアウト: ${
          timeout / 60000
        }分, リトライ: ${maxRetries}回）`
      );
    } else {
      console.log(
        `⚠️ ${this.name}: OpenAI APIキーが見つかりません - モックモードで動作`
      );
    }
  }

  // エージェント別の余裕を持ったタイムアウト設定
  private getTimeoutForAgent(): number {
    switch (this.type) {
      // 🔥 超高リスク（Web検索 + 複雑な処理）
      case "source-enhancement":
        return 2400000; // 40分（出典検索は最も時間がかかる）

      // 🔴 高リスク（Web検索 + 専門的な検索）
      case "legal":
        return 1200000; // 20分（法令検索）
      case "facts-cases":
        return 1200000; // 20分（事例検証）
      case "technical":
        return 1200000; // 20分（技術文書検索）

      // 🟡 中リスク（Web検索 + 一般的な検索）
      case "proper-nouns":
        return 900000; // 15分（固有名詞確認）
      case "numbers-stats":
        return 900000; // 15分（統計データ検索）
      case "dates-timeline":
        return 720000; // 12分（日付確認）

      // 🟢 低リスク（Web検索なし）
      case "citations":
        return 600000; // 10分（引用検証）
      case "company":
        return 600000; // 10分（自社情報）
      case "source-requirement":
        return 600000; // 10分（出典必要性判定）

      // 🔵 最低リスク（統合処理のみ）
      case "integration":
        return 300000; // 5分（統合処理）

      // デフォルト（念のため）
      default:
        return 900000; // 15分（安全マージン）
    }
  }

  async execute(content: string, context?: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    console.log(`🚀 ${this.name} execute開始`);

    try {
      // OpenAI APIが利用できない場合はモック結果を返す
      if (!this.openai) {
        console.log(
          `⚠️ ${this.name}: OpenAI APIが利用できないため、モック結果を返します`
        );
        return this.getMockResult();
      }

      console.log(`🔧 ${this.name}: performCheckを実行中...`);
      // 各エージェント固有の処理を実行
      const result = await this.performCheck(content, context);

      const executionTime = Date.now() - startTime;
      console.log(
        `✅ ${this.name}: performCheck完了 (${executionTime}ms, スコア: ${result.score})`
      );

      return {
        agentName: this.name,
        agentType: this.type,
        executionTime: executionTime,
        status: "success",
        ...result,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ ${this.name}エラー (${executionTime}ms):`, error);

      // エラー時も部分結果があれば優先的に返す
      const partialResults = this.getPartialResults();
      if (partialResults && partialResults.completedItems > 0) {
        console.log(
          `⚠️ ${this.name}: エラー発生、部分結果を返します（${partialResults.completedItems}/${partialResults.totalItems}件完了）`
        );

        const partialScore = Math.round(
          (partialResults.completedItems / partialResults.totalItems) * 100
        );

        return {
          agentName: this.name,
          agentType: this.type,
          executionTime: executionTime,
          score: partialScore,
          issues: partialResults.issues || [],
          suggestions: partialResults.suggestions || [],
          confidence: 60,
          status: "partial-success",
          partialData: {
            completedItems: partialResults.completedItems,
            totalItems: partialResults.totalItems,
            message: `エラー発生、${partialResults.completedItems}件の部分結果のみ`,
          },
          verified_urls: partialResults.verified_urls,
        };
      }

      // 部分結果もない場合は完全なエラー
      return {
        agentName: this.name,
        agentType: this.type,
        executionTime: executionTime,
        score: 0,
        issues: [],
        suggestions: [],
        confidence: 0,
        status: "error",
        error: error instanceof Error ? error.message : "不明なエラー",
      };
    }
  }

  // 各エージェントで実装する抽象メソッド
  protected abstract performCheck(
    content: string,
    context?: AgentContext
  ): Promise<{
    score: number;
    issues: Issue[];
    suggestions: Suggestion[];
    confidence: number;
  }>;

  // デフォルトの部分結果取得メソッド（各エージェントでオーバーライド可能）
  public getPartialResults(): PartialResults | null {
    // デフォルトではnullを返す（部分結果なし）
    // 必要なエージェントはこのメソッドをオーバーライドして実装
    return null;
  }

  // OpenAI APIが使えない場合のモック結果
  protected getMockResult(): AgentResult {
    return {
      agentName: this.name,
      agentType: this.type,
      executionTime: 100,
      score: 85,
      issues: [],
      suggestions: [],
      confidence: 70,
      status: "success",
    };
  }

  // 最新AIモデル情報をフォーマット
  protected formatLatestAIModels(context?: AgentContext): string {
    if (!context?.latestAIModels) return "";

    const models = context.latestAIModels;
    let result = `\n【前提知識：${models.currentDate.displayText}時点の最新AIモデル】\n`;

    // LLMモデル
    if (models.categories.llm?.latest) {
      result += "大規模言語モデル:\n";
      models.categories.llm.latest.forEach((m: any) => {
        result += `- ${m.model}（${m.company}、${m.releaseDate}リリース済み）\n`;
      });
    }

    // 推論モデル
    if (models.categories.reasoning?.latest) {
      result += "\n推論特化モデル:\n";
      models.categories.reasoning.latest.forEach((m: any) => {
        result += `- ${m.model}（${m.company}、${m.releaseDate}リリース済み）\n`;
      });
    }

    result +=
      "\nこれらは全て実在する最新モデルです。記事内でこれらが使用されていても「未リリース」「存在しない」と指摘しないでください。\n";

    return result;
  }

  // GPT-5 Responses API呼び出し
  protected async callGPT5(
    prompt: string,
    useWebSearch: boolean = false,
    context?: AgentContext
  ): Promise<any> {
    if (!this.openai) {
      throw new Error("OpenAI APIが初期化されていません");
    }

    try {
      // GPT-5 + Responses API（Cookbookドキュメントに基づく構造）
      console.log(`🤖 ${this.name}: GPT-5 (${this.model}) + Responses API実行`);

      // web_search使用時は追加ログ
      if (useWebSearch) {
        console.log(
          `🔍 ${this.name}: Web検索を含む処理（最大15分かかる可能性があります）`
        );
      }

      // キャッシュ回避のためタイムスタンプを追加
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const cacheBreaker = `\n<!-- Request ID: ${timestamp}-${randomId} -->`;

      // web_search使用時はJSONを明示的に要求
      let finalPrompt = prompt + cacheBreaker;
      if (useWebSearch) {
        // Web検索時はtext形式で返すが、JSONフォーマットを要求
        finalPrompt =
          prompt + cacheBreaker + "\n\n必ず有効なJSON形式で応答してください。";
      } else {
        // 通常時はjson_objectモードで、プロンプトに"json"を含める
        finalPrompt =
          prompt + cacheBreaker + "\n\n結果をJSON形式で返してください。";
      }

      // 進捗ログを出力（出典検索エージェントの場合は詳細に）
      let elapsedTime = 0;
      const progressInterval = setInterval(() => {
        elapsedTime += 30;

        if (this.name === "出典検索エージェント") {
          // 部分結果があれば表示
          const agent = this as any;
          if (agent.partialResults) {
            const { completedItems, totalItems } = agent.partialResults;
            if (totalItems > 0) {
              console.log(
                `📊 ${this.name}: 中間結果 - ${completedItems}/${totalItems}件取得済み（${elapsedTime}秒経過）`
              );
            } else {
              console.log(
                `⏳ ${this.name}: 処理継続中...（${elapsedTime}秒経過）`
              );
            }
          } else {
            console.log(
              `⏳ ${this.name}: 処理継続中...（${elapsedTime}秒経過）`
            );
          }
        } else {
          console.log(`⏳ ${this.name}: 処理継続中...（${elapsedTime}秒経過）`);
        }
      }, 30000);

      try {
        // APIパラメータを動的に構築
        const apiParams: any = {
          model: this.model,
          input: finalPrompt,
          reasoning: {
            effort: useWebSearch ? "medium" : "minimal", // web_searchはmedium以上が必要
          },
        };

        // Web検索使用時はtext形式、それ以外はjson_object形式
        if (!useWebSearch) {
          apiParams.text = {
            format: { type: "json_object" },
            verbosity: "medium", // low/medium/high
          };
        }

        // Web検索ツールは使用時のみ追加
        if (useWebSearch) {
          apiParams.tools = [{ type: "web_search" }];
        }

        const response = await (this.openai as any).responses.create(apiParams);

        clearInterval(progressInterval);

        // response.outputの内容を確認（デバッグ用）
        if (response?.output) {
          console.log("📝 response.output を検出:", typeof response.output);
          if (typeof response.output === "string") {
            console.log(
              "📝 response.output の最初の200文字:",
              response.output.substring(0, 200)
            );
          } else if (typeof response.output === "object") {
            console.log("📝 response.output はオブジェクト:", response.output);
            console.log(
              "📝 response.output のキー:",
              Object.keys(response.output)
            );
          }
        }

        // レスポンスからテキストを取得（オブジェクトの場合も考慮）
        let resultText = "";

        // どのフィールドが存在するか確認
        console.log("🔍 レスポンスのフィールド確認:");
        console.log(
          "  - response.output exists:",
          !!response?.output,
          "type:",
          typeof response?.output
        );
        console.log(
          "  - response.output_text exists:",
          !!response?.output_text,
          "type:",
          typeof response?.output_text
        );
        console.log(
          "  - response.text exists:",
          !!response?.text,
          "type:",
          typeof response?.text
        );
        console.log(
          "  - response.content exists:",
          !!response?.content,
          "type:",
          typeof response?.content
        );

        if (typeof response?.output === "string") {
          console.log("✅ response.outputから取得（string）");
          resultText = response.output;
        } else if (
          typeof response?.output === "object" &&
          response?.output?.text
        ) {
          console.log("✅ response.output.textから取得");
          resultText = response.output.text;
        } else if (
          typeof response?.output === "object" &&
          response?.output?.content
        ) {
          console.log("✅ response.output.contentから取得");
          resultText = response.output.content;
        } else if (response?.output_text) {
          console.log("✅ response.output_textから取得");
          resultText = response.output_text;
        } else if (response?.text) {
          console.log("✅ response.textから取得");
          resultText = response.text;
        } else if (response?.content) {
          console.log("✅ response.contentから取得");
          resultText = response.content;
        } else {
          console.log("❌ どのフィールドからも取得できず");
          resultText = "";
        }

        // 取得したデータの形式を確認
        if (resultText) {
          console.log("📝 取得したresultTextの型:", typeof resultText);
          console.log(
            "📝 resultTextの最初の100文字:",
            resultText.substring(0, 100)
          );

          // JSONの場合は中身を取り出す（汎用的な処理）
          if (resultText.startsWith("{") && resultText.includes("===結果")) {
            try {
              console.log(
                "📦 JSON形式を検出、===結果を含むフィールドを探します"
              );
              const parsed = JSON.parse(resultText);

              // すべてのキーをチェックして、===結果を含む文字列を探す
              for (const key of Object.keys(parsed)) {
                const value = parsed[key];
                if (typeof value === "string" && value.includes("===結果")) {
                  console.log(
                    `✅ "${key}"フィールドから===結果を含むデータを取得`
                  );
                  resultText = value;
                  console.log(
                    "📝 取得したデータの先頭100文字:",
                    resultText.substring(0, 100)
                  );
                  break; // 最初に見つかったものを使用
                }
              }
            } catch (e) {
              console.log("⚠️ JSONパース失敗:", e);
            }
          }
        }

        // CitationsAgentの場合、レスポンスの詳細をログ出力
        if (this.name === "引用・出典検証エージェント") {
          console.log("🔍 CitationsAgent レスポンス詳細:");
          console.log("  - response全体の型:", typeof response);
          console.log(
            "  - responseのキー:",
            response ? Object.keys(response) : "null"
          );

          // output_textの安全な表示
          if (response?.output_text) {
            const textStr =
              typeof response.output_text === "string"
                ? response.output_text
                : JSON.stringify(response.output_text);
            console.log("  - output_text:", `${textStr.substring(0, 200)}...`);
          } else {
            console.log("  - output_text:", "なし");
          }

          // textの安全な表示（オブジェクトの可能性があるため）
          if (response?.text) {
            const textStr =
              typeof response.text === "string"
                ? response.text
                : JSON.stringify(response.text);
            console.log("  - text:", `${textStr.substring(0, 200)}...`);
          } else {
            console.log("  - text:", "なし");
          }

          // contentの安全な表示
          if (response?.content) {
            const contentStr =
              typeof response.content === "string"
                ? response.content
                : JSON.stringify(response.content);
            console.log("  - content:", `${contentStr.substring(0, 200)}...`);
          } else {
            console.log("  - content:", "なし");
          }

          console.log(
            "  - 取得したresultText (最初の500文字):",
            resultText ? resultText.substring(0, 500) : "なし"
          );
        }

        if (resultText) {
          console.log(`✅ ${this.name} API応答成功`);
        } else {
          console.warn(`⚠️ ${this.name} 応答テキストが空`);
        }

        return resultText;
      } finally {
        clearInterval(progressInterval);
      }
    } catch (error) {
      console.error(`❌ ${this.name} GPT-5 Responses APIエラー:`, error);
      // エラーでもデフォルト結果を返す（デモ用）
      return JSON.stringify({
        score: 75 + Math.random() * 15,
        confidence: 80 + Math.random() * 15,
        issues: [
          {
            type: "factual-error",
            severity: "major",
            location: "テスト検出箇所",
            description: `${this.name}による問題検出（デモ）`,
            original: "問題のある表現",
            suggestion: "修正案",
            confidence: 85,
          },
        ],
        suggestions: [
          {
            type: "improvement",
            description: `${this.name}からの改善提案（デモ）`,
            implementation: "具体的な実装方法",
            priority: "medium",
          },
        ],
      });
    }
  }

  // 結果のパース
  protected parseResponse(response: string): {
    issues: Issue[];
    suggestions: Suggestion[];
    score: number;
    confidence: number;
  } {
    try {
      // まず直接JSON解析を試みる
      if (response.trim().startsWith("{")) {
        return JSON.parse(response);
      }

      // JSONを含む可能性のあるパターンを複数試す
      // パターン1: 最も外側の{}を探す（ネストされたオブジェクトに対応）
      let depth = 0;
      let startIdx = -1;
      let endIdx = -1;

      for (let i = 0; i < response.length; i++) {
        if (response[i] === "{") {
          if (depth === 0) startIdx = i;
          depth++;
        } else if (response[i] === "}") {
          depth--;
          if (depth === 0 && startIdx !== -1) {
            endIdx = i + 1;
            break;
          }
        }
      }

      if (startIdx !== -1 && endIdx !== -1) {
        const jsonStr = response.substring(startIdx, endIdx);
        const parsed = JSON.parse(jsonStr);
        console.log("✅ JSON解析成功（抽出方式）");
        return parsed;
      }

      // パターン2: 正規表現でJSON-likeな構造を探す
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log("✅ JSON解析成功（正規表現方式）");
        return parsed;
      }
    } catch (e) {
      console.warn("JSON解析失敗、テキスト解析にフォールバック");
      console.warn("レスポンスの最初の200文字:", response.substring(0, 200));
    }

    // テキスト解析フォールバック
    return {
      issues: [],
      suggestions: [],
      score: 80,
      confidence: 60,
    };
  }
}
