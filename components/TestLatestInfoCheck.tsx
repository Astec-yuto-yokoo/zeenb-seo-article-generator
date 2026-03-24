import React, { useState } from 'react';
import { MultiAgentOrchestrator } from '../services/finalProofreadingAgents/MultiAgentOrchestrator';

const TestLatestInfoCheck: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [selectedTest, setSelectedTest] = useState<'current' | 'wrong' | 'future'>('current');

  // テスト記事のパターン
  const testArticles = {
    current: {
      title: '2025年9月の最新情報テスト',
      content: `
<h1>2025年9月の最新AI・テクノロジー動向</h1>
<p>現在の日本の総理大臣は石破茂氏です。2024年11月11日から第103代総理大臣を務めていますが、2025年9月7日に辞任を表明しました。</p>
<h2>最新のAI技術動向</h2>
<p>OpenAIは2025年にGPT-5をリリースしました。統一型アーキテクチャで、GPT-5 Pro、GPT-5 Mini、GPT-5 Nanoなど複数バリアントを提供しています。</p>
<p>GoogleのGemini 2.5 Proが最新モデルとして稼働中で、Grounding機能により最新情報の取得が可能です。</p>
<h2>2025年9月の株価・経済指標</h2>
<p>日経平均株価は2025年9月12日に44,768円で取引を終え、史上最高値を更新しました。</p>
<p>ビットコインの価格は2025年9月14日現在、約1,700万円で推移しています。8月には一時1,825万円まで上昇しました。</p>
<h2>最新のテクノロジー企業動向</h2>
<p>Appleは2024年6月にVision Proを日本で発売し、2025年も継続販売中です。価格は599,800円からです。</p>
<p>テスラのCEOイーロン・マスクは、X（旧Twitter）の運営を継続し、AIサービスGrokの開発も進めています。</p>
`
    },
    wrong: {
      title: '誤った情報を含むテスト',
      content: `
<h1>誤った情報のテスト記事</h1>
<p>現在の日本の総理大臣は岸田文雄氏です。</p>
<h2>誤ったAI情報</h2>
<p>OpenAIは2026年にGPT-6を一般公開しました。</p>
<p>GoogleのGemini 3.0が2025年1月にリリースされ、人間レベルのAGIを実現しました。</p>
<h2>誤った経済情報</h2>
<p>日経平均株価は現在25,000円前後で推移しています。</p>
<p>ビットコインの価格は現在1BTC=500万円程度です。</p>
<h2>誤った企業情報</h2>
<p>AmazonのCEOはまだジェフ・ベゾスが務めています。</p>
<p>FacebookはMeta社への社名変更を取り消し、再びFacebookに戻りました。</p>
`
    },
    future: {
      title: '未来の予測を含むテスト',
      content: `
<h1>2026年のテクノロジー予測</h1>
<p>2026年には量子コンピュータが家庭用PCとして普及すると予測されています。</p>
<h2>AI技術の展望</h2>
<p>2026年末までにAGI（汎用人工知能）が確実に実現します。</p>
<p>OpenAIは2026年中にGPT-6をリリース予定です。</p>
<h2>経済予測</h2>
<p>日経平均株価は2026年に6万円を突破すると予想されています。</p>
<p>ビットコインは2026年末までに1BTC=3000万円に達する可能性があります。</p>
<h2>テクノロジー企業の将来</h2>
<p>Appleは2026年に自動運転車を発売します。</p>
<p>テスラは2026年に火星への民間宇宙旅行を開始します。</p>
`
    }
  };

  const runCheck = async () => {
    setIsChecking(true);
    setResults(null);

    try {
      const article = testArticles[selectedTest];
      console.log('🧪 最新情報チェックテスト開始');
      console.log('📝 テスト記事タイプ:', selectedTest);

      // マルチエージェントオーケストレーターを初期化
      const orchestrator = new MultiAgentOrchestrator({
        enableLegalCheck: false,
        parallel: true,
        onProgress: (message, progress) => {
          console.log(`📊 進捗: ${progress}% - ${message}`);
        }
      });

      // 固有名詞エージェントと事実確認エージェントのみ実行
      console.log('🔍 固有名詞・事実確認エージェントを実行中...');
      const result = await orchestrator.execute(article.content);

      console.log('✅ チェック完了');
      console.log('📊 結果:', result);

      // Web検索結果を抽出
      const webSearchResults = result.agentResults
        .filter((r: any) => r.agentName === '固有名詞校閲エージェント' || r.agentName === '事例・ファクト検証エージェント')
        .map((r: any) => ({
          agent: r.agentName,
          score: r.score,
          issues: r.issues,
          webSearchUsed: r.status === 'success' && r.executionTime > 5000 // 5秒以上かかった場合はWeb検索使用と推定
        }));

      setResults({
        overall: result,
        webSearchResults,
        testType: selectedTest,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ テストエラー:', error);
      setResults({
        error: error instanceof Error ? error.message : '不明なエラー',
        testType: selectedTest,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h2 className="text-xl font-bold text-gray-800 mb-4">🔍 最新情報取得テスト</h2>

      <div className="mb-4">
        <label className="text-gray-600 block mb-2">テスト記事を選択:</label>
        <select
          value={selectedTest}
          onChange={(e) => setSelectedTest(e.target.value as any)}
          className="w-full p-2 bg-white text-gray-800 rounded-xl border border-gray-200"
          disabled={isChecking}
        >
          <option value="current">正しい最新情報（2025年9月現在）</option>
          <option value="wrong">誤った情報を含む記事</option>
          <option value="future">未来の予測を含む記事</option>
        </select>
      </div>

      <button
        onClick={runCheck}
        disabled={isChecking}
        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold disabled:bg-gray-300 disabled:text-gray-500 transition-all"
      >
        {isChecking ? '🔄 チェック中...' : '🚀 最新情報チェックを実行'}
      </button>

      {isChecking && (
        <div className="mt-4 text-amber-600">
          ⏳ Web検索を含むため、30秒〜1分程度かかる場合があります...
        </div>
      )}

      {results && (
        <div className="mt-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">📊 チェック結果</h3>

            {results.error ? (
              <div className="text-red-600">
                ❌ エラー: {results.error}
              </div>
            ) : (
              <>
                <div className="text-gray-600 space-y-2">
                  <p>テストタイプ: <span className="text-blue-600 font-medium">{results.testType}</span></p>
                  <p>総合スコア: <span className="text-green-600 font-medium">{results.overall?.overallScore || 0}点</span></p>
                  <p>実行時間: <span className="text-amber-600">{results.timestamp}</span></p>
                </div>

                {results.webSearchResults && (
                  <div className="mt-4">
                    <h4 className="text-gray-800 font-semibold mb-2">🔍 Web検索エージェントの結果:</h4>
                    {results.webSearchResults.map((agent: any, idx: number) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-gray-200 mb-2">
                        <p className="text-blue-600 font-semibold">{agent.agent}</p>
                        <p className="text-gray-600">スコア: {agent.score}点</p>
                        <p className="text-gray-600">Web検索使用: {agent.webSearchUsed ? '✅ はい' : '❌ いいえ'}</p>
                        {agent.issues && agent.issues.length > 0 && (
                          <div className="mt-2">
                            <p className="text-amber-600">検出された問題:</p>
                            <ul className="list-disc list-inside text-gray-500">
                              {agent.issues.map((issue: any, i: number) => (
                                <li key={i}>{issue.description}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4">
                  <details className="cursor-pointer">
                    <summary className="text-gray-800 hover:text-blue-600">詳細な結果を表示</summary>
                    <pre className="mt-2 p-2 bg-gray-100 text-gray-600 text-xs overflow-auto rounded-xl border border-gray-200">
                      {JSON.stringify(results.overall, null, 2)}
                    </pre>
                  </details>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 text-gray-500 text-sm">
        <p>💡 このテストでは以下を確認します：</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>固有名詞（人名、企業名、製品名）の正確性</li>
          <li>最新の統計データや数値の妥当性</li>
          <li>Web検索機能が実際に動作しているか</li>
          <li>誤った情報を正しく検出できるか</li>
        </ul>
      </div>
    </div>
  );
};

export default TestLatestInfoCheck;