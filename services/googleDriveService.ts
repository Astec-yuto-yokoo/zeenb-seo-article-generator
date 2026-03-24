// Google Driveからデータを取得するサービス（汎用スタブ版）
// 現在はスタブ実装を使用

export interface DriveCompanyData {
  company: string;
  industry: string;
  result: string;
  detail: string;
  additionalInfo?: {
    challenges?: string[];
    solutions?: string[];
    keywords?: string[];
  };
}

// 汎用サンプルデータ
const sampleCompanies: DriveCompanyData[] = [
  {
    company: 'A社',
    industry: 'マーケティング支援',
    result: 'LP制作費10万円→0円',
    detail: 'AI活用によるLP制作の内製化を実現',
    additionalInfo: {
      challenges: ['LP制作の外注コストが高い', '制作期間が長い'],
      solutions: ['AI活用による内製化', '生成AIを使った制作フロー構築'],
      keywords: ['LP制作', '広告', 'ライティング', '外注削減']
    }
  },
  {
    company: 'B社',
    industry: 'Webマーケティング',
    result: '原稿執筆8時間→15分',
    detail: '生成AIの活用で大幅な時間短縮を実現',
    additionalInfo: {
      challenges: ['原稿執筆に長時間かかっていた', 'コンテンツ制作が遅い'],
      solutions: ['生成AIの活用', 'プロンプトエンジニアリング導入'],
      keywords: ['原稿執筆', 'コンテンツ制作', 'マーケティング']
    }
  },
  {
    company: 'C社',
    industry: '製造業',
    result: '業務時間66%削減',
    detail: 'AI自動化システムによる業務効率化',
    additionalInfo: {
      challenges: ['属人化による業務の非効率性', '運用負荷が膨大'],
      solutions: ['AI活用文化の構築', '運用自動化システムの導入'],
      keywords: ['運営', '自動化', '業務効率化']
    }
  }
];

/**
 * Google Driveから企業の詳細情報を取得
 * 注：汎用版ではサンプルデータを返す
 */
export async function fetchCompanyDetailsFromDrive(): Promise<DriveCompanyData[]> {
  return sampleCompanies;
}

/**
 * キーワードに基づいて関連する企業事例を取得
 */
export async function getRelevantCaseStudies(keyword: string): Promise<DriveCompanyData[]> {
  const allCompanies = await fetchCompanyDetailsFromDrive();

  // キーワードに関連する企業を優先順位付け
  const relevantCompanies = allCompanies.filter(company => {
    const allText = `${company.industry} ${company.result} ${company.detail} ${company.additionalInfo?.keywords?.join(' ') || ''}`.toLowerCase();
    const keywordLower = keyword.toLowerCase();

    // キーワードとの関連性をチェック
    return allText.includes(keywordLower) ||
           keywordLower.includes('ai') ||
           keywordLower.includes('研修') ||
           keywordLower.includes('自動化');
  });

  // 関連企業がない場合は全企業を返す
  return relevantCompanies.length > 0 ? relevantCompanies : allCompanies;
}

/**
 * 構成生成用のコンテキストを生成（汎用版）
 */
export async function generateEnhancedCompanyContext(keyword: string): Promise<string> {
  const companies = await getRelevantCaseStudies(keyword);

  let context = `
【導入実績（サンプル）】
`;

  companies.slice(0, 3).forEach(company => {
    context += `
◆ ${company.company}（${company.industry}）
  成果: ${company.result}
  詳細: ${company.detail}`;

    if (company.additionalInfo?.challenges && company.additionalInfo.challenges.length > 0) {
      context += `
  課題: ${company.additionalInfo.challenges[0]}`;
    }
    if (company.additionalInfo?.solutions && company.additionalInfo.solutions.length > 0) {
      context += `
  解決策: ${company.additionalInfo.solutions[0]}`;
    }
  });

  return context;
}
