import { GoogleGenAI, Modality } from "@google/genai";

// エクスポネンシャルバックオフ用のヘルパー関数
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  initialDelay: number = 1000
): Promise<T> {
  let delay = initialDelay;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      // 429エラー（レート制限）の場合のみリトライ
      if (error?.status === 429 && i < maxRetries - 1) {
        console.warn(
          `🔄 429エラー検出 - リトライ ${
            i + 1
          }/${maxRetries}: ${delay}ms待機中...`
        );
        await sleep(delay);
        delay *= 2; // 待機時間を2倍に
      } else {
        // 429以外のエラーまたは最後のリトライの場合はそのままエラーを投げる
        throw error;
      }
    }
  }

  throw new Error("Max retries exceeded");
}

// 複数のAPIキーをサポート
const API_KEYS = [
  process.env.API_KEY,
  process.env.API_KEY_2,
  process.env.API_KEY_3,
].filter(Boolean); // 存在するキーのみ使用

if (API_KEYS.length === 0) {
  throw new Error(
    "At least one API_KEY environment variable must be set (API_KEY, API_KEY_2, or API_KEY_3)."
  );
}

console.log(`✅ ${API_KEYS.length}個のAPIキーが設定されています`);

// 各APIキー用のクライアントを作成
const aiClients = API_KEYS.map(
  (apiKey) => new GoogleGenAI({ apiKey: apiKey! })
);

function dataUrlToBlob(dataUrl: string): { data: string; mimeType: string } {
  const parts = dataUrl.split(",");
  const mimeType = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const data = parts[1];
  return { data, mimeType };
}

// APIキーのラウンドロビン用カウンター
let currentKeyIndex = 0;

// 次のAPIキーを取得（ラウンドロビン）
function getNextAIClient(): GoogleGenAI {
  const client = aiClients[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % aiClients.length;
  return client;
}

export const generateImage = async (
  baseImageB64: string,
  prompt: string,
  clientIndex?: number
): Promise<string> => {
  const { data: base64ImageData, mimeType } = dataUrlToBlob(baseImageB64);

  // clientIndexが指定されていれば、そのクライアントを使用（並列処理用）
  const ai =
    clientIndex !== undefined
      ? aiClients[clientIndex % aiClients.length]
      : getNextAIClient();

  return retryWithExponentialBackoff(async () => {
    let response: any;

    try {
      // gemini-3-pro-image-previewを使用
      const modelsToTry = ["gemini-3-pro-image-preview"];

      let lastError;

      for (const modelName of modelsToTry) {
        try {
          console.log(`🔄 ${modelName} で画像生成を試行中...`);

          response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    data: base64ImageData,
                    mimeType: mimeType,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
            config: {
              responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
          });

          console.log(`✅ ${modelName} でレスポンス取得成功`);
          break; // 成功したらループを抜ける
        } catch (modelError: any) {
          console.warn(`⚠️ ${modelName} で失敗:`, modelError.message);
          lastError = modelError;
          continue; // 次のモデルを試行
        }
      }

      if (!response) {
        throw lastError || new Error("All models failed");
      }
    } catch (error: any) {
      // API呼び出しエラーの詳細ログ
      console.error("🚨 Gemini API呼び出しエラー:", {
        status: error?.status || error?.response?.status || "Unknown",
        statusText:
          error?.statusText || error?.response?.statusText || "Unknown",
        message: error?.message || "Unknown error",
        details:
          error?.response?.data || error?.details || "No details available",
        timestamp: new Date().toISOString(),
        promptLength: prompt?.length || 0,
        imageSize: base64ImageData?.length || 0,
        errorType: error?.name || "UnknownError",
        fullError: JSON.stringify(error, null, 2),
      });

      // 500エラーの場合、追加の診断情報を出力
      if (error?.status === 500 || error?.response?.status === 500) {
        console.error("❌ 500 Internal Server Error 診断情報:");
        console.error(
          "  - プロンプト冒頭100文字:",
          prompt?.substring(0, 100) + "..."
        );
        console.error("  - 画像サイズ(bytes):", base64ImageData?.length || 0);
        console.error(
          "  - 画像サイズ(MB):",
          ((base64ImageData?.length || 0) / 1024 / 1024).toFixed(2) + "MB"
        );
        console.error("  - mimeType:", mimeType);
        console.error("  - 現在時刻:", new Date().toISOString());
        console.error("  - エラー詳細:", error);
      }

      throw error;
    }

    // レスポンスの詳細ログ
    console.log("📊 Gemini APIレスポンス詳細:", {
      hasResponse: !!response,
      hasCandidates: !!response?.candidates,
      candidatesCount: response?.candidates?.length || 0,
      finishReason: response?.candidates?.[0]?.finishReason,
      safetyRatings: response?.candidates?.[0]?.safetyRatings,
      timestamp: new Date().toISOString(),
    });

    // レスポンス全体をログ出力（デバッグ用）
    console.log("🔍 完全なレスポンス:", JSON.stringify(response, null, 2));

    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];

      // 画像が生成されなかった理由を詳細に記録
      if (candidate.finishReason && candidate.finishReason !== "STOP") {
        console.warn("⚠️ 画像生成が正常に完了しませんでした:", {
          finishReason: candidate.finishReason,
          safetyRatings: candidate.safetyRatings,
          content: candidate.content,
        });
      }

      // content.partsの詳細ログ
      console.log("🔍 candidate.content.parts:", candidate.content.parts);

      for (const part of candidate.content.parts) {
        console.log("🔍 part:", part);
        if (part.inlineData) {
          const generatedMimeType = part.inlineData.mimeType;
          const generatedData = part.inlineData.data;
          console.log("✅ 画像生成成功");
          return `data:${generatedMimeType};base64,${generatedData}`;
        }
      }
    }

    // 画像が生成されなかった場合の詳細エラー
    const errorDetails = {
      message: "No image was generated in the response.",
      response: {
        hasCandidates: !!response?.candidates,
        candidatesCount: response?.candidates?.length || 0,
        finishReason: response?.candidates?.[0]?.finishReason,
        safetyRatings: response?.candidates?.[0]?.safetyRatings,
        responseText: response?.text,
      },
      timestamp: new Date().toISOString(),
    };

    console.error("❌ 画像生成失敗:", errorDetails);
    throw new Error(JSON.stringify(errorDetails));
  });
};

