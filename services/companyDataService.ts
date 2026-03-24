// 自社データ取得サービス
// Google Drive API（優先）またはローカルCSVファイルから実績データを取得

import {
  COMPANY_MASTER,
  getCompanyIndustry,
  type CompanyInfo,
} from "./companyMasterData";

interface CompanyData {
  company: string;
  industry?: string;
  challenge: string;
  actions: string;
  result: {
    before: string;
    after: string;
    delta?: string;
  };
  timeframe?: string;
  source?: {
    title: string;
    page?: number;
    url?: string;
  };
}

interface PDFSegment {
  segment_id: string;
  source_id: string;
  file_name: string;
  title: string;
  created_at?: string;
  file_size?: number;
  page_num?: number;
  chunk_num?: number;
  extraction_method?: string;
  extraction_confidence?: number;
  text: string;
  summary?: string;
  labels?: string;
  evidence?: string;
  confidence?: number;
  topics?: string;
  has_structure?: boolean;
}

class CompanyDataService {
  // ローカルファイルパス（開発環境用フォールバック）
  private readonly LOCAL_CSV_PATH = "./data/pdf_segments_index.csv";

  // Google DriveのフォルダID（メイン）- 環境変数で設定
  private readonly DRIVE_FOLDER_ID =
    process.env.COMPANY_DATA_FOLDER_ID || "";

  // Google APIキー
  private readonly API_KEY =
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GOOGLE_API_KEY ||
    import.meta.env?.VITE_GOOGLE_API_KEY;

  // CSVをパースする関数
  private parseCSV(csvText: string): PDFSegment[] {
    const lines = csvText.split("\n");
    const headers = this.parseCSVLine(lines[0]);
    const data: PDFSegment[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const record: any = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || "";
      });

      const segment: PDFSegment = {
        segment_id: record.segment_id,
        source_id: record.source_id,
        file_name: record.file_name,
        title: record.title,
        created_at: record.created_at,
        file_size: record.file_size ? parseInt(record.file_size) : undefined,
        page_num: record.page_num ? parseInt(record.page_num) : undefined,
        chunk_num: record.chunk_num ? parseInt(record.chunk_num) : undefined,
        extraction_method: record.extraction_method,
        extraction_confidence: record.extraction_confidence
          ? parseFloat(record.extraction_confidence)
          : undefined,
        text: record.text || "",
        summary: record.summary,
        labels: record.labels,
        evidence: record.evidence,
        confidence: record.confidence
          ? parseFloat(record.confidence)
          : undefined,
        topics: record.topics,
        has_structure:
          record.has_structure === "True" || record.has_structure === "true",
      };

