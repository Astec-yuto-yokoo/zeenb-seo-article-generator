/**
 * スプレッドシートモードAPI
 * 「1」または「１」マークのあるキーワードを取得
 * Google API Key認証対応版（本番環境対応）
 *
 * スプレッドシートフォーマット:
 * A列: No.
 * B列: KW（キーワード）
 * C列: 編集用URL（マーカー: 1 or １ で処理対象を指定）
 * D列: Slug
 * E列: タイトル
 * F列: 公開用URL（内部リンクURL）
 * G列: メタディスクリプション
 */

const { google } = require("googleapis");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "";

/**
 * スプレッドシートから「1」または「１」マークのあるキーワードを取得
 */
async function getMarkedKeywords(req, res) {
  try {
    console.log("📊 スプレッドシートモード: キーワード取得開始");

    // デバッグ: 環境変数の確認
    console.log("🔍 環境変数デバッグ:");
    console.log(
      "  GOOGLE_APPLICATION_CREDENTIALS_JSON:",
      !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    );
    console.log("  GOOGLE_API_KEY:", !!process.env.GOOGLE_API_KEY);
    console.log("  NODE_ENV:", process.env.NODE_ENV);

    // ADC認証（環境変数対応）
    let auth;

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      // Render環境: 環境変数から直接認証情報を使用
      const credentials = JSON.parse(
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
      );
      auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets.readonly",
          "https://www.googleapis.com/auth/drive.readonly",
        ],
      });
      console.log("🔐 ADC認証（環境変数から認証情報を読み込み）");
    } else {
      // ローカル環境: 通常のADC認証
      auth = new google.auth.GoogleAuth({
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets.readonly",
          "https://www.googleapis.com/auth/drive.readonly",
        ],
      });
      console.log("🔐 ADC認証（ローカル環境）");
    }

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });

    // シート1のA列〜G列を取得（最大500行）
    const range = "シート1!A1:G500";
    console.log("📋 スプレッドシートからデータを取得中...");

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "スプレッドシートにデータが見つかりませんでした",
      });
    }

    // 「1」または「１」マークの検索
    const markedItems = [];

    for (let i = 0; i < rows.length; i++) {
      const cColumn = rows[i][2]; // C列（編集用URL / マーカー）
      const bColumn = rows[i][1]; // B列（KW）

      // 空白を完全除去、全角・半角の1両方に対応
      const normalizedC = cColumn ? cColumn.toString().replace(/\s+/g, "") : "";

      if (
        normalizedC === "1" ||
        normalizedC === "１" ||
        normalizedC === "■" ||
        normalizedC === "●"
      ) {
        // B列が空の場合はスキップ
        if (!bColumn || bColumn.trim() === "") {
          console.log(
            `⚠️ 行${i + 1}: マーカーはあるがB列（KW）が空のためスキップ`
          );
          continue;
        }

        markedItems.push({
          row: i + 1,
          keyword: bColumn.trim(),
          originalMarker: cColumn,
        });

        console.log(`✅ 行${i + 1}: マーカーを発見 - KW: ${bColumn.trim()}`);
      }
    }

    // エラーハンドリング
    if (markedItems.length === 0) {
      return res.status(404).json({
        success: false,
        error:
          "処理対象のマーカーが見つかりませんでした。スプレッドシートのC列に「1」または「１」を入力してください。",
      });
    }

    // B列全体が空かチェック
    const hasAnyKeyword = rows.some((row) => row[1] && row[1].trim() !== "");
    if (!hasAnyKeyword) {
      return res.status(400).json({
        success: false,
        error: "B列にキーワードが入力されていません",
      });
    }

    console.log(`📊 合計 ${markedItems.length} 個のキーワードを取得しました`);

    res.json({
      success: true,
      count: markedItems.length,
      keywords: markedItems,
    });
  } catch (error) {
    console.error("❌ スプレッドシートモードエラー:", error.message);

    // ADC認証エラーの場合は自動で再認証を促す
    if (
      error.message.includes("invalid_grant") ||
      error.message.includes("invalid_rapt") ||
      error.message.includes("reauth") ||
      error.message.includes("insufficient authentication scopes")
    ) {
      console.log(
        "🔐 ADC認証が期限切れ、またはスコープ不足です。再認証を実行してください:"
      );
      console.log(
        "   gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive"
      );

      return res.status(401).json({
        success: false,
        error: "Google認証が期限切れ、またはスコープ不足です",
        action: "ADC_REAUTH_REQUIRED",
        command:
          "gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * スプレッドシートからB列（キーワード）とF列（公開用URL）のマッピングを取得
 * 内部リンク挿入用
 */
async function getInternalLinkMap(req, res) {
  try {
    console.log("🔗 内部リンクマップ取得開始");

    // デバッグ: 環境変数の確認
    console.log("🔍 環境変数デバッグ:");
    console.log(
      "  GOOGLE_APPLICATION_CREDENTIALS_JSON:",
      !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    );

    // ADC認証（環境変数対応）
    let auth;

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      // Render環境: 環境変数から直接認証情報を使用
      const credentials = JSON.parse(
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
      );
      auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets.readonly",
          "https://www.googleapis.com/auth/drive.readonly",
        ],
      });
      console.log("🔐 ADC認証（環境変数から認証情報を読み込み）");
    } else {
      // ローカル環境: 通常のADC認証
      auth = new google.auth.GoogleAuth({
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets.readonly",
          "https://www.googleapis.com/auth/drive.readonly",
        ],
      });
      console.log("🔐 ADC認証（ローカル環境）");
    }

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });

    // シート1のA列〜G列を取得（最大500行）
    const range = "シート1!A1:G500";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "スプレッドシートにデータが見つかりませんでした",
      });
    }

    // B列（キーワード）とF列（公開用URL）のマッピングを構築
    const internalLinkMap = [];

    for (let i = 0; i < rows.length; i++) {
      const bColumn = rows[i][1]; // B列（KW）- 0-indexed なので 1
      const fColumn = rows[i][5]; // F列（公開用URL）- 0-indexed なので 5

      // B列とF列が両方存在する場合のみ追加
      if (
        bColumn &&
        bColumn.trim() !== "" &&
        fColumn &&
        fColumn.trim() !== ""
      ) {
        internalLinkMap.push({
          row: i + 1,
          keyword: bColumn.trim(),
          url: fColumn.trim(),
        });

        console.log(`✅ 行${i + 1}: ${bColumn.trim()} → ${fColumn.trim()}`);
      }
    }

    console.log(
      `🔗 合計 ${internalLinkMap.length} 個の内部リンクマッピングを取得しました`
    );

    res.json({
      success: true,
      count: internalLinkMap.length,
      linkMap: internalLinkMap,
    });
  } catch (error) {
    console.error("❌ 内部リンクマップ取得エラー:", error.message);

    // ADC認証エラーの場合は自動で再認証を促す
    if (
      error.message.includes("invalid_grant") ||
      error.message.includes("invalid_rapt") ||
      error.message.includes("reauth") ||
      error.message.includes("insufficient authentication scopes")
    ) {
      console.log(
        "🔐 ADC認証が期限切れ、またはスコープ不足です。再認証を実行してください:"
      );
      console.log(
        "   gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive"
      );

      return res.status(401).json({
        success: false,
        error: "Google認証が期限切れ、またはスコープ不足です",
        action: "ADC_REAUTH_REQUIRED",
        command:
          "gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = { getMarkedKeywords, getInternalLinkMap };
