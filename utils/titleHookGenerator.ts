// タイトルフック生成ユーティリティ
// 検索意図と競合分析に基づいて適切なタイトルフックを生成

// 検索意図別のフックパターン
const TITLE_HOOKS = {
  KNOW: [
    '完全ガイド',
    '徹底解説', 
    '基礎知識',
    '入門編',
    'まとめ',
    '保存版',
    '要点整理',
    '決定版',
    '完全版',
    '総まとめ',
    '全解説',
    '基本ガイド',
    'わかりやすく解説',
    '初心者向け',
    'プロが教える'
  ],
  DO: [
    '始め方',
    '手順解説',
    '実践ガイド',
    '導入方法',
    '活用法',
    '使い方',
    '設定方法',
    '構築手順',
    '実装方法',
    'ステップ解説',
    '具体的な方法',
    '成功の秘訣',
    '効果的な手法',
    '実践編'
  ],
  BUY: [
    '徹底比較',
    'おすすめ',  // ○選は後で追加
    '選び方ガイド',
    '比較表付き',
    '選定ポイント',
    'メリット・デメリット',
    '注意点',
    '比較ガイド',
    '失敗しない選び方',
    '賢い選択',
    '厳選',
    '人気ランキング',
    '導入事例付き'
  ],
  TREND: [
    '最新',
    '版',
    '最新版',
    '最新情報',
    '今知っておくべき',
    '注目の',
    '話題の',
    'トレンド'
  ],
  // 年号なしの汎用フック
  GENERAL: [
    '必見',
    '重要ポイント',
    '成功事例',
    '実例付き',
    'ポイント解説',
    '詳細ガイド',
    '専門家が解説',
    '図解付き',
    'チェックリスト付き'
  ]
};

// 検索意図を判定
export function detectSearchIntent(keyword: string): 'KNOW' | 'DO' | 'BUY' | 'GENERAL' {
  const lowerKeyword = keyword.toLowerCase();
  
  // KNOW意図のパターン
  if (lowerKeyword.includes('とは') || 
      lowerKeyword.includes('意味') || 
      lowerKeyword.includes('違い') || 
      lowerKeyword.includes('基礎') ||
      lowerKeyword.includes('基本')) {
    return 'KNOW';
  }
  
  // DO意図のパターン
  if (lowerKeyword.includes('方法') || 
      lowerKeyword.includes('やり方') || 
      lowerKeyword.includes('手順') || 
      lowerKeyword.includes('始め方') ||
      lowerKeyword.includes('使い方') ||
      lowerKeyword.includes('設定')) {
    return 'DO';
  }
  
  // BUY意図のパターン  
  if (lowerKeyword.includes('おすすめ') || 
      lowerKeyword.includes('比較') || 
      lowerKeyword.includes('選び方') || 
      lowerKeyword.includes('ランキング') ||
      lowerKeyword.includes('選') ||
      lowerKeyword.includes('サービス')) {
    return 'BUY';
  }
  
  return 'GENERAL';
}

// 鮮度が重要なキーワードかチェック
export function needsFreshness(keyword: string, competitorTitles: string[]): boolean {
  // キーワード自体に鮮度が必要な要素がある場合は必ず年号を使う
  const freshnessKeywords = ['最新', 'ニュース', 'アップデート', '改正', '変更', '新機能', '新サービス', '最新版', '新着'];
  const keywordNeedsFreshness = freshnessKeywords.some(w => keyword.includes(w));
  if (keywordNeedsFreshness) return true;
  
  // 競合が最新を使っているかチェック（判定を厳しく）
  const currentYear = new Date().getFullYear();
  const competitorsWithYear = competitorTitles.filter(title => 
    title.includes('最新') || 
    title.includes(currentYear.toString()) ||
    title.includes((currentYear - 1).toString())
  );
  
  // 競合70%以上が年号を使っている場合のみ鮮度を重視
  const freshnessRatio = competitorsWithYear.length / Math.max(competitorTitles.length, 1);
  return freshnessRatio >= 0.7;
}

