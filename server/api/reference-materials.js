/**
 * 参考資料（独自情報ソース）API
 * PDF/TXT/CSVファイルのアップロード・管理・テキスト抽出
 */

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { execSync } = require("child_process");
const os = require("os");
const fetch = require("node-fetch");

// ディレクトリ設定
const BASE_DIR = path.join(__dirname, "..", "..", "data", "reference-materials");
const FILES_DIR = path.join(BASE_DIR, "files");
const EXTRACTED_DIR = path.join(BASE_DIR, "extracted");
const METADATA_PATH = path.join(BASE_DIR, "metadata.json");

// 許可するファイル拡張子
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".csv"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const OCR_MAX_PAGES = 20; // OCR対象の最大ページ数

// ディレクトリの初期化
function ensureDirectories() {
  [BASE_DIR, FILES_DIR, EXTRACTED_DIR].forEach(function (dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// メタデータ読み込み
function readMetadata() {
  ensureDirectories();
  if (!fs.existsSync(METADATA_PATH)) {
    return { version: 1, materials: [] };
  }
  try {
    const content = fs.readFileSync(METADATA_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("❌ metadata.json の読み込みに失敗:", err.message);
    return { version: 1, materials: [] };
  }
}

// メタデータ書き込み
function writeMetadata(metadata) {
  ensureDirectories();
  fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2), "utf-8");
}

// UUID生成
function generateId() {
  return crypto.randomUUID();
}

/**
 * PDF → 画像変換（pdftoppm使用）
 * 各ページをPNG画像のBufferとして返す
 */
function convertPdfToImages(buffer) {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-ocr-"));
  var pdfPath = path.join(tmpDir, "input.pdf");
  var outputPrefix = path.join(tmpDir, "page");

  try {
    fs.writeFileSync(pdfPath, buffer);
    // 200DPI でPNG変換（OCRに十分な解像度、ファイルサイズも適度）
    execSync(
      'pdftoppm -png -r 200 "' + pdfPath + '" "' + outputPrefix + '"',
      { timeout: 120000 }
    );

    // 生成されたPNG一覧を取得（ソートして順番を維持）
    var files = fs
      .readdirSync(tmpDir)
      .filter(function (f) {
        return f.startsWith("page-") && f.endsWith(".png");
      })
      .sort();

    var images = files.map(function (f) {
      return fs.readFileSync(path.join(tmpDir, f));
    });

    console.log("  📸 PDF→画像変換完了:", images.length, "ページ");
    return images;
  } finally {
    // 一時ファイル削除
    try {
      var tmpFiles = fs.readdirSync(tmpDir);
      tmpFiles.forEach(function (f) {
        fs.unlinkSync(path.join(tmpDir, f));
      });
      fs.rmdirSync(tmpDir);
    } catch (e) {
      // cleanup errors are non-critical
    }
  }
}

/**
 * Gemini Vision API で画像からテキストをOCR抽出
 * 1ページずつ処理して結合する
 */
async function ocrWithGemini(imageBuffers) {
  var apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY が設定されていません（OCRに必要）");
  }

  var allText = [];
  var url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    apiKey;

  for (var i = 0; i < imageBuffers.length; i++) {
    var base64 = imageBuffers[i].toString("base64");

    var body = {
      contents: [
        {
          parts: [
            {
              text:
                "この画像に含まれるすべてのテキストを正確に抽出してください。" +
                "レイアウトは無視して、テキストのみを改行で区切って出力してください。" +
                "見出し、本文、キャプション、表の内容、注釈などすべて含めてください。" +
                "テキストが全くない場合は「（テキストなし）」と返してください。",
            },
            {
              inline_data: {
                mime_type: "image/png",
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192,
      },
    };

    try {
      var response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        var errText = await response.text();
        console.error(
          "  ❌ Gemini OCR API エラー (Page " + (i + 1) + "):",
          errText.substring(0, 200)
        );
        continue;
      }

      var result = await response.json();

      if (
        result &&
        result.candidates &&
        result.candidates[0] &&
        result.candidates[0].content &&
        result.candidates[0].content.parts
      ) {
        var text = result.candidates[0].content.parts
          .map(function (p) {
            return p.text || "";
          })
          .join("");
        allText.push(text);
        console.log(
          "  ✅ Page " + (i + 1) + ": " + text.length + " 文字抽出"
        );
      }
    } catch (err) {
      console.error(
        "  ❌ Gemini OCR リクエストエラー (Page " + (i + 1) + "):",
        err.message
      );
      continue;
    }

    // レート制限対策: ページ間に短いディレイ
    if (i < imageBuffers.length - 1) {
      await new Promise(function (resolve) {
        setTimeout(resolve, 500);
      });
    }
  }

  return allText.join("\n\n");
}

// テキスト抽出（PDF: テキストレイヤー抽出 → OCRフォールバック、TXT/CSV: そのまま）
async function extractText(buffer, ext) {
  if (ext === ".pdf") {
    try {
      // Step 1: 通常のテキスト抽出を試みる
      console.log("📖 PDF テキスト抽出（テキストレイヤー）...");
      const { PDFParse } = require("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      await parser.load();
      const info = await parser.getInfo();
      var totalPages = (info && info.total) ? info.total : 1;
      const result = await parser.getText();
      var textContent = result.text || "";

      // 空白を除いた実質的な文字数
      var meaningfulChars = textContent.replace(/\s+/g, "").length;
      // 1ページあたり50文字未満 → 画像ベースPDFの可能性が高い
      var charsPerPage = totalPages > 0 ? meaningfulChars / totalPages : meaningfulChars;

      console.log("  - 総ページ数:", totalPages);
      console.log("  - テキスト抽出文字数:", meaningfulChars);
      console.log("  - 1ページあたり:", Math.round(charsPerPage), "文字");

      if (charsPerPage >= 50) {
        console.log("✅ テキストレイヤーから十分なテキストを取得");
        return textContent;
      }

      // テキストが少ない → 画像ベースPDFの可能性 → Gemini Vision OCR
      console.log("⚠️ テキストが少ないPDF → Gemini Vision OCRで抽出を試みます...");
      try {
        var images = convertPdfToImages(buffer);
        if (images.length > OCR_MAX_PAGES) {
          console.log(
            "⚠️ PDFが " + images.length + " ページあります（上限: " +
              OCR_MAX_PAGES + "ページ）。先頭 " + OCR_MAX_PAGES +
              " ページのみOCR処理します。"
          );
          images = images.slice(0, OCR_MAX_PAGES);
        }
        if (images.length > 0) {
          var ocrText = await ocrWithGemini(images);
          var ocrMeaningful = ocrText.replace(/\s+/g, "").length;
          if (ocrMeaningful > meaningfulChars) {
            console.log(
              "✅ Gemini OCR完了: " +
                ocrMeaningful +
                " 文字取得（テキストレイヤーの " +
                meaningfulChars +
                " 文字から改善）"
            );
            return ocrText;
          }
          console.log(
            "⚠️ OCR結果がテキストレイヤーより少ないため、テキストレイヤーの結果を使用します"
          );
        }
      } catch (ocrErr) {
        console.error("❌ OCR処理エラー:", ocrErr.message);
        console.log("⚠️ OCR失敗のため、テキストレイヤーの結果をそのまま使用します");
      }
      return textContent;
    } catch (err) {
      console.error("❌ PDF テキスト抽出エラー:", err.message);
      throw new Error("PDFからのテキスト抽出に失敗しました: " + err.message);
    }
  }
  // TXT, CSV はそのまま
  return buffer.toString("utf-8");
}

// Multer設定（メモリストレージ）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: function (req, file, cb) {
    var ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.indexOf(ext) !== -1) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "サポートされていないファイル形式です。対応形式: PDF, TXT, CSV"
        )
      );
    }
  },
});

