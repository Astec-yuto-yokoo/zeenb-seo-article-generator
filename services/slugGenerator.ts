import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY not set.");
}

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * 日本語キーワードを英語のslugに変換
 * 例: "仕事つらい" → "work-hard"
 *     "AI 研修" → "ai-training"
 */
export async function generateSlug(keyword: string): Promise<string> {
  try {
    console.log('🔄 Slug生成開始:', keyword);

    // Gemini 2.5 Flash-Lite（軽量・高速・低コスト）を使用
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.3, // 安定した翻訳のため低めに設定
        maxOutputTokens: 50, // slugは短いので50で十分
      }
    });

    const prompt = `
Convert the following Japanese keyword to an English URL slug.
Rules:
- Translate to simple, clear English
- Use lowercase only
- Replace spaces with hyphens
- Remove special characters
- Keep it short and SEO-friendly (2-4 words max)
- Output ONLY the slug, nothing else

Japanese keyword: "${keyword}"
English slug:`;

    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();

    // 安全のため、追加のクリーンアップ
    const slug = response
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // 英数字とハイフン以外を削除
      .replace(/\s+/g, '-') // スペースをハイフンに
      .replace(/-+/g, '-') // 連続するハイフンを1つに
      .replace(/^-|-$/g, ''); // 先頭と末尾のハイフンを削除

    console.log('✅ Slug生成完了:', slug);
    return slug;

  } catch (error) {
    console.error('❌ Slug生成エラー:', error);
    // フォールバック: キーワードをそのままローマ字化（簡易版）
    const fallbackSlug = keyword
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50); // 最大50文字

    console.log('⚠️ フォールバックslug使用:', fallbackSlug);
    return fallbackSlug || 'post';
  }
}