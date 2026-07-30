import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  CompetitorResearchResult,
  GroundingChunk,
  StrategicKeyword,
  StrategicKeywordList,
  TrendKeyword,
  TrendKeywordList,
} from "../types";

const apiKey =
  import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey || apiKey === "" || apiKey === "undefined") {
  console.warn("[strategicKeywordService] GEMINI_API_KEY が未設定です");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

// このツールが対象とする記事ドメイン（既定: 戸建て住宅の外壁塗装・屋根塗装）。
// テーマに対象領域が無い場合、この領域に自動で絞り込むために使う。
const KEYWORD_DOMAIN =
  import.meta.env.VITE_KEYWORD_DOMAIN || "戸建て住宅の外壁塗装・屋根塗装";

/**
 * Geminiのレスポンス文字列からJSON部分を抽出してクリーニングする。
 * writingAgentV3 系と同じ方針（コードフェンス除去・末尾カンマ除去）。
 */
function cleanJsonString(str: string): string {
  // 文字列リテラルを一時トークン化してコメント記号を保護
  const stringTokens: string[] = [];
  let tokenIndex = 0;
  str = str.replace(/"([^"\\]|\\.)*"/g, (match) => {
    // 文字列リテラル内の生の制御文字（改行・タブ等）は無効なJSONになるため空白へ置換
    const sanitized = match.replace(/[\u0000-\u001F]/g, " ");
    const token = `__STRING_${tokenIndex}__`;
    stringTokens[tokenIndex] = sanitized;
    tokenIndex++;
    return token;
  });
  // コメント除去
  str = str.replace(/\/\*[\s\S]*?\*\//g, "");
  str = str.replace(/\/\/.*$/gm, "");
  // 文字列を復元
  stringTokens.forEach((s, index) => {
    str = str.replace(`__STRING_${index}__`, s);
  });
  // 末尾カンマ除去
  str = str.replace(/,(\s*[}\]])/g, "$1");
  return str.trim();
}

/**
 * 競合調査結果から、プロンプトに渡すコンテキスト文字列を構築する。
 */
function buildCompetitorContext(
  research: CompetitorResearchResult | null | undefined
): string {
  if (!research) {
    return "（競合調査データなし。メインキーワードから推定してください）";
  }

  const lines: string[] = [];

  // 上位記事のタイトル・見出し
  const validArticles =
    research.validArticles && Array.isArray(research.validArticles)
      ? research.validArticles
      : [];
  if (validArticles.length > 0) {
    lines.push("【上位競合記事のタイトルと見出し】");
    validArticles.slice(0, 8).forEach((article) => {
      lines.push(`- ${article.rank}位: ${article.title}`);
      const h2Items =
        article.headingStructure && article.headingStructure.h2Items
          ? article.headingStructure.h2Items
          : [];
      const h2Texts = h2Items
        .slice(0, 6)
        .map((h2) => h2.text)
        .join(" / ");
      if (h2Texts) {
        lines.push(`  H2: ${h2Texts}`);
      }
    });
  }

  // 頻出単語
  const freqWords =
    research.frequencyWords && Array.isArray(research.frequencyWords)
      ? research.frequencyWords
      : [];
  if (freqWords.length > 0) {
    lines.push("");
    lines.push("【競合記事の頻出単語TOP20】");
    lines.push(
      freqWords
        .slice(0, 20)
        .map((w) => `${w.word}(${w.count}回)`)
        .join("、")
    );
  }

  // 共通トピック
  const commonTopics =
    research.commonTopics && Array.isArray(research.commonTopics)
      ? research.commonTopics
      : [];
  if (commonTopics.length > 0) {
    lines.push("");
    lines.push("【競合の共通トピック】");
    lines.push(commonTopics.join("、"));
  }

  return lines.join("\n");
}

/**
 * 自社ブランド情報をプロンプト用に構築する（環境変数から）。
 */
