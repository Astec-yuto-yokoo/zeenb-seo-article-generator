// Vercel画像生成エージェントとの実際の連携テスト

export interface ImageAgentTestData {
  title: string;
  keyword: string;
  h2Items: Array<{
    text: string;
    h3Items: string[];
  }>;
  characterCount: number;
  content?: string; // 実際のコンテンツ（オプション）
}

// Vercel画像生成エージェントのURL（実際のURLに変更してください）
const IMAGE_AGENT_URL = "https://your-image-agent.vercel.app"; // ここを実際のURLに変更

// テスト用の記事データ
export const testArticleData: ImageAgentTestData[] = [
  {
    title: "SEO対策完全ガイド：検索順位を上げる15の手法",
    keyword: "SEO対策",
    characterCount: 8500,
    h2Items: [
      {
        text: "SEO対策の基本概念",
        h3Items: [
          "検索エンジンの仕組み",
          "SEOの重要性",
          "検索アルゴリズムの理解",
        ],
      },
      {
        text: "キーワード戦略の立て方",
        h3Items: [
          "キーワード調査の方法",
          "競合分析",
          "ロングテールキーワード活用",
        ],
      },
      {
        text: "コンテンツ最適化テクニック",
        h3Items: [
          "タイトルタグ最適化",
          "メタディスクリプション",
          "見出し構造の改善",
        ],
      },
      {
        text: "技術的SEO対策",
        h3Items: ["サイト速度改善", "モバイル最適化", "構造化データ実装"],
      },
    ],
    content: `
SEO対策は現代のデジタルマーケティングにおいて欠かせない要素です。
検索エンジンで上位表示されることで、より多くの潜在顧客にリーチできます。

## SEO対策の基本概念
検索エンジンは複雑なアルゴリズムを使用してウェブページをランク付けしています...

## キーワード戦略の立て方
効果的なSEO対策には、適切なキーワード選定が不可欠です...
    `,
  },
  {
    title: "リモートワーク成功の秘訣：生産性を3倍にする方法",
    keyword: "リモートワーク",
    characterCount: 6200,
    h2Items: [
      {
        text: "リモートワークの現状と課題",
        h3Items: ["導入企業の増加傾向", "よくある問題点", "解決すべき課題"],
      },
      {
        text: "効率的な作業環境の構築",
        h3Items: [
          "ホームオフィス設計",
          "必要なツールと機器",
          "集中力を高める工夫",
        ],
      },
      {
        text: "時間管理とタスク管理",
        h3Items: [
          "ポモドーロテクニック",
          "タスク優先順位付け",
          "デッドライン管理",
        ],
      },
    ],
  },
  {
    title: "AI活用で業務効率化：中小企業でも始められる実践ガイド",
    keyword: "AI活用",
    characterCount: 7800,
    h2Items: [
      {
        text: "AI導入の基礎知識",
        h3Items: [
          "AIの種類と特徴",
          "中小企業での活用メリット",
          "導入コストの考え方",
        ],
      },
      {
        text: "具体的なAI活用事例",
        h3Items: ["顧客対応の自動化", "データ分析の効率化", "文書作成支援"],
      },
      {
        text: "AI導入の進め方",
        h3Items: ["段階的導入計画", "従業員教育", "効果測定方法"],
      },
    ],
  },
];

