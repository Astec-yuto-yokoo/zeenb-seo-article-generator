// Gemini API のプリペイドクレジット残高切れ（HTTP 402 / RESOURCE_EXHAUSTED）の判定と利用者向け文言。
// 残高切れはコード側では復旧できないため、原因と対処（チャージ or キー差し替え）を画面に出す。

export const GEMINI_CREDIT_DEPLETED_TITLE = "Gemini APIのクレジット残高が不足しています（402）";

export const GEMINI_CREDIT_DEPLETED_MESSAGE =
  "画像生成に使うGemini APIのプリペイドクレジットが残高切れのため、画像を生成できません。" +
  "AI Studio（https://ai.studio/projects）でこのAPIキーのプロジェクトにクレジットを追加してから、" +
  "「全画像を順次生成」を押して再開してください。" +
  "別プロジェクトのキーに替える場合は、本体の .env の GEMINI_API_KEY を書き換えてサーバーを再起動してください。";

export function isGeminiCreditDepletedError(error: unknown): boolean {
  if (!error) return false;
  const err = error as any;
  if (err.status === 402) return true;
  if (err.response && err.response.status === 402) return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.indexOf("prepayment credits are depleted") !== -1 ||
    /"code"\s*:\s*402/.test(message)
  );
}
