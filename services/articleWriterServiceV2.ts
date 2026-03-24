// 記事執筆サービス Ver.2 - 新レギュレーション対応版
// 指示タグシステム、厳密な文字数管理、構造化されたセクション構成を実装

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SeoOutline, FrequencyWord } from '../types';
import type { WritingRegulation } from './articleWriterService';
import { getCompanyInfo, generateCompanyContext } from './companyService';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set.");
}
const genAI = new GoogleGenerativeAI(apiKey);

// Ver.2用の拡張レギュレーション
export interface WritingRegulationV2 extends WritingRegulation {
  enableInstructionTags?: boolean; // 指示タグを有効にするか
  strictBulletPoints?: boolean; // 箇条書き制限を適用するか
  useLeadTemplate?: boolean; // リード文テンプレートを使用するか
  addSectionSummary?: boolean; // 各H2末尾に要点まとめを追加するか
}

// 指示タグの種類
export interface InstructionTags {
  searchIntent?: string; // [[検索意図: ～]]
  imgSuggestions?: string[]; // [[IMG提案: ～]]
  tableSuggestions?: string[]; // [[表提案: ～]]
  primaryInfoPoints?: string[]; // [[一次情報ポイント: ～]]
  termBoxes?: { term: string; definition: string }[]; // [[用語ボックス: 用語=定義]]
  cautions?: string[]; // [[注意: ～]]
}

// セクションの重み付け設定
const SECTION_WEIGHTS: Record<string, number> = {
  '定義': 0.08,
  '基本': 0.08,
  '種類': 0.08,
  'メリット': 0.06,
  'デメリット': 0.06,
  'E-E-A-T': 0.08,
  '内部対策': 0.12,
  'コンテンツ': 0.12,
  '外部対策': 0.10,
  'ツール': 0.06,
  'トレンド': 0.08,
  '避ける': 0.06,
  '費用': 0.06,
  '事例': 0.10,
  'まとめ': 0.01
};

// 文字数から指示タグを除外してカウント
export function countCharactersExcludingTags(text: string): number {
  // [[...]]形式のタグを除外
  const withoutTags = text.replace(/\[\[.*?\]\]/g, '');
  // HTMLタグも除外
  const withoutHtml = withoutTags.replace(/<[^>]*>/g, '');
  return withoutHtml.length;
}

// セクションごとの文字数配分を計算
function calculateSectionDistribution(
  outline: SeoOutline,
  totalCharCount: number
): Map<string, number> {
  const distribution = new Map<string, number>();
  
  // リード文とまとめの文字数
  const leadCharCount = Math.min(500, Math.round(totalCharCount * 0.03));
  const conclusionCharCount = Math.min(300, Math.round(totalCharCount * 0.01));
  
  distribution.set('lead', leadCharCount);
  distribution.set('conclusion', conclusionCharCount);
  
  // 本文用の文字数
  const bodyCharCount = totalCharCount - leadCharCount - conclusionCharCount;
  
  // 各セクションに重み付けで配分
  outline.outline.forEach((section, index) => {
    // セクション名から重みを判定
    let weight = 0.08; // デフォルト
    for (const [key, value] of Object.entries(SECTION_WEIGHTS)) {
      if (section.heading.includes(key)) {
        weight = value;
        break;
      }
    }
    
    const sectionCharCount = Math.round(bodyCharCount * weight);
    distribution.set(`section_${index}`, sectionCharCount);
  });
  
  return distribution;
}

// リード文をテンプレートで生成
async function generateLeadWithTemplate(
  keyword: string,
  outline: SeoOutline,
  targetCharCount: number
): Promise<string> {
  const prompt = `
「${keyword}」についての記事のリード文を、以下のテンプレートに従って執筆してください。

【テンプレート構成】
1. 疑問形で始める（読者の代表的な疑問・誤解）
2. 共感を示す
3. ベネフィット（得られること2点）を提示
4. 本文予告（最初のH2への誘導）

【要件】
- ${targetCharCount}文字（300-500字の範囲内）
- 主キーワード「${keyword}」を冒頭100字以内に必ず含める
- です・ます調

【ターゲット読者】
${outline.targetAudience}

【記事概要】
${outline.introduction}

HTMLのpタグで出力してください。
`;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.5, // 創造性と正確性のバランスを改善
        maxOutputTokens: 1000,
      }
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('リード文生成エラー:', error);
    return `<p>${keyword}について解説します。</p>`;
  }
}

