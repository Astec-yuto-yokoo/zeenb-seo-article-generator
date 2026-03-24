import React, { useState } from 'react';
import type { ProofreadingReport, Violation, ViolationCategory } from '../types/proofreading';

interface ProofreadingReportProps {
  report: ProofreadingReport;
  onClose?: () => void;
}

// カテゴリ別の表示設定
const CATEGORY_CONFIG: Record<ViolationCategory, { label: string; icon: string; color: string }> = {
  prep_label: { label: 'PREP法ラベル', icon: '🏷️', color: 'text-red-500' },
  sentence_unity: { label: '一文一意', icon: '📝', color: 'text-amber-500' },
  repetition: { label: '語尾の重複', icon: '🔁', color: 'text-orange-500' },
  char_count: { label: '文字数', icon: '📏', color: 'text-blue-500' },
  wordpress: { label: 'WordPress', icon: '🚫', color: 'text-red-600' },
  frequency: { label: '頻出単語', icon: '📊', color: 'text-indigo-500' },
  readability: { label: '読みやすさ', icon: '👁️', color: 'text-green-500' },
  forbidden_tags: { label: '禁止タグ', icon: '⛔', color: 'text-red-700' },
  indentation: { label: 'インデント', icon: '↔️', color: 'text-gray-500' },
  numbering: { label: '番号付け', icon: '🔢', color: 'text-blue-600' }
};

// 重要度別の表示設定
const SEVERITY_CONFIG = {
  critical: { label: '重大', color: 'bg-red-500', textColor: 'text-red-600', icon: '🔴' },
  warning: { label: '警告', color: 'bg-amber-500', textColor: 'text-amber-600', icon: '🟡' },
  info: { label: '情報', color: 'bg-blue-500', textColor: 'text-blue-600', icon: '🔵' }
};

