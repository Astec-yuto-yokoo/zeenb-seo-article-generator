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

// ============================================================
// ビジュアルカテゴリ分類システム（改善案A + D）
// H2テーマに応じて異なるビジュアルを生成し、単調さを排除する
// ============================================================

type VisualCategory =
  | "construction-site"  // 塗装工事・足場・施工現場
  | "building-exterior"  // 建物外観・劣化・屋根・外壁
  | "consultation"       // 相談・打合せ・専門家アドバイス
  | "data-analysis"      // 費用・相場・比較・統計
  | "checklist"          // 注意点・確認事項・契約
  | "product"            // 製品・塗料・性能・素材
  | "lifestyle"          // 暮らし・快適・入居者生活
  | "concept";           // まとめ・メリット・ポイント・抽象

interface CategoryRule {
  category: VisualCategory;
  keywords: string[];
  /** 高優先キーワード: 1つでもマッチすればこのカテゴリ確定 */
  strongKeywords?: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "construction-site",
    strongKeywords: ["足場", "高圧洗浄", "施工中", "養生", "飛散防止", "葺き替え"],
    keywords: ["塗装工事", "施工", "工事中", "下塗り", "上塗り", "中塗り", "吹付", "ローラー", "職人", "作業員", "塗り替え工事", "塗装手順", "施工手順", "工事の流れ", "施工事例"],
  },
  {
    category: "building-exterior",
    strongKeywords: ["劣化", "ひび割れ", "クラック", "チョーキング", "色褪せ", "雨漏り", "剥がれ", "外壁診断", "屋根診断"],
    keywords: ["外壁", "屋根", "外観", "外装", "修繕", "防水", "サイディング", "モルタル", "コーキング", "シーリング", "遮熱", "断熱", "塗膜", "築年数"],
  },
  {
    category: "product",
    strongKeywords: ["塗料", "シリコン", "フッ素", "無機", "ウレタン", "遮熱塗料"],
    keywords: ["製品", "性能", "耐久性", "耐候性", "塗膜", "下地", "プライマー", "トップコート", "水性", "油性", "艶"],
  },
  {
    category: "data-analysis",
    strongKeywords: ["相場", "見積", "費用一覧"],
    keywords: ["費用", "価格", "コスト", "単価", "坪単価", "手数料", "料金", "予算", "比較表", "統計", "データ", "推移", "平均", "年数", "耐用年数"],
  },
  {
    category: "checklist",
    strongKeywords: ["注意点", "要確認", "チェックリスト"],
    keywords: ["確認", "契約", "トラブル", "失敗", "リスク", "違約", "クレーム", "保証", "保険", "法律", "規約", "届出", "許可"],
  },
  {
    category: "consultation",
    keywords: ["選び方", "相談", "比較", "検討", "依頼", "業者", "見極め", "探し方", "選定", "判断", "ポイント", "基準", "提案", "専門家", "アドバイス", "報告", "担当者", "レスポンス", "対応"],
  },
  {
    category: "lifestyle",
    strongKeywords: ["入居者", "住み心地", "快適性"],
    keywords: ["暮らし", "快適", "住まい", "生活", "家族", "入居", "居住", "美観", "清潔", "きれい", "カラー", "シミュレーション", "デザイン", "景観"],
  },
  {
    category: "concept",
    strongKeywords: ["まとめ", "よくある質問", "FAQ"],
    keywords: ["メリット", "デメリット", "重要", "成功", "効果", "理由", "目的", "基礎知識", "基本", "全体", "ガイド", "完全", "徹底", "解説"],
  },
];

/**
 * H2テキストと段落テキストからビジュアルカテゴリを判定する。
 * strongKeywordsの1語マッチ → 即確定。それ以外はスコア最大のカテゴリを返す。
 */
function classifyVisualCategory(h2Text: string, paragraphText: string): VisualCategory {
  const combined = (h2Text + " " + paragraphText).toLowerCase();

  // Phase 1: strongKeywordsで即確定
  for (const rule of CATEGORY_RULES) {
    if (rule.strongKeywords) {
      for (const kw of rule.strongKeywords) {
        if (combined.includes(kw)) {
          console.log(`🏷️ カテゴリ確定(strong): ${rule.category} ← "${kw}"`);
          return rule.category;
        }
      }
    }
  }

  // Phase 2: 通常keywordsのスコアリング
  let bestCategory: VisualCategory = "concept";
  let bestScore = 0;

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (combined.includes(kw)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.category;
    }
  }

  console.log(`🏷️ カテゴリ判定: ${bestCategory} (score: ${bestScore})`);
  return bestCategory;
}

