// まとめ見出しのバリエーション生成ユーティリティ

export function generateConclusionHeading(keyword: string, articleType?: string): string {
  // 記事タイプに応じたバリエーション
  const variations = {
    howTo: [
      `まとめ：${keyword}を実践する際のポイント`,
      `${keyword}のまとめと次のステップ`,
      `まとめ：${keyword}で成功するための要点`,
      `${keyword}実践のまとめ`,
      `まとめ：${keyword}マスターへの道`
    ],
    comparison: [
      `まとめ：${keyword}の選び方のポイント`,
      `${keyword}比較のまとめ`,
      `まとめ：最適な${keyword}を見つけるために`,
      `${keyword}選定のまとめと推奨事項`,
      `まとめ：${keyword}の判断基準`
    ],
    explanation: [
      `まとめ：${keyword}の要点整理`,
      `${keyword}についてのまとめ`,
      `まとめ：${keyword}を理解するために`,
      `${keyword}の概要まとめ`,
      `まとめ：${keyword}の本質`
    ],
    tips: [
      `まとめ：${keyword}のコツと注意点`,
      `${keyword}活用のまとめ`,
      `まとめ：${keyword}を最大限活用する方法`,
      `${keyword}のポイントまとめ`,
      `まとめ：${keyword}の実用的なアドバイス`
    ],
    general: [
      `まとめ：${keyword}について`,
      `${keyword}のまとめ`,
      `まとめ：${keyword}の重要な点`,
      `${keyword}総括`,
      `まとめ：${keyword}を振り返って`,
      `${keyword}の要点まとめ`,
      `まとめ：${keyword}のポイント`,
      `${keyword}についての総まとめ`
    ]
  };

  // 記事タイプが指定されていない場合はランダムに選択
  const typeVariations = articleType && variations[articleType as keyof typeof variations] 
    ? variations[articleType as keyof typeof variations]
    : variations.general;
  
  // ランダムに1つ選択
  return typeVariations[Math.floor(Math.random() * typeVariations.length)];
}

// 記事タイプを推測する関数
export function detectArticleType(h2Headings: string[]): string {
  const headingText = h2Headings.join(' ').toLowerCase();
  
  if (headingText.includes('方法') || headingText.includes('やり方') || headingText.includes('手順')) {
    return 'howTo';
  }
  if (headingText.includes('比較') || headingText.includes('違い') || headingText.includes('選び方')) {
    return 'comparison';
  }
  if (headingText.includes('とは') || headingText.includes('基本') || headingText.includes('概要')) {
    return 'explanation';
  }
  if (headingText.includes('コツ') || headingText.includes('ポイント') || headingText.includes('注意')) {
    return 'tips';
  }
  
  return 'general';
}