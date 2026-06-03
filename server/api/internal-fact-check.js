// 社内ライブラリ・ファクトチェッカー（Dify Workflow API）プロキシ
// 記事HTMLを受け取り、Dify側でファクトチェックを実行 → 結果テキストを返す
//
// 環境変数:
//   DIFY_FACTCHECK_API_KEY  Dify Workflow API キー（必須）
//   DIFY_FACTCHECK_ENDPOINT 任意。未設定時は https://api.dify.ai/v1/workflows/run

const fetch = require("node-fetch");

const DEFAULT_ENDPOINT = "https://api.dify.ai/v1/workflows/run";
const DEFAULT_TIMEOUT_MS = 120000; // 90秒推奨 + 余裕30秒

async function runInternalFactCheck(req, res) {
  try {
    const articleText =
      req && req.body && typeof req.body.article_text === "string"
        ? req.body.article_text
        : "";

    if (!articleText || articleText.trim().length === 0) {
      return res
        .status(400)
        .json({ error: "article_text is required (HTML or plain text)" });
    }

    const apiKey = process.env.DIFY_FACTCHECK_API_KEY;
    if (!apiKey) {
      console.warn(
        "⚠️ DIFY_FACTCHECK_API_KEY 未設定のため、社内ファクトチェックはスキップされます"
      );
      return res.status(503).json({
        error: "DIFY_FACTCHECK_API_KEY is not configured",
        skipped: true,
      });
    }

    const endpoint = process.env.DIFY_FACTCHECK_ENDPOINT || DEFAULT_ENDPOINT;

    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
      controller.abort();
    }, DEFAULT_TIMEOUT_MS);

    const startedAt = Date.now();
    console.log(
      "🔎 社内ファクトチェッカー呼び出し開始 (length=" +
        articleText.length +
        ")"
    );

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: { article_text: articleText },
          response_mode: "blocking",
          user: "blog-agent",
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err && err.name === "AbortError";
      console.error(
        isAbort
          ? "⏱️ 社内ファクトチェッカーがタイムアウト（120秒）"
          : "❌ 社内ファクトチェッカー fetch エラー:",
        isAbort ? "" : err
      );
      return res.status(504).json({
        error: isAbort ? "Dify request timed out" : "Dify request failed",
        message: err && err.message ? err.message : String(err),
      });
    }

    clearTimeout(timeoutId);

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text().catch(function () {
        return "";
      });
      console.error(
        "❌ Dify API エラー status=" +
          upstreamResponse.status +
          " body=" +
          errText.substring(0, 500)
      );
      return res.status(502).json({
        error: "Dify upstream error",
        status: upstreamResponse.status,
        body: errText.substring(0, 1000),
      });
    }

    const data = await upstreamResponse.json();
    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

    const outputs =
      data && data.data && data.data.outputs ? data.data.outputs : {};
    const status =
      data && data.data && data.data.status ? data.data.status : "unknown";
    const factCheckResult =
      outputs && typeof outputs.fact_check_result === "string"
        ? outputs.fact_check_result
        : "";

    console.log(
      "✅ 社内ファクトチェッカー完了 (" +
        elapsedSec +
        "秒, status=" +
        status +
        ", length=" +
        factCheckResult.length +
        ")"
    );

    return res.json({
      success: true,
      status: status,
      elapsedMs: Date.now() - startedAt,
      fact_check_result: factCheckResult,
      raw: data,
    });
  } catch (err) {
    console.error("❌ 社内ファクトチェッカー 内部エラー:", err);
    return res.status(500).json({
      error: "Internal error",
      message: err && err.message ? err.message : String(err),
    });
  }
}

module.exports = { runInternalFactCheck };