function buildOwnCompanyContext(): string {
  const serviceName =
    import.meta.env.VITE_SERVICE_NAME || "当社サービス";
  const companyName =
    import.meta.env.VITE_COMPANY_NAME || "当社";
  const siteUrl = import.meta.env.VITE_COMPANY_SITE_URL || "";
  const mediaUrl = import.meta.env.VITE_COMPANY_MEDIA_URL || "";

  const lines: string[] = [];
  lines.push(`サービス名: ${serviceName}`);
  lines.push(`会社名: ${companyName}`);
  if (siteUrl) {
    lines.push(`自社サイト: ${siteUrl}`);
  }
  if (mediaUrl) {
    lines.push(`自社メディア: ${mediaUrl}`);
  }
  return lines.join("\n");
}

const JSON_SCHEMA_HINT = `
{
  "competitorKeywords": [
    {
      "keyword": "キーワード（複合語・ロングテール可）",
      "intent": "インフォメーショナル | コマーシャル | トランザクショナル | ナビゲーショナル のいずれか",
      "priority": "高 | 中 | 低 のいずれか",
      "reason": "なぜ狙うべきか（80字以内）",
      "suggestedH2": "そのKWで書く記事の切り口・H2案（1行）"
    }
  ],
  "ownKeywords": [ /* 同じ構造 */ ],
  "marketKeywords": [ /* 同じ構造 */ ]
}`;

/**
 * 戦略的キーワードリストを3観点（競合・自社・市場環境）で生成する。
 *
 * - 起点: 既存の競合調査結果を再利用
 * - 市場環境観点: Google検索グラウンディングで最新トレンドを反映
 * - 各KWに検索意図・優先度・推奨理由・想定H2を付与
 */
