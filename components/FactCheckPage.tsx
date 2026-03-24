import React, { useState } from 'react';
import { performFactCheck, type FactCheckResult } from '../services/factCheckServiceSimple';

const FactCheckPage: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<FactCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [includeCompanyCheck, setIncludeCompanyCheck] = useState(false);

  const handleFactCheck = async () => {
    if (!inputText.trim()) {
      setError('テキストを入力してください');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // サービスを使用してファクトチェックを実行
      const checkResult = await performFactCheck(inputText, { includeCompanyCheck: false });
      setResult(checkResult);

    } catch (err) {
      console.error('❌ ファクトチェックエラー:', err);
      setError(err instanceof Error ? err.message : 'ファクトチェック中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(result.correctedText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('コピーエラー:', err);
    }
  };

  const highlightChanges = (original: string, corrected: string) => {
    // 簡易的な差分表示（実際の実装では、より高度な差分アルゴリズムを使用）
    const originalLines = original.split('\n');
    const correctedLines = corrected.split('\n');

    return {
      original: original,
      corrected: corrected
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 text-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <button
            onClick={() => window.location.href = '/'}
            className="mb-4 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl transition-colors border border-gray-200 shadow-sm"
          >
            ← トップに戻る
          </button>
          <h1 className="text-3xl font-bold mb-2 text-gray-800">ファクトチェック</h1>
          <p className="text-gray-500">
            テキストの事実確認と出典の追加を行います
          </p>
        </div>

        {/* 入力エリア */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-gray-700">
            チェックするテキスト（1000文字程度まで）
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="ここにテキストを入力してください..."
            className="w-full h-48 p-4 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none shadow-sm"
            disabled={isProcessing}
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {inputText.length} 文字
            </div>

            {/* 追加チェックオプション（将来の拡張用） */}
          </div>
        </div>

        {/* 実行ボタン */}
        <div className="mb-8">
          <button
            onClick={handleFactCheck}
            disabled={isProcessing || !inputText.trim()}
            className={`px-6 py-3 rounded-xl font-semibold transition-all shadow-sm ${
              isProcessing || !inputText.trim()
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center">
                <span className="animate-spin mr-2">⏳</span>
                チェック中...
              </span>
            ) : (
              'ファクトチェックを実行'
            )}
          </button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600">❌ {error}</p>
          </div>
        )}

        {/* 結果表示 */}
        {result && (
          <div className="space-y-6">
            {/* スコアと概要 */}
            <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-gray-800">チェック結果</h2>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold text-white ${
                  result.score >= 80 ? 'bg-green-500' :
                  result.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                }`}>
                  スコア: {result.score}点
                </div>
              </div>
              {result.issues.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-gray-500 mb-2">検出された問題:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {result.issues.slice(0, 5).map((issue, idx) => (
                      <li key={idx} className="text-sm text-gray-600">
                        {issue.description}
                      </li>
                    ))}
                    {result.issues.length > 5 && (
                      <li className="text-sm text-gray-400">
                        他 {result.issues.length - 5} 件...
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* 比較表示 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 修正前 */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold mb-3 text-red-500">
                  修正前
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 border border-gray-200">
                  <pre className="whitespace-pre-wrap text-sm text-gray-600">
                    {result.originalText}
                  </pre>
                </div>
              </div>

              {/* 修正後 */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-green-600">
                    修正後（コピペ用）
                  </h3>
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {copySuccess ? '✓ コピー済み' : 'コピー'}
                  </button>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 border border-gray-200">
                  <div
                    className="text-sm text-gray-600"
                    dangerouslySetInnerHTML={{ __html: result.correctedText }}
                  />
                </div>
              </div>
            </div>

            {/* 出典情報 */}
            {result.sourceInsertions && result.sourceInsertions.length > 0 && (
              <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">追加された出典</h3>
                <ul className="space-y-2">
                  {result.sourceInsertions.map((source, idx) => (
                    <li key={idx} className="text-sm">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 underline"
                      >
                        {source.title}
                      </a>
                      {source.location && (
                        <span className="text-gray-500 ml-2">
                          （{source.location}セクション）
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FactCheckPage;
