import React from 'react';

export interface AutoStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: number;
  result?: string;
  error?: string;
  details?: any; // 詳細データ（構成など）を格納
}

interface AutoProgressDisplayProps {
  steps: AutoStep[];
  currentStep: number;
  isRunning: boolean;
  onRetry?: (stepId: string) => void;
  onCancel?: () => void;
}

const AutoProgressDisplay: React.FC<AutoProgressDisplayProps> = ({
  steps,
  currentStep,
  isRunning,
  onRetry,
  onCancel
}) => {
  const [expandedDetails, setExpandedDetails] = React.useState<{ [key: string]: boolean }>({});
  const getStatusIcon = (status: AutoStep['status']) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'running':
        return '⏳';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  };

  const getStatusColor = (status: AutoStep['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 border-green-300 bg-green-50';
      case 'running':
        return 'text-blue-700 border-blue-300 bg-blue-50 animate-pulse';
      case 'error':
        return 'text-red-700 border-red-300 bg-red-50';
      default:
        return 'text-gray-500 border-gray-200 bg-gray-50';
    }
  };

  const totalProgress = Math.round((steps.filter(s => s.status === 'completed').length / steps.length) * 100);

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            フル自動実行中
            {isRunning && (
              <span className="text-sm bg-blue-500 text-white px-2 py-1 rounded-full animate-pulse">
                処理中...
              </span>
            )}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            構成生成から最終校閲まで全自動で実行します
          </p>
        </div>
        {isRunning && onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            中断
          </button>
        )}
      </div>

      {/* 全体進捗バー */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>全体進捗</span>
          <span className="font-medium">{totalProgress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>

      {/* ステップリスト */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`p-4 rounded-xl border transition-all ${getStatusColor(step.status)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-2xl mt-1">{getStatusIcon(step.status)}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800">
                      Step {index + 1}: {step.title}
                    </h3>
                    {step.status === 'running' && (
                      <div className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {step.progress && (
                          <span className="text-xs text-blue-600 font-medium">
                            {step.progress}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{step.description}</p>

                  {/* 結果表示 */}
                  {step.result && (
                    <div className="mt-2 p-2 bg-green-100 rounded-lg text-xs text-green-700 border border-green-200">
                      {step.result}
                    </div>
                  )}

                  {/* 構成詳細の表示（構成生成・構成チェックステップの場合） */}
                  {(step.id === 'outline-generation' || step.id === 'outline-check') && step.details && step.status === 'completed' && (
                    <div className="mt-3">
                      <button
                        onClick={() => setExpandedDetails(prev => ({ ...prev, [step.id]: !prev[step.id] }))}
                        className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 transition-colors font-medium"
                      >
                        <span>{expandedDetails[step.id] ? '▼' : '▶'}</span>
                        <span>構成詳細を{expandedDetails[step.id] ? '隠す' : '表示'}</span>
                      </button>

                      {expandedDetails[step.id] && (
                        <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                          <h4 className="text-sm font-semibold text-gray-800 mb-2">
                            {step.id === 'outline-check' ? '最終確定した構成' : '生成された構成'}
                          </h4>

                          {/* タイトル */}
                          <div className="mb-3">
                            <span className="text-xs text-gray-500">タイトル:</span>
                            <p className="text-sm text-gray-800 font-medium mt-1">
                              {step.details.title}
                            </p>
                          </div>

                          {/* H2/H3見出し一覧 */}
                          <div className="space-y-2">
                            <span className="text-xs text-gray-500">見出し構成:</span>
                            {step.details.outline?.map((section: any, idx: number) => (
                              <div key={idx} className="ml-2">
                                <div className="text-sm text-blue-700">
                                  <span className="text-gray-400 mr-2">H2</span>
                                  {section.heading || section.title}
                                </div>
                                {/* subheadings（Ver.2形式）またはcontent（旧形式）の両方に対応 */}
                                {(section.subheadings || section.content) && (
                                  <div className="ml-6 mt-1 space-y-1">
                                    {section.subheadings ? (
                                      // Ver.2形式: { text: string, writingNote?: string }[]
                                      section.subheadings.map((h3: any, h3Idx: number) => (
                                        <div key={h3Idx} className="text-xs text-gray-500">
                                          <span className="text-gray-400 mr-2">H3</span>
                                          {typeof h3 === 'string' ? h3 : h3.text}
                                        </div>
                                      ))
                                    ) : (
                                      // 旧形式またはcontent形式: string[]
                                      section.content.map((h3: string, h3Idx: number) => (
                                        <div key={h3Idx} className="text-xs text-gray-500">
                                          <span className="text-gray-400 mr-2">H3</span>
                                          {h3}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* 文字数情報 */}
                          {step.details.characterCountAnalysis && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <span className="text-xs text-gray-500">目標文字数:</span>
                              <p className="text-sm text-gray-800">
                                {step.details.characterCountAnalysis.min?.toLocaleString()} -
                                {step.details.characterCountAnalysis.max?.toLocaleString()}文字
                                {step.details.characterCountAnalysis.average && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    （平均: {step.details.characterCountAnalysis.average.toLocaleString()}文字）
                                  </span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* エラー表示 */}
                  {step.error && (
                    <div className="mt-2 p-2 bg-red-100 rounded-lg border border-red-200">
                      <p className="text-xs text-red-700">{step.error}</p>
                      {onRetry && (
                        <button
                          onClick={() => onRetry(step.id)}
                          className="mt-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg transition-colors font-medium"
                        >
                          リトライ
                        </button>
                      )}
                    </div>
                  )}

                  {/* 個別進捗バー（実行中のステップのみ） */}
                  {step.status === 'running' && step.progress !== undefined && (
                    <div className="mt-2">
                      <div className="w-full bg-blue-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 完了時のサマリー */}
      {!isRunning && steps.every(s => s.status === 'completed') && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-2 text-green-700">
            <span className="text-2xl">🎉</span>
            <div>
              <h3 className="font-semibold">全工程完了！</h3>
              <p className="text-sm text-green-600">構成生成から最終校閲まで、すべての処理が正常に完了しました。</p>
            </div>
          </div>
        </div>
      )}

      {/* エラー時のメッセージ */}
      {!isRunning && steps.some(s => s.status === 'error') && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2 text-red-700">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold">一部の処理でエラーが発生しました</h3>
              <p className="text-sm text-red-600">エラーが発生したステップをリトライするか、手動で続行してください。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoProgressDisplay;
