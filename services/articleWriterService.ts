// 記事執筆サービス
// 構成案から実際の記事本文を生成

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SeoOutline, CompetitorResearchResult, FrequencyWord, SubheadingWithNote } from '../types';

// Viteの環境変数を使用（フロントエンドで実行されるため）
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('GEMINI_API_KEY not found in environment variables');
    throw new Error("GEMINI_API_KEY not set. Please set VITE_GEMINI_API_KEY in .env file.");
}
const genAI = new GoogleGenerativeAI(apiKey);

// レギュレーション設定
export interface WritingRegulation {
  tone?: string; // 文体の指定
  prohibitedWords?: string[]; // 使用禁止ワード
  requiredPhrases?: string[]; // 必須フレーズ
  internalLinkBaseUrl?: string; // 内部リンクのベースURL
  enableInternalLinks?: boolean; // 内部リンク提案のON/OFF
  usePREP?: boolean; // PREP法の使用（デフォルト: true）
  includeSourceCitation?: boolean; // 出典元の明記（デフォルト: true）
  avoidRepetitiveEndings?: boolean; // 語尾の繰り返し禁止（デフォルト: true）
  onePointPerSentence?: boolean; // 一文一意の原則（デフォルト: true）
  enableAutoProofreading?: boolean; // 自動校閲と修正（デフォルト: true）
}

// セクションごとの文字数配分を計算
function calculateSectionWordCounts(outline: SeoOutline | any): Map<number, number> {
  // Ver.2の構成の場合、competitorComparisonから文字数を取得
  const totalWords = outline.characterCountAnalysis?.average || 
                     outline.competitorComparison?.recommendedCharCount ||
                     5000;
  const sections = outline.outline;
  const sectionCount = sections.length;
  
  // リード文は300-500文字程度（全体の2-3%、最大500文字）
  const introWords = Math.min(
    Math.max(300, Math.round(totalWords * 0.025)), 
    500
  );
  
  // まとめは全体の5-8%程度（最小400文字、最大1500文字）
  const conclusionWords = Math.min(
    Math.max(400, Math.round(totalWords * 0.06)),
    1500
  );
  
  // 残りを本文セクションに配分
  const remainingWords = totalWords - introWords - conclusionWords;
  
  const wordsPerSection = Math.round(remainingWords / sectionCount);
  
  const distribution = new Map<number, number>();
  sections.forEach((_, index) => {
    // まとめセクションは少なめに
    if (sections[index].heading.includes('まとめ')) {
      distribution.set(index, conclusionWords);
    } else {
      // H3の数に応じて調整（H3が多いセクションは多めに）
      const h3Count = sections[index].subheadings?.length || 0;
      const adjustedWords = wordsPerSection + (h3Count * 100);
      distribution.set(index, adjustedWords);
    }
  });
  
  return distribution;
}

// 頻出単語を文章に自然に組み込むための指示を生成
function createFrequencyWordInstruction(frequencyWords?: FrequencyWord[]): string {
  if (!frequencyWords || frequencyWords.length === 0) return '';
  
  const mustUseWords = frequencyWords
    .filter(w => w.articleCount >= 10)
    .map(w => w.word)
    .slice(0, 10);
  
  const shouldUseWords = frequencyWords
    .filter(w => w.articleCount >= 5 && w.articleCount < 10)
    .map(w => w.word)
    .slice(0, 15);
  
  return `
【重要キーワード】
必須（自然に複数回使用）: ${mustUseWords.join(', ')}
推奨（適切に配置）: ${shouldUseWords.join(', ')}
`;
}

