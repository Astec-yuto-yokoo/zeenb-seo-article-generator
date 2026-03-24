// 校閲エージェント用の型定義

export type ViolationSeverity = 'critical' | 'warning' | 'info';

export type ViolationCategory = 
  | 'prep_label'        // PREP法のラベル使用
  | 'sentence_unity'    // 一文一意違反
  | 'repetition'        // 語尾の重複
  | 'char_count'        // 文字数の過不足
  | 'wordpress'         // WordPress非対応タグ
  | 'frequency'         // 頻出単語の未使用
  | 'readability'       // 読みやすさの問題
  | 'forbidden_tags'    // 禁止タグの使用
  | 'indentation'       // 不要なインデント
  | 'numbering'         // H2タグへの番号付け
  | 'paragraph'         // 段落分けの問題
  | 'h2_intro'          // H2導入文の問題
  | 'fact_accuracy';    // 事実の正確性

export interface ViolationLocation {
  sectionHeading: string;
  paragraphIndex?: number;
  lineNumber?: number;
  charPosition?: {
    start: number;
    end: number;
  };
}

export interface Violation {
  id: string;
  severity: ViolationSeverity;
  category: ViolationCategory;
  location: ViolationLocation;
  violatedRule: string;
  actualText: string;
  suggestion: string;
  confidence: number; // 0-1
}

export interface ProofreadingStatistics {
  totalViolations: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  byCategory: Record<ViolationCategory, number>;
}

export interface ProofreadingReport {
  violations: Violation[];
  statistics: ProofreadingStatistics;
  overallScore: number; // 0-100
  timestamp: string;
  articleInfo: {
    totalCharacters: number;
    sectionCount: number;
    h2Count: number;
    h3Count: number;
  };
}

export interface ProofreadingConfig {
  enabledCategories: ViolationCategory[];
  severityThreshold: ViolationSeverity;
  checkFrequencyWords: boolean;
  targetCharCount?: number;
  allowedCharCountDeviation?: number; // 許容される文字数の誤差（%）
  enableFactCheck?: boolean; // ファクトチェックを有効にするか
}