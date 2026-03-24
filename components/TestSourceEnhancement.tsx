import React, { useState } from 'react';
import { SourceEnhancementAgent } from '../services/finalProofreadingAgents/SourceEnhancementAgent';

export const TestSourceEnhancement: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  
  // テスト用の出典要求データ
  const testRequirements = [
    {
      claim: "2030年までに世界市場は200兆円規模",
      h2: "AIの市場規模",
      h3: "",
      searchKeywords: ["AI市場 2030年 200兆円"],
      location: "AIの市場規模セクション"
    },
    {
      claim: "トヨタ自動車では不良品率を50%削減",
      h2: "導入事例",
      h3: "製造業の事例",
      searchKeywords: ["トヨタ AI 品質検査 50%削減"],
      location: "製造業の事例セクション"
    },
    {
      claim: "日本のAI市場は2025年に1兆円規模",
      h2: "AIの市場規模",
      h3: "国内市場",
      searchKeywords: ["日本 AI市場 2025年 1兆円"],
      location: "国内市場セクション"
    }
  ];
  
  const testContent = `
<h2>AIの市場規模</h2>
<p>AIの市場は急成長しています。2030年までに世界市場は200兆円規模に達すると予測されています。</p>
<h3>国内市場</h3>
<p>日本のAI市場は2025年に1兆円規模になる見込みです。</p>
<h2>導入事例</h2>
<h3>製造業の事例</h3>
<p>トヨタ自動車では品質検査にAIを活用し、不良品率を50%削減しました。</p>
`;

  const runTest = async () => {
    setIsRunning(true);
    setResult('テスト開始...\n');
    console.log('🧪 SourceEnhancementAgent単体テスト開始');
    
    try {
      const agent = new SourceEnhancementAgent();
      console.log('✅ エージェントインスタンス作成');
      
      // コンテキストを準備
      const context = {
        sourceRequirements: testRequirements
      };
      console.log('📋 テストコンテキスト:', context);
      
      setResult(prev => prev + `\n📋 ${testRequirements.length}件の出典を検索します\n`);
      testRequirements.forEach((req, idx) => {
        setResult(prev => prev + `  [${idx+1}] ${req.claim}\n`);
        console.log(`  [${idx+1}] ${req.claim} @ ${req.h3 || req.h2}`);
      });
      
      // エージェント実行
      console.log('🚀 エージェント実行開始...');
      const startTime = Date.now();
      const agentResult = await agent.execute(testContent, context);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ エージェント実行完了 (${elapsed}秒)`);
      console.log('📊 実行結果:', agentResult);
      
      setResult(prev => prev + `\n⏱️ 処理時間: ${elapsed}秒\n`);
      setResult(prev => prev + `\n📊 結果:\n`);
      setResult(prev => prev + `- スコア: ${agentResult.score}\n`);
      setResult(prev => prev + `- ステータス: ${agentResult.status}\n`);
      
      // verified_urlsの表示
      if (agentResult.verified_urls && agentResult.verified_urls.length > 0) {
        setResult(prev => prev + `\n✅ 発見されたURL:\n`);
        agentResult.verified_urls.forEach((url: any, idx: number) => {
          const status = url.status === 'ok' || url.status === 'found' ? '✅' : '❌';
          setResult(prev => prev + `  [${idx+1}] ${status} ${url.claim || testRequirements[idx]?.claim || ''}\n`);
          if (url.url) {
            setResult(prev => prev + `      → ${url.url}\n`);
          }
        });
      }
      
      // issuesの表示
      if (agentResult.issues && agentResult.issues.length > 0) {
        setResult(prev => prev + `\n⚠️ 課題:\n`);
        agentResult.issues.forEach((issue: any, idx: number) => {
          setResult(prev => prev + `  [${idx+1}] ${issue.description}\n`);
          if (issue.source_url) {
            setResult(prev => prev + `      推奨URL: ${issue.source_url}\n`);
          }
        });
      }
      
      // 部分成功の場合
      if (agentResult.status === 'partial-success' && agentResult.partialData) {
        setResult(prev => prev + `\n⚠️ 部分成功: ${agentResult.partialData.completedItems}/${agentResult.partialData.totalItems}件完了\n`);
      }
      
    } catch (error) {
      setResult(prev => prev + `\n❌ エラー: ${error instanceof Error ? error.message : '不明なエラー'}\n`);
    } finally {
      setIsRunning(false);
    }
  };
  
  const runMockTest = () => {
    console.log('🧪 モックテスト開始');
    setResult('モックテスト（APIを使わない）\n');
    setResult(prev => prev + '\n構造化テキスト形式のパース確認:\n');
    
    // モックレスポンス（構造化テキスト形式）
    const mockResponse = `
===結果1===
主張: 2030年までに世界市場は200兆円規模
URL: https://www.meti.go.jp/press/2024/ai-market-forecast.html
状態: found
信頼度: 0.9
理由: 
===結果1終了===

===結果2===
主張: トヨタ自動車では不良品率を50%削減
URL: https://global.toyota/jp/newsroom/corporate/ai-quality-inspection.html
状態: found
信頼度: 0.85
理由: 
===結果2終了===

===結果3===
主張: 日本のAI市場は2025年に1兆円規模
URL: not_found
状態: not_found
信頼度: 0.0
理由: 具体的な数値の出典が見つかりませんでした
===結果3終了===
`;
    
    // パース処理のテスト
    const resultPattern = /===結果(\d+)===([\s\S]*?)===結果\1終了===/g;
    console.log('📝 正規表現パターン:', resultPattern);
    console.log('📝 モックレスポンス長:', mockResponse.length);
    
    const matches = [...mockResponse.matchAll(resultPattern)];
    console.log(`✅ パース結果: ${matches.length}件の結果を検出`);
    
    setResult(prev => prev + `\n解析結果: ${matches.length}件の結果を検出\n`);
    
    matches.forEach((match, index) => {
      const content = match[2];
      // 各行を配列に分割して処理
      const lines = content.split('\n').map(line => line.trim());
      
      let claim = '';
      let url = '';
      let statusValue = '';
      
      for (const line of lines) {
        if (line.startsWith('主張:')) {
          claim = line.substring('主張:'.length).trim();
        } else if (line.startsWith('URL:')) {
          url = line.substring('URL:'.length).trim();
        } else if (line.startsWith('状態:')) {
          statusValue = line.substring('状態:'.length).trim();
        }
      }
      
      const status = statusValue === 'found' ? '✅' : '❌';
      
      console.log(`  [${index + 1}] パース結果:`, {
        claim: claim.substring(0, 30) + '...',
        url: url === 'not_found' ? 'not_found' : url.substring(0, 50) + '...',
        status: statusValue
      });
      
      setResult(prev => prev + `\n[${index + 1}] ${status} ${claim}\n`);
      if (url && url !== 'not_found') {
        setResult(prev => prev + `    → ${url}\n`);
      }
    });
  };
  
  return (
    <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-bold text-gray-800 mb-4">🧪 SourceEnhancementAgent単体テスト</h3>

      <div className="space-y-2 mb-4">
        <button
          onClick={runMockTest}
          disabled={isRunning}
          className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 mr-2 transition-all"
        >
          📝 モックテスト（無料）
        </button>

        <button
          onClick={runTest}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-all"
        >
          🚀 実API テスト（GPT-5-mini使用）
        </button>
      </div>

      <div className="bg-gray-50 text-gray-700 p-4 rounded-xl font-mono text-sm whitespace-pre-wrap border border-gray-200">
        {result || 'テスト結果がここに表示されます'}
      </div>
    </div>
  );
};