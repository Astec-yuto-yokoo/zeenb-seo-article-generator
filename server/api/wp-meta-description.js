/**
 * WordPress入稿後にメタディスクリプション（description）を設定する。
 * サイトごとに description の保存先が異なるため mode で切り替える（3プロジェクト共通実装）。
 *
 * - aioseo: All in One SEO の投稿一覧インライン編集API（posts-list/update-details-column）。
 *           送るのは description のみで、AIOSEOのタイトル設定は変更しない。
 * - yoast : Yoast SEO の _yoast_wpseo_metadesc を REST の meta で更新。
 *           Yoast はこのキーを REST 非公開で登録するため、WordPress側で register_post_meta による
 *           REST公開が必要。未公開の場合 WordPress は meta を黙って無視するので、応答で反映を確認する。
 * - emanon: Emanon Pro テーマの独自フィールド emanon_meta_description を XML-RPC wp.editPost で更新
 *           （REST非公開のカスタムフィールドのため）。
 *
 * 失敗しても記事作成自体は成功扱いにし、結果（applied / message）を呼び出し元へ返す。
 * フォーカスキーフレーズの設定（applyFocusKeyphrase）も同じ mode で切り替える。
 */

var SUPPORTED_MODES = ["aioseo", "yoast", "emanon"];

function normalizeDescription(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function applyAioseo(ctx) {
  var url = ctx.wpBaseUrl + "/wp-json/aioseo/v1/posts-list/update-details-column";
  var response = await ctx.fetch(url, {
    method: "POST",
    headers: { Authorization: ctx.authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ postId: ctx.postId, description: ctx.description }),
  });
  var data = await response.json().catch(function () {
    return {};
  });
  if (!response.ok || !data.success) {
    return {
      applied: false,
      message: "AIOSEOへのdescription設定に失敗 (HTTP " + response.status + "): " + (data.message || "unknown"),
    };
  }
  return { applied: true, message: "AIOSEOにdescriptionを設定しました" };
}

async function applyYoast(ctx) {
  var url = ctx.wpBaseUrl + "/wp-json/wp/v2/" + ctx.restBase + "/" + ctx.postId;
  var response = await ctx.fetch(url, {
    method: "POST",
    headers: { Authorization: ctx.authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ meta: { _yoast_wpseo_metadesc: ctx.description } }),
  });
  var data = await response.json().catch(function () {
    return {};
  });
  if (!response.ok) {
    return {
      applied: false,
      message: "Yoastへのdescription設定に失敗 (HTTP " + response.status + "): " + (data.message || "unknown"),
    };
  }
  var meta = data.meta || {};
  if (!Object.prototype.hasOwnProperty.call(meta, "_yoast_wpseo_metadesc")) {
    return {
      applied: false,
      message:
        "WordPress側で _yoast_wpseo_metadesc がREST公開されていないため、descriptionを設定できませんでした（register_post_meta の追加が必要）",
    };
  }
  return { applied: true, message: "Yoastにdescriptionを設定しました" };
}

async function applyEmanon(ctx) {
  return writeEmanonCustomField(ctx, "emanon_meta_description", ctx.description, "description");
}

// Emanon Pro の独自フィールド（REST非公開）を XML-RPC wp.editPost の custom_fields で更新する
async function writeEmanonCustomField(ctx, fieldKey, value, label) {
  var body =
    '<?xml version="1.0"?><methodCall><methodName>wp.editPost</methodName><params>' +
    "<param><value><int>1</int></value></param>" +
    "<param><value><string>" + escapeXml(ctx.wpUsername) + "</string></value></param>" +
    "<param><value><string>" + escapeXml(ctx.wpAppPassword) + "</string></value></param>" +
    "<param><value><int>" + ctx.postId + "</int></value></param>" +
    "<param><value><struct><member><name>custom_fields</name><value><array><data>" +
    "<value><struct>" +
    "<member><name>key</name><value><string>" + fieldKey + "</string></value></member>" +
    "<member><name>value</name><value><string>" + escapeXml(value) + "</string></value></member>" +
    "</struct></value>" +
    "</data></array></value></member></struct></value></param>" +
    "</params></methodCall>";

  var response = await ctx.fetch(ctx.wpBaseUrl + "/xmlrpc.php", {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=UTF-8" },
    body: body,
  });
  var text = await response.text();
  if (!response.ok || text.indexOf("<fault>") !== -1 || text.indexOf("<boolean>1</boolean>") === -1) {
    var faultMatch = text.match(/<name>faultString<\/name>\s*<value>\s*<string>([^<]*)<\/string>/);
    return {
      applied: false,
      message:
        "Emanonの" + label + "設定に失敗 (HTTP " + response.status + "): " + (faultMatch ? faultMatch[1] : "unexpected response"),
    };
  }
  return { applied: true, message: "Emanon（テーマのSEO設定）に" + label + "を設定しました" };
}

/**
 * @param {object} params
 * @param {string} params.mode            aioseo | yoast | emanon
 * @param {Function} params.fetch
 * @param {string} params.wpBaseUrl       末尾スラッシュなし
 * @param {string} params.restBase        posts / journal 等（yoastで使用）
 * @param {string} params.authHeader      Basic 認証ヘッダー（REST用）
 * @param {string} params.wpUsername      XML-RPC用
 * @param {string} params.wpAppPassword   XML-RPC用
 * @param {number} params.postId
 * @param {string} params.description
 * @returns {Promise<{applied: boolean, mode: string, message: string}>}
 */
