// Gemini SDK シム（セキュリティ：APIキーをブラウザに出さないための差し替え）
//
// vite.config.ts の resolve.alias により、アプリ内の
//   import { GoogleGenerativeAI } from "@google/generative-ai"
// はすべてこのファイルに解決される。
// ここで GoogleGenerativeAI を差し替え、全ての生成リクエストを
// サーバープロキシ（/api/gemini-proxy）経由に強制する。実APIキーはサーバー側のみが保持し、
// x-goog-api-key ヘッダをサーバーで注入する。クライアントは実キーを一切持たない。
//
// 注意（CLAUDE.md）：Optional Chaining（?.）は使用しない。

// 実体SDKは node_modules 内の実ファイルを相対パスで直接読む。
// - alias（/^@google\/generative-ai$/）にマッチしないため無限ループにならない
// - 相対ファイル参照は package.json の exports 制約を受けない
export * from "../node_modules/@google/generative-ai/dist/index.mjs";
import { GoogleGenerativeAI as RealGoogleGenerativeAI } from "../node_modules/@google/generative-ai/dist/index.mjs";

const PROXY_BASE_URL = "/api/gemini-proxy";

// サーバー(/api)認証で使う内部APIキー（既存の x-api-key 認証と同じ）
function getInternalApiKey(): string {
  const key = import.meta.env.VITE_INTERNAL_API_KEY;
  if (key && typeof key === "string") {
    return key;
  }
  return "";
}

// getGenerativeModel に渡す requestOptions を、必ずプロキシ経由になるよう組み立てる
function buildProxyRequestOptions(requestOptions: any): any {
  const base = requestOptions ? requestOptions : {};
  const merged = Object.assign({}, base);
  merged.baseUrl = PROXY_BASE_URL;

  const existingHeaders =
    base && base.customHeaders ? base.customHeaders : {};
  const mergedHeaders = Object.assign({}, existingHeaders);
  mergedHeaders["x-api-key"] = getInternalApiKey();
  merged.customHeaders = mergedHeaders;

  return merged;
}

export class GoogleGenerativeAI extends RealGoogleGenerativeAI {
  constructor(_apiKey?: string) {
    // 実キーは使わない。サーバープロキシが x-goog-api-key を差し替える。
    super("server-proxied-gemini-no-client-key");
  }

  getGenerativeModel(modelParams: any, requestOptions?: any): any {
    return super.getGenerativeModel(
      modelParams,
      buildProxyRequestOptions(requestOptions)
    );
  }
}