// 記事本文を生成（推敲付き）
export async function generateArticle(
  outline: SeoOutline | any,  // Ver.2の構成も受け付ける
  keyword: string,
  regulation: WritingRegulation = {},
  enableProofreading: boolean = true  // 推敲機能を有効化
): Promise<{
  title: string;
  metaDescription: string;
  htmlContent: string;
  plainText: string;
  proofreadingInfo?: {
    adjustmentMade: boolean;
    charCountBefore: number;
    charCountAfter: number;
    diffPercent: number;
  };
}> {
  
  const sectionWordCounts = calculateSectionWordCounts(outline);
  const frequencyWordInstruction = createFrequencyWordInstruction(
    outline.competitorResearch?.frequencyWords || outline.competitorComparison?.frequencyWords
  );
  
  // レギュレーションの文字列化
  const regulationText = regulation.prohibitedWords?.length 
    ? `使用禁止ワード: ${regulation.prohibitedWords.join(', ')}\n` 
    : '';
  
  const internalLinkInstruction = regulation.enableInternalLinks && regulation.internalLinkBaseUrl
    ? `内部リンクを適切に配置（ベースURL: ${regulation.internalLinkBaseUrl}）`
    : '内部リンクは配置しない';
  
  // 目標文字数を明確に設定（Ver.2の場合も対応）
  const targetCharCount = outline.characterCountAnalysis?.average || 
                         outline.competitorComparison?.recommendedCharCount ||
                         5000;
  console.log('記事生成開始:', {
    keyword,
    targetCharCount,
    hasCompetitorResearch: !!(outline.competitorResearch || outline.competitorComparison),
    hasFrequencyWords: !!(outline.competitorResearch?.frequencyWords || outline.competitorComparison?.frequencyWords),
    sectionsCount: outline.outline?.length || 0,
    outlineType: outline.competitorComparison ? 'Ver.2' : 'Ver.1'
  });
  
  const prompt = `
あなたはSEOライターです。以下の構成案に基づいて、「${keyword}」についての記事本文を執筆してください。

【最重要指示】
1. 必ず合計${targetCharCount}文字程度の記事を執筆してください
2. 全てのセクションを省略せずに完全に記述してください
3. 「以下同様のフォーマットで記述」などの省略は禁止です
4. HTMLコメントや伝言は一切入れないでください

【ターゲット読者】
${outline.targetAudience}

【記事構成（必ずこの構成に従ってください）】
${outline.outline.map((section, index) => {
  let sectionText = `${section.heading}（目安: ${sectionWordCounts.get(index)}文字）\n`;
  
  // H3がある場合はH2直下の導入文について指示
  if (section.subheadings && section.subheadings.length > 0) {
    sectionText += `   📝 H2直下導入文: 100-200文字でセクション概要と価値を説明（他のH2と言い回しを変える）\n`;
    sectionText += section.subheadings.map(sub => {
      if (typeof sub === 'string') {
        return `   - ${sub}`;
      } else {
        const note = sub.writingNote ? `\n     ✍ H3執筆指示: ${sub.writingNote}` : '';
        return `   - ${sub.text}${note}`;
      }
    }).join('\n') + '\n';
  }
  
  if (section.writingNote) {
    sectionText += `   ✍ H2執筆指示: ${section.writingNote}\n`;
  }
  
  if (section.imageSuggestion) {
    sectionText += `   ※画像: ${section.imageSuggestion}\n`;
  }
  
  return sectionText;
}).join('\n')}

【導入文の方向性】
${outline.introduction || (outline.introductions?.conclusionFirst || outline.introductions?.empathy) || ''}

【まとめの方向性】
${outline.conclusion}

【必須キーワード】
${outline.keywords.join(', ')}

${frequencyWordInstruction}

【執筆ルール】
1. PREP法で論理的に構成するが、論の展開パターンを変えて単調にならないよう工夫する
   - ラベル付けは絶対禁止（「結論：」「理由：」「具体例：」など書かない）
   - 時には具体例から入る、問いかけから入るなど、バリエーションを持たせる
2. リード文では読者の悩みに寄り添い、具体的な解決策を提示
3. 一文一意の原則を厳守
   - 悪い例：「私はケーキを作って、それをあなたにあげた。」（2つの動作）
   - 良い例：「私はケーキを作った。それをあなたにあげた。」（1文1動作）
4. 同じ語尾の3回以上の繰り返しは禁止（です・ます・でしょう等）
5. 専門的な内容や数値情報には出典を明記
   - 形式：（出典：<a href="URL" target="_blank" rel="noopener">記事タイトル</a>）
6. 段落分けの基準：
   - 話題が変わるとき
   - 視点が変わるとき（総論→各論、メリット→デメリット等）
   - 時系列が変わるとき
   - 新しい<p>タグで区切る
7. H2直下には必ず導入文を配置（H3がある場合）
   - 100-200文字程度
   - そのセクションの概要と読者が得られる価値を説明
   - 各H2で言い回しのパターンを変える（「〜について解説します」を繰り返さない）

【WordPress用HTML形式】
1. WordPressの記事本文エリアにコピペできる形式
2. 使用可能タグ: h2, h3, p, strong, ul, ol, li, blockquote, a
3. 以下は絶対に使用禁止:
   - <!DOCTYPE>, <html>, <head>, <body>, <meta> タグ
   - <title>タグやその他のheadタグ
   - <article>, <section>, <h1> タグ
   - <!-- --> コメント
   - タグの前のスペースやインデント
   - imgタグ
   - h2タイトルの番号（例: 1. 2. 3.）
   - コードブロック記法（バッククォート3つ）
4. 必ず全てのセクションを完全に記述（省略禁止）
5. 各セクションの文字数目安を守る
6. 具体的で実用的な内容を詳細に記述
7. 頻出単語（競合記事で共通して使われている重要キーワード）を自然に配置
${regulationText}

【出力形式】
以下のJSON形式で出力してください。改行は\\nで表現してください：
{
  "title": "記事タイトル（titleタグは不要、テキストのみ）",
  "metaDescription": "メタディスクリプション（120-160文字、metaタグは不要、テキストのみ）",
  "htmlContent": "<p>リード文...</p>\\n\\n<h2>見出し1</h2>\\n<p>本文...</p>\\n（記事本文のみ、DOCTYPE/html/head/bodyタグは絶対に含めない）"
}

重要: 
- htmlContentには記事本文のHTMLタグのみ（p, h2, h3, ul等）
- DOCTYPE, html, head, body, meta, titleタグは絶対に含めない
- 必ず${targetCharCount}文字分の完全な本文を含める
`;

  try {
    // 目標文字数に応じてトークン数を動的に調整
    // 日本語の場合: 1文字 ≈ 0.5-1トークン
    // HTMLタグとJSON構造のオーバーヘッドを考慮して3倍のマージンを設定
    const requiredTokens = Math.min(
      Math.ceil(targetCharCount * 3),
      128000 // Gemini 1.5 Flashの最大トークン数
    );
    console.log(`目標文字数: ${targetCharCount}文字 → 設定トークン数: ${requiredTokens}`);
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.5, // 創造性と正確性のバランスを改善
        maxOutputTokens: requiredTokens,
      }
    });

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // JSONを抽出
    console.log('Geminiからの応答:', response.substring(0, 500) + '...');
    
    // JSONを抽出（最初と最後の{}を探す）
    const jsonStart = response.indexOf('{');
    const jsonEnd = response.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('JSON抽出失敗。応答全体:', response);
      throw new Error('Failed to extract JSON from response. Response may be truncated or malformed.');
    }
    
    const jsonStr = response.substring(jsonStart, jsonEnd + 1);
    
    // JSONパース前にエスケープされていない改行を処理
    let cleanedJsonStr = jsonStr;
    
    // htmlContent内の改行を適切にエスケープ
    cleanedJsonStr = cleanedJsonStr.replace(/"htmlContent":\s*"([^"]*(?:\\.[^"]*)*)"/g, (match, content) => {
      // すでにエスケープされている\\nはそのまま、エスケープされていない改行は\\nに変換
      const escaped = content.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
      return `"htmlContent": "${escaped}"`;
    });
    
    let articleData;
    try {
      articleData = JSON.parse(cleanedJsonStr);
    } catch (parseError) {
      console.error('JSONパースエラー:', parseError);
      console.error('パース対象JSON:', cleanedJsonStr.substring(0, 1000) + '...');
      throw new Error('Failed to parse JSON response. The response may be malformed.');
    }
      console.log('JSONパース成功');
      console.log('生成された記事の文字数:', articleData.htmlContent?.length || 0);
    
    // 記事の完成度をチェックして、必要なら続きを生成
    const truncationCheck = checkContentTruncation(
      articleData.htmlContent,
      targetCharCount,
      outline
    );
    
    let finalHtmlContent = articleData.htmlContent;
    
    if (truncationCheck.isTruncated) {
      console.log('⚠️ 記事が途切れています。続きを生成します...');
      console.log(`完成度: ${truncationCheck.completionRate}%`);
      console.log(`不足セクション: ${truncationCheck.missingSections.join(', ')}`);
      
      // 続きを生成
      const continuation = await generateContinuation(
        articleData,
        truncationCheck,
        outline,
        keyword,
        targetCharCount,
        regulation
      );
      
      if (continuation) {
        finalHtmlContent = continuation.combinedHtml;
        console.log('✅ 続きの生成が完了しました');
      }
    }
    
    // 念のため、不要なHTMLタグを除去
    if (finalHtmlContent.includes('<!DOCTYPE') || finalHtmlContent.includes('<html') || finalHtmlContent.includes('<head')) {
      console.warn('警告: 不要なHTMLタグが検出されました。除去します。');
      // <body>タグ内のコンテンツのみを抽出
      const bodyMatch = finalHtmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        finalHtmlContent = bodyMatch[1];
      }
      // それでも残っているheadタグなどを除去
      finalHtmlContent = finalHtmlContent.replace(/<!DOCTYPE[^>]*>/gi, '');
      finalHtmlContent = finalHtmlContent.replace(/<html[^>]*>|<\/html>/gi, '');
      finalHtmlContent = finalHtmlContent.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
      finalHtmlContent = finalHtmlContent.replace(/<body[^>]*>|<\/body>/gi, '');
      finalHtmlContent = finalHtmlContent.replace(/<meta[^>]*>/gi, '');
      finalHtmlContent = finalHtmlContent.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
      finalHtmlContent = finalHtmlContent.trim();
    }
    let proofreadingInfo = undefined;
    
    // 推敲と文字数調整
    if (enableProofreading) {
      const charCountBefore = articleData.htmlContent.replace(/<[^>]*>/g, '').length;
      const proofreadResult = await proofreadAndAdjust(
        articleData.htmlContent,
        targetCharCount,
        keyword,
        outline
      );
      
      if (proofreadResult.adjustmentMade) {
        finalHtmlContent = proofreadResult.adjustedHtml;
        const charCountAfter = finalHtmlContent.replace(/<[^>]*>/g, '').length;
        proofreadingInfo = {
          adjustmentMade: true,
          charCountBefore,
          charCountAfter,
          diffPercent: Math.abs((charCountAfter - targetCharCount) / targetCharCount * 100)
        };
        console.log(`推敲完了: ${charCountBefore}文字 → ${charCountAfter}文字`);
      } else {
        proofreadingInfo = {
          adjustmentMade: false,
          charCountBefore,
          charCountAfter: charCountBefore,
          diffPercent: Math.abs((charCountBefore - targetCharCount) / targetCharCount * 100)
        };
      }
    }
    
    // プレーンテキスト版も生成
    const plainText = finalHtmlContent
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    
    return {
      title: articleData.title,
      metaDescription: articleData.metaDescription,
      htmlContent: finalHtmlContent,
      plainText: plainText,
      proofreadingInfo
    };
    
  } catch (error) {
    console.error('記事生成エラー:', error);
    throw error;
  }
}