      if (segment.text) {
        data.push(segment);
      }
    }

    return data;
  }

  // CSVの1行をパース（カンマ区切り、ダブルクォート対応）
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"';
        i++; // スキップ
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    if (current) {
      result.push(current.trim());
    }

    return result;
  }

  // PDFセグメントから実績データを抽出
  private extractCompanyDataFromSegments(
    segments: PDFSegment[]
  ): CompanyData[] {
    const companyDataList: CompanyData[] = [];

    for (const segment of segments) {
      // テキストから実績情報を抽出
      const text = segment.text;

      // 会社名の抽出パターン（汎用）
      const companyPatterns = [
        /([A-Z]社)/,
        /(株式会社[^\s,、]+)/,
        /([ぁ-ん]+社)/,
      ];

      let company = "企業名非公開";
      for (const pattern of companyPatterns) {
        const match = text.match(pattern);
        if (match) {
          company = match[0];
          break;
        }
      }

      // 業界の抽出 - まず企業マスターから取得
      const industry = getCompanyIndustry(company);

      // 実績数値の抽出パターン（より柔軟に）
      const patterns = {
        time: /(\d+時間|約?\d+時間|毎日\d+時間|1日\d+時間|\d+営業日)[^→]*[→から]?[^→]*(わずか\d+時間|\d+時間|\d+分|\d+秒|自動化|0円|削減)/,
        impression:
          /月間?(\d+万|[\d,]+|1,?000万)imp|(\d+万|[\d,]+)インプレッション/,
        cost: /(\d+万円|[\d,]+円|外注費\d+万円)[^→]*[→から]?[^→]*(\d+万円|[\d,]+円|0円|無料|削減)/,
        percentage: /(\d+)%[削減|向上|改善|短縮]/,
        // LP制作パターン
        lpPattern:
          /LP(ライティング)?外注費?(\d+万円)?.*?(0円|削減)|外注費.*?(\d+万円)?.*?0円/,
        // 原稿執筆パターン
        writingPattern: /原稿(執筆|作成).*?(\d+時間).*?(\d+秒|\d+分)/,
        // SNS運用パターン
        snsPattern: /(SNS|imp|インプレッション).*?(自動化|削減)/,
      };

      // 時間短縮の実績を探す
      const timeMatch = text.match(patterns.time);
      if (timeMatch) {
        const beforeAfter = timeMatch[0].split("→");
        if (beforeAfter.length === 2) {
          const data: CompanyData = {
            company: company,
            industry: industry,
            challenge: this.extractChallenge(text),
            actions: "業務効率化プログラムを導入",
            result: {
              before: beforeAfter[0].trim(),
              after: beforeAfter[1].trim(),
            },
            source: {
              title: segment.title || segment.file_name,
              page: segment.page_num,
            },
          };
          companyDataList.push(data);
        }
      }

      // コスト削減の実績
      const costMatch =
        text.match(patterns.cost) || text.match(patterns.lpPattern);
      if (costMatch) {
        const data: CompanyData = {
          company: company,
          industry: industry,
          challenge: this.extractChallenge(text),
          actions: "ツール導入でLP制作内製化",
          result: {
            before: "LP外注費",
            after: "0円（内製化）",
          },
          source: {
            title: segment.title || segment.file_name,
            page: segment.page_num,
          },
        };
        companyDataList.push(data);
      }

      // 原稿執筆の実績
      const writingMatch = text.match(patterns.writingPattern);
      if (writingMatch) {
        const data: CompanyData = {
          company: company,
          industry: industry,
          challenge: this.extractChallenge(text),
          actions: "AI執筆ツール導入",
          result: {
            before: "原稿執筆時間",
            after: "大幅短縮",
          },
          source: {
            title: segment.title || segment.file_name,
            page: segment.page_num,
          },
        };
        companyDataList.push(data);
      }

      // 自動化の実績
      const automationMatch = text.match(patterns.automation);
      if (automationMatch) {
        const fullMatch = automationMatch[0];
        const beforeAfter = fullMatch.split(/→|から/);
        if (beforeAfter.length >= 2) {
          const data: CompanyData = {
            company: company,
            industry: industry,
            challenge: this.extractChallenge(text),
            actions: this.extractAction(text),
            result: {
              before: beforeAfter[0].trim(),
              after: beforeAfter[1].trim(),
            },
            source: {
              title: segment.title || segment.file_name,
              page: segment.page_num,
            },
          };
          companyDataList.push(data);
        }
      }

      // パーセンテージ改善の実績
      const percentageMatch = text.match(patterns.percentageImprovement);
      if (percentageMatch) {
        const data: CompanyData = {
          company: company,
          industry: industry,
          challenge: this.extractChallenge(text),
          actions: this.extractAction(text),
          result: {
            before: "改善前",
            after: percentageMatch[0],
            delta: percentageMatch[0],
          },
          source: {
            title: segment.title || segment.file_name,
            page: segment.page_num,
          },
        };
        companyDataList.push(data);
      }
    }

    return companyDataList;
  }

  // アクションの抽出
  private extractAction(text: string): string {
    const actionPatterns = [
      /研修[^。]+導入/,
      /AI[^。]+実装/,
      /システム[^。]+構築/,
    ];

    for (const pattern of actionPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return "業務効率化プログラムを導入";
  }

  // Before状態の推測
  private extractBefore(text: string, afterValue: string): string {
    // 文脈から「以前」の状態を推測
    if (afterValue.includes("自動化")) {
      return "手動運用";
    }
    if (afterValue.includes("imp")) {
      return "従来のSNS運用";
    }
    if (afterValue.includes("0円")) {
      return "外注依存";
    }
    return "改善前";
  }

  // 課題の抽出
  private extractChallenge(text: string): string {
    const challengePatterns = [
      /属人化[^。]+/,
      /課題[：:は]([^。]+)/,
      /問題[：:は]([^。]+)/,
      /悩み[：:は]([^。]+)/,
      /困っていた[^。]+/,
    ];

    for (const pattern of challengePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return "AIツールの活用における組織的な課題";
  }

  // Google Drive APIでCSVファイルを取得（サーバーサイドAPI経由）
  private async fetchCSVFromGoogleDrive(): Promise<string | null> {
    try {
      console.log(`📂 サーバー経由でGoogle Driveデータを取得中...`);

      // タイムアウト設定を追加（30秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      // バックエンドサーバーのURLを取得
      const backendUrl =
        import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

      // API Keyを取得
      const apiKey = import.meta.env.VITE_INTERNAL_API_KEY;
      console.log("🔑 API Key status:", apiKey ? "Available" : "Missing");

      // サーバーサイドAPIを呼び出す
      const response = await fetch(`${backendUrl}/api/company-data`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { "x-api-key": apiKey }),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`サーバーAPIエラー: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.csvContent) {
        console.log("✅ サーバー経由でGoogle Driveデータを取得しました");
        return data.csvContent;
      }

      throw new Error(data.error || "データ取得に失敗しました");
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.error(
          "⏱️ Google Driveデータ取得がタイムアウトしました（30秒）"
        );
        console.log("ℹ️ ローカルデータにフォールバックします");
      } else {
        console.error("❌ サーバーAPIエラー:", error.message);
      }
      return null;
    }
  }

  // 自社データを取得
  async fetchCompanyData(): Promise<CompanyData[]> {
    try {
      console.log("📊 実績データを取得中...");

      // ブラウザ環境でもサーバーAPIを試行する
      if (typeof window !== "undefined") {
        console.log(
          "🌐 ブラウザ環境を検出 - サーバーAPI経由でデータ取得を試行"
        );

        // まずサーバーAPIを試す
        const driveData = await this.fetchCSVFromGoogleDrive();

        if (driveData) {
          console.log("✅ ブラウザ環境でサーバーAPI経由でデータを取得しました");
          const segments = this.parseCSV(driveData);
          const companyData = this.extractCompanyDataFromSegments(segments);
          console.log(`📊 ${companyData.length}件の実績データを抽出しました`);
          return companyData;
        } else {
          console.log("⚠️ サーバーAPI失敗 - フォールバックデータを使用");
          const fallbackData = this.getFallbackData();
          console.log(
            `📚 ${fallbackData.length}件のフォールバックデータを返します`
          );
          return fallbackData;
        }
      }

      let csvText: string;

      // サーバーサイドでの処理
      // 優先順位：
      // 1. Google Drive API（最優先）
      // 2. ローカルファイル（フォールバック）

      // まずGoogle Drive APIから取得を試みる
      const driveData = await this.fetchCSVFromGoogleDrive();

      if (driveData) {
        csvText = driveData;
      } else {
        // Google Drive APIが失敗した場合、ローカルファイルにフォールバック
        console.log("📁 ローカルファイルにフォールバック...");

        // Node.js環境（サーバーサイド）
        try {
          const fs = await import("fs").then((m) => m.default);
          csvText = fs.readFileSync(this.LOCAL_CSV_PATH, "utf-8");
          console.log("📁 ローカルファイルからデータを取得しました");
        } catch (localError) {
          console.error("❌ ローカルファイルも読み込めませんでした");
          return this.getFallbackData();
        }
      }

      const segments = this.parseCSV(csvText);
      const companyData = this.extractCompanyDataFromSegments(segments);

      console.log(`✅ ${companyData.length}件の実績データを抽出しました`);
      return companyData;
    } catch (error) {
      console.error("❌ データ取得エラー:", error);
      return this.getFallbackData();
    }
  }

  // キーワードに関連する実績を検索（カテゴリ分散型ランダム選択）
  searchRelevantData(keyword: string, data: CompanyData[]): CompanyData[] {
    const keywords = keyword.toLowerCase().split(/[\s　]+/);

    // まず関連データをフィルタリング
    const relevantData = data.filter((item) => {
      const searchText =
        `${item.company} ${item.industry} ${item.challenge} ${item.actions}`.toLowerCase();
      return keywords.some((kw) => searchText.includes(kw));
    });

    // デバッグログ（簡潔に）
    console.log(`🔍 キーワード「${keyword}」でフィルタリング: ${data.length}件 → ${relevantData.length}件`);

    // キーワードにマッチする企業が少ない場合は、全データからランダムに選択
    if (relevantData.length < 3) {
      console.log(
        `⚠️ キーワードに関連する企業が${relevantData.length}社のみ。全データから選択します。`
      );
      return this.selectDiverseCompanies(data, 3);
    }

    // カテゴリ分散型でランダムに3件選択
    const selected = this.selectDiverseCompanies(relevantData, 3);
    console.log(
      `✅ 選択された企業: ${selected.map((d) => d.company).join(", ")}`
    );

    return selected;
  }

  // カテゴリ分散型ランダム選択
  private selectDiverseCompanies(
    companies: CompanyData[],
    count: number = 3
  ): CompanyData[] {
    if (companies.length <= count) {
      return companies;
    }

    // 業界カテゴリと成果タイプでグループ化
    const categorized = this.categorizeCompanies(companies);
    const selected: CompanyData[] = [];
    const usedCategories = new Set<string>();
    const usedResultTypes = new Set<string>();

    // まず各カテゴリから1社ずつ選択（最大限の多様性を確保）
    for (const [category, categoryCompanies] of Object.entries(
      categorized.byIndustry
    )) {
      if (selected.length >= count) break;
      if (categoryCompanies.length > 0 && !usedCategories.has(category)) {
        const randomIndex = Math.floor(
          Math.random() * categoryCompanies.length
        );
        const company = categoryCompanies[randomIndex];
        selected.push(company);
        usedCategories.add(category);
        const resultType = this.getResultType(company);
        if (resultType) usedResultTypes.add(resultType);
      }
    }

    // 残り枠がある場合、成果タイプの多様性を考慮して追加
    while (selected.length < count) {
      const remaining = companies.filter((c) => !selected.includes(c));
      if (remaining.length === 0) break;

      // 未使用の成果タイプを優先
      const withNewResultType = remaining.filter((c) => {
        const resultType = this.getResultType(c);
        return resultType && !usedResultTypes.has(resultType);
      });

      const pool = withNewResultType.length > 0 ? withNewResultType : remaining;
      const randomIndex = Math.floor(Math.random() * pool.length);
      const company = pool[randomIndex];

      selected.push(company);
      const resultType = this.getResultType(company);
      if (resultType) usedResultTypes.add(resultType);
    }

    return selected;
  }

  // 企業をカテゴリ分類
  private categorizeCompanies(companies: CompanyData[]) {
    const byIndustry: { [key: string]: CompanyData[] } = {
      マーケティング: [],
      "SNS・動画": [],
      "IT・サービス": [],
      その他: [],
    };

    const byResultType: { [key: string]: CompanyData[] } = {
      コスト削減: [],
      時間短縮: [],
      規模拡大: [],
      人材代替: [],
      新規創出: [],
    };

    companies.forEach((company) => {
      // 業界カテゴリ分類
      const industryCategory = this.getIndustryCategory(company);
      byIndustry[industryCategory].push(company);

      // 成果タイプ分類
      const resultType = this.getResultType(company);
      if (resultType) {
        byResultType[resultType].push(company);
      }
    });

    return { byIndustry, byResultType };
  }

  // 業界カテゴリを判定
  private getIndustryCategory(company: CompanyData): string {
    const industry = company.industry?.toLowerCase() || "";

    if (
      industry.includes("マーケティング") ||
      industry.includes("広告運用") ||
      industry.includes("リスティング")
    ) {
      return "マーケティング";
    }
    if (
      industry.includes("sns") ||
      industry.includes("動画") ||
      industry.includes("ショート")
    ) {
      return "SNS・動画";
    }
    if (
      industry.includes("it") ||
      industry.includes("サービス") ||
      industry.includes("システム")
    ) {
      return "IT・サービス";
    }
    return "その他";
  }

  // 成果タイプを判定
  private getResultType(company: CompanyData): string | null {
    const result = company.result?.delta?.toLowerCase() || "";
    const actions = company.actions?.toLowerCase() || "";

    if (
      result.includes("円") ||
      result.includes("コスト") ||
      result.includes("費用")
    ) {
      return "コスト削減";
    }
    if (
      result.includes("時間") ||
      result.includes("%削減") ||
      result.includes("短縮")
    ) {
      return "時間短縮";
    }
    if (
      result.includes("imp") ||
      result.includes("自動化") ||
      result.includes("規模")
    ) {
      return "規模拡大";
    }
    if (
      result.includes("採用") ||
      result.includes("人") ||
      result.includes("代替")
    ) {
      return "人材代替";
    }
    if (
      result.includes("新規") ||
      result.includes("創出") ||
      result.includes("立ち上げ")
    ) {
      return "新規創出";
    }
    return null;
  }

  // 実績データをマークダウン形式で整形
  formatAsMarkdown(data: CompanyData): string {
    let markdown = `### ${data.company}様の事例\n\n`;

    if (data.industry) {
      markdown += `**業界**: ${data.industry}\n\n`;
    }

    markdown += `**課題**: ${data.challenge}\n\n`;
    markdown += `**実施内容**: ${data.actions}\n\n`;
    markdown += `**成果**: <strong>${data.result.before}→${data.result.after}</strong>`;

    if (data.result.delta) {
      markdown += ` (${data.result.delta})`;
    }

    if (data.timeframe) {
      markdown += `\n**期間**: ${data.timeframe}`;
    }

    if (data.source?.title) {
      markdown += `\n\n*出典: ${data.source.title}`;
      if (data.source.page) {
        markdown += ` (P.${data.source.page})`;
      }
      markdown += "*";
    }

    return markdown;
  }

  // フォールバックデータ（現在は無効化）
  private getFallbackData(): CompanyData[] {
    return [];
  }
}

// シングルトンインスタンス
export const companyDataService = new CompanyDataService();

// エクスポート
export type { CompanyData, PDFSegment };
export { CompanyDataService };