// Vercel画像生成エージェントにデータを送信
export async function sendToImageAgent(
  articleData: ImageAgentTestData,
  imageAgentUrl: string = IMAGE_AGENT_URL
): Promise<{
  success: boolean;
  response?: any;
  error?: string;
  processingTime?: number;
}> {
  const startTime = Date.now();

  try {
    console.log(
      `🚀 画像生成エージェントにデータ送信開始: ${articleData.title}`
    );
    console.log(`📡 送信先URL: ${imageAgentUrl}`);

    // 画像生成エージェントが期待する形式にデータを変換
    const payload = {
      article: {
        title: articleData.title,
        keyword: articleData.keyword,
        h2Items: articleData.h2Items,
        characterCount: articleData.characterCount,
        content: articleData.content || generateMockContent(articleData),
      },
      options: {
        imageCount: articleData.h2Items.length,
        style: "professional", // または "illustration", "photo" など
        size: "1024x1024",
      },
    };

    console.log(`📝 送信データ:`, {
      title: payload.article.title,
      h2Count: payload.article.h2Items.length,
      totalH3Count: payload.article.h2Items.reduce(
        (sum, h2) => sum + h2.h3Items.length,
        0
      ),
    });

    const response = await fetch(`${imageAgentUrl}/api/generate-images`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const processingTime = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    console.log(`✅ 画像生成完了 (${processingTime}ms)`);
    console.log(`🖼️ 生成された画像数: ${result.images?.length || 0}`);

    return {
      success: true,
      response: result,
      processingTime,
    };
  } catch (error: any) {
    const processingTime = Date.now() - startTime;

    console.error(`❌ 画像生成エラー (${processingTime}ms):`, error.message);

    return {
      success: false,
      error: error.message,
      processingTime,
    };
  }
}

// モックコンテンツ生成（contentが提供されていない場合）
function generateMockContent(articleData: ImageAgentTestData): string {
  let content = `# ${articleData.title}\n\n`;
  content += `この記事では「${articleData.keyword}」について詳しく解説します。\n\n`;

  articleData.h2Items.forEach((h2, index) => {
    content += `## ${h2.text}\n\n`;
    content += `${h2.text}について説明します。この章では以下の内容を扱います。\n\n`;

    h2.h3Items.forEach((h3, h3Index) => {
      content += `### ${h3}\n\n`;
      content += `${h3}に関する詳細な説明をここに記載します。実際の運用では、より具体的で実用的な内容が含まれます。\n\n`;
    });
  });

  return content;
}

// 全テストデータで順次テスト実行
export async function runImageAgentTests(
  imageAgentUrl?: string,
  onProgress?: (step: string, data?: any) => void
): Promise<
  Array<{
    title: string;
    success: boolean;
    processingTime?: number;
    imageCount?: number;
    error?: string;
  }>
> {
  const results = [];

  onProgress?.("🚀 Vercel画像生成エージェント連携テスト開始");
  onProgress?.(`📡 テスト対象URL: ${imageAgentUrl || IMAGE_AGENT_URL}`);
  onProgress?.(`📊 テストケース数: ${testArticleData.length}`);

  for (let i = 0; i < testArticleData.length; i++) {
    const articleData = testArticleData[i];

    onProgress?.(
      `\n📄 テスト ${i + 1}/${testArticleData.length}: ${articleData.title}`
    );
    onProgress?.(`   H2見出し数: ${articleData.h2Items.length}`);
    onProgress?.(
      `   総H3見出し数: ${articleData.h2Items.reduce(
        (sum, h2) => sum + h2.h3Items.length,
        0
      )}`
    );

    try {
      const result = await sendToImageAgent(articleData, imageAgentUrl);

      if (result.success) {
        const imageCount = result.response?.images?.length || 0;
        onProgress?.(
          `   ✅ 成功: ${imageCount}枚生成 (${result.processingTime}ms)`
        );

        results.push({
          title: articleData.title,
          success: true,
          processingTime: result.processingTime,
          imageCount,
        });
      } else {
        onProgress?.(`   ❌ 失敗: ${result.error}`);

        results.push({
          title: articleData.title,
          success: false,
          error: result.error,
          processingTime: result.processingTime,
        });
      }
    } catch (error: any) {
      onProgress?.(`   ❌ 例外エラー: ${error.message}`);

      results.push({
        title: articleData.title,
        success: false,
        error: error.message,
      });
    }

    // 次のテストまで少し待機（サーバー負荷軽減）
    if (i < testArticleData.length - 1) {
      onProgress?.("   ⏳ 3秒待機...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  onProgress?.("\n🎉 全テスト完了");

  // 結果サマリー
  const successCount = results.filter((r) => r.success).length;
  const totalImages = results.reduce((sum, r) => sum + (r.imageCount || 0), 0);
  const avgTime =
    results
      .filter((r) => r.processingTime)
      .reduce((sum, r) => sum + (r.processingTime || 0), 0) / results.length;

  onProgress?.(`\n📊 テスト結果サマリー:`);
  onProgress?.(
    `   成功率: ${successCount}/${results.length} (${Math.round(
      (successCount / results.length) * 100
    )}%)`
  );
  onProgress?.(`   総生成画像数: ${totalImages}枚`);
  onProgress?.(`   平均処理時間: ${Math.round(avgTime)}ms`);

  return results;
}

// 単体テスト用の関数
export async function testSingleArticle(
  articleIndex: number = 0,
  imageAgentUrl?: string
) {
  if (articleIndex >= testArticleData.length) {
    throw new Error(
      `無効なインデックス: ${articleIndex}. 最大: ${testArticleData.length - 1}`
    );
  }

  const articleData = testArticleData[articleIndex];
  console.log(`🧪 単体テスト実行: ${articleData.title}`);

  return await sendToImageAgent(articleData, imageAgentUrl);
}
