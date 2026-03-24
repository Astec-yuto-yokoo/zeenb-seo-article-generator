/**
 * FAQPage JSON-LD 構造化データ生成
 * 記事HTMLからFAQセクションのQ&Aを抽出し、JSON-LDスクリプトを生成する
 */

interface FaqItem {
  question: string;
  answer: string;
}

/**
 * 記事HTMLからFAQ Q&Aペアを抽出する
 * FAQ/よくある質問セクション内のH3を質問、その後の本文を回答として解析
 */
export function extractFaqFromHtml(htmlContent: string): FaqItem[] {
  var faqItems: FaqItem[] = [];

  // FAQ セクションの開始を検出（H2でFAQ/よくある質問を含むもの）
  var faqSectionRegex = /<h2[^>]*>(.*?(?:FAQ|よくある質問|faq)[^<]*)<\/h2>/i;
  var faqMatch = htmlContent.match(faqSectionRegex);

  if (!faqMatch) {
    return faqItems;
  }

  // FAQ H2の位置から次のH2までの範囲を取得
  var faqStartIndex = htmlContent.indexOf(faqMatch[0]);
  var afterFaq = htmlContent.substring(faqStartIndex + faqMatch[0].length);

  // 次のH2で区切り
  var nextH2Index = afterFaq.indexOf("<h2");
  var faqSection = nextH2Index !== -1
    ? afterFaq.substring(0, nextH2Index)
    : afterFaq;

  // H3を質問として抽出し、その後のコンテンツを回答として取得
  var h3Regex = /<h3[^>]*>(.*?)<\/h3>/gi;
  var h3Match;
  var h3Positions: Array<{ question: string; startIndex: number }> = [];

  while (true) {
    h3Match = h3Regex.exec(faqSection);
    if (!h3Match) break;

    // HTMLタグを除去してテキストのみ取得
    var questionText = h3Match[1].replace(/<[^>]*>/g, "").trim();
    if (questionText) {
      h3Positions.push({
        question: questionText,
        startIndex: h3Match.index + h3Match[0].length,
      });
    }
  }

  // 各H3の後から次のH3（またはセクション末尾）までのテキストを回答として取得
  for (var i = 0; i < h3Positions.length; i++) {
    var answerStart = h3Positions[i].startIndex;
    var answerEnd = i + 1 < h3Positions.length
      ? faqSection.indexOf("<h3", answerStart)
      : faqSection.length;

    if (answerEnd === -1) {
      answerEnd = faqSection.length;
    }

    var answerHtml = faqSection.substring(answerStart, answerEnd).trim();
    // HTMLタグを除去してプレーンテキストに
    var answerText = answerHtml
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (answerText && h3Positions[i].question) {
      faqItems.push({
        question: h3Positions[i].question,
        answer: answerText,
      });
    }
  }

  return faqItems;
}

/**
 * FAQ Q&AペアからJSON-LDスクリプトタグを生成する
 */
export function generateFaqJsonLd(faqItems: FaqItem[]): string {
  if (faqItems.length === 0) {
    return "";
  }

  var schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map(function (item) {
      return {
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      };
    }),
  };

  return '<script type="application/ld+json">\n' +
    JSON.stringify(schema, null, 2) +
    "\n</script>";
}

/**
 * 記事HTMLからFAQを抽出してJSON-LDを生成する（ワンショット）
 */
export function generateFaqSchemaFromArticle(htmlContent: string): string {
  var faqItems = extractFaqFromHtml(htmlContent);
  return generateFaqJsonLd(faqItems);
}