export const checkForTextInImage = async (
  imageBase64: string
): Promise<boolean> => {
  const { data: base64ImageData, mimeType } = dataUrlToBlob(imageBase64);

  return retryWithExponentialBackoff(async () => {
    const ai = getNextAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64ImageData,
              mimeType: mimeType,
            },
          },
          {
            text: "Is there any text, letters, or numbers visible in this image? Please answer with only 'Yes' or 'No'.",
          },
        ],
      },
    });

    const resultText = response.text.trim().toLowerCase();
    return resultText.includes("yes");
  }).catch((error) => {
    console.error("Error checking for text in image after retries:", error);
    // If the check fails after retries, assume it's okay to avoid blocking the whole process.
    return false;
  });
};

export const generateBackgroundInstruction = async (
  h2Text: string,
  paragraphText: string
): Promise<string> => {
  return retryWithExponentialBackoff(async () => {
    const prompt = `You are a creative assistant for an illustrator. Based on the following heading and paragraph from an article, suggest a compelling and visually interesting background for an illustration. Describe the background in a short, descriptive phrase (e.g., "A futuristic cityscape at night," "A tranquil forest with sunbeams," "A cozy, warm-lit library"). Do not describe the main subject, only the background.

Heading: "${h2Text}"
Paragraph: "${paragraphText}"

Background Suggestion:`;

    const ai = getNextAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: prompt,
    });
    return response.text.trim().replace(/"/g, ""); // Remove quotes from response
  }).catch((error) => {
    console.error(
      "Error generating background instruction after retries:",
      error
    );
    return "A simple, neutral background."; // Fallback instruction
  });
};

/**
 * H2見出し・段落テキストから、写真撮影指示書（英語）を自動生成する。
 * Gemini テキストモデルが「プロの商業カメラマン」として
 * カメラ・レンズ・照明・構図を含む具体的な撮影ディレクションを出力する。
 *
 * 生成されたプロンプトはそのまま gemini-3-pro-image-preview に渡して画像生成に使う。
 */
export const generatePhotographyPrompt = async (
  h2Text: string,
  paragraphText: string
): Promise<string> => {
  return retryWithExponentialBackoff(async () => {
    const systemPrompt = `You are a professional commercial photographer specializing in Japanese corporate and editorial photography.

Your task: Given a heading and paragraph from a Japanese business article, create a detailed PHOTOGRAPHY DIRECTION in English (max 200 words) that will be used to generate a photorealistic image.

REQUIREMENTS — always include ALL of these:
1. SUBJECT: Concrete description of people (number, gender, clothing, action), objects, or scene. For people, specify Japanese individuals.
2. CAMERA: Choose one — Sony α7IV, Canon EOS R5, or Fujifilm X-T5
3. LENS: Focal length and aperture (e.g. "35mm f/1.8", "85mm f/1.4", "24-70mm f/2.8")
4. LIGHTING: MUST be bright and well-lit. Use abundant natural daylight (large window light, clear sunny day, bright overcast). For indoor scenes use bright fluorescent office lighting or large windows letting in plenty of light. NEVER use dim, moody, or low-key lighting.
5. COMPOSITION: Angle (eye-level, slightly above, low angle), framing, depth of field
6. ATMOSPHERE: bright, clean, professional — like a Japanese stock photo
7. SETTING: Specific Japanese location or interior (modern bright Tokyo office, clean apartment building under blue sky, etc.)

CONSTRAINTS:
- Output ONLY the photography direction. No explanations, no headers, no bullet points.
- Write as a single flowing paragraph of natural English.
- NO text, logos, watermarks, or UI elements in the image.
- The scene must look like a real photograph taken in Japan.
- Avoid overly perfect or symmetrical compositions — add slight natural imperfection.
- The overall image must be BRIGHT and WELL-LIT with clean, natural colors. Think Japanese stock photography tone — warm, inviting. Preserve highlight detail and avoid blown-out whites.
- For outdoor scenes, always use clear blue sky or bright daylight, NEVER overcast or cloudy.
- White balance should be neutral to slightly warm.

Heading: "${h2Text}"
Paragraph: "${paragraphText}"

Photography Direction:`;

    const ai = getNextAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: systemPrompt,
    });

    var result = response.text.trim();

    // 万一マークダウンやヘッダが混入した場合は除去
    result = result.replace(/^#+\s.*/gm, "").trim();
    result = result.replace(/^\*\*.*/gm, "").trim();
    result = result.replace(/^-\s.*/gm, "").trim();

    console.log("📸 写真プロンプト生成完了 (" + result.length + " chars)");
    return result;
  }).catch((error: any) => {
    console.error("Error generating photography prompt after retries:", error);
    // フォールバック: 汎用的な写真プロンプト
    return "A bright, well-lit editorial photograph of Japanese business professionals in a modern Tokyo office with large windows, shot on Sony α7IV with 35mm f/1.8 lens, abundant natural daylight streaming in, slight bokeh in background, clean warm color palette, high-key exposure, no text or logos.";
  });
};