// 記事の推敲と文字数調整
export async function proofreadAndAdjust(
  articleHtml: string,
  targetCharCount: number,
  keyword: string,
  outline: SeoOutline
): Promise<{
  adjustedHtml: string;
  charCountDiff: number;
  adjustmentMade: boolean;
}> {
  const currentCharCount = articleHtml.replace(/<[^>]*>/g, '').length;
  const diffPercent = Math.abs((currentCharCount - targetCharCount) / targetCharCount * 100);
  
  console.log(`推敲前文字数: ${currentCharCount}, 目標: ${targetCharCount}, 差: ${diffPercent.toFixed(1)}%`);
  
  // 10%以内なら調整不要
  if (diffPercent <= 10) {
    return {
      adjustedHtml: articleHtml,
      charCountDiff: currentCharCount - targetCharCount,
      adjustmentMade: false
    };
  }
  
  // 10%以上の乖離があれば調整
  const adjustmentType = currentCharCount < targetCharCount ? '追加' : '削減';
  const adjustmentAmount = Math.abs(currentCharCount - targetCharCount);
  
  const prompt = `
以下の記事を推敲し、文字数を調整してください。

【調整内容】
- 現在の文字数: ${currentCharCount}文字
- 目標文字数: ${targetCharCount}文字
- 必要な調整: ${adjustmentAmount}文字を${adjustmentType}

【キーワード】
${keyword}

【推敲のポイント】
1. 文字数調整（${adjustmentType}）を最優先
2. PREP法の構成を維持
3. 一文一意の原則を守る
4. 同じ語尾の3回以上の繰り返しを避ける
5. 読みやすさと論理性を保つ
6. 重要な情報は削除しない
${adjustmentType === '追加' ? '7. 具体例や説明を充実させる' : '7. 冗長な表現を簡潔にする'}

【現在の記事】
${articleHtml}

【出力形式】
HTMLタグのみを直接出力してください。
- コードブロック記法（\`\`\`html\`\`\`）は絶対に使用しない
- バッククォート3つ（\`\`\`）は禁止
- 説明やコメントは一切不要
- HTMLタグだけを直接出力（WordPressに直接貼り付け可能な形式）
`;
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.3, // 推敲なので低めの温度
        maxOutputTokens: Math.ceil(targetCharCount * 3), // HTMLタグを考慮して3倍に増加
      }
    });

    const result = await model.generateContent(prompt);
    let adjustedHtml = result.response.text();
    
    // Markdownのコードブロック記法を完全に除去（WordPress投稿用）
    adjustedHtml = adjustedHtml.replace(/^```html?\s*\n?/gim, '');
    adjustedHtml = adjustedHtml.replace(/\n?```\s*$/gim, '');
    adjustedHtml = adjustedHtml.replace(/```html?/gi, '');
    adjustedHtml = adjustedHtml.replace(/```/g, '');
    adjustedHtml = adjustedHtml.trim();
    
    const newCharCount = adjustedHtml.replace(/<[^>]*>/g, '').length;
    console.log(`推敲後文字数: ${newCharCount}`);
    
    return {
      adjustedHtml: adjustedHtml,
      charCountDiff: newCharCount - targetCharCount,
      adjustmentMade: true
    };
    
  } catch (error) {
    console.error('推敲エラー:', error);
    // エラー時は元の記事を返す
    return {
      adjustedHtml: articleHtml,
      charCountDiff: currentCharCount - targetCharCount,
      adjustmentMade: false
    };
  }
}

