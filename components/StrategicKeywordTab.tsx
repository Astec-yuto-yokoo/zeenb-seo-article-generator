import React, { useState } from "react";
import type { StrategicKeyword, StrategicKeywordList } from "../types";
import { strategicKeywordsToCsv } from "../services/strategicKeywordService";

interface StrategicKeywordTabProps {
  keyword: string;
  strategicKeywords: StrategicKeywordList | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onUseKeyword?: (keyword: string) => void; // 候補KWを原稿作成に引き継ぐ
}

// 検索意図バッジの色分け
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
  return "bg-sky-100 text-sky-700"; // インフォメーショナル
}

// 優先度バッジの色分け
function priorityBadgeClass(priority: string): string {
  if (priority === "高") {
    return "bg-red-500 text-white";
  }
  if (priority === "低") {
    return "bg-gray-300 text-gray-700";
  }
  return "bg-orange-400 text-white"; // 中
}

interface SectionProps {
  title: string;
  description: string;
  accentClass: string;
  items: StrategicKeyword[];
  onUseKeyword?: (keyword: string) => void;
}

const KeywordSection: React.FC<SectionProps> = ({
  title,
  description,
  accentClass,
  items,
  onUseKeyword,
}) => {
  return (
    <div className="space-y-3">
      <div className={`p-4 rounded-xl border ${accentClass}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <span className="text-sm font-semibold px-3 py-1 bg-white/70 rounded-full">
            {items.length}件
          </span>
        </div>
        <p className="text-sm mt-1 opacity-80">{description}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 px-2">キーワードが生成されませんでした。</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((k, i) => (
            <div
              key={i}
              className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"
            >
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
              {k.reason && (
                <p className="text-sm text-gray-600 mb-1">
                  <span className="text-gray-400">理由: </span>
                  {k.reason}
                </p>
              )}
              {k.suggestedH2 && (
                <p className="text-sm text-gray-700">
                  <span className="text-gray-400">想定H2: </span>
                  <span className="font-medium">{k.suggestedH2}</span>
                </p>
              )}
              {onUseKeyword && (
                <div className="mt-3">
                  <button
                    onClick={() => onUseKeyword(k.keyword)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                  >
                    このKWで原稿作成 →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const StrategicKeywordTab: React.FC<StrategicKeywordTabProps> = ({
  keyword,
  strategicKeywords,
  isGenerating,
  onGenerate,
  onUseKeyword,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCsv = () => {
    if (!strategicKeywords) {
      return;
    }
    const csv = strategicKeywordsToCsv(strategicKeywords);
    navigator.clipboard.writeText(csv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadCsv = () => {
    if (!strategicKeywords) {
      return;
    }
    const csv = strategicKeywordsToCsv(strategicKeywords);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strategic-keywords_${keyword}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-emerald-700 mb-1">
              戦略的キーワードリスト
            </h2>
            <p className="text-sm text-gray-600">
              「{keyword}」を起点に、競合・自社・市場環境の3観点で狙うべきキーワードを提案します
            </p>
          </div>
          <div className="flex items-center gap-2">
            {strategicKeywords && (
              <>
                <button
                  onClick={handleCopyCsv}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 transition"
                >
                  {copied ? "コピーしました" : "CSVコピー"}
                </button>
                <button
                  onClick={handleDownloadCsv}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 transition"
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
                  : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md"
              }`}
            >
              {isGenerating
                ? "生成中..."
                : strategicKeywords
                ? "再生成"
                : "キーワードリストを生成"}
            </button>
          </div>
        </div>
      </div>

      {/* 生成中 */}
      {isGenerating && (
        <div className="p-8 text-center text-gray-500">
          <div className="animate-pulse">
            競合・自社・市場環境の3観点でキーワードを分析中...
          </div>
          <p className="text-xs mt-2">市場環境の観点でWeb検索を実行するため、30秒〜1分ほどかかります</p>
        </div>
      )}

      {/* 未生成 */}
      {!isGenerating && !strategicKeywords && (
        <div className="p-8 text-center text-gray-400">
          <p>右上のボタンから戦略的キーワードリストを生成してください。</p>
        </div>
      )}

      {/* 結果 */}
      {!isGenerating && strategicKeywords && (
        <div className="space-y-8">
          <KeywordSection
            title="① 競合キーワード調査"
            description="上位競合が取り込んでいる／取りこぼしているキーワードから抽出"
            accentClass="bg-blue-50 border-blue-200 text-blue-700"
            items={strategicKeywords.competitorKeywords}
            onUseKeyword={onUseKeyword}
          />
          <KeywordSection
            title="② 自社キーワード分析"
            description="自社の強み・サービス特性から獲得を狙うキーワード"
            accentClass="bg-purple-50 border-purple-200 text-purple-700"
            items={strategicKeywords.ownKeywords}
            onUseKeyword={onUseKeyword}
          />
          <KeywordSection
            title="③ 市場環境"
            description="最新の市場トレンド・季節性・新規需要から抽出（Web検索反映）"
            accentClass="bg-teal-50 border-teal-200 text-teal-700"
            items={strategicKeywords.marketKeywords}
            onUseKeyword={onUseKeyword}
          />

          {/* 出典 */}
          {strategicKeywords.sources &&
            strategicKeywords.sources.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-600 mb-2">
                  市場環境分析の参照ソース
                </h4>
                <ul className="space-y-1">
                  {strategicKeywords.sources.map((s, i) => {
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