export async function generateStrategicKeywords(
  keyword: string,
  competitorResearch: CompetitorResearchResult | null | undefined,
  options?: { useGrounding?: boolean }
): Promise<StrategicKeywordList> {
  const useGrounding =
    options && typeof options.useGrounding === "boolean"
      ? options.useGrounding
      : true;

  const competitorContext = buildCompetitorContext(competitorResearch);
  const ownContext = buildOwnCompanyContext();

  const prompt = `あなたはSEO戦略の専門家です。入力された「テーマ（軸キーワード）」を、記事制作の起点となる具体的なキーワード候補へ展開する「戦略的キーワードリスト」を生成してください。

# 入力テーマ（軸キーワード）
「${keyword}」

# 対象ドメイン（絶対厳守）
- このメディアの対象領域は「${KEYWORD_DOMAIN}」です。
- 入力テーマに「外壁」「屋根」「戸建て」等の対象領域を示す語が**含まれている場合はそれを優先**して絞り込む。
- 対象領域を示す語が**含まれていない場合**（例:「色選び」のみ）は、自動的に「${KEYWORD_DOMAIN}」の文脈に絞って展開する（例:「色選び」→「外壁塗装の色選び」）。アパート・マンション・工場・オフィスなど対象外の領域へ広げない。
- 生成する全キーワードは、この対象ドメインに該当していなければならない。対象領域を明示していないテーマでも、キーワード側には適宜「外壁塗装」「屋根塗装」を補って具体化してよい。

# 最重要: テーマの解釈と展開ルール（絶対厳守）
- 入力テーマは「抽象的な軸」です。あなたの役割は、この軸の**語義の範囲内で**、具体的で検索されうるロングテールキーワードへ展開することです。
- テーマに含まれる各語の**意味を厳密に守る**こと。特に修飾語（例:「色」「費用」「助成金」等）を無視して、別の話題へ横滑りさせてはならない。
- 抽象語は必ず**具体物・具体施策に分解**して展開する。
  - 例:「外壁塗装 色」→ 人気色・ツートン配色・色選びの失敗・汚れが目立たない色・カラーシミュレーション 等、外壁塗装の「色」に該当する具体語へ展開。
  - 例:「屋根 メンテナンス」→ 屋根塗装・葺き替え・カバー工法・費用相場・実施時期 等。
- **全観点のすべてのキーワードは、入力テーマの語義に直接該当していなければならない**。テーマから外れた汎用キーワードは出力しない。
- 生成後、各キーワードが「テーマの意味に本当に合致しているか」を自己チェックし、外れているものは除外すること。

# 観点1: 競合キーワード調査（competitorKeywords）
テーマに沿って、上位競合が取り込んでいる／取りこぼしているキーワードを抽出する。${
    competitorResearch
      ? "以下の競合調査データも根拠にすること（ただしテーマから外れる語は採用しない）。"
      : "競合調査データが無いため、テーマの語義からユーザーが検索しうるKWを推定する。"
  }
${competitorContext}

# 観点2: 自社キーワード分析（ownKeywords）
自社の強み・サービス特性の中で、**入力テーマに関係する部分**に絞って獲得を狙うキーワードを抽出する。
- テーマと自社サービスの**接点**を探すこと。テーマから外れた自社の一般キーワードは出さない。
- テーマと自社サービスの重なりが薄い場合は、無理に自社事業へ寄せず、テーマに沿った現実的な接点のみを出す（件数が少なくなってもよい）。
${ownContext}

# 観点3: 市場環境（marketKeywords）
${
    useGrounding
      ? "Google検索で、入力テーマに関する最新の市場トレンド・季節性・法改正・新技術・ユーザーの関心の変化を調べ、"
      : ""
  }テーマに沿って今後需要が伸びる／新規性のあるキーワードを抽出する。ここでもテーマの語義から外れないこと。

# 各キーワードに必ず付与する属性
- keyword: キーワード本体（テーマの単純反復ではなく、テーマを具体展開した複合語・ロングテール）
- intent: 検索意図（インフォメーショナル / コマーシャル / トランザクショナル / ナビゲーショナル のいずれか）
- priority: 優先度（高 / 中 / 低）
- reason: 推奨理由（80字以内。テーマとの関連性も一言含める）
- suggestedH2: 想定H2・記事テーマ案（1行、そのKWで書く記事の切り口）

# 出力ルール（厳守）
- 各観点それぞれ 8〜12 個。ただしテーマとの関連性を優先し、無関係な語で件数を埋めない
- 3観点でキーワードが重複しないようにする
- 必ず下記のJSON形式のみを出力する（説明文・前置き・後書きは一切不要）
- コードブロック（\`\`\`json）で囲んでよい

出力JSON形式:
${JSON_SCHEMA_HINT}`;

  const modelConfig: any = {
    model: "gemini-flash-latest",
    generationConfig: {
      // グラウンディング利用時は temperature 1.0 が推奨
      temperature: useGrounding ? 1.0 : 0.7,
      maxOutputTokens: 8192,
    },
  };

  if (useGrounding) {
    modelConfig.tools = [{ googleSearch: {} }];
  }

  const model = genAI.getGenerativeModel(modelConfig);

  let text = "";
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    text = response.text();

    // グラウンディング出典を抽出（段階的nullチェック）
    let sources: GroundingChunk[] | undefined = undefined;
    const candidates =
      response && (response as any).candidates
        ? (response as any).candidates
        : null;
    if (candidates && candidates.length > 0) {
      const first = candidates[0];
      const meta = first && first.groundingMetadata ? first.groundingMetadata : null;
      if (meta && meta.groundingChunks) {
        sources = meta.groundingChunks as GroundingChunk[];
      }
    }

    // JSON抽出（堅牢化）:
    // 1) コードフェンス（```json / ```）を全て除去
    // 2) 最初の「{」から最後の「}」までを取り出す
    //    （フェンス欠落・複数フェンス・前後の説明文が混じっても壊れないようにする）
    let jsonText = text.replace(/```(?:json)?/gi, "");
    const firstBrace = jsonText.indexOf("{");
    const lastBrace = jsonText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.slice(firstBrace, lastBrace + 1);
    }
    jsonText = cleanJsonString(jsonText);

    const parsed: any = JSON.parse(jsonText);

    // 優先度を日本語に正規化（英語・表記ゆれ対応）
    const normalizePriority = (raw: any): "高" | "中" | "低" => {
      const v = raw ? String(raw).trim().toLowerCase() : "";
      if (v === "高" || v === "high" || v === "h") {
        return "高";
      }
      if (v === "低" || v === "low" || v === "l") {
        return "低";
      }
      return "中";
    };

    // 検索意図を日本語に正規化（英語・表記ゆれ対応）
    const normalizeIntent = (raw: any): string => {
      const v = raw ? String(raw).trim().toLowerCase() : "";
      if (v.indexOf("transaction") !== -1 || v === "do") {
        return "トランザクショナル";
      }
      if (v.indexOf("commercial") !== -1 || v.indexOf("比較") !== -1) {
        return "コマーシャル";
      }
      if (v.indexOf("navigation") !== -1 || v === "nav") {
        return "ナビゲーショナル";
      }
      if (v.indexOf("informational") !== -1 || v === "know") {
        return "インフォメーショナル";
      }
      // 既に日本語ならそのまま、空なら既定値
      return raw ? String(raw) : "インフォメーショナル";
    };

    const normalize = (arr: any): StrategicKeyword[] => {
      if (!arr || !Array.isArray(arr)) {
        return [];
      }
      return arr
        .filter((item) => item && item.keyword)
        .map((item) => ({
          keyword: String(item.keyword),
          intent: normalizeIntent(item.intent),
          priority: normalizePriority(item.priority),
          reason: item.reason ? String(item.reason) : "",
          suggestedH2: item.suggestedH2 ? String(item.suggestedH2) : "",
        }));
    };

    return {
      keyword,
      generatedAt: new Date().toISOString(),
      competitorKeywords: normalize(parsed.competitorKeywords),
      ownKeywords: normalize(parsed.ownKeywords),
      marketKeywords: normalize(parsed.marketKeywords),
      sources,
    };
  } catch (error: any) {
    const message =
      error && error.message ? error.message : String(error);
    if (message.indexOf("API key") !== -1) {
      throw new Error("API認証エラー: Gemini APIキーが無効です。");
    }
    if (message.indexOf("quota") !== -1) {
      throw new Error(
        "APIクォータエラー: Gemini APIの利用制限に達しました。"
      );
    }
    throw new Error(`戦略的キーワード生成エラー: ${message}`);
  }
}

/**
 * 戦略的キーワードリストをCSV文字列に変換する。
 */
export function strategicKeywordsToCsv(list: StrategicKeywordList): string {
  const header = ["観点", "キーワード", "検索意図", "優先度", "推奨理由", "想定H2・記事テーマ案"];
  const rows: string[][] = [];

  const pushRows = (label: string, items: StrategicKeyword[]) => {
    items.forEach((k) => {
      rows.push([label, k.keyword, String(k.intent), k.priority, k.reason, k.suggestedH2]);
    });
  };

  pushRows("競合キーワード調査", list.competitorKeywords);
  pushRows("自社キーワード分析", list.ownKeywords);
  pushRows("市場環境", list.marketKeywords);

  const escape = (v: string) => {
    const s = v == null ? "" : String(v);
    if (s.indexOf('"') !== -1 || s.indexOf(",") !== -1 || s.indexOf("\n") !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const lines = [header, ...rows].map((row) => row.map(escape).join(","));
  // Excel向けBOM付き
  return "﻿" + lines.join("\r\n");
}

// ===== 時事ネタ（ニュースジャッキング）キーワード生成 =====

// 優先度を日本語に正規化（英語・表記ゆれ対応）
function normalizePriorityValue(raw: any): "高" | "中" | "低" {
  const v = raw ? String(raw).trim().toLowerCase() : "";
  if (v === "高" || v === "high" || v === "h") {
    return "高";
  }
  if (v === "低" || v === "low" || v === "l") {
    return "低";
  }
  return "中";
}

// 検索意図を日本語に正規化（英語・表記ゆれ対応）
function normalizeIntentValue(raw: any): string {
  const v = raw ? String(raw).trim().toLowerCase() : "";
  if (v.indexOf("transaction") !== -1 || v === "do") {
    return "トランザクショナル";
  }
  if (v.indexOf("commercial") !== -1 || v.indexOf("比較") !== -1) {
    return "コマーシャル";
  }
  if (v.indexOf("navigation") !== -1 || v === "nav") {
    return "ナビゲーショナル";
  }
  if (v.indexOf("informational") !== -1 || v === "know") {
    return "インフォメーショナル";
  }
  return raw ? String(raw) : "インフォメーショナル";
}

const TREND_SCHEMA_HINT = `
{
  "keywords": [
    {
      "newsSummary": "拾った時事ニュース・話題（いつ頃の何の話題か・1〜2文）",
      "keyword": "そのニュースから狙う検索キーワード（外壁塗装・屋根塗装文脈の具体語）",
      "intent": "インフォメーショナル | コマーシャル | トランザクショナル | ナビゲーショナル のいずれか",
      "priority": "高 | 中 | 低 のいずれか",
      "relevance": "そのニュースが外壁塗装・屋根塗装にどう結びつくか・なぜ今アクセスが取れるか（100字以内）",
      "suggestedH2": "そのKWで書く記事の切り口・H2案（1行）",
      "sourceTitle": "根拠にしたニュースのタイトル（分かる範囲で）",
      "sourceUrl": "根拠にしたニュースのURL（分かる範囲で）"
    }
  ]
}`;

/**
 * リアルタイムの時事ニュース・話題から、戸建ての外壁塗装・屋根塗装に
 * 結びつくキーワードをピックアップする（ニュースジャッキング）。
 *
 * - Google検索グラウンディングで最近のニュース・トピックを調べる
 * - 資材/価格・訪問販売トラブル・補助金/制度・災害/気候 などの切り口を対象
 * - 各KWに、根拠ニュース・外壁塗装との結びつき・記事切り口を付与
 */
export async function generateTrendKeywords(options?: {
  useGrounding?: boolean;
}): Promise<TrendKeywordList> {
  const useGrounding =
    options && typeof options.useGrounding === "boolean"
      ? options.useGrounding
      : true;

  const prompt = `あなたは「${KEYWORD_DOMAIN}」を扱う専門メディアのSEO編集者です。
${
    useGrounding
      ? "Google検索を使って、"
      : ""
  }いま世の中で話題になっている最近のニュース・時事トピックのうち、${KEYWORD_DOMAIN}を検討する戸建て住宅の持ち主（施主）にとって「塗装・修繕・費用・制度・トラブル回避」の観点で関心が高まりうるものを特定し、それをフックに記事化すべき検索キーワードを提案してください。

# 狙うべき時事の切り口（例）
- 資材・価格: ナフサ・原油高による塗料/建材の価格高騰 → 外壁塗装費用の値上がり・早期実施の判断
- 事件・トラブル: 悪質訪問販売・外壁塗装の見積りトラブル・手抜き工事の報道 → 相見積もり・業者選び・費用適正化への関心
- 制度・補助金: 省エネ基準の改正、遮熱・断熱塗装への補助金/助成金の新設や変更
- 災害・気候: 台風・地震・豪雨・猛暑 → 外壁・屋根の劣化点検/補修、防水・遮熱塗料の需要

# 重要ルール（厳守）
- できるだけ「最近（直近数か月〜1年程度）」の実際のニュース・動向を根拠にすること
- 各キーワードは必ず${KEYWORD_DOMAIN}の文脈に結びつけること
- ニュースの話題そのもの（例: 事件名）ではなく、ユーザーが実際に検索する「対策・費用・方法」寄りのキーワードにすること
- 根拠にしたニュースの出典（タイトル・URL）を分かる範囲で記載すること
- 8〜12個を出す

# 出力ルール
- 必ず下記のJSON形式のみを出力する（説明文・前置き・後書きは一切不要）
- コードブロック（\`\`\`json）で囲んでよい

出力JSON形式:
${TREND_SCHEMA_HINT}`;

  const modelConfig: any = {
    model: "gemini-flash-latest",
    generationConfig: {
      temperature: useGrounding ? 1.0 : 0.7,
      maxOutputTokens: 8192,
    },
  };

  if (useGrounding) {
    modelConfig.tools = [{ googleSearch: {} }];
  }

  const model = genAI.getGenerativeModel(modelConfig);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // グラウンディング出典を抽出（段階的nullチェック）
    let sources: GroundingChunk[] | undefined = undefined;
    const candidates =
      response && (response as any).candidates
        ? (response as any).candidates
        : null;
    if (candidates && candidates.length > 0) {
      const first = candidates[0];
      const meta =
        first && first.groundingMetadata ? first.groundingMetadata : null;
      if (meta && meta.groundingChunks) {
        sources = meta.groundingChunks as GroundingChunk[];
      }
    }

    // JSON抽出（フェンス除去＋最初の { 〜 最後の } ）
    let jsonText = text.replace(/```(?:json)?/gi, "");
    const firstBrace = jsonText.indexOf("{");
    const lastBrace = jsonText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.slice(firstBrace, lastBrace + 1);
    }
    jsonText = cleanJsonString(jsonText);

    const parsed: any = JSON.parse(jsonText);

    const rawList =
      parsed && parsed.keywords && Array.isArray(parsed.keywords)
        ? parsed.keywords
        : [];
    const keywords: TrendKeyword[] = rawList
      .filter((item: any) => item && item.keyword)
      .map((item: any) => ({
        newsSummary: item.newsSummary ? String(item.newsSummary) : "",
        keyword: String(item.keyword),
        intent: normalizeIntentValue(item.intent),
        priority: normalizePriorityValue(item.priority),
        relevance: item.relevance ? String(item.relevance) : "",
        suggestedH2: item.suggestedH2 ? String(item.suggestedH2) : "",
        sourceTitle: item.sourceTitle ? String(item.sourceTitle) : undefined,
        sourceUrl: item.sourceUrl ? String(item.sourceUrl) : undefined,
      }));

    return {
      generatedAt: new Date().toISOString(),
      keywords,
      sources,
    };
  } catch (error: any) {
    const message = error && error.message ? error.message : String(error);
    if (message.indexOf("API key") !== -1) {
      throw new Error("API認証エラー: Gemini APIキーが無効です。");
    }
    if (message.indexOf("quota") !== -1) {
      throw new Error("APIクォータエラー: Gemini APIの利用制限に達しました。");
    }
    throw new Error(`時事ネタキーワード生成エラー: ${message}`);
  }
}

/**
 * 時事ネタキーワードリストをCSV文字列に変換する。
 */
export function trendKeywordsToCsv(list: TrendKeywordList): string {
  const header = [
    "時事ニュース",
    "キーワード",
    "検索意図",
    "優先度",
    "外壁塗装との結びつき",
    "想定H2・記事テーマ案",
    "出典タイトル",
    "出典URL",
  ];
  const rows: string[][] = list.keywords.map((k) => [
    k.newsSummary,
    k.keyword,
    String(k.intent),
    k.priority,
    k.relevance,
    k.suggestedH2,
    k.sourceTitle ? k.sourceTitle : "",
    k.sourceUrl ? k.sourceUrl : "",
  ]);

  const escape = (v: string) => {
    const s = v == null ? "" : String(v);
    if (s.indexOf('"') !== -1 || s.indexOf(",") !== -1 || s.indexOf("\n") !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const lines = [header, ...rows].map((row) => row.map(escape).join(","));
  return "﻿" + lines.join("\r\n");
}
