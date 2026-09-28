/**
 * WordPress入稿用 FAQPage JSON-LD 付与
 * 記事HTMLのFAQ/よくある質問セクション（H2）配下のH3を質問、続く本文を回答として抽出し、
 * 本文末尾に <!-- wp:html --> ブロックで JSON-LD を追加する。
 * フロントの utils/faqSchemaGenerator.ts と同じ抽出ルール（サーバーはJSのため別実装）。
 */

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&");
}

function toPlainText(html) {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      // 出典注釈は回答テキストに含めない
      .replace(/<small[^>]*>[\s\S]*?<\/small>/gi, "")
      // ブロック要素の境界は空白、インライン要素はそのまま除去（日本語に余計な空白を入れない）
      .replace(/<\/?(?:p|li|ul|ol|br|div|figure|table|tr|td|th|h[1-6])\b[^>]*>/gi, " ")
      .replace(/<[^>]*>/g, "")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function extractFaqItems(html) {
  var items = [];
  var faqMatch = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi);
  if (!faqMatch) return items;

  var faqHeading = null;
  for (var i = 0; i < faqMatch.length; i++) {
    if (/FAQ|よくある質問|よくあるご質問/i.test(toPlainText(faqMatch[i]))) {
      faqHeading = faqMatch[i];
      break;
    }
  }
  if (!faqHeading) return items;

  var afterFaq = html.substring(html.indexOf(faqHeading) + faqHeading.length);
  var nextH2 = afterFaq.search(/<h2[\s>]/i);
  var section = nextH2 !== -1 ? afterFaq.substring(0, nextH2) : afterFaq;
  // 次のH2直前に付く見出しブロックコメントを除外
  section = section.replace(/<!--\s*wp:heading[^>]*-->\s*$/, "");

  var h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  var positions = [];
  var m;
  while ((m = h3Regex.exec(section)) !== null) {
    // 見出し番号（例: "5-1. "）を除去
    var question = toPlainText(m[1]).replace(/^\d+(?:-\d+)?\.\s*/, "");
    if (question) {
      positions.push({ question: question, start: m.index + m[0].length, headStart: m.index });
    }
  }

  for (var j = 0; j < positions.length; j++) {
    var end = j + 1 < positions.length ? positions[j + 1].headStart : section.length;
    var answer = toPlainText(section.substring(positions[j].start, end));
    if (answer) {
      items.push({ question: positions[j].question, answer: answer });
    }
  }
  return items;
}

/**
 * 本文にFAQPage JSON-LDを付与する。FAQが無い・既に付与済みの場合は元の本文を返す。
 */
function appendFaqSchema(html) {
  if (typeof html !== "string" || !html) return { content: html, faqCount: 0 };
  if (/"@type"\s*:\s*"FAQPage"/.test(html)) return { content: html, faqCount: 0 };

  var items = extractFaqItems(html);
  if (items.length === 0) return { content: html, faqCount: 0 };

  var schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(function (item) {
      return {
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      };
    }),
  };

  // </script> 等でタグが閉じないよう < をエスケープ
  var json = JSON.stringify(schema, null, 2).replace(/</g, "\\u003c");
  var block =
    "\n\n<!-- wp:html -->\n" +
    '<script type="application/ld+json">\n' +
    json +
    "\n</script>\n" +
    "<!-- /wp:html -->";

  return { content: html + block, faqCount: items.length };
}

module.exports = { appendFaqSchema: appendFaqSchema, extractFaqItems: extractFaqItems };
