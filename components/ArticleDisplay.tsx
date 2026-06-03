import React, { useState, useMemo } from "react";
import type { SeoOutline } from "../types";
import { generateFaqSchemaFromArticle } from "../utils/faqSchemaGenerator";
import { generateSlug } from "../services/slugGenerator";
import { MultiAgentOrchestrator } from "../services/finalProofreadingAgents/MultiAgentOrchestrator";
import type { IntegrationResult } from "../services/finalProofreadingAgents/types";

interface ArticleDisplayProps {
  article: {
    title: string;
    metaDescription: string;
    htmlContent: string;
    plainText: string;
  };
  keyword: string;
  outline: SeoOutline | null;
  onEditClick?: () => void;
  onOpenImageAgent?: (articleData: {
    title: string;
    content: string;
    keyword: string;
    autoMode?: boolean;
  }) => void;
}

const ArticleDisplay: React.FC<ArticleDisplayProps> = ({
  article,
  keyword,
  outline,
  onEditClick,
  onOpenImageAgent,
}) => {
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [copyButtonText, setCopyButtonText] = useState("HTMLコピー");

  // 最終校閲（マルチエージェント）
  const [isFinalProofreading, setIsFinalProofreading] = useState(false);
  const [proofStatus, setProofStatus] = useState<string>("");
  const [proofResult, setProofResult] = useState<IntegrationResult | null>(null);
  const [showProofResult, setShowProofResult] = useState<boolean>(false);

  const handleFinalProofread = async () => {
    if (isFinalProofreading) return;

    console.log("🔘 [FAB] 最終校閲ボタンがクリックされました");
    setIsFinalProofreading(true);
    setProofStatus("校閲を開始...");
    setProofResult(null);
    setShowProofResult(false);

    try {
      const orchestrator = new MultiAgentOrchestrator({
        enableLegalCheck: true,
        parallel: true,
        timeout: 180000,
        enableMoA: false,
        enableSelfEvaluation: false,
        onProgress: function (message: string, progress: number) {
          setProofStatus(message + " (" + progress + "%)");
        },
      });

      const result = await orchestrator.execute(article.htmlContent);
      setProofResult(result);
      setShowProofResult(true);
      console.log("✅ [FAB] マルチエージェント実行完了:", {
        overallScore: result.overallScore,
        passed: result.passed,
        criticalIssues: result.criticalIssues.length,
        majorIssues: result.majorIssues.length,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ [FAB] 最終校閲エラー:", error);
      alert("最終校閲でエラーが発生しました：\n" + errMsg);
    } finally {
      setIsFinalProofreading(false);
      setProofStatus("");
    }
  };

  // FAQPage JSON-LD を生成
  var faqJsonLd = useMemo(function () {
    return generateFaqSchemaFromArticle(article.htmlContent);
  }, [article.htmlContent]);

  const handleCopyHtml = () => {
    var htmlWithSchema = faqJsonLd
      ? article.htmlContent + "\n\n" + faqJsonLd
      : article.htmlContent;
    navigator.clipboard
      .writeText(htmlWithSchema)
      .then(() => {
        setCopyButtonText("コピーしました！");
        setTimeout(() => {
          setCopyButtonText("HTMLコピー");
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        alert("コピーに失敗しました");
      });
  };

  const handleDownloadText = () => {
    const content = `タイトル: ${article.title}

メタディスクリプション: ${article.metaDescription}

---

${article.plainText}`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${keyword.replace(/\s+/g, "_")}_article.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenImageGenerator = async () => {
    // 画像生成エージェントに記事データを渡す
    // 修正済みの最新記事を優先的に使用
    // slugはキーワードを英訳して生成（未指定の場合）
    let slug = (article as any).slug as string | undefined;
    if (!slug) {
      try {
        slug = await generateSlug(keyword);
      } catch (e) {
        console.error("⚠️ slug生成失敗、フォールバックを使用:", e);
        slug = "post";
      }
    }

    const articleData = {
      title: article.title,
      htmlContent: article.htmlContent, // 常に最新の記事内容を使用
      metaDescription: article.metaDescription,
      keyword: keyword,
      slug: slug,
    };

    console.log("🎨 画像生成エージェントへデータを送信");
    console.log(`  - タイトル: ${articleData.title}`);
    console.log(`  - 記事文字数: ${articleData.htmlContent.length}文字`);
    console.log(`  - キーワード: ${articleData.keyword}`);

    // localStorageにデータを保存（AI Article Imager for WordPressが読み込み用）
    localStorage.setItem("articleDataForImageGen", JSON.stringify(articleData));

    // 画像生成エージェントを別タブで開く（iframeモーダル表示は無効化済み）
    const imageGenUrl =
      import.meta.env.VITE_IMAGE_GEN_URL ||
      "http://localhost:5181";
    const imageGenOrigin = new URL(imageGenUrl).origin;

    console.log(`🚀 AI Article Imager for WordPressを開きます: ${imageGenUrl}`);
    const newWindow = window.open(imageGenUrl, "_blank");

    if (newWindow) {
      setTimeout(() => {
        console.log(
          "📮 AI Article Imager for WordPressにpostMessageでデータを送信中..."
        );
        newWindow.postMessage(
          {
            type: "ARTICLE_DATA",
            data: articleData,
          },
          imageGenOrigin
        );
        console.log("✅ postMessage送信完了");
      }, 3000);
    } else {
      alert(
        "ポップアップがブロックされました。ブラウザの設定で " +
          imageGenOrigin +
          " のポップアップを許可してください。"
      );
    }
  };

  const handleDownloadHtml = () => {
    const fullHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${article.metaDescription}">
  <title>${article.title}</title>
  <style>
    body { font-family: sans-serif; line-height: 1.8; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
    h1 { color: #1e40af; border-bottom: 3px solid #0066cc; padding-bottom: 15px; font-size: 2em; margin-bottom: 30px; }
    h2 { color: #1e3a8a; margin-top: 40px; margin-bottom: 20px; font-size: 1.5em; font-weight: bold; padding-bottom: 10px; border-bottom: 2px solid #ddd; }
    h3 { color: #1d4ed8; margin-top: 30px; margin-bottom: 15px; font-size: 1.25em; font-weight: bold; }
    p { margin: 15px 0; }
    strong, b { color: #1e3a8a; font-weight: bold; }
    ul, ol { margin: 20px 0; padding-left: 30px; }
    li { margin: 8px 0; }
    .source-citation { font-size: 0.85em; color: #666; margin-top: 4px; margin-bottom: 16px; }
    .source-citation a { color: #2563eb; text-decoration: underline; }
    .source-citation a:hover { color: #1d4ed8; }
  </style>
  ${faqJsonLd}
</head>
<body>
  <h1>${article.title}</h1>
  ${article.htmlContent}
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${keyword.replace(/\s+/g, "_")}_article.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            生成された記事
            <span className="text-sm text-gray-500">- {keyword}</span>
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("preview")}
              className={`px-4 py-2 rounded-lg ${
                viewMode === "preview"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
              }`}
            >
              プレビュー
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={`px-4 py-2 rounded-lg ${
                viewMode === "code"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
              }`}
            >
              HTMLコード
            </button>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex gap-2 justify-end flex-wrap">
          <button
            onClick={handleCopyHtml}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors border border-gray-200"
          >
            {copyButtonText}
          </button>
          <button
            onClick={handleDownloadText}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
          >
            テキストDL
          </button>
          <button
            onClick={handleDownloadHtml}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            HTML DL
          </button>
          <button
            onClick={handleOpenImageGenerator}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg transition-all flex items-center gap-2 font-semibold shadow-sm animate-pulse"
            title="画像生成エージェントで記事に画像を挿入"
          >
            画像生成へ
          </button>
        </div>
      </div>

      {/* 記事情報 */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold text-blue-600 mb-3">記事情報</h3>
        <div className="space-y-2">
          <div>
            <span className="text-gray-500">タイトル:</span>
            <p className="text-gray-800 mt-1">{article.title}</p>
          </div>
          <div>
            <span className="text-gray-500">メタディスクリプション:</span>
            <p className="text-gray-800 mt-1">{article.metaDescription}</p>
          </div>
          <div className="flex gap-4">
            <div>
              <span className="text-gray-500">文字数:</span>
              <span className="ml-2 text-gray-800">
                {article.plainText.length.toLocaleString()}文字
              </span>
            </div>
            {outline?.characterCountAnalysis && (
              <div>
                <span className="text-gray-500">推奨文字数:</span>
                <span className="ml-2 text-gray-800">
                  {outline.characterCountAnalysis.average.toLocaleString()}文字
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAQPage JSON-LD */}
      {faqJsonLd && (
        <div className="bg-green-50 p-4 rounded-xl border border-green-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
              <span>{"✅"}</span>
              FAQPage 構造化データ（JSON-LD）
            </h3>
            <button
              onClick={function () {
                navigator.clipboard.writeText(faqJsonLd).then(function () {
                  alert("JSON-LDをコピーしました");
                });
              }}
              className="px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors border border-green-300"
            >
              コピー
            </button>
          </div>
          <p className="text-xs text-green-600 mb-2">
            HTMLコピー・HTML DLに自動で含まれます。WordPressのカスタムHTMLブロックに貼り付けても使えます。
          </p>
          <pre className="bg-white text-xs text-gray-700 p-3 rounded-lg overflow-auto max-h-40 border border-green-200">
            <code>{faqJsonLd}</code>
          </pre>
        </div>
      )}

      {/* 最終校閲 結果パネル */}
      {showProofResult && proofResult && (
        <div
          className={
            "p-5 rounded-xl border-l-4 shadow-sm space-y-4 " +
            (proofResult.passed
              ? "bg-green-50 border-green-500"
              : "bg-amber-50 border-amber-500")
          }
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-3">
              <span>🤖 最終校閲結果</span>
              <span
                className={
                  "px-3 py-1 rounded-full text-sm " +
                  (proofResult.passed
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800")
                }
              >
                {proofResult.overallScore}/100点
                {proofResult.passed ? " ✅ 合格" : " ⚠ 要修正"}
              </span>
            </h3>
            <button
              onClick={function () {
                setShowProofResult(false);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* スコア内訳 */}
          {proofResult.regulationScore && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-2">
                スコア内訳
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <div className="bg-white rounded p-2 border">
                  <div className="text-gray-500">ファクトチェック</div>
                  <div className="font-bold text-gray-800">
                    {Math.round(proofResult.regulationScore.factChecking)} / 45
                  </div>
                </div>
                <div className="bg-white rounded p-2 border">
                  <div className="text-gray-500">信頼性・引用</div>
                  <div className="font-bold text-gray-800">
                    {Math.round(proofResult.regulationScore.reliability)} / 25
                  </div>
                </div>
                <div className="bg-white rounded p-2 border">
                  <div className="text-gray-500">構成ルール</div>
                  <div className="font-bold text-gray-800">
                    {Math.round(proofResult.regulationScore.structureRules)} /
                    18
                  </div>
                </div>
                <div className="bg-white rounded p-2 border">
                  <div className="text-gray-500">法令準拠</div>
                  <div className="font-bold text-gray-800">
                    {Math.round(proofResult.regulationScore.legalCompliance)} /
                    7
                  </div>
                </div>
                <div className="bg-white rounded p-2 border">
                  <div className="text-gray-500">総合品質</div>
                  <div className="font-bold text-gray-800">
                    {Math.round(proofResult.regulationScore.overallQuality)} / 5
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 指摘事項サマリー */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-2">指摘事項</h4>
            <div className="grid grid-cols-3 gap-2 mb-2 text-sm">
              <div className="bg-white rounded p-2 border">
                <span className="text-red-600 font-semibold">重大:</span>{" "}
                {proofResult.criticalIssues.length}件
              </div>
              <div className="bg-white rounded p-2 border">
                <span className="text-amber-600 font-semibold">重要:</span>{" "}
                {proofResult.majorIssues.length}件
              </div>
              <div className="bg-white rounded p-2 border">
                <span className="text-gray-600 font-semibold">軽微:</span>{" "}
                {proofResult.minorIssues.length}件
              </div>
            </div>

            {proofResult.criticalIssues.length +
              proofResult.majorIssues.length +
              proofResult.minorIssues.length ===
            0 ? (
              <div className="text-sm text-green-700 bg-white p-3 rounded border border-green-200">
                ✅ 指摘事項は検出されませんでした。
              </div>
            ) : (
              <details className="text-sm" open>
                <summary className="cursor-pointer text-blue-700 hover:underline font-semibold">
                  指摘の詳細を表示
                </summary>
                <ul className="mt-2 space-y-2">
                  {[
                    ...proofResult.criticalIssues,
                    ...proofResult.majorIssues,
                    ...proofResult.minorIssues,
                  ]
                    .slice(0, 30)
                    .map(function (issue, idx) {
                      var severityLabel =
                        issue.severity === "critical"
                          ? "重大"
                          : issue.severity === "major"
                          ? "重要"
                          : issue.severity === "minor"
                          ? "軽微"
                          : "情報";
                      var typeLabel =
                        issue.type === "factual-error"
                          ? "事実誤認"
                          : issue.type === "outdated-info"
                          ? "古い情報"
                          : issue.type === "inconsistency"
                          ? "不整合"
                          : issue.type === "missing-source"
                          ? "出典不明"
                          : issue.type === "legal-risk"
                          ? "法的リスク"
                          : issue.type === "brand-error"
                          ? "ブランド表記誤り"
                          : issue.type === "technical-error"
                          ? "技術的誤り"
                          : issue.type === "style-issue"
                          ? "表現スタイル"
                          : issue.type;
                      var severityColor =
                        issue.severity === "critical"
                          ? "bg-red-100 text-red-800"
                          : issue.severity === "major"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-700";
                      return (
                        <li
                          key={idx}
                          className="bg-white p-3 rounded border border-gray-200"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={
                                "text-xs font-bold px-2 py-0.5 rounded " +
                                severityColor
                              }
                            >
                              {severityLabel}
                            </span>
                            <span className="text-xs text-gray-500">
                              {typeLabel}
                            </span>
                            <span className="text-xs text-gray-400">
                              {issue.location}
                            </span>
                          </div>
                          <div className="text-gray-800 mb-1">
                            {issue.description}
                          </div>
                          {issue.original && (
                            <div className="text-xs bg-red-50 border-l-2 border-red-300 px-2 py-1 my-1">
                              <span className="font-semibold text-red-700">
                                該当箇所:
                              </span>{" "}
                              <span className="text-gray-700">
                                {issue.original}
                              </span>
                            </div>
                          )}
                          {issue.suggestion && (
                            <div className="text-xs bg-blue-50 border-l-2 border-blue-300 px-2 py-1 my-1">
                              <span className="font-semibold text-blue-700">
                                改善案:
                              </span>{" "}
                              <span className="text-gray-700">
                                {issue.suggestion}
                              </span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </details>
            )}
          </div>

          {/* 改善提案 */}
          {proofResult.suggestions && proofResult.suggestions.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-2">
                改善提案（{proofResult.suggestions.length}件）
              </h4>
              <details className="text-sm" open>
                <summary className="cursor-pointer text-blue-700 hover:underline font-semibold">
                  提案を表示
                </summary>
                <ul className="mt-2 space-y-2">
                  {proofResult.suggestions
                    .slice(0, 15)
                    .map(function (s, idx) {
                      var priorityLabel =
                        s.priority === "high"
                          ? "優先度・高"
                          : s.priority === "medium"
                          ? "優先度・中"
                          : "優先度・低";
                      var priorityColor =
                        s.priority === "high"
                          ? "bg-red-100 text-red-800"
                          : s.priority === "medium"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-700";
                      return (
                        <li
                          key={idx}
                          className="bg-white p-3 rounded border border-gray-200"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={
                                "text-xs font-bold px-2 py-0.5 rounded " +
                                priorityColor
                              }
                            >
                              {priorityLabel}
                            </span>
                            <span className="text-xs text-gray-500">
                              {s.type}
                            </span>
                          </div>
                          <div className="text-gray-800 mb-1">
                            {s.description}
                          </div>
                          {s.implementation && (
                            <div className="text-xs bg-blue-50 border-l-2 border-blue-300 px-2 py-1 my-1">
                              <span className="font-semibold text-blue-700">
                                実装方法:
                              </span>{" "}
                              <span className="text-gray-700">
                                {s.implementation}
                              </span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </details>
            </div>
          )}
        </div>
      )}

      {/* コンテンツエリア */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {viewMode === "preview" ? (
          // プレビューモード
          <div className="bg-white rounded-lg p-8 text-gray-900">
            <style dangerouslySetInnerHTML={{ __html: `
              .article-content .source-citation { font-size: 0.85em; color: #6b7280; margin-top: 4px; margin-bottom: 16px; }
              .article-content .source-citation a { color: #2563eb; text-decoration: underline; }
              .article-content .source-citation a:hover { color: #1d4ed8; }
            `}} />
            <h1 className="text-3xl font-bold mb-6 pb-4 border-b-2 border-blue-600">
              {article.title}
            </h1>
            <div
              className="prose prose-lg max-w-none article-content
                prose-h2:text-2xl prose-h2:font-bold prose-h2:text-blue-900 prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b-2 prose-h2:border-blue-200
                prose-h3:text-xl prose-h3:font-bold prose-h3:text-blue-700 prose-h3:mt-6 prose-h3:mb-3
                prose-p:text-gray-700 prose-p:leading-relaxed
                prose-strong:text-blue-900 prose-strong:font-bold
                prose-ul:my-4 prose-li:my-1"
              dangerouslySetInnerHTML={{ __html: article.htmlContent }}
            />
          </div>
        ) : (
          // コードモード
          <div className="p-4">
            <pre className="bg-gray-50 text-gray-800 font-mono text-sm p-4 rounded-lg overflow-auto max-h-[600px] border border-gray-200">
              <code>{article.htmlContent}</code>
            </pre>
          </div>
        )}
      </div>

      {/* 最終校閲 FAB（画面右下に追従型・丸ボタン） */}
      <button
        type="button"
        onClick={handleFinalProofread}
        disabled={isFinalProofreading}
        className={
          "fixed bottom-8 right-8 z-50 w-32 h-32 rounded-full text-white shadow-2xl flex flex-col items-center justify-center transition-all hover:scale-110 disabled:cursor-not-allowed border-4 border-white " +
          (isFinalProofreading
            ? "bg-gradient-to-br from-gray-400 to-gray-500 opacity-90"
            : "bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700")
        }
        title="最終校閲 Ver.2.0（マルチエージェント校閲）"
      >
        {isFinalProofreading ? (
          <>
            <span className="text-3xl animate-pulse">🤖</span>
            <span className="text-sm font-bold mt-1">校閲中</span>
          </>
        ) : (
          <>
            <span className="text-3xl">🤖</span>
            <span className="text-sm font-bold leading-tight mt-1 text-center">
              最終校閲
              <br />
              Ver.2.0
            </span>
          </>
        )}
      </button>

      {/* 校閲中のステータスバブル */}
      {isFinalProofreading && proofStatus && (
        <div className="fixed bottom-32 right-8 z-40 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-[280px]">
          {proofStatus}
        </div>
      )}
    </div>
  );
};

export default ArticleDisplay;
