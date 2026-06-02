// 社内ライブラリ・ファクトチェッカーエージェント
// Dify Workflow API（社内ライブラリ照合）を呼び出し、
// 記事内の表現・情報が社内定義に則しているかをチェックする。
//
// Phase 2「出典系」エージェント群の末尾で実行される想定。
// OpenAI を使わないため BaseProofreadingAgent.execute() を独自に上書き。

import { BaseProofreadingAgent } from "./BaseAgent";
import { runInternalFactCheck } from "../internalLibraryFactCheck";
import type {
  AgentResult,
  Issue,
  Suggestion,
  AgentContext,
} from "./types";

export class InternalLibraryFactCheckAgent extends BaseProofreadingAgent {
  constructor() {
    // model は使わないが BaseProofreadingAgent の規約上ダミー指定
    super("社内ライブラリ照合エージェント", "internal-library-factcheck", "gpt-5-nano");
  }

  // OpenAI を使わないので execute() を上書きする
  async execute(
    content: string,
    _context?: AgentContext
  ): Promise<AgentResult> {
    const startedAt = Date.now();
    console.log("🚀 " + this.name + " execute開始");

    try {
      const result = await runInternalFactCheck(content);
      const executionTime = Date.now() - startedAt;

      // Dify 側がスキップ（APIキー未設定）の場合は、successful 扱いにせずスキップ
      if (result && result.skipped) {
        console.log("⏭️ " + this.name + ": APIキー未設定のためスキップ");
        return {
          agentName: this.name,
          agentType: this.type,
          executionTime: executionTime,
          score: 0,
          issues: [],
          suggestions: [],
          confidence: 0,
          status: "error",
          error: "DIFY_FACTCHECK_API_KEY 未設定（スキップ）",
        };
      }

      if (!result || !result.ok) {
        const errMsg =
          result && result.error ? result.error : "Dify呼び出し失敗";
        console.error("❌ " + this.name + ": " + errMsg);
        return {
          agentName: this.name,
          agentType: this.type,
          executionTime: executionTime,
          score: 0,
          issues: [],
          suggestions: [],
          confidence: 0,
          status: "error",
          error: errMsg,
        };
      }

      const factText = result.factCheckResult || "";
      const parsed = this.parseFactCheckResult(factText);

      console.log(
        "✅ " +
          this.name +
          " 完了 (score=" +
          parsed.score +
          ", issues=" +
          parsed.issues.length +
          ", " +
          executionTime +
          "ms)"
      );

      return {
        agentName: this.name,
        agentType: this.type,
        executionTime: executionTime,
        score: parsed.score,
        issues: parsed.issues,
        suggestions: parsed.suggestions,
        confidence: parsed.confidence,
        status: "success",
      };
    } catch (err) {
      const executionTime = Date.now() - startedAt;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("❌ " + this.name + " エラー (" + executionTime + "ms):", err);
      return {
        agentName: this.name,
        agentType: this.type,
        executionTime: executionTime,
        score: 0,
        issues: [],
        suggestions: [],
        confidence: 0,
        status: "error",
        error: errMsg,
      };
    }
  }

  // BaseProofreadingAgent の抽象メソッド要件のための no-op 実装
  protected async performCheck(): Promise<{
    score: number;
    issues: Issue[];
    suggestions: Suggestion[];
    confidence: number;
  }> {
    return { score: 0, issues: [], suggestions: [], confidence: 0 };
  }

