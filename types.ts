// 見出し構造の階層を表現
export interface HeadingStructure {
  h1: string;
  h2Items: Array<{
    text: string;
    h3Items: string[];
  }>;
}

// 個別記事の詳細分析結果
export interface ArticleAnalysis {
  rank: number;
  url: string;
  title: string;
  summary: string;
  characterCount: number;
  headingStructure: HeadingStructure;
  isArticle: boolean; // コラム記事かどうか
  excludeReason?: string; // 除外理由（ショッピング、PDF等）
}

// 頻出単語の情報
export interface FrequencyWord {
  word: string;
  count: number;
  articleCount: number; // 何記事で使われているか
  articles: number[]; // 使用している記事のランク番号
}

// 競合分析の全体結果
export interface CompetitorResearchResult {
  keyword: string;
  analyzedAt: string;
  totalArticlesScanned: number;
  validArticles: ArticleAnalysis[];
  excludedCount: number;
  commonTopics: string[];
  recommendedWordCount: {
    min: number;
    max: number;
    optimal: number;
  };
  frequencyWords?: FrequencyWord[]; // 頻出単語リスト
}

export interface SubheadingWithNote {
  text: string;
  writingNote?: string; // H3ごとの執筆メモ
}

// Ver.2用の型定義
export interface IntroductionPatterns {
  conclusionFirst: string; // 結論先行型
  empathy: string; // 共感型
}

export interface OutlineSectionV2 {
  heading: string;
  subheadings: SubheadingWithNote[];
  imageSuggestion: string; // 具体的な画像提案（被写体・構図まで）
  writingNote: string; // H2ごとの執筆メモ（最大200字）
  referenceMaterialIds?: string[];
}

export interface CompetitorComparisonSummary {
  averageH2Count: number;
  averageH3Count: number;
  ourH2Count: number;
  ourH3Count: number;
  freshnessRisks: string[]; // 競合の古い箇所
  differentiators: string[]; // 差分ポイント3点
}

export interface SeoOutlineV2 {
  title: string; // 32文字以内
  metaDescription: string; // 100文字以内、KW含む
  introductions: IntroductionPatterns; // 2パターンの導入文
  targetAudience: string;
  outline: OutlineSectionV2[];
  conclusion: string;
  keywords: string[];
  characterCountAnalysis?: {
    average: number;
    median: number;
    min: number;
    max: number;
    analyzedArticles: number;
  };
  competitorComparison: CompetitorComparisonSummary;
  searchIntent: {
    primary: string; // 主意図（KNOW/DO/NAV/LOCAL）
    secondary?: string; // 副意図
  };
  freshnessData?: {
    lastUpdated?: string;
    hasOutdatedInfo: boolean;
    outdatedSections?: string[];
  };
}

// 構成チェック結果
export interface OutlineCheckResult {
  isValid: boolean;
  errors: {
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }[];
  suggestions: string[];
}

export interface OutlineSection {
  heading: string;
  subheadings: string[] | SubheadingWithNote[]; // 文字列配列または詳細オブジェクト配列
  imageSuggestion?: string;
  writingNote?: string; // H2全体の執筆メモ
}

export interface CharacterCountAnalysis {
  average: number;
  median: number;
  min: number;
  max: number;
  analyzedArticles: number;
}

export interface SeoOutline {
  title: string;
  targetAudience: string;
  introduction: string;
  outline: OutlineSection[];
  conclusion: string;
  keywords: string[];
  characterCountAnalysis: CharacterCountAnalysis;
  competitorResearch?: CompetitorResearchResult; // 競合分析結果を追加
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

// ===== 戦略的キーワードリスト =====

// 検索意図タイプ
export type KeywordIntent =
  | 'インフォメーショナル' // 情報収集（KNOW）
  | 'コマーシャル'         // 比較検討（COMMERCIAL）
  | 'トランザクショナル'   // 取引・行動（DO）
  | 'ナビゲーショナル';    // 指名（NAV）

// 戦略的キーワード1件
export interface StrategicKeyword {
  keyword: string;            // キーワード（複合語・ロングテール可）
  intent: KeywordIntent | string; // 検索意図
  priority: '高' | '中' | '低';   // 優先度
  reason: string;             // 推奨理由（80字以内）
  suggestedH2: string;        // 想定H2・記事テーマ案（1行）
}

// 3観点の戦略的キーワードリスト全体
export interface StrategicKeywordList {
  keyword: string;            // 起点となったメインキーワード
  generatedAt: string;        // 生成日時（ISO文字列）
  competitorKeywords: StrategicKeyword[]; // 観点1: 競合キーワード調査
  ownKeywords: StrategicKeyword[];        // 観点2: 自社キーワード分析
  marketKeywords: StrategicKeyword[];     // 観点3: 市場環境
  sources?: GroundingChunk[]; // グラウンディング出典
}

// ===== 時事ネタ（ニュースジャッキング）キーワード =====

// 時事ネタ起点のキーワード1件
export interface TrendKeyword {
  newsSummary: string;        // 拾った時事ニュース・話題（いつ頃の何の話題か）
  keyword: string;            // そのニュースから狙う検索キーワード
  intent: KeywordIntent | string; // 検索意図
  priority: '高' | '中' | '低';   // 優先度
  relevance: string;          // 自ドメイン（外壁塗装）との結びつき（なぜ今アクセスが取れるか）
  suggestedH2: string;        // 想定H2・記事テーマ案
  sourceTitle?: string;       // 根拠ニュースのタイトル
  sourceUrl?: string;         // 根拠ニュースのURL
}

// 時事ネタキーワードのリスト全体
export interface TrendKeywordList {
  generatedAt: string;        // 生成日時（ISO文字列）
  keywords: TrendKeyword[];
  sources?: GroundingChunk[]; // グラウンディング出典
}