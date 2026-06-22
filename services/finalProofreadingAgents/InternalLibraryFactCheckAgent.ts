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
   *
   * Dify の出力は判定単位のマーカーで構成される（フォーマットは2系統を観測）:
   *   - 「[判定] 〜」形式
   *   - 「✅ / ⚠️ / ❌」絵文字形式
   * これらを「判定（finding）」の最小単位として抽出し、3種類に分類する:
   *   - problem     … 社内定義と不一致・矛盾（❌ / 不正確 等）→ 減点対象
   *   - unconfirmed … ナレッジベースに該当が無く確認できない（⚠️ / 確認できない 等）
   *                   → 「誤り」ではないため減点しない。Dify更新用にリスト化する
   *   - positive    … 一致・問題なし（✅ 等）→ 何もしない（無視）
   * 「■ 見出し」は文脈、「【総合評価】「【ファクトチェック結果】」等の【】総括ブロックは
   * 個別判定の要約に過ぎないためスコア対象から除外する。
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

    const findings = this.extractFindings(text);

    // マーカー判定が1件も取れない（想定外フォーマット）場合は全文ヒューリスティックにフォールバック
    if (findings.length === 0) {
      const negativeAll = /不正確|不一致|矛盾|誤り|虚偽|逸脱/.test(text);
      if (!negativeAll) {
        return {
          score: 95,
          issues: [],
          suggestions: [
            {
              type: "internal-library",
              description:
                "社内ライブラリ照合：指摘事項なし。社内定義と整合しています。",
              implementation:
                "現状の表現を維持してください（全文レポートは管理画面参照）。",
              priority: "low",
            },
          ],
          confidence: 80,
        };
      }
      return {
        score: 80,
        issues: [
          {
            type: "factual-error",
            severity: "major",
            location: "社内ライブラリ照合",
            description:
              text.length > 600 ? text.substring(0, 600) + "…" : text,
            original: "",
            confidence: 80,
          },
        ],
        suggestions: [],
        confidence: 80,
      };
    }

    const problems = findings.filter((f) => f.kind === "problem");
    const unconfirmed = findings.filter((f) => f.kind === "unconfirmed");

    const issues: Issue[] = [];

    // 不一致・矛盾 → major（減点対象）
    problems.forEach((f) => {
      const detail = f.text.length > 600 ? f.text.substring(0, 600) + "…" : f.text;
      issues.push({
        type: "factual-error",
        severity: "major",
        location: f.heading || "社内ライブラリ照合",
        description: detail,
        original: "",
        confidence: 85,
      });
    });

    // 確認できなかった項目 → minor（減点しない・可視化のみ）
    // ※ IntegrationAgent は info を critical/major/minor のどれにも振り分けず捨てるため、
    //    UI に表示するには minor にする必要がある（スコアは件数非依存なので減点されない）。
    unconfirmed.forEach((f) => {
      issues.push({
        type: "factual-error",
        severity: "minor",
        location: f.heading || "社内ライブラリ照合",
        description:
          "【ライブラリ未確認】" +
          f.label +
          (f.detail ? " — " + f.detail : "") +
          "（ナレッジベースに該当が無く確認できず／減点対象外）",
        original: "",
        confidence: 50,
      });
    });

    // スコア算出：problem（不一致）件数のみで減点。unconfirmed は減点しない
    let score = 95;
    if (problems.length === 1) score = 85;
    else if (problems.length === 2) score = 78;
    else if (problems.length === 3) score = 72;
    else if (problems.length >= 4) score = 65;

    const suggestions: Suggestion[] = [];

    if (problems.length > 0) {
      suggestions.push({
        type: "internal-library",
        description:
          "社内ライブラリ照合：" +
          problems.length +
          "件の不一致あり。社内定義との食い違いを確認・修正してください。",
        implementation:
          "ファクトチェッカーの全文レポートを参照し、該当箇所の表現を社内定義に合わせて修正する。",
        priority: problems.length >= 3 ? "high" : "medium",
      });
    }

    // 確認できなかった項目をリスト化（Dify側ライブラリ追加の手がかり）
    if (unconfirmed.length > 0) {
      const list = unconfirmed.map((f) => "・" + f.label).join("\n");
      suggestions.push({
        type: "internal-library-unconfirmed",
        description:
          "ナレッジベースで確認できなかった項目が" +
          unconfirmed.length +
          "件あります（減点対象外）。Dify側の社内ライブラリへの追加をご検討ください。",
        implementation: "【ライブラリ未登録の可能性がある項目】\n" + list,
        priority: "low",
      });
    }

    if (problems.length === 0) {
      suggestions.push({
        type: "internal-library",
        description:
          "社内ライブラリ照合：社内定義との不一致はありませんでした。",
        implementation:
          unconfirmed.length > 0
            ? "上記の未確認項目をライブラリに追加すると、次回以降の照合精度が上がります。"
            : "現状の表現を維持してください。",
        priority: "low",
      });
    }

    return {
      score: score,
      issues: issues,
      suggestions: suggestions,
      confidence: 85,
    };
  }

  /**
   * fact_check_result を判定（finding）単位に分解する。
   * 「[判定]」「✅」「⚠️」「❌」等のマーカー行を1判定の起点とし、
   * 続く根拠行（→ 〜）をその判定に束ねる。「■」は文脈見出し、
   * 「【〜】」総括ブロックは個別判定の要約のためスコア対象外として読み飛ばす。
   */
  private extractFindings(text: string): Array<{
    heading: string;
    label: string;
    detail: string;
    text: string;
    kind: "problem" | "unconfirmed" | "positive";
  }> {
    const lines = text.split(/\r?\n/);

    const isSectionHeading = (line: string): boolean => /^■/.test(line.trim());
    const isSummaryHeading = (line: string): boolean =>
      /^【.+】/.test(line.trim());
    const markerRe = /^(\[判定\]|✅|⚠️|❌|🔴|✕|×)/;
    const isMarker = (line: string): boolean => markerRe.test(line.trim());

    const findings: Array<{
      heading: string;
      label: string;
      detail: string;
      text: string;
      kind: "problem" | "unconfirmed" | "positive";
    }> = [];

    let currentHeading = "";
    let inSummary = false;
    let cur: { heading: string; first: string; lines: string[] } | null = null;

    const flush = (): void => {
      if (cur === null) return;
      const c = cur;
      cur = null;
      const block = c.lines.join("\n").trim();
      if (block.length === 0) return;
      const kind = this.classifyFinding(block);
      // positive（一致・問題なし）は減点もリスト化もしないため捨てる
      if (kind === "positive") return;
      // 「用語の確認」セクションの未確認は一般的な業界用語が多くノイズになるため除外する。
      // （不一致＝problem は万一あれば実害があるため残す）
      if (kind === "unconfirmed" && /用語/.test(c.heading)) return;
      const label = this.extractLabel(c.first);
      const detail = c.lines.slice(1).join(" ").replace(/\s+/g, " ").trim();
      findings.push({
        heading: c.heading,
        label: label,
        detail: detail,
        text: block,
        kind: kind,
      });
    };

    lines.forEach((line) => {
      if (isSectionHeading(line)) {
        flush();
        currentHeading = line.trim().replace(/^■\s*/, "");
        inSummary = false;
        return;
      }
      if (isSummaryHeading(line)) {
        // 【総合評価】【ファクトチェック結果】等：以降の本文はスコア対象外
        flush();
        inSummary = true;
        return;
      }
      if (inSummary) return;
      if (isMarker(line)) {
        flush();
        cur = { heading: currentHeading, first: line.trim(), lines: [line] };
        return;
      }
      if (cur !== null) cur.lines.push(line);
      // マーカー前の見出し直下テキストは文脈とみなし無視する
    });
    flush();

    return findings;
  }

  // 判定ブロックを problem / unconfirmed / positive に分類する。
  // 優先度: problem > unconfirmed > positive。判別不能は安全側で unconfirmed（減点なし・リスト化）。
  private classifyFinding(
    block: string
  ): "problem" | "unconfirmed" | "positive" {
    // ① 不一致・矛盾（明確な誤り）→ problem（減点対象）
    if (
      /❌|✕|×|不正確|不一致|矛盾|誤り|虚偽|逸脱|事実と異なる|要修正/.test(block)
    ) {
      return "problem";
    }

    const hasCheck = /✅/.test(block); // 明示的なOKマーカー
    const hasWarn = /⚠️/.test(block); // 明示的な注意マーカー

    // ② 確認できない・ナレッジに情報が無い（誤りではない）→ unconfirmed（減点しない・リスト化）
    //    「確認が必要」「情報が含まれていない」「定義が示されていない」等も含む。
    //    ただし ✅ が付いた肯定判定は対象外（✅ を優先）。
    const unconfirmedText =
      /確認が必要|確認できない|確認できません|確認不能|情報が(ない|ありません|不足|不十分|含まれていない)|具体的な[^。]*(ない|示されていない|含まれていない)|示されていない|該当する記載が(ない|ありません)|記載が(ない|ありません)|登録されていない|存在しません|見当たらない|不明確/.test(
        block
      );
    if (hasWarn || (unconfirmedText && !hasCheck)) {
      return "unconfirmed";
    }

    // ③ 一致・問題なし → positive（無視）
    if (
      hasCheck ||
      /一致|合致|問題なし|問題はありません|整合|認識されている|存在する|存在します|正確です/.test(
        block
      )
    ) {
      return "positive";
    }

    // ④ 判別不能：安全側で unconfirmed（黙って捨てない）
    return "unconfirmed";
  }

  // 判定行の先頭マーカーを除き、対象（「」内の主張 or 見出し語）を抜き出す
  private extractLabel(line: string): string {
    let s = line.trim().replace(/^(\[判定\]|✅|⚠️|❌|🔴|✕|×)\s*/, "");
    const quoted = /「([^」]+)」/.exec(s);
    if (quoted && quoted[1]) return quoted[1].trim();
    // 「→」「:」「：」以降は根拠なので落とす
    const sepIdx = s.search(/[→:：]/);
    if (sepIdx > 0) s = s.substring(0, sepIdx);
    return s.trim().substring(0, 60);
  }
}
