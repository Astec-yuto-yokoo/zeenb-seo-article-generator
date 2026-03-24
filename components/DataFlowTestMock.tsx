import React, { useState } from 'react';

interface TestResult {
  agentName: string;
  receivedContent: string;
  outputData: any;
  status: 'success' | 'error';
}

export const DataFlowTestMock: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentStep, setCurrentStep] = useState('');

  // テスト用の記事（検証困難な主張を含む）
  const TEST_ARTICLE = `
<h2>AI人材の将来性</h2>
<p>AIエンジニアの平均年収は2025年に2000万円になると予測されています。日本のAI導入率は世界最下位レベルという現状があります。</p>
`;

  const runMockTest = async () => {
    setIsRunning(true);
    setTestResults([]);

    console.log('🎭 モックテスト開始（API呼び出しなし）');
    console.log('=====================================');
    console.log('📄 テスト記事:');
    console.log(TEST_ARTICLE);
    console.log('=====================================');

    try {
      // 1. 出典必要性判定エージェント（モック）
      setCurrentStep('出典必要性判定エージェント実行中...');
      await new Promise(resolve => setTimeout(resolve, 500));

      const sourceRequirements = [
        {
          claim: "AIエンジニアの平均年収は2025年に2000万円になると予測",
          location: "AI人材の将来性"
        },
        {
          claim: "日本のAI導入率は世界最下位レベル",
          location: "AI人材の将来性"
        }
      ];

      setTestResults(prev => [...prev, {
        agentName: '出典必要性判定エージェント',
        receivedContent: TEST_ARTICLE.substring(0, 100) + '...',
        outputData: { requirementsCount: 2, requirements: sourceRequirements },
        status: 'success'
      }]);

      console.log('✅ 出典必要性判定: 2箇所の出典が必要');

      // 2. 出典検索エージェント（モック）
      setCurrentStep('出典検索エージェント実行中...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // 出典が見つからないケースをシミュレート
      const searchResults = [
        {
          type: 'missing-source',
          severity: 'major',
          location: sourceRequirements[0].location,
          description: sourceRequirements[0].claim,
          original: "AIエンジニアの平均年収は2025年に2000万円になると予測されています",
          suggestion: "",
          source_url: "",
          confidence: 0,
          action: 'rephrase-with-caution',
          cautionNote: "AIエンジニアの平均年収は2025年に2000万円になると予測"
        },
        {
          type: 'missing-source',
          severity: 'major',
          location: sourceRequirements[1].location,
          description: sourceRequirements[1].claim,
          original: "日本のAI導入率は世界最下位レベル",
          suggestion: "",
          source_url: "",
          confidence: 0,
          action: 'rephrase-with-caution',
          cautionNote: "日本のAI導入率は世界最下位レベル"
        }
      ];

      setTestResults(prev => [...prev, {
        agentName: '出典検索エージェント',
        receivedContent: TEST_ARTICLE.substring(0, 100) + '...',
        outputData: {
          issues: searchResults,
          verified_urls: []
        },
        status: 'success'
      }]);

      console.log('⚠️ 出典検索: 2箇所とも出典が見つからず → rephrase-with-caution');

      // 3. 最終統合エージェント（モック）
      setCurrentStep('最終統合エージェント実行中...');
      await new Promise(resolve => setTimeout(resolve, 500));

      const integrationResult = {
        overallScore: 55,
        passed: false,
        criticalIssues: [],
        majorIssues: searchResults.map(issue => ({
          ...issue,
          actionType: 'rephrase',
          cautionNote: issue.cautionNote
        })),
        minorIssues: [],
        sourceInsertions: []
      };

      setTestResults(prev => [...prev, {
        agentName: '最終統合エージェント',
        receivedContent: 'all agent results',
        outputData: integrationResult,
        status: 'success'
      }]);

      console.log('📊 最終統合: スコア55点、要修正（rephrase指示）');

      // 4. 修正サービス（モック）
      setCurrentStep('修正サービス実行中...');
      await new Promise(resolve => setTimeout(resolve, 500));

      const revisedArticle = `
<h2>AI人材の将来性</h2>
<p>AIエンジニアの年収は増加傾向にあります。<!-- 要確認：AIエンジニアの平均年収は2025年に2000万円になると予測 -->
日本のAI導入は発展途上にあります。<!-- 要確認：日本のAI導入率は世界最下位レベル --></p>
`;

      setTestResults(prev => [...prev, {
        agentName: '修正サービス',
        receivedContent: 'original article + revision instructions',
        outputData: {
          revisedArticle,
          htmlCommentsAdded: 2,
          phrasesReplaced: [
            "2025年に2000万円 → 増加傾向",
            "世界最下位レベル → 発展途上"
          ]
        },
        status: 'success'
      }]);

      console.log('✅ 修正完了: HTMLコメント2件挿入、表現をマイルドに変更');

      // 5. Slack通知（モック）
      setCurrentStep('Slack通知準備中...');
      await new Promise(resolve => setTimeout(resolve, 500));

      const cautionNotes = [
        { location: "AI人材の将来性", claim: "AIエンジニアの平均年収は2025年に2000万円になると予測" },
        { location: "AI人材の将来性", claim: "日本のAI導入率は世界最下位レベル" }
      ];

      setTestResults(prev => [...prev, {
        agentName: 'Slack通知',
        receivedContent: 'caution notes',
        outputData: {
          notificationType: 'notifyProofreadingComplete',
          cautionNotes,
          message: '要確認箇所2件をSlackに通知'
        },
        status: 'success'
      }]);

      console.log('📨 Slack通知: 要確認箇所2件を含む通知を送信');

      setCurrentStep('✅ モックテスト完了！');

      console.log('\n=====================================');
      console.log('🎉 データフロー確認完了（コスト: 0円）');
      console.log('=====================================');

    } catch (error) {
      console.error('❌ エラー:', error);
      setCurrentStep('エラーが発生しました');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 mb-6 border border-gray-200 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        モックテスト（API費用0円）
      </h2>

      <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
        <p className="text-amber-700 text-sm">
          ⚠️ これはモックテストです。実際のAPIは呼び出されません。
        </p>
      </div>

      <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="text-gray-800 font-semibold mb-2">テスト記事：</h3>
        <div className="text-gray-600 text-sm font-mono">
          「AIエンジニアの平均年収は2025年に2000万円になると予測されています。<br/>
          日本のAI導入率は世界最下位レベルという現状があります。」
        </div>
      </div>

      <button
        onClick={runMockTest}
        disabled={isRunning}
        className={`px-6 py-3 rounded-xl font-medium transition-all ${
          isRunning
            ? 'bg-gray-200 cursor-not-allowed text-gray-500'
            : 'bg-green-500 hover:bg-green-600 text-white'
        }`}
      >
        {isRunning ? '🔄 実行中...' : 'モックテスト実行（無料）'}
      </button>

      {currentStep && (
        <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-blue-700">{currentStep}</p>
        </div>
      )}

      {testResults.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            処理フロー：
          </h3>

          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-gray-800 font-medium">
                    {index + 1}. {result.agentName}
                  </h4>
                  <span className="text-green-600 text-sm">
                    ✅ {result.status}
                  </span>
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  <p className="text-gray-500">
                    受信: {result.receivedContent}
                  </p>
                  <div className="bg-white p-2 rounded-lg border border-gray-200 text-xs">
                    <pre className="text-blue-700">
                      {JSON.stringify(result.outputData, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
