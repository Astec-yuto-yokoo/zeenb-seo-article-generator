/**
 * 企業マスターデータ
 */

export interface CompanyInfo {
  fullName: string;
  displayName: string;
  industry: string;
  ceo?: string;
  results: {
    before: string;
    after: string;
    timeReduction?: string;
    improvement?: string;
    achievement?: string;
  };
  details: string;
  noteUrl: string;
}

// 実データをここに登録
export const COMPANY_MASTER: Record<string, CompanyInfo> = {
  'アステックペイント': {
    fullName: '株式会社アステックペイント',
    displayName: 'アステックペイント',
    industry: '工場営繕・改修工事',
    ceo: '',
    results: {
      before: '',
      after: '',
      achievement: '施工実績 年間3000棟以上',
      improvement: '遮熱効果により屋根の表面温度を約15℃程度抑え、室内温度も6.9℃低下'
    },
    details:
      '遮熱塗料シェアNo.1の技術力と豊富な施工ノウハウを持つアステックペイントが運営',
    noteUrl: ''
  }
};

/**
 * 企業名から業界情報を取得
 */
export function getCompanyIndustry(
  companyName: string
): string | undefined {
  return COMPANY_MASTER[companyName]?.industry;
}

/**
 * 企業名から完全な情報を取得
 */
export function getCompanyInfo(
  companyName: string
): CompanyInfo | undefined {
  return COMPANY_MASTER[companyName];
}

/**
 * すべての企業情報を取得
 */
export function getAllCompanies(): CompanyInfo[] {
  return Object.values(COMPANY_MASTER);
}

/**
 * 実績データをマークダウン形式で取得
 */
export function formatCompanyResultAsMarkdown(
  companyName: string
): string | null {
  const company = COMPANY_MASTER[companyName];
  if (!company) return null;

  return `
## ${company.displayName}の実績

- 業界：${company.industry}
- 実績：${company.results.improvement ?? ''}

${company.details}
`.trim();
}