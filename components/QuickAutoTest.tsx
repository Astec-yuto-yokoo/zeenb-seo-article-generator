import React, { useState } from 'react';
import { testArticle, testOutline } from '../testData/sampleArticle';
import { reviseBatchIssues } from '../services/articleRevisionService';
import type { IntegrationResult } from '../services/finalProofreadingAgents/types';

// モック校閲結果（71点、重大5件、主要10件、出典挿入データ付き）
const mockProofreadResult: IntegrationResult = {
  overallScore: 71,
  passed: false,
  passReason: '',
  agentResults: [],
  criticalIssues: [
    {
      agentName: 'テスト',
      agentType: 'test',
      type: 'factual-error',
      severity: 'critical',
      location: '1. 生成AIの定義と特徴',
      description: 'GPT-4 Turboのリリース年が間違っています',
      original: 'OpenAIのGPT-4 Turboは、2024年にリリースされ',
      suggestion: '2023年11月にリリースされた'
    },
    {
      agentName: 'テスト',
      agentType: 'test',
      type: 'missing-source',
      severity: 'critical',
      location: '生成AIとは？基本概念と仕組み',
      description: '業務効率30〜50%向上の出典が必要',
      original: '業務効率を30〜50%向上させることが可能です',
      suggestion: '具体的な調査データや事例の出典を追加'
    }
  ],
  majorIssues: [
    {
      agentName: 'テスト',
      agentType: 'test',
      type: 'clarity',
      severity: 'major',
      location: '2. カスタマーサポートの効率化',
      description: '数値の根拠が不明確',
      original: '問い合わせの初期対応の60〜70%をAIが処理',
      suggestion: '調査元や企業事例を明記'
    }
  ],
  minorIssues: [],
  suggestions: [],
  executionSummary: {
    totalTime: 1000,
    successfulAgents: 10,
    failedAgents: 0,
    timeoutAgents: 0
  },
  regulationScore: {
    factChecking: 31.5,
    reliability: 17.5,
    structureRules: 12.6,
    legalCompliance: 4.9,
    overallQuality: 5,
    total: 71.5
  },
  recommendation: 'revise',
  detailedReport: 'テスト用レポート',
  sourceInsertions: [
    {
      h2: '生成AIとは？基本概念と仕組み',
      h3: '',
      title: 'McKinsey & Company - 生成AIの経済効果',
      url: 'https://www.mckinsey.com/capabilities/quantumblack/our-insights/generative-ai-2023'
    },
    {
      h2: '生成AIの主要な活用領域7選',
      h3: '2. カスタマーサポートの効率化',
      title: 'Gartner - AI顧客サービス予測',
      url: 'https://www.gartner.com/en/newsroom/press-releases/2024-ai-customer-service'
    },
    {
      h2: '生成AIの主要な活用領域7選',
      h3: '4. プログラミング支援',
      title: 'GitHub Copilot効果測定レポート',
      url: 'https://github.blog/2023-06-27-github-copilot-impact/'
    }
  ]
};

const QuickAutoTest: React.FC = () => {
  const [status, setStatus] = useState<string>('待機中');
  const [result, setResult] = useState<string>('');

  const runQuickTest = async () => {
    try {
      setStatus('🚀 クイックテスト開始...');
      setResult('');

      // Step 1: モック校閲結果を表示
      setStatus('📊 モック校閲結果: 71点（重大5件、主要10件）');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: 一括修正をテスト
      setStatus('🔧 一括修正処理をテスト中...');

      const revisedArticle = await reviseBatchIssues({
        originalArticle: testArticle,
        issues: [...mockProofreadResult.criticalIssues, ...mockProofreadResult.majorIssues],
        category: 'critical',
        detailedReport: mockProofreadResult.detailedReport,
        sourceInsertions: mockProofreadResult.sourceInsertions,
        keyword: '業務効率化'  // テスト用のキーワード
      });

      setStatus('✅ テスト完了！');

      // 出典挿入の確認
      const sourceCount = (revisedArticle.match(/https?:\/\/[^\s<>]+/g) || []).length;
      const insertedSources = mockProofreadResult.sourceInsertions.filter(s =>
        revisedArticle.includes(s.url)
      );

      setResult(`修正後の記事長: ${revisedArticle.length}文字
出典URL挿入: ${insertedSources.length}/${mockProofreadResult.sourceInsertions.length}件成功
検出されたURL総数: ${sourceCount}件
最初の100文字: ${revisedArticle.substring(0, 100)}...`);

    } catch (error) {
      setStatus('❌ エラー発生');
      setResult(`エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
      console.error('クイックテストエラー:', error);
    }
  };

  // クイックフル自動テストは非表示
  return null;
};

export default QuickAutoTest;
