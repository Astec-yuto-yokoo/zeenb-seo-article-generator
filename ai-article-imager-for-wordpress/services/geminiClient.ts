// Gemini クライアント（プロキシ化：APIキーをブラウザに出さない）
//
// 実APIキーはバックエンド（/api/gemini-proxy）側のみが保持する。
// このファクトリは @google/genai の GoogleGenAI を
//   httpOptions.baseUrl = <backend>/api/gemini-proxy
// に向けて生成する。genai は URL を `{baseUrl}/{apiVersion(=v1beta)}/{path}` で
// 組み立てるため、サーバーの app.use("/api/gemini-proxy") がマウント部を剥がし、
// generativelanguage.googleapis.com へそのまま転送できる（本体 geminiSdkShim.ts と同設計）。
// サーバーの authenticate（x-api-key 内部認証）用に内部キーのみヘッダへ付与する。
// 実キーはサーバーが x-goog-api-key として注入するため、クライアントは実キーを一切持たない。
//
// 注意（CLAUDE.md）：Optional Chaining（?.）は使用しない。

import { GoogleGenAI } from "@google/genai";

// サーバー(/api)認証で使う内部APIキー（内部認証用であり秘匿対象の外部APIキーではない）
function getInternalApiKey(): string {
  const key = import.meta.env.VITE_INTERNAL_API_KEY;
  if (key && typeof key === "string") {
    return key;
  }
  return "";
}

// Gemini プロキシのベースURL。VITE_API_URL（= http://localhost:PORT/api）を基点にする。
// 例: http://localhost:3003/api → http://localhost:3003/api/gemini-proxy
function getGeminiProxyBaseUrl(): string {
  const apiBase = import.meta.env.VITE_API_URL;
  if (apiBase && typeof apiBase === "string" && apiBase !== "") {
    const trimmed = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
    return trimmed + "/gemini-proxy";
  }
  return "/api/gemini-proxy";
}

// プロキシ経由の GoogleGenAI クライアントを生成する。
// apiKey はダミー（サーバーが実キーを x-goog-api-key で差し替える）。
export function createProxiedGenAI(): GoogleGenAI {
  const headers: Record<string, string> = {};
  const internalKey = getInternalApiKey();
  if (internalKey !== "") {
    headers["x-api-key"] = internalKey;
  }
  return new GoogleGenAI({
    apiKey: "server-proxied-gemini-no-client-key",
    httpOptions: {
      baseUrl: getGeminiProxyBaseUrl(),
      headers: headers,
    },
  });
}
