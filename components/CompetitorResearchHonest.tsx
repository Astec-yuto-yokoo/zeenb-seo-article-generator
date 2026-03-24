import React from 'react';
import type { CompetitorResearchResult } from '../types';

interface CompetitorResearchHonestProps {
  research: CompetitorResearchResult;
}

export const CompetitorResearchHonest: React.FC<CompetitorResearchHonestProps> = ({ research }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
      {/* 制限事項の警告 */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
        <h3 className="text-amber-700 font-bold mb-2">重要なお知らせ</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• Google Search APIの制限により、実際のページコンテンツにはアクセスできません</p>
          <p>• 表示されている情報は検索結果のタイトルとスニペットのみです</p>
          <p>• H2/H3構造と文字数は取得できないため表示していません</p>
        </div>
      </div>

      {/* 分析サマリー */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <h2 className="text-xl font-bold mb-3 text-blue-700">検索結果サマリー</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">分析キーワード:</span>
            <span className="ml-2 text-gray-800 font-semibold">{research.keyword}</span>
          </div>
          <div>
            <span className="text-gray-500">取得件数:</span>
            <span className="ml-2 text-gray-800">{research.validArticles.length}件</span>
          </div>
        </div>
      </div>

      {/* 共通トピック */}
      {research.commonTopics.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <h3 className="text-lg font-semibold mb-2 text-blue-700">検索結果から抽出した共通トピック</h3>
          <div className="flex flex-wrap gap-2">
            {research.commonTopics.map((topic, index) => (
              <span key={index} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 検索結果一覧 */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-blue-700">検索結果一覧</h3>
        {research.validArticles.map((article) => (
          <div key={article.rank} className="bg-gray-50 p-5 rounded-xl border border-gray-200">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    {article.rank}位
                  </span>
                  <span className="text-gray-500 text-sm">
                    サイト: <span className="text-gray-800 font-semibold">{article.url}</span>
                  </span>
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">{article.title}</h4>

                {/* スニペット */}
                <div className="bg-white p-3 rounded-lg border border-gray-200 mb-3">
                  <div className="text-sm text-gray-600">{article.summary}</div>
                </div>

                {/* 詳細分析のための操作 */}
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                  <p className="text-sm text-blue-700 mb-2">
                    詳細な分析を行うには：
                  </p>
                  <ol className="text-xs text-gray-500 ml-4 space-y-1">
                    <li>1. このサイトのURLを直接訪問</li>
                    <li>2. ブラウザの開発者ツールでH2/H3を確認</li>
                    <li>3. 文字数カウントツールで測定</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 改善提案 */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-xl border border-indigo-200">
        <h3 className="text-lg font-semibold mb-2 text-indigo-700">より詳細な分析を行うには</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>1. <strong>Chrome拡張機能</strong>を使用してページ構造を分析</p>
          <p>2. <strong>ScreamingFrog</strong>などのSEOツールでクロール</p>
          <p>3. <strong>手動で各ページ</strong>を訪問して情報収集</p>
          <p>4. <strong>有料のSERP API</strong>（SerpAPI、DataForSEO等）を利用</p>
        </div>
      </div>
    </div>
  );
};
