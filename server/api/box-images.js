// BOX画像取得APIエンドポイント
// JWT認証でBOXフォルダ内の画像ファイル一覧を取得し、公開URLと共に返す

const { BoxClient } = require("box-node-sdk");
const { BoxJwtAuth, JwtConfig } = require("box-node-sdk/box");

let boxClient = null;

/**
 * BOXクライアントを初期化（シングルトン）
 */
function getBoxClient() {
  if (boxClient) return boxClient;

  const clientId = process.env.BOX_CLIENT_ID;
  const clientSecret = process.env.BOX_CLIENT_SECRET;
  const enterpriseId = process.env.BOX_ENTERPRISE_ID;
  const privateKey = process.env.BOX_PRIVATE_KEY;
  const passphrase = process.env.BOX_PASSPHRASE;

  if (!clientId || !clientSecret || !enterpriseId || !privateKey) {
    console.warn("⚠️ BOX環境変数が未設定です。BOX画像機能は無効です。");
    return null;
  }

  // 改行文字のエスケープを復元（環境変数では\\nとして格納されることがある）
  const resolvedPrivateKey = privateKey.replace(/\\n/g, "\n");

  const jwtConfig = new JwtConfig({
    clientId,
    clientSecret,
    jwtKeyId: process.env.BOX_JWT_KEY_ID || "",
    privateKey: resolvedPrivateKey,
    privateKeyPassphrase: passphrase || "",
    enterpriseId,
  });

  const jwtAuth = new BoxJwtAuth({ config: jwtConfig });
  boxClient = new BoxClient({ auth: jwtAuth });
  console.log("✅ BOXクライアント初期化完了");
  return boxClient;
}

/**
 * 画像ファイルかどうか判定
 */
function isImageFile(fileName) {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"];
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf("."));
  return imageExtensions.includes(ext);
}

/**
 * GET /api/box-images
 * BOXフォルダ内の画像ファイル一覧を取得
 */
async function getBoxImages(req, res) {
  try {
    const client = getBoxClient();
    if (!client) {
      console.log("⏭️ BOXクライアント未設定 — 空配列を返却");
      return res.json({ images: [] });
    }

    const folderId = process.env.BOX_FOLDER_ID;
    if (!folderId) {
      console.warn("⚠️ BOX_FOLDER_IDが未設定です");
      return res.json({ images: [] });
    }

    console.log(`📦 BOXフォルダ ${folderId} から画像を取得中...`);

    // フォルダ内のファイル一覧を取得
    const items = await client.folders.getFolderItems(folderId, {
      queryParams: {
        fields: ["name", "description", "tags", "shared_link", "size", "type"],
        limit: 100,
      },
    });

    const entries = items && items.entries ? items.entries : [];
    console.log(`📦 BOXフォルダ内アイテム数: ${entries.length}`);

    // 画像ファイルのみフィルタリング
    const imageFiles = entries.filter(
      (entry) => entry.type === "file" && isImageFile(entry.name)
    );
    console.log(`🖼️ 画像ファイル数: ${imageFiles.length}`);

    // 各画像ファイルの共有リンクを取得・作成
    const images = [];
    for (const file of imageFiles) {
      try {
        let downloadUrl = null;

        // 既存の共有リンクを確認
        if (file.sharedLink && file.sharedLink.downloadUrl) {
          downloadUrl = file.sharedLink.downloadUrl;
        } else {
          // 共有リンクを作成
          const fileWithLink = await client.sharedLinksFiles.addShareLinkToFile(
            file.id,
            {
              shared_link: {
                access: "open",
                permissions: {
                  can_download: true,
                },
              },
            },
            { queryParams: { fields: "shared_link" } }
          );
          if (fileWithLink && fileWithLink.sharedLink) {
            downloadUrl = fileWithLink.sharedLink.downloadUrl || fileWithLink.sharedLink.url;
          }
        }

        if (downloadUrl) {
          images.push({
            url: downloadUrl,
            title: file.name || "",
            description: file.description || "",
            tags: file.tags || [],
          });
        }
      } catch (linkError) {
        console.warn(`⚠️ 共有リンク作成失敗 (${file.name}):`, linkError.message);
        // 個別ファイルのエラーは無視して続行
      }
    }

    console.log(`✅ BOX画像取得完了: ${images.length}件`);
    return res.json({ images });
  } catch (error) {
    console.error("❌ BOX画像取得エラー:", error.message);
    // エラー時も空配列を返す（記事生成を止めない）
    return res.json({ images: [] });
  }
}

module.exports = { getBoxImages };
