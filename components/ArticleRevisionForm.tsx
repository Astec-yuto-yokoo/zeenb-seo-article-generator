import React, { useState } from 'react';
import { reviseArticle } from '../services/articleRevisionService';

interface ArticleRevisionFormProps {
  onClose?: () => void;
}

const ArticleRevisionForm: React.FC<ArticleRevisionFormProps> = ({ onClose }) => {
  const [articleContent, setArticleContent] = useState('');
  const [revisionInstruction, setRevisionInstruction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [revisedContent, setRevisedContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleRevision = async () => {
    if (!articleContent.trim() || !revisionInstruction.trim()) {
      setError('記事本文と修正指示の両方を入力してください。');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setRevisedContent('');
    setCopySuccess(false);

    try {
      // 修正サービスを呼び出し
      const result = await reviseArticle(articleContent, revisionInstruction);

      if (result.success && result.revised) {
        setRevisedContent(result.revised);
      } else {
        setError(result.error || '修正処理に失敗しました。');
      }
    } catch (err) {
      console.error('修正エラー:', err);
      setError('修正処理中にエラーが発生しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(revisedContent);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('コピーエラー:', err);
    }
  };

  const handleReset = () => {
    setArticleContent('');
    setRevisionInstruction('');
    setRevisedContent('');
    setError(null);
    setCopySuccess(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 text-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              記事修正モード
            </h1>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                閉じる
              </button>
            )}
          </div>
          <p className="mt-2 text-gray-500">
            WordPress上で修正したい記事の全文をコピペして、修正指示を入力してください
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側: 入力エリア */}
          <div className="space-y-6">
            {/* 記事本文入力 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <label className="block text-sm font-medium mb-3 text-gray-700">
                記事全文を貼り付け
              </label>
              <textarea
                value={articleContent}
                onChange={(e) => setArticleContent(e.target.value)}
                placeholder="WordPressからコピーした記事全文をここに貼り付けてください..."
                className="w-full h-64 p-4 bg-gray-50 text-gray-800 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200"
                disabled={isProcessing}
              />
              <div className="mt-2 text-right text-sm text-gray-500">
                {articleContent.length} 文字
              </div>
            </div>

            {/* 修正指示入力 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <label className="block text-sm font-medium mb-3 text-gray-700">
                修正指示
              </label>
              <textarea
                value={revisionInstruction}
                onChange={(e) => setRevisionInstruction(e.target.value)}
                placeholder="例：「助成金8選」を「助成金7選」に変更し、該当するH3も7つに調整してください"
                className="w-full h-32 p-4 bg-gray-50 text-gray-800 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200"
                disabled={isProcessing}
              />
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
                {error}
              </div>
            )}

            {/* 実行ボタン */}
            <div className="flex gap-4">
              <button
                onClick={handleRevision}
                disabled={isProcessing || !articleContent.trim() || !revisionInstruction.trim()}
                className={`flex-1 py-3 px-6 rounded-xl font-medium transition-all ${
                  isProcessing
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    修正中...
                  </span>
                ) : (
                  '修正実行'
                )}
              </button>
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className="py-3 px-6 rounded-xl font-medium bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-all shadow-sm"
              >
                リセット
              </button>
            </div>
          </div>

          {/* 右側: 結果エリア */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                修正結果
              </label>
              {revisedContent && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all text-sm font-medium"
                >
                  {copySuccess ? (
                    <>
                      <span>✓</span>
                      コピー完了
                    </>
                  ) : (
                    <>
                      <span>📋</span>
                      コピー
                    </>
                  )}
                </button>
              )}
            </div>

            {revisedContent ? (
              <div className="bg-gray-50 rounded-lg p-4 h-[600px] overflow-y-auto border border-gray-200">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                  {revisedContent}
                </pre>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 h-[600px] flex items-center justify-center border border-gray-200">
                <p className="text-gray-500 text-center">
                  修正結果がここに表示されます
                </p>
              </div>
            )}

            {revisedContent && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-700">
                  修正完了！上記の内容をコピーしてWordPressに貼り付けてください。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArticleRevisionForm;
