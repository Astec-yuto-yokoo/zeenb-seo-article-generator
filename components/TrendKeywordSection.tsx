import React, { useState } from "react";
import type { TrendKeyword, TrendKeywordList } from "../types";
import { trendKeywordsToCsv } from "../services/strategicKeywordService";

interface TrendKeywordSectionProps {
  trendKeywords: TrendKeywordList | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onUseKeyword?: (keyword: string) => void;
}

function intentBadgeClass(intent: string): string {
  if (intent.indexOf("トランザクショナル") !== -1) {
    return "bg-rose-100 text-rose-700";
  }
  if (intent.indexOf("コマーシャル") !== -1) {
    return "bg-amber-100 text-amber-700";
  }
  if (intent.indexOf("ナビゲーショナル") !== -1) {
    return "bg-purple-100 text-purple-700";
  }
  return "bg-sky-100 text-sky-700";
}

function priorityBadgeClass(priority: string): string {
  if (priority === "高") {
    return "bg-red-500 text-white";
  }
  if (priority === "低") {
    return "bg-gray-300 text-gray-700";
  }
  return "bg-orange-400 text-white";
}

export const TrendKeywordSection: React.FC<TrendKeywordSectionProps> = ({
  trendKeywords,
  isGenerating,
  onGenerate,
  onUseKeyword,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCsv = () => {
    if (!trendKeywords) {
      return;
    }
    const csv = trendKeywordsToCsv(trendKeywords);
    navigator.clipboard.writeText(csv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadCsv = () => {
    if (!trendKeywords) {
      return;
    }
    const csv = trendKeywordsToCsv(trendKeywords);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trend-keywords.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const items: TrendKeyword[] =
    trendKeywords && trendKeywords.keywords ? trendKeywords.keywords : [];

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-orange-50 to-rose-50 p-4 rounded-xl border border-orange-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-orange-700 mb-1">
              時事ネタからのキーワード
            </h2>
            <p className="text-sm text-gray-600">
              最新ニュース・話題（資材高騰・悪質訪問販売・補助金・災害など）から、外壁塗装・屋根塗装に結びつくキーワードを自動で拾います
            </p>
          </div>
          <div className="flex items-center gap-2">
            {trendKeywords && (
              <>
                <button
                  onClick={handleCopyCsv}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-white text-orange-700 border border-orange-300 hover:bg-orange-50 transition"
                >
                  {copied ? "コピーしました" : "CSVコピー"}
                </button>
                <button
                  onClick={handleDownloadCsv}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-white text-orange-700 border border-orange-300 hover:bg-orange-50 transition"
                >
                  CSVダウンロード
                </button>
              </>
            )}
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition ${
                isGenerating
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-orange-500 text-white hover:bg-orange-600 shadow-md"
              }`}
            >
              {isGenerating
                ? "スキャン中..."
                : trendKeywords
                ? "再スキャン"
                : "時事ネタをスキャン"}
            </button>
          </div>
        </div>
      </div>

      {/* 生成中 */}
      {isGenerating && (
        <div className="p-6 text-center text-gray-500">
          <div className="animate-pulse">
            最新ニュース・話題をWeb検索でスキャン中...
          </div>
          <p className="text-xs mt-2">
            外壁塗装・屋根塗装に結びつく時事トピックを探すため、30秒〜1分ほどかかります
          </p>
        </div>
      )}

      {/* 未生成 */}
      {!isGenerating && !trendKeywords && (
        <div className="p-6 text-center text-gray-400">
          <p>「時事ネタをスキャン」ボタンで、いま話題のニュース起点のキーワードを拾います。</p>
        </div>
      )}

      {/* 結果 */}
      {!isGenerating && trendKeywords && (
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400">
              該当する時事ネタが見つかりませんでした。再スキャンをお試しください。
            </p>
          ) : (
            items.map((k, i) => (
              <div
                key={i}
                className="bg-gray-50 p-4 rounded-xl border border-gray-200"
              >
                {/* 時事ニュース */}
                {k.newsSummary && (
                  <div className="mb-2 text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5">
                    📰 {k.newsSummary}
                  </div>
                )}
                {/* キーワード＋バッジ */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-base font-semibold text-gray-800">
                    {k.keyword}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${intentBadgeClass(
                      String(k.intent)
                    )}`}
                  >
                    {k.intent}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${priorityBadgeClass(
                      k.priority
                    )}`}
                  >
                    優先度: {k.priority}
                  </span>
                </div>
                {k.relevance && (
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="text-gray-400">結びつき: </span>
                    {k.relevance}
                  </p>
                )}
                {k.suggestedH2 && (
                  <p className="text-sm text-gray-700 mb-1">
                    <span className="text-gray-400">想定H2: </span>
                    <span className="font-medium">{k.suggestedH2}</span>
                  </p>
                )}
                {k.sourceUrl && (
                  <p className="text-xs mb-1">
                    <a
                      href={k.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {k.sourceTitle ? k.sourceTitle : k.sourceUrl}
                    </a>
                  </p>
                )}
                {onUseKeyword && (
                  <div className="mt-2">
                    <button
                      onClick={() => onUseKeyword(k.keyword)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                    >
                      このKWで原稿作成 →
                    </button>
                  </div>
                )}
              </div>
            ))
          )}

          {/* 出典 */}
          {trendKeywords.sources && trendKeywords.sources.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-600 mb-2">
                参照ソース
              </h4>
              <ul className="space-y-1">
                {trendKeywords.sources.map((s, i) => {
                  const web = s && s.web ? s.web : null;
                  if (!web || !web.uri) {
                    return null;
                  }
                  return (
                    <li key={i} className="text-xs">
                      <a
                        href={web.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {web.title || web.uri}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
