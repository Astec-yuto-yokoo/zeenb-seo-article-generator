// 文字数カウント用ユーティリティ
// 全角=1、半角=0.5でカウントし、0.5刻みで四捨五入

/**
 * 文字数をカウント（全角=1、半角=0.5）
 * @param text カウント対象のテキスト
 * @returns 文字数（0.5刻みで四捨五入）
 */
export function countCharacters(text: string): number {
  if (!text) return 0;
  
  let count = 0;
  
  for (const char of text) {
    // 全角文字の判定
    // Unicode範囲で全角を判定
    const code = char.charCodeAt(0);
    
    // 基本的なASCII文字（半角）
    if (code >= 0x20 && code <= 0x7E) {
      count += 0.5;
    }
    // 半角カナ
    else if (code >= 0xFF61 && code <= 0xFF9F) {
      count += 0.5;
    }
    // その他は全角として扱う
    else {
      count += 1;
    }
  }
  
  // 0.5刻みで四捨五入
  return Math.round(count * 2) / 2;
}

/**
 * タイトルが32文字以内かチェック
 * @param title タイトル
 * @returns 32文字以内ならtrue
 */
export function isTitleWithinLimit(title: string): boolean {
  return countCharacters(title) <= 32;
}

/**
 * メタディスクリプションが100文字以内かチェック
 * @param description メタディスクリプション
 * @returns 100文字以内ならtrue
 */
export function isMetaDescriptionWithinLimit(description: string): boolean {
  return countCharacters(description) <= 100;
}

/**
 * テキストを指定文字数以内に切り詰める
 * @param text 対象テキスト
 * @param maxLength 最大文字数
 * @returns 切り詰められたテキスト
 */
export function truncateToLength(text: string, maxLength: number): string {
  let currentCount = 0;
  let result = '';
  
  for (const char of text) {
    const code = char.charCodeAt(0);
    const charWeight = (code >= 0x20 && code <= 0x7E) || (code >= 0xFF61 && code <= 0xFF9F) ? 0.5 : 1;
    
    if (currentCount + charWeight > maxLength) {
      break;
    }
    
    currentCount += charWeight;
    result += char;
  }
  
  return result;
}