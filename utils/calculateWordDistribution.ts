// 文字数配分計算のユーティリティ
import type { SeoOutline } from '../types';

export interface SectionDistribution {
  sectionIndex: number;
  heading: string;
  h3Count: number;
  targetWords: number;
  wordsPerH3: number;
  isConclusion: boolean;
}

/**
 * 改善版: より正確な文字数配分を計算
 */
export function calculateImprovedWordDistribution(
  outline: SeoOutline
): {
  totalWords: number;
  introWords: number;
  distributions: SectionDistribution[];
  actualTotal: number;
} {
  const totalWords = outline.characterCountAnalysis?.average || 5000;
  const sections = outline.outline;
  
  // リード文は300-500文字程度（読者をすぐ本題に導く）
  const introWords = Math.min(
    Math.max(300, Math.round(totalWords * 0.025)), 
    500
  );
  
  // まとめセクションを特定
  const conclusionIndex = sections.findIndex(s => 
    s.heading.includes('まとめ') || s.heading.includes('終わり')
  );
  
  // まとめは400-1500文字程度（要点をコンパクトにまとめる）
  const conclusionWords = Math.min(
    Math.max(400, Math.round(totalWords * 0.06)),
    1500
  );
  
  // 残りの文字数を本文セクションに配分
  const bodyWords = totalWords - introWords - conclusionWords;
  
  // 各セクションのH3数を取得
  const sectionWeights = sections.map((section, index) => {
    if (index === conclusionIndex) return 0; // まとめは別計算
    const h3Count = section.subheadings?.length || 0;
    // H3がない場合も最低限の重みを持たせる
    return 1 + (h3Count * 0.5); // H3 1個につき重み+0.5
  });
  
  const totalWeight = sectionWeights.reduce((sum, w) => sum + w, 0);
  
  // 配分を計算
  const distributions: SectionDistribution[] = sections.map((section, index) => {
    const h3Count = section.subheadings?.length || 0;
    let targetWords: number;
    
    if (index === conclusionIndex) {
      // まとめセクション
      targetWords = conclusionWords;
    } else {
      // 通常セクション: 重み付けに基づいて配分
      const weight = sectionWeights[index];
      targetWords = Math.round(bodyWords * (weight / totalWeight));
    }
    
    // H3あたりの文字数を計算
    const wordsPerH3 = h3Count > 0 ? Math.round(targetWords / (h3Count + 1)) : targetWords;
    
    return {
      sectionIndex: index,
      heading: section.heading,
      h3Count,
      targetWords,
      wordsPerH3,
      isConclusion: index === conclusionIndex
    };
  });
  
  // 実際の合計を計算
  const actualTotal = introWords + distributions.reduce((sum, d) => sum + d.targetWords, 0);
  
  return {
    totalWords,
    introWords,
    distributions,
    actualTotal
  };
}

/**
 * 配分結果を見やすく表示
 */
export function formatDistribution(
  result: ReturnType<typeof calculateImprovedWordDistribution>
): string {
  const lines: string[] = [];
  
  lines.push(`📊 文字数配分計画（目標: ${result.totalWords.toLocaleString()}文字）`);
  lines.push('━'.repeat(50));
  lines.push(`📝 リード文: ${result.introWords.toLocaleString()}文字`);
  lines.push('');
  
  result.distributions.forEach((dist, index) => {
    const emoji = dist.isConclusion ? '✅' : '📌';
    lines.push(`${emoji} ${dist.heading}`);
    lines.push(`   文字数: ${dist.targetWords.toLocaleString()}文字`);
    if (dist.h3Count > 0) {
      lines.push(`   H3: ${dist.h3Count}個（各H3: 約${dist.wordsPerH3.toLocaleString()}文字）`);
    }
    lines.push('');
  });
  
  lines.push('━'.repeat(50));
  lines.push(`📊 合計: ${result.actualTotal.toLocaleString()}文字`);
  
  const difference = result.totalWords - result.actualTotal;
  if (Math.abs(difference) > 100) {
    lines.push(`⚠️ 誤差: ${difference > 0 ? '+' : ''}${difference.toLocaleString()}文字`);
  }
  
  return lines.join('\n');
}

/**
 * テスト用: 20,000文字、H2が3個、H3が合計15個の例
 */
export function testDistribution(): void {
  const testOutline: SeoOutline = {
    title: 'テスト記事',
    targetAudience: 'テスト読者',
    introduction: 'テスト導入',
    outline: [
      {
        heading: 'セクション1',
        subheadings: ['H3-1', 'H3-2', 'H3-3', 'H3-4', 'H3-5', 'H3-6', 'H3-7']
      },
      {
        heading: 'セクション2', 
        subheadings: ['H3-1', 'H3-2', 'H3-3', 'H3-4', 'H3-5', 'H3-6', 'H3-7', 'H3-8']
      },
      {
        heading: 'まとめ',
        subheadings: []
      }
    ],
    conclusion: 'テストまとめ',
    keywords: [],
    characterCountAnalysis: {
      average: 20000,
      median: 20000,
      min: 15000,
      max: 25000,
      analyzedArticles: 10
    }
  };
  
  const result = calculateImprovedWordDistribution(testOutline);
  console.log(formatDistribution(result));
}