// コンテンツが途切れているかチェック
function checkContentTruncation(
  htmlContent: string,
  targetCharCount: number,
  outline: SeoOutline
): {
  isTruncated: boolean;
  completionRate: number;
  missingSections: string[];
  lastCompleteSection?: string;
} {
  // 実際の文字数を計算
  const actualCharCount = htmlContent.replace(/<[^>]*>/g, '').length;
  const completionRate = Math.round((actualCharCount / targetCharCount) * 100);
  
  // 予定されていたセクションを取得
  const expectedSections = outline.outline.map(s => s.heading);
  
  // 実際に生成されたH2見出しを取得
  const h2Matches = htmlContent.match(/<h2[^>]*>([^<]+)<\/h2>/g) || [];
  const generatedSections = h2Matches.map(h2 => 
    h2.replace(/<h2[^>]*>|<\/h2>/g, '').trim()
  );
  
  // 不足しているセクションを特定
  const missingSections = expectedSections.filter(
    section => !generatedSections.some(generated => 
      generated.includes(section.replace(/[【】]/g, ''))
    )
  );
  
  // 最後の完成したセクションを特定
  let lastCompleteSection: string | undefined;
  if (generatedSections.length > 0) {
    lastCompleteSection = generatedSections[generatedSections.length - 1];
  }
  
  // 文末が不自然かチェック
  const endsIncomplete = /[^。！？」】）\s]$/.test(htmlContent.trim());
  
  // 途切れ判定
  const isTruncated = 
    completionRate < 70 || // 目標の70%未満
    missingSections.length > expectedSections.length * 0.3 || // 30%以上のセクションが不足
    endsIncomplete; // 文末が不自然
  
  return {
    isTruncated,
    completionRate,
    missingSections,
    lastCompleteSection
  };
}