// multerインスタンスの取得
function getMulterUpload() {
  return upload;
}

/**
 * POST /api/reference-materials/upload
 * ファイルアップロード + テキスト抽出
 */
async function handleUpload(req, res) {
  try {
    console.log("📤 参考資料アップロード開始");

    if (!req.file) {
      return res.status(400).json({ error: "ファイルが選択されていません" });
    }

    var file = req.file;
    // multerはファイル名をlatin1でデコードするため、日本語が文字化けする
    // Buffer経由でutf-8に復元する
    var originalName = Buffer.from(file.originalname, "latin1").toString("utf-8");
    var ext = path.extname(originalName).toLowerCase();
    var id = generateId();

    console.log("  - ファイル名:", originalName);
    console.log("  - サイズ:", file.size, "bytes");
    console.log("  - 形式:", ext);
    console.log("  - ID:", id);

    // テキスト抽出
    console.log("📖 テキスト抽出中...");
    var extractedText = await extractText(file.buffer, ext);
    console.log("  - 抽出文字数:", extractedText.length);

    // ファイル保存
    ensureDirectories();
    var filePath = path.join(FILES_DIR, id + ext);
    fs.writeFileSync(filePath, file.buffer);

    // 抽出テキスト保存
    var extractedPath = path.join(EXTRACTED_DIR, id + ".txt");
    fs.writeFileSync(extractedPath, extractedText, "utf-8");

    // メタデータ更新
    var title = req.body && req.body.title ? req.body.title : originalName;
    var description =
      req.body && req.body.description ? req.body.description : "";
    var tags = [];
    if (req.body && req.body.tags) {
      try {
        tags = JSON.parse(req.body.tags);
      } catch (e) {
        tags = [];
      }
    }

    var material = {
      id: id,
      originalFileName: originalName,
      fileType: ext.replace(".", ""),
      fileSize: file.size,
      title: title,
      description: description,
      tags: tags,
      uploadedAt: new Date().toISOString(),
      extractedTextLength: extractedText.length,
      status: "ready",
    };

    var metadata = readMetadata();
    metadata.materials.push(material);
    writeMetadata(metadata);

    console.log("✅ 参考資料アップロード完了:", id);
    res.json({ success: true, material: material });
  } catch (err) {
    console.error("❌ 参考資料アップロードエラー:", err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/reference-materials
 * 一覧取得
 */
function handleList(req, res) {
  try {
    var metadata = readMetadata();
    var materials = metadata.materials;

    // タグフィルタリング
    if (req.query && req.query.tags) {
      var filterTags = req.query.tags.split(",").map(function (t) {
        return t.trim().toLowerCase();
      });
      materials = materials.filter(function (m) {
        return m.tags.some(function (tag) {
          return filterTags.indexOf(tag.toLowerCase()) !== -1;
        });
      });
    }

    console.log("📋 参考資料一覧取得:", materials.length, "件");
    res.json({ success: true, materials: materials });
  } catch (err) {
    console.error("❌ 参考資料一覧取得エラー:", err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/reference-materials/:id
 * 抽出テキスト取得
 */
function handleGetExtracted(req, res) {
  try {
    var id = req.params.id;
    var extractedPath = path.join(EXTRACTED_DIR, id + ".txt");

    if (!fs.existsSync(extractedPath)) {
      return res.status(404).json({ error: "参考資料が見つかりません" });
    }

    var text = fs.readFileSync(extractedPath, "utf-8");
    var metadata = readMetadata();
    var material = metadata.materials.find(function (m) {
      return m.id === id;
    });

    console.log("📖 参考資料テキスト取得:", id);
    res.json({
      success: true,
      id: id,
      title: material ? material.title : "",
      originalFileName: material ? material.originalFileName : "",
      extractedText: text,
    });
  } catch (err) {
    console.error("❌ 参考資料テキスト取得エラー:", err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/reference-materials/:id
 * 削除
 */
function handleDelete(req, res) {
  try {
    var id = req.params.id;
    var metadata = readMetadata();
    var materialIndex = metadata.materials.findIndex(function (m) {
      return m.id === id;
    });

    if (materialIndex === -1) {
      return res.status(404).json({ error: "参考資料が見つかりません" });
    }

    var material = metadata.materials[materialIndex];
    var ext = "." + material.fileType;

    // ファイル削除
    var filePath = path.join(FILES_DIR, id + ext);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    var extractedPath = path.join(EXTRACTED_DIR, id + ".txt");
    if (fs.existsSync(extractedPath)) {
      fs.unlinkSync(extractedPath);
    }

    // メタデータから削除
    metadata.materials.splice(materialIndex, 1);
    writeMetadata(metadata);

    console.log("🗑️ 参考資料削除完了:", id);
    res.json({ success: true, id: id });
  } catch (err) {
    console.error("❌ 参考資料削除エラー:", err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getMulterUpload,
  handleUpload,
  handleList,
  handleGetExtracted,
  handleDelete,
};
