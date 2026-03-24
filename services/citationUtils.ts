/**
 * 出典リンク生成ユーティリティ
 *
 * URL優先順位:
 * - 自社noteアカウント > 自社メディアサイト > その他
 * - note URL は必ず aタグで埋め込み（ベタ貼り禁止）
 * - media URL は出典として使う場合はaタグ、内部リンクとしてのベタ貼りは別途保護
 *
 * 環境変数:
 * - VITE_COMPANY_NOTE_URL: 自社noteアカウントURL（例：note.com/yourcompany）
 * - VITE_COMPANY_MEDIA_URL: 自社メディアサイトURL（例：media.yourcompany.com）
 */

// 環境変数から自社URLパターンを取得
const COMPANY_NOTE_URL = import.meta.env.VITE_COMPANY_NOTE_URL || "";
const COMPANY_MEDIA_URL = import.meta.env.VITE_COMPANY_MEDIA_URL || "";

/**
 * 自社noteのURLかどうかを判定
 */
function isCompanyNoteUrl(url: string): boolean {
  if (!COMPANY_NOTE_URL) return false;
  return url.includes(COMPANY_NOTE_URL);
}

/**
 * 自社メディアのURLかどうかを判定
 */
function isCompanyMediaUrl(url: string): boolean {
  if (!COMPANY_MEDIA_URL) return false;
  return url.includes(COMPANY_MEDIA_URL);
}

/**
 * 出典リンクをHTML形式で生成
 *
 * @param url - 出典URL
 * @param title - 出典タイトル
 * @returns HTML形式の出典リンク
 *
 * @example
 * ```ts
 * // 環境変数 VITE_COMPANY_NOTE_URL=note.com/yourcompany の場合
 * buildCitationLink('https://note.com/yourcompany/n/abc123', '事例インタビュー')
 * // => '（出典：<a href="https://note.com/yourcompany/n/abc123" target="_blank" rel="noopener noreferrer">事例インタビュー</a>）'
 * ```
 */
export function buildCitationLink(url: string, title: string): string {
  // すべてのURLをaタグ形式で出力
  return `（出典：<a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>）`;
}

/**
 * URL優先順位に従って最適なURLを選択
 *
 * 優先順位:
 * 1. 自社noteアカウントのURL（環境変数 VITE_COMPANY_NOTE_URL で設定）
 * 2. 自社メディアサイトのURL（環境変数 VITE_COMPANY_MEDIA_URL で設定）
 * 3. その他のURL（最初のもの）
 *
 * @param urls - URL配列
 * @returns 優先順位に従って選択されたURL
 *
 * @example
 * ```ts
 * // 環境変数が設定されている場合
 * selectPrioritizedUrl([
 *   'https://media.yourcompany.com/article1',
 *   'https://note.com/yourcompany/n/abc123'
 * ])
 * // => 'https://note.com/yourcompany/n/abc123'
 * ```
 */
export function selectPrioritizedUrl(urls: string[]): string {
  if (!urls || urls.length === 0) {
    return "";
  }

  // 自社noteを最優先（環境変数が設定されている場合のみ）
  if (COMPANY_NOTE_URL) {
    const noteUrl = urls.find((url) => url.includes(COMPANY_NOTE_URL));
    if (noteUrl) return noteUrl;
  }

  // フォールバック: 自社メディア（環境変数が設定されている場合のみ）
  if (COMPANY_MEDIA_URL) {
    const mediaUrl = urls.find((url) => url.includes(COMPANY_MEDIA_URL));
    if (mediaUrl) return mediaUrl;
  }

  // それ以外は最初のURL
  return urls[0];
}

/**
 * URLの種類を判定
 *
 * @param url - 判定対象URL
 * @returns URLの種類（"note": 自社note, "media": 自社メディア, "external": 外部）
 */
export function getUrlType(url: string): "note" | "media" | "external" {
  if (isCompanyNoteUrl(url)) {
    return "note";
  }
  if (isCompanyMediaUrl(url)) {
    return "media";
  }
  return "external";
}

/**
 * 複数の出典候補から最適な出典を生成
 *
 * @param citations - 出典候補配列 { url: string, title: string }[]
 * @returns HTML形式の出典リンク
 */
export function buildOptimalCitation(
  citations: Array<{ url: string; title: string }>
): string {
  if (!citations || citations.length === 0) {
    return "";
  }

  // URL優先順位に従って選択
  const urls = citations.map((c) => c.url);
  const selectedUrl = selectPrioritizedUrl(urls);

  // 選択されたURLに対応するタイトルを取得
  const selectedCitation = citations.find((c) => c.url === selectedUrl);
  if (!selectedCitation) {
    return "";
  }

  // DIAGNOSTIC_MODE: 選択ログ
  if (process.env.DIAGNOSTIC_MODE) {
    console.log(`[citationUtils] 出典選択:`, {
      candidates: citations.length,
      selected: selectedUrl,
      type: getUrlType(selectedUrl),
      title: selectedCitation.title,
    });
  }

  return buildCitationLink(selectedUrl, selectedCitation.title);
}