// 続きを生成
async function generateContinuation(
  firstPart: any,
  truncationInfo: any,
  outline: SeoOutline,
  keyword: string,
  targetCharCount: number,
  regulation: WritingRegulation
): Promise<{ combinedHtml: string } | null> {
  try {
    // 不足しているセクションの構成を取得
    const missingSectionsData = outline.outline.filter(section =>
      truncationInfo.missingSections.includes(section.heading)
    );
    
    if (missingSectionsData.length === 0) {
      return null;
    }
    
    // 既に生成された内容から文脈を抽出
    const context = extractWritingContext(firstPart.htmlContent);
    
    // 最後の段落を取得（スムーズな接続のため）
    const lastParagraphMatch = firstPart.htmlContent.match(/<p>([^<]+)<\/p>(?!.*<p>)/s);
    const lastParagraph = lastParagraphMatch ? lastParagraphMatch[1] : '';
    
    // 残りの目標文字数を計算
    const currentCharCount = firstPart.htmlContent.replace(/<[^>]*>/g, '').length;
    const remainingCharCount = targetCharCount - currentCharCount;
    
    const continuationPrompt = `
あなたはSEOライターです。以下の記事の続きを執筆してください。

【これまでに書いた内容の要約】
- キーワード: ${keyword}
- 扱った見出し: ${context.coveredSections.join(', ')}
- 文体: ${context.writingStyle}
- 使用した主要な例: ${context.mainExamples.slice(0, 3).join(', ')}

【前の文章の最後】
${lastParagraph}

【これから書くセクション】
${missingSectionsData.map((section, index) => {
  const wordCount = Math.floor(remainingCharCount / missingSectionsData.length);
  let sectionText = `${section.heading}（目安: ${wordCount}文字）\n`;
  
  if (section.subheadings && section.subheadings.length > 0) {
    sectionText += section.subheadings.map(sub => {
      if (typeof sub === 'string') {
        return `   - ${sub}`;
      } else {
        const note = sub.writingNote ? `\n     ✍ H3執筆指示: ${sub.writingNote}` : '';
        return `   - ${sub.text}${note}`;
      }
    }).join('\n') + '\n';
  }
  
  if (section.writingNote) {
    sectionText += `   ✍ H2執筆指示: ${section.writingNote}\n`;
  }
  
  return sectionText;
}).join('\n')}

【目標文字数】
約${remainingCharCount}文字

【重要な指示】
1. 前の文章から自然に続くように書く
2. 同じ文体・トーンを維持する
3. 既に触れた内容の重複は避ける
4. 全てのセクションを省略せずに記述
5. WordPressの記事本文用HTML形式で出力

【出力形式】
HTMLタグのみを直接出力してください。
- コードブロック記法（\`\`\`html\`\`\`）は絶対に使用しない
- JSONやコメントは不要です。
`;

    // トークン数を計算
    const requiredTokens = Math.min(
      Math.ceil(remainingCharCount * 3),
      128000
    );
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.5, // 創造性と正確性のバランスを改善
        maxOutputTokens: requiredTokens,
      }
    });

    const result = await model.generateContent(continuationPrompt);
    let continuationHtml = result.response.text();
    
    // 不要なタグを除去
    continuationHtml = continuationHtml.replace(/<!DOCTYPE[^>]*>/gi, '');
    continuationHtml = continuationHtml.replace(/<html[^>]*>|<\/html>/gi, '');
    continuationHtml = continuationHtml.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    continuationHtml = continuationHtml.replace(/<body[^>]*>|<\/body>/gi, '');
    continuationHtml = continuationHtml.replace(/<meta[^>]*>/gi, '');
    continuationHtml = continuationHtml.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
    continuationHtml = continuationHtml.trim();
    
    // 前半と後半を結合
    const combinedHtml = firstPart.htmlContent + '\n\n' + continuationHtml;
    
    console.log(`続き生成完了: ${remainingCharCount}文字追加`);
    
    return {
      combinedHtml
    };
    
  } catch (error) {
    console.error('続き生成エラー:', error);
    return null;
  }
}

