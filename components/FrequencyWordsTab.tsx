import React from 'react';
import type { FrequencyWord } from '../types';

interface FrequencyWordsTabProps {
  frequencyWords: FrequencyWord[];
  totalArticles: number;
}

export const FrequencyWordsTab: React.FC<FrequencyWordsTabProps> = ({
  frequencyWords,
  totalArticles
}) => {
  if (!frequencyWords || frequencyWords.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-gray-500 text-center">頻出単語の分析中...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
        <h2 className="text-xl font-bold text-blue-700 mb-2">頻出単語分析</h2>
        <p className="text-sm text-gray-600">
          上位{totalArticles}記事のH2/H3タグから抽出した頻出単語TOP20
        </p>
      </div>

      {/* 頻出単語リスト */}
      <div className="space-y-3">
        {frequencyWords.map((word, index) => {
          const percentage = Math.round((word.articleCount / totalArticles) * 100);
          const barWidth = `${percentage}%`;

          return (
            <div key={index} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="flex items-start justify-between mb-2">
                {/* 順位と単語 */}
                <div className="flex items-center gap-3">
                  <span className={`
                    px-3 py-1 rounded-full text-sm font-bold
                    ${index === 0 ? 'bg-yellow-400 text-yellow-900' :
                      index === 1 ? 'bg-gray-300 text-gray-800' :
                      index === 2 ? 'bg-amber-500 text-amber-900' :
                      'bg-gray-200 text-gray-700'}
                  `}>
                    {index + 1}位
                  </span>
                  <span className="text-lg font-semibold text-gray-800">
                    {word.word}
                  </span>
                </div>

                {/* 使用回数 */}
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {word.count}回
                  </div>
                  <div className="text-xs text-gray-500">
                    {word.articleCount}/{totalArticles}記事で使用
                  </div>
                </div>
              </div>

              {/* プログレスバー */}
              <div className="mb-2">
                <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: barWidth }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  記事カバー率: {percentage}%
                </div>
              </div>

              {/* 使用記事の詳細 */}
              <div className="text-xs text-gray-500">
                <span>使用記事: </span>
                <span className="text-gray-600">
                  {word.articles.slice(0, 10).map(rank => `${rank}位`).join(', ')}
                  {word.articles.length > 10 && ` 他${word.articles.length - 10}記事`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 統計サマリー */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-xl border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-700 mb-3">分析結果のポイント</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>• 最頻出単語「{frequencyWords[0]?.word}」は{frequencyWords[0]?.count}回使用</p>
          <p>• 上位5単語の合計使用回数: {frequencyWords.slice(0, 5).reduce((sum, w) => sum + w.count, 0)}回</p>
          <p>• これらの単語を適切に含めることでSEO効果が期待できます</p>
        </div>
      </div>
    </div>
  );
};
