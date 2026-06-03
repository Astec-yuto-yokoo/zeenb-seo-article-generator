// 見出し番号付与ユーティリティ
//
// 出力ルール:
//   - H2 → 文頭に「N. 」（半角数字 + ピリオド + 半角スペース）通し番号
//   - H3 → 文頭に「N-M. 」（親H2番号 - H3連番）。H2ごとに M はリセット
//
// 冪等性:
//   - 既に番号が付いている見出しは、その番号を剥がしてから振り直す
//   - 何度呼び出しても結果は同じ
//
// 参考フォーマット: https://zeenb.astecpaints.jp/journal/color/painting-color-48427

/**
 * 既存の見出し番号プレフィックスを剥がす
 *
 * 対応パターン:
 *   - "1. タイトル"          → "タイトル"
 *   - "12. タイトル"         → "タイトル"
 *   - "1-1. タイトル"        → "タイトル"
 *   - "1-12. タイトル"       → "タイトル"
 *   - "1．タイトル"（全角）  → "タイトル"
 */
function stripExistingNumber(text: string): string {
  // 全角数字・全角ピリオドを半角に正規化してから判定
  // ただし元のテキストは触らず、判定用に正規化
  const trimmed = text.replace(/^\s+/, '');

  // パターン: 数字（半角・全角）+ 任意の "-数字" + ピリオド（半角・全角）+ スペース（任意）
  // 例: "1. ", "12. ", "1-1. ", "1-12. ", "1．", "1-1．"
  const match = trimmed.match(/^[0-9０-９]+(?:[-－][0-9０-９]+)?[\.．]\s*/);
  if (match) {
    return trimmed.slice(match[0].length);
  }
  return trimmed;
}

/**
 * 記事HTML内の <h2>/<h3> タグに番号を付与する（冪等）
 *
 * - H2 は出現順に 1 から通し番号
 * - H3 は直前の H2 の番号配下で 1 から振り直し
 * - H2 が見つかる前に出現した H3 は番号を付けない（不正構造なので元のまま）
 * - タグの属性（class, id 等）は維持
 */
export function numberArticleHeadings(html: string): string {
  if (!html) return html;

  let h2Index = 0;
  let h3Index = 0;

  // <h2 ...>内容</h2> または <h3 ...>内容</h3> を順に走査
  // 大文字小文字を許容
  return html.replace(
    /<(h[23])([^>]*)>([\s\S]*?)<\/\1>/gi,
    (_match, tag: string, attrs: string, inner: string) => {
      const tagLower = tag.toLowerCase();
      const cleaned = stripExistingNumber(inner);

      if (tagLower === 'h2') {
        h2Index += 1;
        h3Index = 0;
        return `<${tag}${attrs}>${h2Index}. ${cleaned}</${tag}>`;
      }

      // h3
      if (h2Index === 0) {
        // H2 が出る前の H3 → 元の見出しを保持（番号なし）
        return `<${tag}${attrs}>${cleaned}</${tag}>`;
      }
      h3Index += 1;
      return `<${tag}${attrs}>${h2Index}-${h3Index}. ${cleaned}</${tag}>`;
    }
  );
}

/**
 * 構成案データ構造の見出しに番号を付与した「表示用ラベル」を計算する
 *
 * - 元の OutlineSectionV2.heading は変更しない（純粋関数）
 * - 表示用に { h2Label, h3Labels } の配列を返す
 */
export interface NumberedOutlineLabel {
  h2Label: string;      // 例: "1. 外壁塗装の色選びで知っておくべき基礎知識"
  h3Labels: string[];   // 例: ["1-1. 家の色・家の壁色が与える印象と役割", ...]
}

export function buildOutlineLabels(
  sections: Array<{ heading: string; subheadings?: Array<{ text: string }> }>
): NumberedOutlineLabel[] {
  return sections.map((section, h2Idx) => {
    const h2Num = h2Idx + 1;
    const h2Clean = stripExistingNumber(section.heading);
    const h2Label = `${h2Num}. ${h2Clean}`;

    const subs = section.subheadings && section.subheadings.length > 0 ? section.subheadings : [];
    const h3Labels = subs.map((sub, h3Idx) => {
      const h3Num = h3Idx + 1;
      const h3Clean = stripExistingNumber(sub.text);
      return `${h2Num}-${h3Num}. ${h3Clean}`;
    });

    return { h2Label, h3Labels };
  });
}

/**
 * 構成案テキスト（## H2 / ### H3 形式の Markdown）に番号を付与する
 *
 * writingAgentV3 が outline を文字列で受け取るため、執筆AIに番号付きで渡すために使用
 */
export function numberOutlineMarkdown(outlineMarkdown: string): string {
  if (!outlineMarkdown) return outlineMarkdown;

  let h2Index = 0;
  let h3Index = 0;

  return outlineMarkdown
    .split('\n')
    .map((line) => {
      if (line.startsWith('## ')) {
        h2Index += 1;
        h3Index = 0;
        const cleaned = stripExistingNumber(line.substring(3));
        return `## ${h2Index}. ${cleaned}`;
      }
      if (line.startsWith('### ')) {
        if (h2Index === 0) return line;
        h3Index += 1;
        const cleaned = stripExistingNumber(line.substring(4));
        return `### ${h2Index}-${h3Index}. ${cleaned}`;
      }
      return line;
    })
    .join('\n');
}
