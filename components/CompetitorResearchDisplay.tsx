import React from 'react';
import type { CompetitorResearchResult } from '../types';

interface CompetitorResearchDisplayProps {
  research: CompetitorResearchResult;
}

export const CompetitorResearchDisplay: React.FC<CompetitorResearchDisplayProps> = ({ research }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
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
            <span className="text-gray-500">検査記事数:</span>
            <span className="ml-2 text-gray-800">{research.totalArticlesScanned}件</span>
          </div>
          <div>
            <span className="text-gray-500">除外記事数:</span>
            <span className="ml-2 text-gray-800">{research.excludedCount}件</span>
          </div>
        </div>
      </div>

      {/* 推奨文字数 */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-4 rounded-xl text-white">
        <h3 className="text-lg font-semibold mb-2">推奨文字数</h3>
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
        {research.validArticles.map((article) => (
          <div key={article.rank} className="bg-gray-50 p-5 rounded-xl border border-gray-200">
            {/* 記事ヘッダー */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    {article.rank}位
                  </span>
                  <span className="text-gray-500 text-sm">
                    文字数: <span className="text-gray-800 font-semibold">{article.characterCount.toLocaleString()}文字</span>
                  </span>
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-1">{article.title}</h4>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 text-sm break-all underline"
                >
                  {article.url}
                </a>
              </div>
            </div>

            {/* 記事要約 */}
            <div className="bg-white p-3 rounded-lg border border-gray-200 mb-3">
              <div className="text-sm text-gray-600">{article.summary}</div>
            </div>

            {/* 見出し構造 */}
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
          </div>
        ))}
      </div>
    </div>
  );
};