// カテゴリ別のSUBJECT・SETTING・COMPOSITIONガイド
const CATEGORY_PROMPTS: Record<VisualCategory, string> = {
  "construction-site": `VISUAL CATEGORY: Construction / Painting Site
SUBJECT GUIDANCE: Depict an active or completed construction/painting scene. Show the building wrapped in mesh sheets, workers in safety gear, or freshly painted surfaces. Focus on the WORK PROCESS or RESULT.
SETTING: Japanese residential neighborhood, apartment or house exterior with scaffolding, clear blue sky above.
COMPOSITION: Wide-angle (24-35mm) to show the full building and scaffolding coverage. Eye-level or slightly elevated angle. Maximum 2 workers visible.`,

  "building-exterior": `VISUAL CATEGORY: Building Exterior / Architecture
SUBJECT GUIDANCE: Show the building itself as the main subject — its walls, roof, facade, or architectural details. For deterioration topics, show close-up textures of walls, cracks, or weathering. For general topics, show a clean, well-maintained building exterior. Do NOT add people as the main subject.
SETTING: Japanese residential area — apartment building, house, or commercial building under clear blue sky. Show surrounding landscaping or streets for context.
COMPOSITION: Choose between wide-angle establishing shot (24mm) of full building, or medium telephoto (85-135mm) close-up of wall texture/architectural detail. Vary the angle — front facade, corner perspective, or upward-looking at roofline.`,

  "consultation": `VISUAL CATEGORY: Professional Consultation / Business Meeting
SUBJECT GUIDANCE: Show a consultation or advisory scene. IMPORTANT — pick ONE option that best matches the heading topic, and VARY from the previously used scene (if provided):
  (a) A specialist pointing at a tablet or laptop screen showing diagrams/data to a client across a desk
  (b) A single professional on a phone call at a tidy desk with documents spread out, looking engaged
  (c) An on-site visit — a specialist with a clipboard standing near a building entrance, explaining to an owner
  (d) A handshake moment between two people in a bright office doorway (trust / agreement theme)
  (e) A specialist in a showroom gesturing toward product samples or color swatches on a display wall
  (f) A single person seated at a desk reading through a thick document with a highlighter, concentrating
  (g) Two people walking side-by-side outside along an apartment building, one pointing at the exterior
Mix genders, ages, and attire naturally. Avoid defaulting to the same "two people sitting at a desk" setup every time.
SETTING: Vary between — bright modern office, a clean meeting room, on-site at a building entrance, a showroom with samples, or an outdoor walkthrough.
COMPOSITION: Medium shot (50-85mm f/1.8) with shallow depth of field. Eye-level or slightly above. Off-center framing with leading lines.`,

  "data-analysis": `VISUAL CATEGORY: Data / Cost / Financial Analysis
SUBJECT GUIDANCE: The main subject is DATA or DOCUMENTS — but a person may appear as a secondary element to add life. Options:
  (a) Neatly arranged documents with charts/graphs on a bright wooden desk — no person
  (b) Over-the-shoulder view of a person looking at a laptop screen showing a colorful dashboard (person is out-of-focus, screen is the hero)
  (c) A calculator beside printed cost estimates and a pen on a clean desk — no person
  (d) A person's hands holding a printed report, with a desk of documents in the background (hands and document in focus)
Choose based on the heading topic. When a person appears, they should be secondary — not facing the camera.
SETTING: Clean, bright desktop or workspace. White or light wooden table surface. Minimal background — soft bokeh of an office or home study.
COMPOSITION: Overhead flat-lay (top-down at 90°) or 45-degree angle looking down at the desk surface. Use 35-50mm lens. Focus on the central object with surrounding items slightly soft.`,

  "checklist": `VISUAL CATEGORY: Verification / Contract / Caution
SUBJECT GUIDANCE: The DOCUMENT or PROCESS is the main subject, but a person's presence adds realism. Options:
  (a) A hand holding a pen about to sign a contract, with the document in sharp focus and the person's torso softly blurred behind
  (b) A checklist on a clipboard with some items checked off — a person's hand resting beside it
  (c) A person carefully reading a document at a desk, seen from the side (document in focus, face in profile/soft focus)
  (d) A neatly organized folder with labeled tabs on a clean desk — no person
Choose based on heading theme. The document stays in focus; any person is partial (hands, silhouette, profile).
SETTING: Bright office desk or conference table. Clean, minimal background. Warm natural light from a window.
COMPOSITION: Close-up to medium shot (50-85mm macro or portrait lens). Shallow depth of field to isolate the key document/object. Slightly angled (30-45°) perspective on the desk surface.`,

  "product": `VISUAL CATEGORY: Product / Material / Paint
SUBJECT GUIDANCE: Feature the PRODUCT or MATERIAL as hero subject. Options: (a) paint cans neatly arranged with color swatches beside them, (b) a close-up of a freshly painted surface showing smooth texture and color, (c) product samples laid out on a clean white surface with natural light, (d) a cross-section or comparison showing different coating layers. No people needed.
SETTING: Clean product photography setup — white or light gray background, or a bright workshop/showroom. Natural or studio lighting.
COMPOSITION: Product photography style — 45° angle or eye-level with the product. 85-100mm lens for slight compression. Clean negative space around the subject. Sharp focus on product with soft background.`,

  "lifestyle": `VISUAL CATEGORY: Lifestyle / Living Space / Comfort
SUBJECT GUIDANCE: Show LIVING SPACES or RESIDENTIAL COMFORT. A person may appear naturally within the scene to convey livability. Options:
  (a) A bright, clean Japanese apartment interior with natural light flooding through curtains — no person
  (b) A person standing on a balcony looking out at a well-maintained residential area (seen from behind, silhouette framing)
  (c) A family relaxing in a living room, seen from behind or at a distance — not portrait-style
  (d) A beautifully painted house exterior with a small garden — a resident walking toward the entrance
  (e) A person sitting by a large window reading, with a tidy apartment interior visible behind them (back or side view)
Choose based on heading theme. People should feel incidental to the space, not posed.
SETTING: Japanese residential interior (living room, bedroom, entrance) or residential neighborhood. Warm natural daylight. Clean, modern Japanese interior design.
COMPOSITION: Wide-angle (24-35mm) to show the space, or medium shot (50mm) focused on a lifestyle detail. Natural framing through doorways or windows. Warm, inviting tone.`,

  "concept": `VISUAL CATEGORY: Conceptual / Summary / Abstract
SUBJECT GUIDANCE: Use a METAPHORICAL or SYMBOLIC image. A person may appear as part of the metaphor to add warmth. Options:
  (a) An aerial/bird's-eye view of a Japanese residential neighborhood with clean rooftops — no person
  (b) A sunrise or golden-hour light on a row of well-maintained buildings — a person walking along the street (small, distant)
  (c) A close-up of hands stacking wooden blocks (building/planning metaphor)
  (d) A clean desk with a notebook, pen, and a small plant — suggesting planning and fresh starts
  (e) A person standing at a crossroads or looking down a bright residential street (back view, symbolizing decision/progress)
  (f) A person on a rooftop or elevated viewpoint overlooking a neighborhood (back view, sense of overview/accomplishment)
Choose based on heading theme. When a person appears, they should be seen from behind or at a distance — symbolic, not portrait.
SETTING: Varies by chosen metaphor — outdoor Japanese landscape, minimalist indoor, or abstract space. Always bright and optimistic.
COMPOSITION: Creative and varied — overhead, wide establishing, or tight symbolic close-up. Use the composition that best conveys the heading's abstract concept. Generous negative space for editorial feel.`,
};

