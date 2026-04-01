// BOX画像コンテキストビルダー
// 画像アセット情報をAIプロンプト用のテキストに整形する

import type { ImageAsset } from "./boxImageService";

/**
 * ImageAsset配列をAIプロンプト用テキストに変換
 * 画像がない場合は空文字を返す
 */
export function buildImageContext(images: ImageAsset[]): string {
  if (!images || images.length === 0) {
    return "";
  }

  const imageList = images
    .map((img, index) => {
      const parts = [`  ${index + 1}. URL: ${img.url}`];
      if (img.title) {
        parts.push(`     タイトル: ${img.title}`);
      }
      if (img.description) {
        parts.push(`     説明: ${img.description}`);
      }
      if (img.tags && img.tags.length > 0) {
        parts.push(`     タグ: ${img.tags.join(", ")}`);
      }
      return parts.join("\n");
    })
    .join("\n");

  return `
【利用可能な画像素材（BOX）】
以下の画像が利用可能です。記事の内容に合致する画像がある場合のみ使用してください。

${imageList}

【画像使用ルール】
- 画像は記事の内容に関連がある場合のみ使用すること（無理に全画像を使う必要はない）
- 各H2セクションにつき最大1枚まで
- 以下のHTML形式で出力すること：
  <figure>
    <img src="画像URL" alt="画像の説明文">
    <figcaption>画像の説明文</figcaption>
  </figure>
- <figure>タグは段落（<p>タグ）の間に配置すること（<p>タグの中に入れない）
- alt属性とfigcaptionには画像の内容を簡潔に記載すること
`;
}
