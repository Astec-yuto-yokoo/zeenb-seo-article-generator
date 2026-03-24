/**
 * カリキュラムデータサービス（汎用スタブ版）
 *
 * 既存のインポートとの互換性を維持するための空実装
 */

interface CurriculumChapter {
  chapter_id: number;
  title: string;
  key_concepts?: Record<string, string>;
  examples?: Array<{ type: string; content: string }>;
  practical_tips?: string[];
  quotes?: string[];
  learning_objectives?: string[];
}

interface RelevantSection {
  chapter: string;
  chapter_id: number;
  concepts?: Record<string, string>;
  examples?: Array<{ type: string; content: string }>;
  tips?: string[];
  quotes?: string[];
  objectives?: string[];
}

export class CurriculumDataService {
  /**
   * キーワードに関連する章・セクションを検索（汎用スタブ）
   */
  findRelevantSections(keyword: string): RelevantSection | null {
    return null;
  }

  /**
   * 特定の概念の説明を取得（汎用スタブ）
   */
  getConceptExplanation(concept: string): string | null {
    return null;
  }

  /**
   * 特定のチャプターIDから情報を取得（汎用スタブ）
   */
  getChapterById(chapterId: number): CurriculumChapter | null {
    return null;
  }

  /**
   * プロンプトエンジニアリング関連の情報を取得（汎用スタブ）
   */
  getPromptEngineeringInfo(): RelevantSection | null {
    return null;
  }

  /**
   * AIエージェント関連の情報を取得（汎用スタブ）
   */
  getAIAgentInfo(): RelevantSection | null {
    return null;
  }

  /**
   * 記事生成用のコンテキストを構築（汎用スタブ）
   */
  buildArticleContext(keyword: string): string {
    return '';
  }

  /**
   * メトリクス情報を取得（汎用スタブ）
   */
  getMetrics(): Record<string, string> {
    return {};
  }

  /**
   * 全カリキュラムデータを取得（汎用スタブ）
   */
  getAllCurriculumData(): Array<{
    title: string;
    description: string;
    modules: Array<{ title: string; description: string }>;
  }> {
    return [];
  }
}

// シングルトンインスタンスをエクスポート
export const curriculumDataService = new CurriculumDataService();