// 足場・安全ルール（construction-site カテゴリのみ適用）
const CONSTRUCTION_SAFETY_RULES = `
CONSTRUCTION & PAINTING SITE SAFETY RULES (Astec Safety & Compliance Guide):

=== SCAFFOLDING (足場) ===
1. TYPE: Use "kusabi (vike) scaffolding" — interlocking wedge-type scaffolding commonly used in Japanese residential renovation. For buildings wider than 1m work area, use "hon-ashiba" (double-row scaffolding) with two rows of vertical posts for maximum stability.
2. COVERAGE: Scaffolding MUST fully enclose the entire building facade from ground level to at least 1 meter ABOVE the eaves/roofline. No partial scaffolding — every wall face being worked on must be fully covered.
3. SAFETY FEATURES: Handrails at 85cm or higher on all working platforms, plus mid-rails. Toe boards at least 10cm high at the base of each platform. Diagonal cross-bracing between vertical posts.
4. WORK PLATFORM: Clean and clear — no paint cans, tools, or materials left on the scaffolding floor.

=== SPLASH PREVENTION SHEETS (飛散防止シート) ===
5. For ANY pressure washing or painting scene, the ENTIRE scaffolding must be wrapped in gray or white mesh splash-prevention sheets.
6. Sheet requirements: All grommet ties securely fastened with NO gaps between sheets. Sheets extend from nearly ground level up to at least 1 meter above the eaves. No loose or flapping sections.
7. For airless spray painting, use DOUBLE-LAYER sheets.

=== HARNESS & FALL PROTECTION (フルハーネス型墜落制止用器具) ===
8. Workers at ANY height on scaffolding MUST wear a full-body harness — NOT an old-style waist belt.
9. Full-body harness anatomy (front view, top to bottom): shoulder straps running over both shoulders, a detachable connector strap joining the shoulder straps at upper chest, a chest strap/buckle across the mid-chest, a waist belt around the torso, and leg/thigh straps looping around each thigh with a pelvic belt connecting them at the lower back.
10. Full-body harness anatomy (rear view): a single D-ring mounted at the center of the upper back between the shoulder blades. A lanyard connects from this D-ring, incorporating a shock absorber midway, and terminates in a carabiner hook that attaches to an anchor point on the scaffolding ABOVE the worker.
11. All harness straps must appear taut and fitted — not loose or baggy. The lanyard must be visibly routed from the back D-ring upward to an overhead anchor.

=== WORKER ATTIRE ===
12. HELMET: SG-rated safety helmet with chin strap securely fastened.
13. CLOTHING: Long-sleeved uniform, shirt tucked into pants, no accessories.
14. FOOTWEAR: Safety shoes or tabi-style work shoes.
15. GLOVES: Work gloves on both hands.

=== GROUND SAFETY ===
16. Entry prohibition signs or caution tape around the scaffolding perimeter.

NEGATIVE PROMPT (NEVER generate these):
- Scaffolding that covers only part of the building or stops below the roofline
- Workers without full-body harness on scaffolding
- Waist-only safety belts (outdated and prohibited)
- Harness lanyards hanging loose or not connected overhead
- Workers with bare arms, rolled-up sleeves, or short sleeves
- Paint cans or tools scattered on scaffolding platforms
- Pedestrians walking under scaffolding without barriers

ANTI-HALLUCINATION RULES:
- If you cannot confidently depict safety details, zoom OUT to a wider shot.
- A fully mesh-wrapped building from a distance is always better than an inaccurate close-up.
- Show scaffolding as a UNIFORM GRID pattern — do not attempt individual pipe joints.
- Show splash-prevention sheets as a CONTINUOUS FLAT SURFACE.

SIMPLIFICATION RULES:
- Maximum 2 workers visible.
- When in doubt, choose a fully mesh-wrapped building exterior over a complex worker scene.
`;

