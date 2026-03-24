// Google Drive APIエンドポイント
// サーバーサイドでGoogle Drive APIを実行
// ADC認証を優先、API keyをフォールバックとして使用

const { google } = require("googleapis");
const dotenv = require("dotenv");
dotenv.config();

// driveAutoAuthは開発環境でのみ読み込み（本番環境ではgcloudが利用できないため）
let driveAuth = null;
if (process.env.NODE_ENV !== "production") {
  try {
    driveAuth = require("../../services/driveAutoAuth.cjs");
  } catch (error) {
    console.warn(
      "⚠️ driveAutoAuth読み込み失敗（本番環境では正常）:",
      error.message
    );
  }
}

// APIハンドラー
async function handleCompanyData(req, res) {
  // CORS設定はメインのapp.jsで処理されるため削除

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const FOLDER_ID = process.env.COMPANY_DATA_FOLDER_ID || "";

    // 本番環境ではADC認証をスキップ（gcloudコマンドが利用できないため）
    if (process.env.NODE_ENV !== "production" && driveAuth) {
      console.log("🔐 ADC認証でGoogle Driveアクセスを試行中...");
      try {
        const csvContent = await driveAuth.getAllSegments(FOLDER_ID);

        if (csvContent) {
          console.log("✅ ADC認証で実績データを取得しました（PDF + Video）");
          return res.status(200).json({
            success: true,
            csvContent: csvContent,
            authMethod: "ADC",
            dataSource: "PDF + Video segments",
          });
        }
      } catch (adcError) {
        console.log(
          "⚠️ ADC認証失敗、API keyにフォールバック:",
          adcError.message
        );
      }
    } else {
      console.log("🏭 本番環境のため、ADC認証をスキップしてAPI Key認証を使用");
    }

    // API Key認証を使用（Google Drive API権限追加済み）
    const API_KEY =
      process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY;

    if (!API_KEY) {
      throw new Error(
        "Google APIキーが設定されていません。GOOGLE_API_KEYを設定してください"
      );
    }

    console.log("🔑 Google API Key認証でGoogle Driveにアクセス中...");

    // Drive APIクライアントを初期化
    const drive = google.drive({
      version: "v3",
      auth: API_KEY,
    });

    console.log(
      `📂 Google Driveフォルダ (${FOLDER_ID}) から実績データを検索中...`
    );

    // フォルダ内のpdf_segments_index.csvを探す
    const filesList = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name='pdf_segments_index.csv'`,
      fields: "files(id, name)",
      pageSize: 10,
    });

    let csvFileId;

    if (!filesList.data.files || filesList.data.files.length === 0) {
      console.log(
        "⚠️ pdf_segments_index.csvが見つかりません。他のCSVファイルを検索中..."
      );

      // 他のCSVファイルも探す
      const allCsvList = await drive.files.list({
        q: `'${FOLDER_ID}' in parents and (mimeType='text/csv' or name contains '.csv')`,
        fields: "files(id, name)",
        pageSize: 100,
      });

      if (!allCsvList.data.files || allCsvList.data.files.length === 0) {
        throw new Error("CSVファイルが見つかりませんでした");
      }

      // 最初のCSVファイルを使用
      const csvFile = allCsvList.data.files[0];
      console.log(`📊 ${csvFile.name}を使用します`);
      csvFileId = csvFile.id;
    } else {
      csvFileId = filesList.data.files[0].id;
      console.log(`✅ pdf_segments_index.csv (${csvFileId}) を取得中...`);
    }

    // CSVファイルをダウンロード
    const response = await drive.files.get(
      {
        fileId: csvFileId,
        alt: "media",
      },
      {
        responseType: "text",
      }
    );

    console.log("✅ Google Drive API (API key)から実績データを取得しました");

    res.status(200).json({
      success: true,
      csvContent: response.data,
      authMethod: "API_KEY",
    });
  } catch (error) {
    console.error("❌ Google Drive APIエラー:", error.message);
    if (error.response) {
      console.error("詳細:", error.response.data);
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = handleCompanyData;
