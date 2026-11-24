/**
 * 注釈・出典の段落を <small> で囲み、本文より小さい文字サイズで表示させる。
 *
 * 対象（段落テキストの先頭で判定）:
 * - 「※」で始まる段落（※出典元：〜 / ※価格は目安です 等）
 * - 「（出典：」「(出典:」「出典：」で始まる段落
 * - class="source-citation" を持つ段落
 *
 * <small> はテーマのCSSに依存せずブラウザ標準で縮小表示されるため、WordPress側の追加設定は不要。
 * 冪等: 既に <small> で囲まれている段落はそのまま返す。
 */

const ANNOTATION_TEXT_PATTERN = /^(?:※|[（(]\s*出典|出典\s*[：:])/;

function toPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function wrapAnnotationsInSmall(html: string): string {
  if (!html) return html;

  return html.replace(
    /<p(\s[^>]*)?>([\s\S]*?)<\/p>/gi,
    function (whole: string, attrs: string | undefined, inner: string) {
      const attrText = attrs ? attrs : "";
      const trimmedInner = inner.trim();
      if (!trimmedInner) return whole;
      if (/^<small[\s>]/i.test(trimmedInner)) return whole;

      const isSourceCitation = /class\s*=\s*["'][^"']*\bsource-citation\b/i.test(attrText);
      const isAnnotationText = ANNOTATION_TEXT_PATTERN.test(toPlainText(trimmedInner));
      if (!isSourceCitation && !isAnnotationText) return whole;

      return "<p" + attrText + "><small>" + trimmedInner + "</small></p>";
    }
  );
}