// 箇条書きを名詞・短句に制限
function formatBulletPoints(items: string[]): string[] {
  return items.map(item => {
    // 長い文章を短縮
    if (item.length > 16) {
      // 最初の名詞句を抽出
      const match = item.match(/^([^、。！？]+)/);
      if (match) {
        return match[1].substring(0, 16);
      }
    }
    return item;
  });
}

// セクション末尾の要点まとめを生成
function generateSectionSummary(sectionContent: string, heading: string): string {
  // セクションの要点を3つ抽出（仮実装）
  const summary = `
<p><strong>この章の要点</strong></p>
<ul>
  <li>${heading.substring(0, 14)}</li>
  <li>実践ポイント</li>
  <li>注意事項</li>
</ul>`;
  
  return summary;
}

// 指示タグをHTMLコメントとして挿入
function insertInstructionTags(content: string, tags: InstructionTags): string {
  let result = content;
  
  if (tags.searchIntent) {
    result = `<!-- [[検索意図: ${tags.searchIntent}]] -->\n${result}`;
  }
  
  // 画像提案をランダムな位置に挿入
  if (tags.imgSuggestions) {
    tags.imgSuggestions.forEach(suggestion => {
      result += `\n<!-- [[IMG提案: ${suggestion}]] -->`;
    });
  }
  
  return result;
}

