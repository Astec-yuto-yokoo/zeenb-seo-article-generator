// 最終統合エージェント
import { BaseProofreadingAgent } from './BaseAgent';
import type { AgentResult, Issue, Suggestion, IntegrationResult, SourceInsertion } from './types';

export class IntegrationAgent extends BaseProofreadingAgent {
  constructor() {
    super(
      '最終統合エージェント',
      'integration',
      'gpt-5-mini'
    );
  }
  
  async integrate(agentResults: AgentResult[], previousScore?: number): Promise<IntegrationResult> {
    const startTime = Date.now();
    
    // 各エージェントの結果を集計
    const allIssues: Issue[] = [];
    const allSuggestions: Suggestion[] = [];
    let totalScore = 0;
    let successfulAgents = 0;
    let failedAgents = 0;
    let timeoutAgents = 0;
    
    // 部分成功のエージェントを追跡
    let partialSuccessAgents: string[] = [];
    
    for (const result of agentResults) {
      if (result.status === 'success') {
        successfulAgents++;
        totalScore += result.score;
        allIssues.push(...result.issues);
        allSuggestions.push(...result.suggestions);
      } else if (result.status === 'partial-success') {
        // 部分成功として処理
        successfulAgents++;
        totalScore += result.score;
        allIssues.push(...result.issues);
        allSuggestions.push(...result.suggestions);
        
        // 部分成功の警告を記録
        partialSuccessAgents.push(result.agentName);
        
        // 部分成功の詳細をログに出力
        if (result.partialData) {
          console.log(`⚠️ ${result.agentName}: ${result.partialData.message}`);
        }
      } else if (result.status === 'error') {
        failedAgents++;
      } else if (result.status === 'timeout') {
        timeoutAgents++;
      }
    }
    
    // 問題を重要度で分類（action情報も含める）
    const criticalIssues = allIssues
      .filter(i => i.severity === 'critical')
      .map(issue => ({
        ...issue,
        // 出典がない場合の処理を追加
        actionType: (issue as any).action === 'rephrase-with-caution' ? 'rephrase' : 'add-source',
        cautionNote: (issue as any).cautionNote
      }));
    
    const majorIssues = allIssues
      .filter(i => i.severity === 'major')
      .map(issue => ({
        ...issue,
        // 出典がない場合の処理を追加
        actionType: (issue as any).action === 'rephrase-with-caution' ? 'rephrase' : 'add-source',
        cautionNote: (issue as any).cautionNote
      }));
    
    const minorIssues = allIssues.filter(i => i.severity === 'minor');
    
    // レギュレーションスコアを計算
    const regulationScore = this.calculateRegulationScore(agentResults);
    
    // 総合評価
    const averageScore = successfulAgents > 0 ? totalScore / successfulAgents : 0;
    
    // 合格判定ロジック
    let passed = false;
    let passReason = '';
    
    // 基準１：75点以上なら合格
    if (regulationScore.total >= 75) {
      passed = true;
      passReason = '75点以上を達成';
    }
    // 基準２：前回から10%以上改善 AND 70点以上
    else if (previousScore && regulationScore.total >= 70) {
      const improvement = regulationScore.total - previousScore;
      const improvementRate = (improvement / previousScore) * 100;
      
      if (improvementRate >= 10) {
        passed = true;
        passReason = `前回${previousScore}点から${improvement.toFixed(1)}点改善（${improvementRate.toFixed(1)}%向上）`;
      }
    }
    
    // 推奨アクション
    let recommendation: 'publish' | 'revise' | 'reject';
    if (passed && criticalIssues.length === 0) {
      recommendation = 'publish';
    } else if (regulationScore.total >= 60 || criticalIssues.length <= 2) {
      recommendation = 'revise';
    } else {
      recommendation = 'reject';
    }
    
    // 詳細レポート生成
    const detailedReport = await this.generateDetailedReport(
      agentResults,
      criticalIssues,
      majorIssues,
      minorIssues,
      regulationScore,
      passed,
      passReason,
      previousScore
    );

    // CitationsAgentの検証済みURLから構造化データを作成
    // （バトンリレーの最後のランナーから受け取る）
    const citationsResult = agentResults.find(r => r.agentType === 'citations');
    console.log('🔍 IntegrationAgent: CitationsAgent結果:', {
      found: !!citationsResult,
      verified_urls: (citationsResult as any)?.verified_urls?.length || 0
    });

    const verifiedUrls = (citationsResult as any)?.verified_urls || [];

    // 📥 デバッグログ：受け取ったデータの確認
    console.log('📥 IntegrationAgentがCitationsAgentから受け取ったデータ:');
    verifiedUrls.slice(0, 5).forEach((u: any, idx: number) => {  // 最初の5件のみ
      console.log(`  [受信${idx + 1}]`, {
        url: u.url || 'URLなし',
        title: u.title || 'タイトル未定義',  // ← ここをチェック
        elementIndex: u.elementIndex
      });
    });
    if (verifiedUrls.length > 5) {
      console.log(`  ... 他${verifiedUrls.length - 5}件`);
    }

    // 要素番号ベースの出典データを従来の形式に変換
    const sourceInsertions: SourceInsertion[] = verifiedUrls
      .filter((u: any) => {
        // URLが存在すればOK
        const hasUrl = u.url && u.url.length > 0;
        const isOk = !u.status || u.status === 'ok';
        return hasUrl && isOk;
      })
      .map((u: any) => ({
        elementIndex: u.elementIndex,  // 要素番号を保持
        elementContent: u.elementContent || '',  // 元のHTML要素
        heading: `要素${u.elementIndex}`,  // 要素番号を表示
        url: u.url,
        title: u.title || 'リンク'
      }));

    // 📤 デバッグログ：出力データの確認
    console.log('📤 IntegrationAgent出力データ:');
    sourceInsertions.slice(0, 5).forEach((s: any, idx: number) => {
      console.log(`  [出力${idx + 1}]`, {
        elementIndex: s.elementIndex,
        url: s.url,
        title: s.title,  // ← 「リンク」になっているか確認
        heading: s.heading
      });
    });
    if (sourceInsertions.length > 5) {
      console.log(`  ... 他${sourceInsertions.length - 5}件`);
    }

    console.log(`📌 IntegrationAgent: ${sourceInsertions.length}件の出典を構造化データとして準備`);
    
    // 部分成功の警告を追加
    if (partialSuccessAgents.length > 0) {
      console.warn(`⚠️ IntegrationAgent: 注意 - 以下のエージェントは部分的な結果です：`);
      partialSuccessAgents.forEach(agent => {
        console.warn(`  - ${agent}（追加検索推奨）`);
      });
    }
    
    return {
      overallScore: regulationScore.total,
      passed,
      passReason,  // 合格理由を追加
      previousScore, // 前回スコアを記録
      agentResults,
      criticalIssues,
      majorIssues,
      minorIssues,
      suggestions: this.prioritizeSuggestions(allSuggestions),
      executionSummary: {
        totalTime: Date.now() - startTime,
        successfulAgents,
        failedAgents,
        timeoutAgents
      },
      regulationScore,
      recommendation,
      detailedReport,
      sourceInsertions  // 構造化された出典挿入データを追加
    };
  }
  
