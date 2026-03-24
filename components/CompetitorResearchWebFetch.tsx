import React from 'react';
import type { CompetitorResearchResult } from '../types';

interface CompetitorResearchWebFetchProps {
  research: CompetitorResearchResult;
}

export const CompetitorResearchWebFetch: React.FC<CompetitorResearchWebFetchProps> = ({ research }) => {
  // 成功した取得の数をカウント
  const successfulFetches = research.validArticles.filter(
    article => article.characterCount > 0
  ).length;

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
      {/* ステータス表示 */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-xl border border-green-200">
        <h3 className="text-green-700 font-bold mb-2">WebFetch実行結果</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• 実際のページコンテンツを取得しました</p>
          <p>• 成功率: {successfulFetches}/{research.validArticles.length} ページ</p>
          <p>• 3秒間隔でアクセス（サイトに優しい設定）</p>
        </div>
      </div>

      {/* 分析サマリー */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <h2 className="text-xl font-bold mb-3 text-blue-700">競合分析結果</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">分析キーワード:</span>
            <span className="ml-2 text-gray-800 font-semibold">{research.keyword}</span>
          </div>
          <div>
            <span className="text-gray-500">分析日時:</span>
            <span className="ml-2 text-gray-800">{new Date(research.analyzedAt).toLocaleString('ja-JP')}</span>
          </div>
          <div>
            <span className="text-gray-500">分析成功:</span>
            <span className="ml-2 text-gray-800">{successfulFetches}件</span>
          </div>
          <div>
            <span className="text-gray-500">平均文字数:</span>
            <span className="ml-2 text-gray-800 font-semibold">
              {research.recommendedWordCount.optimal.toLocaleString()}文字
            </span>
          </div>
        </div>
      </div>

      {/* 推奨文字数 */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-4 rounded-xl text-white">
        <h3 className="text-lg font-semibold mb-2">推奨文字数（実測値ベース）</h3>
        <div className="flex justify-around text-center">
          <div>
            <div className="text-2xl font-bold">{research.recommendedWordCount.min.toLocaleString()}</div>
            <div className="text-xs text-blue-100">最小</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-yellow-300">{research.recommendedWordCount.optimal.toLocaleString()}</div>
            <div className="text-xs text-blue-100">最適</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{research.recommendedWordCount.max.toLocaleString()}</div>
            <div className="text-xs text-blue-100">最大</div>
          </div>
        </div>
      </div>

      {/* 共通トピック */}
      {research.commonTopics.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <h3 className="text-lg font-semibold mb-2 text-blue-700">上位記事の共通トピック</h3>
          <div className="flex flex-wrap gap-2">
            {research.commonTopics.map((topic, index) => (
              <span key={index} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 各記事の詳細 */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-blue-700">上位記事の詳細分析</h3>
        {research.validArticles.map((article) => {
          const isSuccess = article.characterCount > 0;

          return (
            <div key={article.rank} className="bg-gray-50 p-5 rounded-xl border border-gray-200">
              {/* 記事ヘッダー */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                      {article.rank}位
                    </span>
                    {isSuccess ? (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                        取得成功
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">
                        取得失敗
                      </span>
                    )}
                    {isSuccess && (
                      <span className="text-gray-500 text-sm">
                        文字数: <span className="text-gray-800 font-semibold">
                          {article.characterCount.toLocaleString()}文字
                        </span>
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-semibold mb-1">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-800 hover:text-blue-600 transition-colors duration-200"
                      title="新しいタブで開く"
                    >
                      {article.title}
                    </a>
                  </h4>
                  <div className="text-sm">
                    <span className="text-gray-500">URL: </span>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline transition-colors duration-200 inline-flex items-center gap-1"
                      title="新しいタブで開く"
                    >
                      {article.url}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>

              {/* 記事要約 */}
              <div className="bg-white p-3 rounded-lg border border-gray-200 mb-3">
                <div className="text-sm text-gray-600">{article.summary}</div>
              </div>

              {/* 見出し構造（取得成功時のみ） */}
              {isSuccess && article.headingStructure.h2Items.length > 0 && (
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <div className="text-sm space-y-2">
                    {/* H1 */}
                    <div className="text-amber-600 font-semibold">
                      H1: {article.headingStructure.h1}
                    </div>

                    {/* H2とH3の階層構造 */}
                    {article.headingStructure.h2Items.map((h2Item, h2Index) => (
                      <div key={h2Index} className="ml-4">
                        <div className="text-blue-600 font-medium">
                          　H2: {h2Item.text}
                        </div>
                        {h2Item.h3Items.map((h3Text, h3Index) => (
                          <div key={h3Index} className="ml-8 text-gray-500">
                            　　H3: {h3Text}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* エラー表示 */}
              {!isSuccess && article.headingStructure.h2Items[0]?.h3Items[0] && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                  <p className="text-sm text-red-700">
                    {article.headingStructure.h2Items[0].h3Items[0]}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
