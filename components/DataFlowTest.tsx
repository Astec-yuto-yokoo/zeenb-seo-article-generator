import React, { useState } from 'react';
import { MultiAgentOrchestrator } from '../services/finalProofreadingAgents/MultiAgentOrchestrator';
import { slackNotifier } from '../services/slackNotificationService';
import { extractCautionNotes } from '../utils/extractCautionNotes';

interface TestResult {
  agentName: string;
  receivedData: any;
  outputData: any;
  status: 'waiting' | 'running' | 'success' | 'partial' | 'error';
  message?: string;
}

export const DataFlowTest: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentStep, setCurrentStep] = useState('');

  // テスト用の短い記事（検証困難な主張を含む）
  const TEST_ARTICLE = `
<h2>AI人材の将来性</h2>
<p>AIエンジニアの平均年収は2025年に2000万円になると予測されています。日本のAI導入率は世界最下位レベルという現状があります。</p>
`;

  const runDataFlowTest = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      console.log('🧪 データフローテスト開始');
      console.log('==================================');
      console.log('🔴🔴🔴 実行する記事内容 🔴🔴🔴');
      console.log(TEST_ARTICLE);
      console.log('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴');

      // 1. マルチエージェント実行
      setCurrentStep('最終校閲エージェント群を実行中...');

      const orchestrator = new MultiAgentOrchestrator({
        enableLegalCheck: false,
        parallel: false,  // 順次実行でログを見やすく
        onProgress: (message, progress) => {
          console.log(`📊 進捗: ${message} (${progress}%)`);
          setCurrentStep(message);
        }
      });

      // 各エージェントの入出力をログで確認
      const originalExecute = orchestrator.execute;
      orchestrator.execute = async function(...args) {
        console.log('🔍 Orchestrator実行開始');

        // 各エージェントをフック
        const agents = (this as any).agents;
        if (agents) {
          agents.forEach((agent: any) => {
            const originalAgentExecute = agent.execute;
            agent.execute = async function(content: string, context: any) {
              console.log('====================');
              console.log(`📥 ${this.name}が受け取ったデータ:`);
              console.log('📄 Content (記事内容):', content.substring(0, 200));
              console.log('🔧 Context:', JSON.stringify(context, null, 2).substring(0, 500));
              console.log('====================');

              const result = await originalAgentExecute.call(this, content, context);

              console.log('====================');
              console.log(`📤 ${this.name}が返したデータ:`);
              console.log('Status:', result.status);
              console.log('Score:', result.score);
              if (result.partialData) {
                console.log('部分データ:', result.partialData);
              }
              if (result.verified_urls) {
                console.log('verified_urls数:', result.verified_urls.length);
              }
              console.log('====================');

              // 要確認箇所のカウント
              let cautionCount = 0;
              if (result.issues) {
                result.issues.forEach((issue: any) => {
                  if (issue.action === 'rephrase-with-caution' ||
                      (issue.actionType === 'rephrase' && issue.cautionNote)) {
                    cautionCount++;
                  }
                });
              }

              // テスト結果を記録
              setTestResults(prev => [...prev, {
                agentName: this.name,
                receivedData: context,
                outputData: {
                  status: result.status,
                  score: result.score,
                  issuesCount: result.issues?.length || 0,
                  verifiedUrlsCount: result.verified_urls?.length || 0,
                  partialData: result.partialData,
                  cautionNotesCount: cautionCount
                },
                status: result.status === 'partial-success' ? 'partial' :
                        result.status === 'success' ? 'success' :
                        result.status === 'error' ? 'error' : 'waiting',
                message: result.error || result.partialData?.message
              }]);

              return result;
            };
          });
        }

        return originalExecute.call(this, ...args);
      };

      const result = await orchestrator.execute(TEST_ARTICLE);

      console.log('🎯 最終結果:', {
        passed: result.passed,
        overallScore: result.overallScore,
        sourceInsertions: result.sourceInsertions?.length || 0
      });

      // 要確認箇所を抽出（共通関数を使用）
      const cautionNotes = extractCautionNotes(result);

      console.log('⚠️ 要確認箇所:', cautionNotes);

      // Slack通知テスト（要確認箇所がある場合）
      if (cautionNotes.length > 0) {
        setCurrentStep('Slack通知を送信中...');
        await slackNotifier.notifyProofreadingComplete({
          keyword: 'AI成長テスト',
          step: 'final-proofreading',
          proofreadingScore: result.overallScore,
          cautionNotes
        });
        console.log('📨 Slack通知を送信しました（要確認箇所: ' + cautionNotes.length + '件）');
      }

      setCurrentStep('テスト完了！');

    } catch (error) {
      console.error('❌ テストエラー:', error);
      setCurrentStep('エラーが発生しました');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return '✅';
      case 'partial': return '⚠️';
      case 'error': return '❌';
      case 'running': return '🔄';
      default: return '⏳';
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 mb-6 border border-gray-200 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        データフローテスト
      </h2>

      <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="text-gray-800 font-semibold mb-2">テスト記事：</h3>
        <div className="text-gray-600 text-sm font-mono">
          「AIエンジニアの平均年収は2025年に2000万円になると予測されています。<br/>
          日本のAI導入率は世界最下位レベルという現状があります。」
        </div>
      </div>

      <button
        onClick={runDataFlowTest}
        disabled={isRunning}
        className={`px-6 py-3 rounded-xl font-medium transition-all ${
          isRunning
            ? 'bg-gray-200 cursor-not-allowed text-gray-500'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {isRunning ? '🔄 実行中...' : 'テスト実行'}
      </button>

      {currentStep && (
        <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-blue-700">{currentStep}</p>
        </div>
      )}

      {testResults.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            データ受け渡し結果：
          </h3>

          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-gray-800 font-medium">
                    {getStatusIcon(result.status)} {result.agentName}
                  </h4>
                  <span className={`text-sm ${
                    result.status === 'success' ? 'text-green-600' :
                    result.status === 'partial' ? 'text-amber-600' :
                    result.status === 'error' ? 'text-red-600' :
                    'text-gray-500'
                  }`}>
                    {result.status}
                  </span>
                </div>

                {result.outputData && (
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>スコア: {result.outputData.score}点</p>
                    <p>検出問題: {result.outputData.issuesCount}件</p>
                    {result.outputData.verifiedUrlsCount > 0 && (
                      <p>検証URL: {result.outputData.verifiedUrlsCount}件</p>
                    )}
                    {result.outputData.partialData && (
                      <p className="text-amber-600">
                        ⚠️ 部分成功: {result.outputData.partialData.completedItems}/{result.outputData.partialData.totalItems}件
                      </p>
                    )}
                    {result.outputData.cautionNotesCount !== undefined && result.outputData.cautionNotesCount > 0 && (
                      <p className="text-orange-600">
                        要確認箇所: {result.outputData.cautionNotesCount}件
                      </p>
                    )}
                  </div>
                )}

                {result.message && (
                  <p className="text-sm text-blue-600 mt-2">
                    {result.message}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-blue-700 text-sm">
              ヒント: ブラウザのコンソール（F12）でより詳細なログを確認できます
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