  private calculateRegulationScore(agentResults: AgentResult[]): IntegrationResult['regulationScore'] {
    // 新スコア配分（自社サービス 15点を削除し再配分）
    // - ファクトチェック系: 40→45点（+5点）
    // - 信頼性・引用系: 20→25点（+5点）
    // - 構成・執筆ルール: 15→18点（+3点）
    // - 法的コンプライアンス: 5→7点（+2点）
    // - 総合品質: 5点（変更なし）
    // - 合計: 100点
    const scores = {
      factChecking: 0,      // 45点満点
      reliability: 0,       // 25点満点
      structureRules: 0,    // 18点満点
      legalCompliance: 0,   // 7点満点
      overallQuality: 0,    // 5点満点
      total: 0              // 100点満点
    };

    // 各エージェントの結果からスコアを計算
    for (const result of agentResults) {
      if (result.status !== 'success' && result.status !== 'partial-success') continue;

      const weight = result.score / 100;

      switch (result.agentType) {
        case 'proper-nouns':
        case 'numbers-stats':
        case 'dates-timeline':
        case 'facts-cases':
          // ファクトチェック系（各11.25点、合計45点）
          scores.factChecking += weight * 11.25;
          break;
        case 'citations':
        case 'technical':
          // 信頼性・引用系（各12.5点、合計25点）
          scores.reliability += weight * 12.5;
          break;
        case 'company':
          // 自社サービスエージェント
          break;
        case 'legal':
          // 法的コンプライアンス（7点）
          scores.legalCompliance = weight * 7;
          break;
      }
    }

    // 構成ルールは固定値（後で実装時に計算）
    scores.structureRules = 14.4; // 18点 × 0.8 = 暫定値

    // 総合品質
    scores.overallQuality = agentResults.every(r => r.status === 'success' || r.status === 'partial-success') ? 5 : 3;

    // 合計
    scores.total = Math.round(
      scores.factChecking +
      scores.reliability +
      scores.structureRules +
      scores.legalCompliance +
      scores.overallQuality
    );

    return scores;
  }
  