// 文脈を抽出
function extractWritingContext(htmlContent: string): {
  writingStyle: string;
  coveredSections: string[];
  mainExamples: string[];
} {
  // 文体を判定
  const writingStyle = htmlContent.includes('です。') || htmlContent.includes('ます。') 
    ? 'です・ます調'
    : 'である調';
  
  // カバーされたセクションを抽出
  const h2Matches = htmlContent.match(/<h2[^>]*>([^<]+)<\/h2>/g) || [];
  const coveredSections = h2Matches.map(h2 => 
    h2.replace(/<h2[^>]*>|<\/h2>/g, '').trim()
  );
  
  // 使用された例を抽出（「例えば」「具体的には」などの後の文）
  const exampleMatches = htmlContent.match(/(?:例えば|具体的には|たとえば)([^。]+。)/g) || [];
  const mainExamples = exampleMatches.map(ex => 
    ex.replace(/(?:例えば|具体的には|たとえば)/, '').trim()
  ).slice(0, 5);
  
  return {
    writingStyle,
    coveredSections,
    mainExamples
  };
}

// 特定セクションのみ再生成
export async function regenerateSection(
  sectionHeading: string,
  sectionSubheadings: (string | SubheadingWithNote)[],
  targetWordCount: number,
  context: {
    keyword: string;
    targetAudience: string;
    frequencyWords?: FrequencyWord[];
    regulation?: WritingRegulation;
    writingNote?: string; // 執筆メモを追加
  }
): Promise<string> {
  
  const frequencyWordInstruction = createFrequencyWordInstruction(context.frequencyWords);
  
  const prompt = `
「${context.keyword}」についての記事の一部を執筆してください。

【セクション】
${sectionHeading}
${sectionSubheadings.map(sub => {
  if (typeof sub === 'string') {
    return `- ${sub}`;
  } else {
    const note = sub.writingNote ? `\n  ✍ H3執筆指示: ${sub.writingNote}` : '';
    return `- ${sub.text}${note}`;
  }
}).join('\n')}
${context.writingNote ? `\n【H2執筆指示】\n${context.writingNote}` : ''}

【文字数】
${targetWordCount}文字程度

【ターゲット読者】
${context.targetAudience}

${frequencyWordInstruction}

【執筆ルール】
1. HTML形式で出力（h2, h3, p, strong, ul, li タグを使用）
2. 見出しから始める
3. 自然で読みやすい文章
4. SEOに最適化

セクションのHTMLのみを出力してください。
`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.5, // 創造性と正確性のバランスを改善
        maxOutputTokens: Math.max(4096, Math.ceil(targetWordCount * 3)), // 動的に調整、最小4096
      }
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
    
  } catch (error) {
    console.error('セクション再生成エラー:', error);
    throw error;
  }
}