const ProofreadingReportComponent: React.FC<ProofreadingReportProps> = ({ report, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<ViolationCategory | 'all'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [expandedViolations, setExpandedViolations] = useState<Set<string>>(new Set());

  // フィルタリングされた違反を取得
  const filteredViolations = report.violations.filter(v => {
    if (selectedCategory !== 'all' && v.category !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && v.severity !== selectedSeverity) return false;
    return true;
  });

  // スコアによる評価
  const getScoreLabel = (score: number) => {
    if (score >= 90) return { label: '優秀', color: 'text-green-600' };
    if (score >= 70) return { label: '良好', color: 'text-blue-600' };
    if (score >= 50) return { label: '要改善', color: 'text-amber-600' };
    return { label: '要大幅改善', color: 'text-red-600' };
  };

  const scoreInfo = getScoreLabel(report.overallScore);

  // 違反の展開/折りたたみ
  const toggleViolation = (id: string) => {
    const newExpanded = new Set(expandedViolations);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedViolations(newExpanded);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-xl">
        {/* ヘッダー */}
        <div className="bg-gray-50 p-4 rounded-t-xl border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              校閲レポート
              <span className="text-sm text-gray-500">
                - {new Date(report.timestamp).toLocaleString('ja-JP')}
              </span>
            </h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* スコアとサマリー */}
          <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="bg-white p-3 rounded-xl border border-gray-200">
              <div className="text-sm text-gray-500">総合スコア</div>
              <div className={`text-2xl font-bold ${scoreInfo.color}`}>
                {report.overallScore}点
              </div>
              <div className={`text-sm ${scoreInfo.color}`}>{scoreInfo.label}</div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-gray-200">
              <div className="text-sm text-gray-500">違反件数</div>
              <div className="text-2xl font-bold text-gray-800">
                {report.statistics.totalViolations}件
              </div>
              <div className="text-xs text-gray-500 mt-1">
                <span className="text-red-500">{report.statistics.criticalCount} 重大</span>
                <span className="mx-1">·</span>
                <span className="text-amber-500">{report.statistics.warningCount} 警告</span>
                <span className="mx-1">·</span>
                <span className="text-blue-500">{report.statistics.infoCount} 情報</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-gray-200">
              <div className="text-sm text-gray-500">記事文字数</div>
              <div className="text-2xl font-bold text-gray-800">
                {report.articleInfo.totalCharacters.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">
                H2: {report.articleInfo.h2Count} / H3: {report.articleInfo.h3Count}
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-gray-200">
              <div className="text-sm text-gray-500">最多違反</div>
              <div className="text-lg font-bold text-gray-800">
                {(() => {
                  const topCategory = Object.entries(report.statistics.byCategory)
                    .sort(([,a], [,b]) => b - a)[0];
                  if (!topCategory) return '-';
                  const config = CATEGORY_CONFIG[topCategory[0] as ViolationCategory];
                  return (
                    <span className={config.color}>
                      {config.icon} {config.label}
                    </span>
                  );
                })()}
              </div>
              <div className="text-xs text-gray-500">
                {Object.values(report.statistics.byCategory)[0] || 0}件
              </div>
            </div>
          </div>
        </div>

        {/* フィルター */}
        <div className="bg-gray-50 p-3 border-b border-gray-200 flex gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">カテゴリ:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as ViolationCategory | 'all')}
              className="bg-white text-gray-800 px-3 py-1 rounded-lg text-sm border border-gray-200"
            >
              <option value="all">すべて</option>
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.icon} {config.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">重要度:</label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value as 'all' | 'critical' | 'warning' | 'info')}
              className="bg-white text-gray-800 px-3 py-1 rounded-lg text-sm border border-gray-200"
            >
              <option value="all">すべて</option>
              <option value="critical">🔴 重大のみ</option>
              <option value="warning">🟡 警告のみ</option>
              <option value="info">🔵 情報のみ</option>
            </select>
          </div>

          <div className="ml-auto text-sm text-gray-500">
            表示中: {filteredViolations.length}件
          </div>
        </div>

        {/* 違反リスト */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50">
          {filteredViolations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg">🎉 該当する違反はありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredViolations.map((violation) => {
                const categoryConfig = CATEGORY_CONFIG[violation.category];
                const severityConfig = SEVERITY_CONFIG[violation.severity];
                const isExpanded = expandedViolations.has(violation.id);

                return (
                  <div
                    key={violation.id}
                    className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors shadow-sm"
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => toggleViolation(violation.id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* 重要度インジケーター */}
                        <div className={`mt-1 ${severityConfig.textColor}`}>
                          {severityConfig.icon}
                        </div>

                        {/* メインコンテンツ */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-sm font-semibold ${categoryConfig.color}`}>
                              {categoryConfig.icon} {categoryConfig.label}
                            </span>
                            <span className="text-xs text-gray-500">
                              {violation.location.sectionHeading}
                            </span>
                            <span className={`ml-auto text-xs px-2 py-1 rounded text-white ${severityConfig.color}`}>
                              {severityConfig.label}
                            </span>
                          </div>

                          <div className="text-gray-800 mb-2">
                            <strong className="text-sm">違反ルール:</strong>{' '}
                            <span className="text-sm">{violation.violatedRule}</span>
                          </div>

                          {/* 実際のテキスト */}
                          <div className="bg-gray-50 p-2 rounded-lg text-sm text-gray-600 font-mono mb-2 border border-gray-200">
                            {violation.actualText}
                          </div>

                          {/* 展開時のみ表示 */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="text-sm">
                                <strong className="text-blue-600">改善提案:</strong>
                                <p className="mt-1 text-gray-600">{violation.suggestion}</p>
                              </div>

                              {violation.location.charPosition && (
                                <div className="mt-2 text-xs text-gray-500">
                                  位置: {violation.location.charPosition.start} - {violation.location.charPosition.end}文字目
                                </div>
                              )}

                              <div className="mt-2 text-xs text-gray-500">
                                信頼度: {Math.round(violation.confidence * 100)}%
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 展開アイコン */}
                        <div className="text-gray-400">
                          {isExpanded ? '▼' : '▶'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="bg-gray-50 p-4 rounded-b-xl border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              ※ 違反をクリックすると詳細と改善提案が表示されます
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
              >
                閉じる
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProofreadingReportComponent;