// カテゴリ別フォールバックプロンプト
const CATEGORY_FALLBACKS: Record<VisualCategory, string> = {
  "construction-site":
    "A bright, wide-angle photograph of a Japanese apartment building fully wrapped in gray mesh splash-prevention sheets on kusabi scaffolding under a clear blue sky, shot on Sony α7IV with 24mm f/2.8 lens, abundant natural daylight, clean composition showing the full building from ground to above roofline, no text or logos.",
  "building-exterior":
    "A bright editorial photograph of a clean Japanese apartment building exterior under clear blue sky, shot on Canon EOS R5 with 35mm f/1.8 lens, warm natural daylight, slight perspective from the corner showing two facades, well-maintained walls and neat entrance, residential neighborhood setting, no text or logos.",
  "consultation":
    "A bright photograph of a Japanese female specialist in a navy blazer explaining building plans on a tablet to a middle-aged male property owner across a clean white meeting table, shot on Fujifilm X-T5 with 56mm f/1.4 lens, large window natural light from the left, shallow depth of field, modern office interior, no text or logos.",
  "data-analysis":
    "A bright overhead flat-lay photograph of neatly arranged financial documents, a silver calculator, a blue pen, and printed cost comparison charts on a clean light wooden desk, shot on Sony α7IV with 35mm f/1.8 lens, soft natural window light from above, clean warm tones, no text or logos.",
  "checklist":
    "A bright close-up photograph of a Japanese professional's hand holding a pen beside a printed checklist document on a clean white desk, with a few items already checked off, shot on Canon EOS R5 with 85mm f/1.4 lens, natural window light creating soft shadows, shallow depth of field with the checklist in sharp focus, no text or logos.",
  "product":
    "A bright product photograph of three paint cans in different colors arranged on a clean white surface with color sample cards fanned out beside them, shot on Fujifilm X-T5 with 90mm f/2 macro lens, soft diffused studio lighting, clean background with gentle shadows, no text or logos.",
  "lifestyle":
    "A bright interior photograph of a modern Japanese apartment living room with sunlight streaming through sheer curtains, clean minimalist furniture, a small indoor plant on the windowsill, warm hardwood floors, shot on Sony α7IV with 24mm f/1.8 lens, abundant natural daylight, inviting and comfortable atmosphere, no text or logos.",
  "concept":
    "A bright aerial photograph of a Japanese residential neighborhood with clean colorful rooftops arranged in a natural pattern, clear blue sky above, green trees interspersed between houses, shot on Canon EOS R5 with 35mm f/2 lens, golden morning light, clean and optimistic atmosphere, no text or logos.",
};