async function applyMetaDescription(params) {
  var mode = String(params.mode || "").toLowerCase();
  var description = normalizeDescription(params.description);

  if (!description) {
    return { applied: false, mode: mode, message: "descriptionが空のため設定をスキップしました" };
  }
  if (SUPPORTED_MODES.indexOf(mode) === -1) {
    return { applied: false, mode: mode, message: "未対応のdescription設定モード: " + mode };
  }

  var ctx = {
    fetch: params.fetch,
    wpBaseUrl: params.wpBaseUrl,
    restBase: params.restBase || "posts",
    authHeader: params.authHeader,
    wpUsername: params.wpUsername,
    wpAppPassword: params.wpAppPassword,
    postId: params.postId,
    description: description,
  };

  try {
    var result;
    if (mode === "aioseo") result = await applyAioseo(ctx);
    else if (mode === "yoast") result = await applyYoast(ctx);
    else result = await applyEmanon(ctx);
    return { applied: result.applied, mode: mode, message: result.message };
  } catch (error) {
    return { applied: false, mode: mode, message: "description設定中にエラー: " + error.message };
  }
}

/**
 * フォーカスキーフレーズ（記事の対策キーワード）を設定する。mode は applyMetaDescription と共通。
 *
 * - aioseo: AIOSEO の keyphrases API（aioseo/v1/keyphrases）。focus のみ設定し、追加キーフレーズは空。
 * - yoast : Yoast SEO の _yoast_wpseo_focuskw を REST の meta で更新（description と同じく REST公開が必要）。
 * - emanon: Emanon Pro の独自フィールド emanon_meta_keywords（メタキーワード欄）を XML-RPC で更新。
 *
 * @returns {Promise<{applied: boolean, skipped: boolean, mode: string, message: string}>}
 */
async function applyFocusKeyphrase(params) {
  var mode = String(params.mode || "").toLowerCase();
  var keyphrase = normalizeDescription(params.keyphrase);

  if (!keyphrase) {
    return { applied: false, skipped: true, mode: mode, message: "キーフレーズが空のため設定をスキップしました" };
  }
  if (SUPPORTED_MODES.indexOf(mode) === -1) {
    return { applied: false, skipped: false, mode: mode, message: "未対応のキーフレーズ設定モード: " + mode };
  }

  var ctx = {
    fetch: params.fetch,
    wpBaseUrl: params.wpBaseUrl,
    restBase: params.restBase || "posts",
    authHeader: params.authHeader,
    wpUsername: params.wpUsername,
    wpAppPassword: params.wpAppPassword,
    postId: params.postId,
  };

  try {
    if (mode === "emanon") {
      var emanonResult = await writeEmanonCustomField(ctx, "emanon_meta_keywords", keyphrase, "キーワード");
      return { applied: emanonResult.applied, skipped: false, mode: mode, message: emanonResult.message };
    }

    var response;
    var data;
    if (mode === "aioseo") {
      response = await ctx.fetch(ctx.wpBaseUrl + "/wp-json/aioseo/v1/keyphrases", {
        method: "POST",
        headers: { Authorization: ctx.authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: ctx.postId,
          keyphrases: { focus: { keyphrase: keyphrase, score: 0, analysis: {} }, additional: [] },
        }),
      });
      data = await response.json().catch(function () {
        return {};
      });
      if (!response.ok || !data.success) {
        return {
          applied: false,
          skipped: false,
          mode: mode,
          message: "AIOSEOへのキーフレーズ設定に失敗 (HTTP " + response.status + "): " + (data.message || "unknown"),
        };
      }
      return { applied: true, skipped: false, mode: mode, message: "AIOSEOにフォーカスキーフレーズを設定しました" };
    }

    response = await ctx.fetch(ctx.wpBaseUrl + "/wp-json/wp/v2/" + ctx.restBase + "/" + ctx.postId, {
      method: "POST",
      headers: { Authorization: ctx.authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ meta: { _yoast_wpseo_focuskw: keyphrase } }),
    });
    data = await response.json().catch(function () {
      return {};
    });
    if (!response.ok) {
      return {
        applied: false,
        skipped: false,
        mode: mode,
        message: "Yoastへのキーフレーズ設定に失敗 (HTTP " + response.status + "): " + (data.message || "unknown"),
      };
    }
    var meta = data.meta || {};
    if (!Object.prototype.hasOwnProperty.call(meta, "_yoast_wpseo_focuskw")) {
      return {
        applied: false,
        skipped: false,
        mode: mode,
        message:
          "WordPress側で _yoast_wpseo_focuskw がREST公開されていないため、キーフレーズを設定できませんでした（register_post_meta の追加が必要）",
      };
    }
    return { applied: true, skipped: false, mode: mode, message: "Yoastにフォーカスキーフレーズを設定しました" };
  } catch (error) {
    return { applied: false, skipped: false, mode: mode, message: "キーフレーズ設定中にエラー: " + error.message };
  }
}

module.exports = { applyMetaDescription, applyFocusKeyphrase, normalizeDescription };
