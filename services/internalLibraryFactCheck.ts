/**
 * 社内ライブラリ・ファクトチェッカー
 *
 * バックエンドの /api/internal-fact-check（Dify Workflow プロキシ）を呼び出し、
 * 記事HTML/テキストに対する社内ライブラリベースのファクトチェック結果を取得する。
 *
 * - 入力: 記事HTML（または整形済みテキスト）
 * - 出力: Difyワークフローが返す fact_check_result テキスト
 * - 失敗時: 例外をthrowせず { ok: false } を返す（呼び出し側がスキップ判定）
 */

// クライアント側からの timeout は120秒（Dify側35〜75秒 + 余裕）
const REQUEST_TIMEOUT_MS = 120000;

export interface InternalFactCheckResult {
  ok: boolean;
  status?: string;
  factCheckResult?: string;
  elapsedMs?: number;
  error?: string;
  skipped?: boolean;
}

function getApiBase(): string {
  const viteApiUrl = (import.meta as any).env
    ? (import.meta as any).env.VITE_API_URL
    : undefined;
  if (viteApiUrl) {
    return String(viteApiUrl).replace("/api", "");
  }
  const backendUrl = (import.meta as any).env
    ? (import.meta as any).env.VITE_BACKEND_URL
    : undefined;
  if (backendUrl) {
    return String(backendUrl);
  }
  return "http://localhost:3003";
}

function getApiKey(): string {
  const env = (import.meta as any).env;
  if (env && env.VITE_INTERNAL_API_KEY) {
    return String(env.VITE_INTERNAL_API_KEY);
  }
  return "";
}

export async function runInternalFactCheck(
  articleHtml: string
): Promise<InternalFactCheckResult> {
  if (!articleHtml || articleHtml.trim().length === 0) {
    return { ok: false, error: "article_text is empty" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = getApiKey();
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const startedAt = Date.now();
  console.log(
    "🔎 社内ライブラリ・ファクトチェッカー呼び出し (length=" +
      articleHtml.length +
      ")"
  );

  try {
    const response = await fetch(
      getApiBase() + "/api/internal-fact-check",
      {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ article_text: articleHtml }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      // 503 (キー未設定) は skipped 扱い
      if (response.status === 503) {
        return {
          ok: false,
          skipped: true,
          error: "DIFY_FACTCHECK_API_KEY not configured (skipped)",
        };
      }
      const errBody = await response.text().catch(function () {
        return "";
      });
      return {
        ok: false,
        error:
          "HTTP " + response.status + " " + errBody.substring(0, 300),
      };
    }

    const data = await response.json();
    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      "✅ 社内ファクトチェッカー応答 (" +
        elapsedSec +
        "秒, status=" +
        (data && data.status ? data.status : "unknown") +
        ")"
    );

    return {
      ok: true,
      status: data && data.status ? String(data.status) : "unknown",
      factCheckResult:
        data && typeof data.fact_check_result === "string"
          ? data.fact_check_result
          : "",
      elapsedMs:
        data && typeof data.elapsedMs === "number"
          ? data.elapsedMs
          : Date.now() - startedAt,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isAbort = err && (err as any).name === "AbortError";
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      isAbort
        ? "⏱️ 社内ファクトチェッカー タイムアウト（120秒）"
        : "❌ 社内ファクトチェッカー エラー: " + msg
    );
    return {
      ok: false,
      error: isAbort ? "timeout (120s)" : msg,
    };
  }
}