/**
 * H2見出し・段落テキストから、写真撮影指示書（英語）を自動生成する。
 * まずビジュアルカテゴリを判定し、カテゴリに応じたプロンプトで
 * Gemini テキストモデルが撮影ディレクションを出力する。
 * 足場・安全ルールは construction-site カテゴリのみに注入する。
 */
export const generatePhotographyPrompt = async (
  h2Text: string,
  paragraphText: string,
  previousScenes?: string[]
): Promise<string> => {
  // Step 1: ビジュアルカテゴリ判定
  const category = classifyVisualCategory(h2Text, paragraphText);
  const categoryGuide = CATEGORY_PROMPTS[category];

  // Step 2: 足場ルールは construction-site のみ
  const safetyRulesBlock = category === "construction-site" ? CONSTRUCTION_SAFETY_RULES : "";

  return retryWithExponentialBackoff(async () => {
    const systemPrompt = `You are a professional commercial photographer specializing in Japanese corporate and editorial photography.

Your task: Given a heading and paragraph from a Japanese business article, create a detailed PHOTOGRAPHY DIRECTION in English (max 200 words) that will be used to generate a photorealistic image.

${categoryGuide}

TECHNICAL REQUIREMENTS — always include ALL of these in your output:
1. CAMERA: Choose one — Sony α7IV, Canon EOS R5, or Fujifilm X-T5
2. LENS: Focal length and aperture (e.g. "35mm f/1.8", "85mm f/1.4", "24-70mm f/2.8")
3. LIGHTING: MUST be bright and well-lit. Use abundant natural daylight (large window light, clear sunny day). For indoor scenes, use bright fluorescent office lighting or large windows. NEVER use dim, moody, or low-key lighting.
4. ATMOSPHERE: bright, clean, professional — like a Japanese stock photo (PIXTA / photo-ac tone)

CONSTRAINTS:
- Output ONLY the photography direction as a single flowing paragraph. No explanations, headers, or bullet points.
- NO text, logos, watermarks, or UI elements in the image.
- The scene must look like a real photograph taken in Japan.
- BRIGHT and WELL-LIT with clean, natural colors. Preserve highlight detail.
- For outdoor scenes, always use clear blue sky, NEVER overcast.
- White balance: neutral to slightly warm.
- Avoid overly perfect symmetry — add natural imperfection.

ANTI-HALLUCINATION RULES (apply to ALL categories):
- If you cannot confidently depict a specific detail (fine text on documents, precise product labels, complex mechanical parts), zoom OUT or simplify so that detail becomes a small, unreadable part of the scene.
- Prefer SIMPLE, CLEAN compositions with fewer elements. A clean scene with 2-3 key objects is always better than a cluttered scene with 10 items that may be inaccurately rendered.
- Do NOT attempt to generate readable text, numbers, or characters in any language — they will be garbled. Frame the shot so any text is too small or blurred to read.
- For scenes with people, keep the number to 1-2 individuals. More people means more opportunities for anatomical errors (hands, fingers, faces).
- When in doubt, choose a WIDER framing that shows the overall scene rather than a close-up that demands precise detail.
${safetyRulesBlock}
${previousScenes && previousScenes.length > 0 ? `
SCENE VARIETY RULE (IMPORTANT):
The following scenes were already used for earlier sections of this same article. You MUST choose a DIFFERENT composition, setting, and subject arrangement. Do NOT repeat a similar setup:
${previousScenes.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}
Pick a distinctly different option from the SUBJECT GUIDANCE list above.
` : ""}
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

    console.log(`📸 写真プロンプト生成完了 [${category}] (${result.length} chars)`);
    return result;
  }).catch((error: any) => {
    console.error("Error generating photography prompt after retries:", error);
    // カテゴリ別フォールバック
    console.log(`⚠️ フォールバック使用 [${category}]`);
    return CATEGORY_FALLBACKS[category];
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
