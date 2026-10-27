// Gemini API 呼び出しの指数バックオフ再試行ヘルパー
//
// Gemini は混雑時に 503（過負荷）/ 429（レート制限）を返す。
// 対策がないと競合調査や品質チェックが途中でエラー終了し、工程をやり直すことになる。
//
// beautiful-wiles の 1cf163e を元に、複数サービスから使えるよう共有化した。
// 元実装は執筆処理（当時Gemini）に直接埋め込まれていたが、現在の執筆は Claude に
// 移行済みのため、Gemini を実際に使っている箇所（各チェック工程・競合調査）で使う。

/**
 * Gemini API 呼び出しを、リトライ可能エラー時に指数バックオフで再試行する。
 *
 * 待ち時間は 2秒 → 4秒 → 最大16秒（＋0〜0.5秒のジッター）。
 * 倍々に増やすのは混雑時に再試行が殺到して輻輳を悪化させないため、
 * ジッターを加えるのは複数リクエストの再試行タイミングをずらすため。
 *
 * @param fn 実行する Gemini 呼び出し
 * @param context ログに出す呼び出し元の識別名
 * @param maxRetries 最大試行回数（デフォルト3）
 */
export async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries: number = 3
): Promise<T> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const msg = err && err.message ? String(err.message) : String(err);
      // 402（プリペイド残高切れ）・401/403（キー無効）は再試行しても回復しないため即座に失敗させる
      const isNonRecoverable =
        msg.indexOf('402') !== -1 ||
        msg.indexOf('Payment Required') !== -1 ||
        msg.indexOf('credits are depleted') !== -1 ||
        msg.indexOf('[401') !== -1 ||
        msg.indexOf('[403') !== -1 ||
        msg.indexOf('API key not valid') !== -1;
      const isRetryable =
        !isNonRecoverable && (
        msg.indexOf('503') !== -1 ||
        msg.indexOf('429') !== -1 ||
        msg.indexOf('overloaded') !== -1 ||
        msg.indexOf('high demand') !== -1 ||
        msg.indexOf('UNAVAILABLE') !== -1 ||
        msg.indexOf('RESOURCE_EXHAUSTED') !== -1 ||
        msg.toLowerCase().indexOf('fetch') !== -1);
      if (!isRetryable || attempt === maxRetries) {
        break;
      }
      const delayMs = Math.min(1000 * Math.pow(2, attempt), 16000) + Math.floor(Math.random() * 500);
      console.warn(`⚠️ [${context}] リトライ可能エラー (${attempt}/${maxRetries}): ${msg.slice(0, 120)}`);
      console.warn(`   ${delayMs}ms 後に再試行します...`);
      await new Promise(function (resolve) { return setTimeout(resolve, delayMs); });
    }
  }
  throw lastError;
}
