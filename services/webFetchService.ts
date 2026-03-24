// WebFetchを使って実際のページコンテンツを取得するサービス
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set.");
}
const genAI = new GoogleGenerativeAI(apiKey);

// 待機時間を作る関数（サイトに優しくアクセスするため）
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// URLから実際のドメインを取得
function extractDomain(url: string): string {
  try {
    // vertexaisearchのURLから実際のURLを推測
    if (url.includes('vertexaisearch')) {
      return 'URL取得不可';
    }
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url; // URLでない場合はそのまま返す
  }
}

// ページコンテンツを分析する型
export interface PageAnalysis {
  url: string;
  title: string;
  h1: string;
  h2Items: Array<{
    text: string;
    h3Items: string[];
  }>;
  characterCount: number;
  fetchSuccess: boolean;
  error?: string;
}

// 単一のページ内容を取得して分析（タイトルベース）
export async function fetchAndAnalyzePage(
  url: string, 
  title: string,
  rank: number,
  useDirectSearch: boolean = false
): Promise<PageAnalysis> {
  console.log(`📄 Fetching page ${rank}: ${title}`);
  
  // デフォルトの結果（エラー時に返す）
  const defaultResult: PageAnalysis = {
    url: url,
    title: title,
    h1: title,
    h2Items: [],
    characterCount: 0,
    fetchSuccess: false,
    error: 'ページ取得失敗'
  };

  try {
    // URLが無効な場合はスキップ
    if (url === 'URL取得不可' || url.includes('vertexaisearch')) {
      console.log(`⚠️ Skipping invalid URL: ${url}`);
      return {
        ...defaultResult,
        error: 'URLが取得できませんでした'
      };
    }

    // Gemini APIを使ってWebFetch
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      }
    });

    // URLが無効な場合はタイトルで検索
    const searchQuery = (url === 'URL_NOT_FOUND' || !url || url.includes('URL')) 
      ? `「${title}」の記事を検索して、その内容を分析してください。`
      : `URL: ${url} のページ内容を分析してください。`;
    
    const prompt = `
${searchQuery}

タイトル: ${title}

以下の情報を正確に抽出してください：
1. 実際のページURL（取得できた場合）
2. H1タグの内容（最初の1つ）
3. すべてのH2タグとその配下のH3タグ
4. 本文の概算文字数（ヘッダー、フッター、ナビゲーションを除く）

重要：
- 実際のページ内容を分析してください
- 推測や一般的な内容を生成しないでください
- アクセスできない場合は「ACCESS_DENIED」と返してください

JSONで返してください：
{
  "actualUrl": "実際のURL（取得できた場合）",
  "h1": "実際のH1タグ内容",
  "h2Items": [
    {
      "text": "H2の内容",
      "h3Items": ["H3の内容1", "H3の内容2"]
    }
  ],
  "characterCount": 文字数,
  "accessStatus": "SUCCESS" または "ACCESS_DENIED"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON extraction failed');
    }
    
    const data = JSON.parse(jsonMatch[0]);
    
    // アクセス拒否の場合
    if (data.accessStatus === 'ACCESS_DENIED') {
      return {
        ...defaultResult,
        error: 'サイトへのアクセスが拒否されました'
      };
    }
    
    return {
      url: data.actualUrl || url,
      title: title,
      h1: data.h1 || title,
      h2Items: data.h2Items || [],
      characterCount: data.characterCount || 0,
      fetchSuccess: true
    };
    
  } catch (error: any) {
    console.error(`❌ Error fetching ${url}:`, error.message);
    return {
      ...defaultResult,
      error: error.message
    };
  }
}

// 複数のページを順番に取得（レート制限あり）
export async function fetchMultiplePages(
  pages: Array<{ url: string; title: string; rank: number }>,
  onProgress?: (current: number, total: number) => void
): Promise<PageAnalysis[]> {
  const results: PageAnalysis[] = [];
  
  // URLの重複を除去（URL_NOT_FOUNDは重複とみなさない）
  const seenUrls = new Set<string>();
  const uniquePages = pages.filter(page => {
    // URL_NOT_FOUNDの場合は重複チェックをスキップ
    if (page.url === 'URL_NOT_FOUND' || !page.url) {
      return true; // 常に処理対象とする
    }
    
    if (seenUrls.has(page.url)) {
      console.log(`⚠️ Skipping duplicate URL: ${page.url}`);
      return false;
    }
    seenUrls.add(page.url);
    return true;
  });
  
  console.log(`🚀 Starting to fetch ${uniquePages.length} unique pages (${pages.length - uniquePages.length} duplicates removed)`);
  console.log('📋 Strategy: 3 seconds between pages, 10 seconds break every 5 pages');
  
  for (let i = 0; i < uniquePages.length; i++) {
    const page = uniquePages[i];
    
    // 待機時間の処理
    if (i > 0) {
      // 5サイトごとに長めの休憩（10秒）
      if (i % 5 === 0) {
        console.log('☕ Taking a 10-second break after 5 sites...');
        await sleep(10000);
      } else {
        // 通常は3秒待つ
        console.log('⏳ Waiting 3 seconds before next request...');
        await sleep(3000);
      }
    }
    
    const analysis = await fetchAndAnalyzePage(
      page.url,
      page.title,
      page.rank
    );
    
    results.push(analysis);
    
    // 進捗表示
    console.log(`✅ Completed ${i + 1}/${uniquePages.length} pages`);
    
    // 進捗コールバック
    if (onProgress) {
      onProgress(i + 1, uniquePages.length);
    }
  }
  
  console.log('🎉 All pages fetched successfully!');
  
  // 元のpagesの順序で結果を返す
  // URL_NOT_FOUNDの場合は順序で対応させる
  let resultIndex = 0;
  return pages.map((page, pageIndex) => {
    // uniquePagesに含まれているかチェック
    const isUnique = uniquePages.some((up, upIndex) => 
      up.url === page.url && up.title === page.title && upIndex === resultIndex
    );
    
    if (isUnique && resultIndex < results.length) {
      const result = results[resultIndex];
      resultIndex++;
      return result;
    } else {
      // 重複URLの場合
      return {
        url: page.url,
        title: page.title,
        h1: page.title,
        h2Items: [],
        characterCount: 0,
        fetchSuccess: false,
        error: 'Duplicate URL - skipped'
      };
    }
  });
}