  private prioritizeSuggestions(suggestions: Suggestion[]): Suggestion[] {
    // 優先度でソート
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return suggestions.sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    ).slice(0, 10); // 上位10件のみ
  }
  
  private async generateDetailedReport(
    agentResults: AgentResult[],
    criticalIssues: Issue[],
    majorIssues: Issue[],
    minorIssues: Issue[],
    regulationScore: IntegrationResult['regulationScore'],
    passed?: boolean,
    passReason?: string,
    previousScore?: number
  ): Promise<string> {
    // CitationsAgentの検証済みURLを抽出（重複削除：上部で既に取得済み）
    // 注: 124-132行目で既に取得しているため、ここでは参照のみ
    const citationsResult2 = agentResults.find(r => r.agentType === 'citations');
    const verifiedUrlsForReport = (citationsResult2 as any)?.verified_urls || [];

    // 構造化された出典挿入データを作成
    // 要素番号ベースの出典データを従来の形式に変換
    const sourceInsertions2: SourceInsertion[] = verifiedUrlsForReport
      .filter((u: any) => {
        // URLが存在すればOK
        const hasUrl = u.url && u.url.length > 0;
        const isOk = !u.status || u.status === 'ok';
        return hasUrl && isOk;
      })
      .map((u: any) => ({
        elementIndex: u.elementIndex,  // 要素番号を保持
        elementContent: u.elementContent || '',  // 元のHTML要素
        heading: `要素${u.elementIndex}`,  // 要素番号を表示
        url: u.url,
        title: u.title || 'リンク'
      }));
    
    const report = `
# 最終校閲レポート

## 総合評価
- **総合スコア**: ${regulationScore.total}/100点
${previousScore ? `- **前回スコア**: ${previousScore}点` : ''}
- **判定**: ${passed ? `✅ 合格（${passReason}）` : '❌ 要修正'}
${!passed && regulationScore.total >= 70 ? '- **次回合格条件**: 75点以上または10%以上の改善' : ''}

## スコア内訳
1. ファクトチェック系: ${regulationScore.factChecking.toFixed(1)}/45点
2. 信頼性・引用系: ${regulationScore.reliability.toFixed(1)}/25点
3. 構成・執筆ルール: ${regulationScore.structureRules.toFixed(1)}/18点
4. 法的コンプライアンス: ${regulationScore.legalCompliance.toFixed(1)}/7点
5. 総合品質: ${regulationScore.overallQuality}/5点

## 検出された問題
- 重大な問題: ${criticalIssues.length}件
- 主要な問題: ${majorIssues.length}件
- 軽微な問題: ${minorIssues.length}件

## エージェント実行結果
${agentResults.map(r => {
  if (r.status === 'success') {
    return `- ${r.agentName}: ✅ ${r.score}点`;
  } else if (r.status === 'partial-success') {
    const partialInfo = r.partialData ? ` (${r.partialData.completedItems}/${r.partialData.totalItems}件完了)` : '';
    return `- ${r.agentName}: ⚠️ ${r.score}点${partialInfo} - 部分成功`;
  } else {
    return `- ${r.agentName}: ❌ エラー`;
  }
}).join('\n')}

## 検証済み出典URL
${verifiedUrlsForReport.length > 0 ?
  verifiedUrlsForReport.map((u: any) => `- ${u.status === 'ok' ? '✅' : '❌'} ${u.url} (${u.location || '記事内'})`).join('\n')
  : '- 出典URLの検証情報なし'}

## 📌 修正サービス用：出典挿入指示
${verifiedUrlsForReport.length > 0 && verifiedUrlsForReport.filter((u: any) => u.status === 'ok').length > 0 ?
`【重要】以下の出典を各セクションの本文末尾（次の見出しの直前）に挿入してください：

${verifiedUrlsForReport.filter((u: any) => u.status === 'ok').map((u: any) => {
  const heading = u.location || '<h2>該当見出し</h2>';
  return `${heading} セクションの末尾に：
<p>（出典：<a href="${u.url}" target="_blank" rel="noopener noreferrer">${u.title || 'リンク'}</a>）</p>`;
}).join('\n\n')}

※注意：各出典は該当セクションの本文が終わった後、次の<h2>タグの直前に配置してください。`
: '出典情報なし'}

## 推奨事項
${passed 
  ? '記事は公開可能な品質です。' 
  : regulationScore.total >= 70
    ? 'あと少しで合格基準に達します。以下の修正を行ってください。'
    : '以下の修正を行ってから再度校閲を実施してください。'}
`;
    
    return report;
  }
  
  protected async performCheck(content: string, context?: any): Promise<{
    score: number;
    issues: Issue[];
    suggestions: Suggestion[];
    confidence: number;
  }> {
    // IntegrationAgentは直接performCheckを使わない
    return {
      score: 100,
      issues: [],
      suggestions: [],
      confidence: 100
    };
  }
}