// タイトルフックを生成
export function generateTitleHook(
  keyword: string,
  competitorTitles: string[] = [],
  usedHooksInLast30Days: string[] = []
): string {
  const currentYear = new Date().getFullYear();
  const intent = detectSearchIntent(keyword);
  const needsFresh = needsFreshness(keyword, competitorTitles);
  
  // 鮮度が必要な場合
  if (needsFresh) {
    // 年号を含むバリエーションを作成
    const yearVariations = [
      `${currentYear}年最新`,
      `${currentYear}年版`,
      `${currentYear}年`,
      `最新版`,
      `最新情報`,
      `${currentYear}年最新版`
    ];
    
    // 年号なしのバリエーションも含める（30%の確率）
    const nonYearVariations = [
      `最新`,
      `今知っておくべき`,
      `注目の`,
      `話題の`
    ];
    
    // 70%の確率で年号あり、30%で年号なし
    const useYear = Math.random() < 0.7;
    const candidateHooks = useYear ? yearVariations : nonYearVariations;
    
    // 使用履歴から未使用のものを選択
    const availableHooks = candidateHooks.filter(h => !usedHooksInLast30Days.includes(h));
    if (availableHooks.length > 0) {
      return `【${availableHooks[Math.floor(Math.random() * availableHooks.length)]}】`;
    }
    // 全て使用済みの場合はランダム選択
    return `【${candidateHooks[Math.floor(Math.random() * candidateHooks.length)]}】`;
  }
  
  // 検索意図に応じたフックを選択
  let hooks: string[] = [];
  
  switch (intent) {
    case 'KNOW':
      hooks = TITLE_HOOKS.KNOW;
      break;
    case 'DO':
      hooks = TITLE_HOOKS.DO;
      break;
    case 'BUY':
      // BUY意図の場合、数値を含むパターンも考慮
      hooks = TITLE_HOOKS.BUY.map(hook => {
        if (hook === 'おすすめ') {
          // 競合タイトルから数値を抽出
          const numbers = competitorTitles.map(t => {
            const match = t.match(/(\d+)[選個社]/);
            return match ? parseInt(match[1]) : null;
          }).filter(n => n !== null);
          
          if (numbers.length > 0) {
            const avgNumber = Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
            return `おすすめ${avgNumber}選`;
          }
          return 'おすすめ10選';
        }
        return hook;
      });
      break;
    default:
      // GENERAL の場合は汎用フックも含めて選択
      hooks = [...TITLE_HOOKS.GENERAL, ...TITLE_HOOKS.KNOW, ...TITLE_HOOKS.DO];
  }
  
  // 使用履歴から未使用のものを選択
  const availableHooks = hooks.filter(h => !usedHooksInLast30Days.includes(h));
  
  if (availableHooks.length === 0) {
    // 全て使用済みの場合はランダムに選択
    return `【${hooks[Math.floor(Math.random() * hooks.length)]}】`;
  }
  
  // ランダムに選択
  const selectedHook = availableHooks[Math.floor(Math.random() * availableHooks.length)];
  return `【${selectedHook}】`;
}

// タイトル全体を生成（文字数調整込み）
export function generateFullTitle(
  hook: string,
  keyword: string,
  description: string,
  maxLength: number = 32
): string {
  // フック + キーワード + 説明の基本構造
  let title = `${hook}${keyword}`;
  
  // 残り文字数で説明部分を追加
  const remainingLength = maxLength - title.length;
  
  if (remainingLength > 0 && description) {
    // 説明部分を適切な長さに調整
    const separator = title.endsWith('】') ? '' : '｜';
    const availableDescLength = remainingLength - separator.length;
    
    if (availableDescLength > 0) {
      // 説明を短縮
      let shortDesc = description;
      if (shortDesc.length > availableDescLength) {
        shortDesc = shortDesc.substring(0, availableDescLength - 1) + '…';
      }
      title += separator + shortDesc;
    }
  }
  
  return title;
}