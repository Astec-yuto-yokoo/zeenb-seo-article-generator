// Gemini API のプリペイドクレジット残高切れ（HTTP 402 / RESOURCE_EXHAUSTED）の判定と利用者向け文言。
// 残高切れはコード側では復旧できないため、原因と対処（チャージ or キー差し替え）を画面に出す。

export const GEMINI_CREDIT_DEPLETED_MESSAGE =
  "Gemini APIのクレジット残高が不足しています（402）。" +
  "プリペイドクレジットが残高切れのため、Geminiを使う処理（競合分析・キーワード提案・画像生成など）が実行できません。" +
  "AI Studio（https://ai.studio/projects）でこのAPIキーのプロジェクトにクレジットを追加してから、もう一度お試しください。" +
  "別プロジェクトのキーに替える場合は、.env の GEMINI_API_KEY を書き換えて start.sh でサーバーを再起動してください。";

export function isGeminiCreditDepletedError(error: unknown): boolean {
  if (!error) return false;
  const err = error as any;
  if (err.status === 402) return true;
  if (err.response && err.response.status === 402) return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.indexOf("prepayment credits are depleted") !== -1 ||
    message.indexOf("[402 Payment Required]") !== -1 ||
    /"code"\s*:\s*402/.test(message)
  );
}