  /**
   * Dify が返す fact_check_result（人間可読のレポートテキスト）を Issue/Suggestion に整形する。
   * Dify 側のフォーマットに依存しないよう、ヒューリスティックに解析する。
   * - 「■」「【」始まりのブロックをセクション単位として抽出
   * - 「問題なし」「OK」「合致」のみのレポート → score=95、issuesなし
   * - それ以外 → 各ブロックを major issue として登録、score を内容量に応じて減点
   */
  private parseFactCheckResult(text: string): {
    score: number;
    issues: Issue[];
    suggestions: Suggestion[];
    confidence: number;
  } {
    if (!text || text.trim().length === 0) {
      return {
        score: 80,
        issues: [],
        suggestions: [],
        confidence: 50,
      };
    }

    // 全文がポジティブ判定のみのケース
    const looksClean =
      /問題なし|問題はありません|社内定義と合致|指摘事項なし|OK\b/i.test(
        text
      ) &&
      !/誤|不一致|要修正|要確認|逸脱|矛盾/.test(text);

    if (looksClean) {
      return {
        score: 95,
        issues: [],
        suggestions: [
          {
            type: "internal-library",
            description:
              "社内ライブラリ照合：指摘事項なし。社内定義と整合しています。",
            implementation:
              "現状の表現を維持してください（社内ライブラリチェッカー全文は管理画面のレポート参照）。",
            priority: "low",
          },
        ],
        confidence: 90,
      };
    }

    // 「■ 〜」または「【〜】」で始まるブロック単位に分割
    const blocks = this.splitBlocks(text);

    const issues: Issue[] = [];
    blocks.forEach((block) => {
      const title = this.extractTitle(block);
      const detail = block.length > 600 ? block.substring(0, 600) + "…" : block;

      // ブロック内に「問題なし」のみ含まれる場合はスキップ
      if (
        /問題なし|問題はありません|合致|該当なし/.test(block) &&
        !/誤|不一致|要修正|要確認|逸脱|矛盾/.test(block)
      ) {
        return;
      }

      issues.push({
        type: "factual-error",
        severity: "major",
        location: title || "社内ライブラリ照合",
        description: detail,
        original: "",
        confidence: 85,
      });
    });

    // スコア算出：指摘数に応じて減点（最低60）
    let score = 90;
    if (issues.length === 1) score = 85;
    else if (issues.length === 2) score = 78;
    else if (issues.length === 3) score = 72;
    else if (issues.length >= 4) score = 65;

    const suggestions: Suggestion[] = [
      {
        type: "internal-library",
        description:
          "社内ライブラリ照合：" +
          issues.length +
          "件の指摘あり。社内定義との不一致を確認・修正してください。",
        implementation:
          "ファクトチェッカーの全文レポートを参照し、該当箇所の表現を社内定義に合わせて修正する。",
        priority: issues.length >= 3 ? "high" : "medium",
      },
    ];

    return {
      score: score,
      issues: issues,
      suggestions: suggestions,
      confidence: 85,
    };
  }

  private splitBlocks(text: string): string[] {
    // 「■」または「【〜】」で始まるブロックに分割
    // どちらの記号もない場合は全文を1ブロックとして扱う
    const lines = text.split(/\r?\n/);
    const blocks: string[] = [];
    let current: string[] = [];

    const isHeaderLine = (line: string): boolean => {
      const trimmed = line.trim();
      return /^■/.test(trimmed) || /^【.+】/.test(trimmed);
    };

    lines.forEach((line) => {
      if (isHeaderLine(line) && current.length > 0) {
        blocks.push(current.join("\n").trim());
        current = [line];
      } else {
        current.push(line);
      }
    });
    if (current.length > 0) {
      const joined = current.join("\n").trim();
      if (joined.length > 0) blocks.push(joined);
    }

    if (blocks.length === 0) blocks.push(text.trim());
    return blocks.filter((b) => b.length > 0);
  }

  private extractTitle(block: string): string {
    const firstLine = block.split(/\r?\n/)[0] || "";
    const trimmed = firstLine.trim();
    // 「■ タイトル」「【タイトル】」を抽出
    const m1 = /^■\s*(.+)$/.exec(trimmed);
    if (m1 && m1[1]) return m1[1].trim();
    const m2 = /^【(.+)】/.exec(trimmed);
    if (m2 && m2[1]) return m2[1].trim();
    return trimmed.substring(0, 40);
  }
}