export const summarizeText = async (text: string): Promise<string> => {
  return retryWithExponentialBackoff(async () => {
    const ai = getNextAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: `Summarize the following text in a single, concise sentence suitable for an image alt text: "${text}"`,
    });
    return response.text.trim();
  }).catch((error) => {
    console.error("Error summarizing text after retries:", error);
    // Fallback to simple truncation
    return text.trim().split(/\s+/).slice(0, 20).join(" ") + "...";
  });
};

// 並列画像生成タスクの型定義
export interface ImageGenerationTask {
  baseImageB64: string;
  prompt: string;
  taskId: string; // タスク識別用ID（例: "image-1", "image-2"）
}

// 並列画像生成結果の型定義
export interface ImageGenerationResult {
  taskId: string;
  success: boolean;
  imageData?: string; // 生成成功時のBase64画像データ
  error?: string; // 生成失敗時のエラーメッセージ
}

/**
 * 複数の画像を並列生成する
 *
 * @param tasks - 画像生成タスクの配列
 * @returns 生成結果の配列（タスクIDと成功/失敗情報を含む）
 *
 * 実装の特徴:
 * - 複数APIキーを使用した並列処理
 * - タスクを利用可能なAPIキーに均等に分散
 * - 1つのタスクが失敗しても他のタスクは継続
 * - 生成が完了したエージェントから次のタスクへ順次進む
 */
export const generateImagesInParallel = async (
  tasks: ImageGenerationTask[]
): Promise<ImageGenerationResult[]> => {
  const apiKeyCount = API_KEYS.length;

  console.log(
    `🚀 並列画像生成開始: ${tasks.length}個のタスクを${apiKeyCount}個のAPIキーで処理`
  );

  // 各APIキーに割り当てるタスクを分配
  const tasksByClient: ImageGenerationTask[][] = Array.from(
    { length: apiKeyCount },
    () => []
  );

  tasks.forEach((task, index) => {
    const clientIndex = index % apiKeyCount;
    tasksByClient[clientIndex].push(task);
  });

  // 各APIキーごとにタスクを順次実行する関数
  const processTasksForClient = async (
    clientIndex: number,
    clientTasks: ImageGenerationTask[]
  ): Promise<ImageGenerationResult[]> => {
    const results: ImageGenerationResult[] = [];

    console.log(
      `📋 Client ${clientIndex + 1}: ${clientTasks.length}個のタスクを処理開始`
    );

    for (const task of clientTasks) {
      try {
        console.log(`🎨 Client ${clientIndex + 1}: ${task.taskId} 生成中...`);
        const imageData = await generateImage(
          task.baseImageB64,
          task.prompt,
          clientIndex
        );

        results.push({
          taskId: task.taskId,
          success: true,
          imageData,
        });

        console.log(`✅ Client ${clientIndex + 1}: ${task.taskId} 生成完了`);
      } catch (error: any) {
        console.error(
          `❌ Client ${clientIndex + 1}: ${task.taskId} 生成失敗:`,
          error.message
        );

        results.push({
          taskId: task.taskId,
          success: false,
          error: error.message || "Unknown error",
        });
      }
    }

    console.log(
      `✨ Client ${clientIndex + 1}: 全タスク完了 (${results.length}個)`
    );
    return results;
  };

  // 全てのクライアントで並列処理を実行
  const allResults = await Promise.all(
    tasksByClient.map((clientTasks, clientIndex) =>
      processTasksForClient(clientIndex, clientTasks)
    )
  );

  // 結果を平坦化して元のタスク順に並び替え
  const flatResults = allResults.flat();
  const sortedResults = tasks.map(
    (task) => flatResults.find((result) => result.taskId === task.taskId)!
  );

  const successCount = sortedResults.filter((r) => r.success).length;
  const failCount = sortedResults.filter((r) => !r.success).length;

  console.log(
    `🎉 並列画像生成完了: 成功 ${successCount}個 / 失敗 ${failCount}個 / 合計 ${tasks.length}個`
  );

  return sortedResults;
};