// Ver.2メイン生成関数
export async function generateArticleV2(
  outline: SeoOutline,
  keyword: string,
  regulation: WritingRegulationV2 = {}
): Promise<{
  title: string;
  metaDescription: string;
  htmlContent: string;
  plainText: string;
  characterCount: number; // 指示タグを除外した文字数
}> {
  const targetCharCount = outline.characterCountAnalysis?.average || 30000;
  const charDistribution = calculateSectionDistribution(outline, targetCharCount);
  
  console.log('📝 Ver.2記事生成開始:', {
    keyword,
    targetCharCount,
    enableInstructionTags: regulation.enableInstructionTags,
    useLeadTemplate: regulation.useLeadTemplate
  });
  
  // タイトルとメタディスクリプション
  const title = `【2025年最新】${keyword}完全ガイド｜初心者にもわかりやすく解説`;
  const metaDescription = `${keyword}について、基本から実践まで徹底解説。${outline.outline[0].heading}など、初心者にも分かりやすく説明します。`;
  
  let htmlContent = '';
  
  // [toc]タグを挿入
  htmlContent += '[toc]\n\n';
  
  // リード文生成
  const leadCharCount = charDistribution.get('lead') || 400;
  let leadContent = '';
  
  if (regulation.useLeadTemplate) {
    leadContent = await generateLeadWithTemplate(keyword, outline, leadCharCount);
  } else {
    // 従来の生成方法
    leadContent = `<p>${keyword}について解説します。</p>`;
  }
  
  htmlContent += leadContent + '\n\n';
  
  // 各セクションを生成
  for (let i = 0; i < outline.outline.length; i++) {
    const section = outline.outline[i];
    const sectionCharCount = charDistribution.get(`section_${i}`) || 2000;
    
    // サービス訴求セクションかチェック（自社サービス名を環境変数から取得）
    const serviceName = import.meta.env.VITE_SERVICE_NAME || '当社サービス';
    const isServiceSection = section.heading.includes(serviceName) || section.heading.includes('サービス訴求');

    // セクション生成プロンプト
    let sectionPrompt = '';

    if (isServiceSection) {
      // サービス訴求セクション用の特別なプロンプト
      const companyInfo = getCompanyInfo();
      sectionPrompt = `
「${keyword}」に関する記事のサービス訴求セクションを執筆してください。

【セクション】
${section.heading}

【サブセクション】
${section.subheadings?.join('\n') || 'なし'}

【目標文字数】
${sectionCharCount}文字

【サービス情報】
- サービス名: ${companyInfo.company.service_name || serviceName}
- 会社名: ${companyInfo.company.name || ''}
- 対象: 法人向けサービス

【導入事例】（業種名で記載、社名は出さない）
${companyInfo.case_studies.map(cs => {
  const industry = cs.industry || '企業';
  return `- ${industry}: ${cs.result}`;
}).join('\n')}

【執筆ルール】
- です・ます調
- 1文60字以内
- 検索意図「${keyword}」に自然につながる内容
- 具体的な料金は記載しない
- 無料相談への誘導にフォーカス
- 企業名は出さず、業種名で記載（例：広告代理店様、メディア運営企業様）
- 成果の数値は含めてOK

HTML形式で出力してください（h2, h3, p, ul, li タグを使用）。
`;
    } else {
      // 通常セクションのプロンプト
      sectionPrompt = `
「${keyword}」に関する記事の以下のセクションを執筆してください。

【セクション】
${section.heading}

【サブセクション】
${section.subheadings?.join('\n') || 'なし'}

【目標文字数】
${sectionCharCount}文字

【執筆ルール】
- です・ます調
- 1文60字以内
- 1段落2-3文
- 段落間に空行
${regulation.strictBulletPoints ? '- 箇条書きは名詞・短句のみ（12-16字）、3-5点まで' : ''}
${regulation.enableInstructionTags ? '- 適切な箇所に[[IMG提案]]や[[用語ボックス]]を提案' : ''}

【頻出語を含める】
${outline.competitorResearch?.frequencyWords?.slice(0, 10).map(w => w.word).join(', ') || 'なし'}

HTML形式で出力してください（h2, h3, p, ul, li タグを使用）。
`;
    }

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.5, // 創造性と正確性のバランスを改善
          maxOutputTokens: Math.ceil(sectionCharCount * 2),
        }
      });

      const result = await model.generateContent(sectionPrompt);
      let sectionHtml = result.response.text();
      
      // 箇条書きの制限を適用
      if (regulation.strictBulletPoints) {
        // 長い箇条書きを短縮する処理（簡易実装）
        sectionHtml = sectionHtml.replace(/<li>([^<]{17,})<\/li>/g, (match, content) => {
          return `<li>${content.substring(0, 16)}</li>`;
        });
      }
      
      // セクション末尾に要点まとめを追加
      if (regulation.addSectionSummary && !section.heading.includes('まとめ')) {
        sectionHtml += generateSectionSummary(sectionHtml, section.heading);
      }
      
      // 指示タグを挿入
      if (regulation.enableInstructionTags) {
        const tags: InstructionTags = {
          imgSuggestions: [`${section.heading}の説明図`],
          primaryInfoPoints: ['ここに独自データを追加']
        };
        sectionHtml = insertInstructionTags(sectionHtml, tags);
      }
      
      htmlContent += sectionHtml + '\n\n';
      
    } catch (error) {
      console.error(`セクション生成エラー (${section.heading}):`, error);
      htmlContent += `<h2>${section.heading}</h2>\n<p>このセクションの生成に失敗しました。</p>\n\n`;
    }
  }
  
  // まとめセクション
  const conclusionCharCount = charDistribution.get('conclusion') || 300;
  const conclusionPrompt = `
「${keyword}」についての記事のまとめを執筆してください。

【文字数】
${conclusionCharCount}文字

【構成】
- 要点を3つの箇条書きでまとめる
- 次のアクションを提示
- CTAは不要

HTML形式で出力してください。
`;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.5, // 創造性と正確性のバランスを改善
        maxOutputTokens: 1000,
      }
    });

    const result = await model.generateContent(conclusionPrompt);
    htmlContent += result.response.text();
    
  } catch (error) {
    console.error('まとめ生成エラー:', error);
    htmlContent += '<h2>まとめ</h2>\n<p>本記事では' + keyword + 'について解説しました。</p>';
  }

  // <b>タグを<strong>タグに変換
  htmlContent = htmlContent
    .replace(/<b>/gi, "<strong>")
    .replace(/<\/b>/gi, "</strong>");

  // プレーンテキスト版と文字数カウント
  const plainText = htmlContent
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  
  const characterCount = countCharactersExcludingTags(htmlContent);
  
  console.log(`✅ Ver.2記事生成完了: ${characterCount}文字 / 目標${targetCharCount}文字`);
  
  return {
    title,
    metaDescription,
    htmlContent,
    plainText,
    characterCount
  };
}