// BOX画像取得サービス
// サーバー側 /api/box-images エンドポイントを呼び出してBOX内の画像を取得

export interface ImageAsset {
  url: string;
  title: string;
  description: string;
  tags: string[];
}

/**
 * BOXフォルダ内の画像アセット一覧を取得
 * サーバー側でJWT認証・共有リンク作成を行うため、フロント側に秘密鍵は不要
 * エラー時は空配列を返す（記事生成を止めない）
 */
export async function fetchBoxImages(): Promise<ImageAsset[]> {
  try {
    const backendUrl =
      import.meta.env.VITE_API_URL || "http://localhost:3003";
    const apiKey = import.meta.env.VITE_INTERNAL_API_KEY;

    console.log("📦 BOX画像を取得中...");

    const response = await fetch(`${backendUrl}/api/box-images`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey || "",
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ BOX画像取得失敗: HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    const images: ImageAsset[] = data.images || [];

    console.log(`✅ BOX画像取得完了: ${images.length}件`);
    return images;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ BOX画像取得エラー: ${message}`);
    return [];
  }
}
