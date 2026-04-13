/**
 * 自社製品レコメンド設定（zeenb専用）
 *
 * 記事テーマが「屋根の遮熱」または「外壁美観」に該当する場合のみ、
 * アステックペイントの具体的な製品名を執筆プロンプトに注入する。
 * それ以外のテーマでは製品紹介を行わない。
 */

// 製品情報の型定義
interface ProductInfo {
  name: string;
  description: string;
  url: string;
  target: string;
  specs: string[];
  lifespan: string;
}

interface ThemeProductMapping {
  themeName: string;
  keywords: string[];
  products: ProductInfo[];
  writingNote?: string;
}

// ===== 製品マスタ（屋根遮熱系） =====

const PRODUCT_SUPER_SHANETSU_THERMO_F: ProductInfo = {
  name: "スーパーシャネツサーモF",
  description: "チタン複合特殊無機顔料で近赤外線を強力に反射するフッ素系屋根用遮熱塗料",
  url: "https://astecpaints.jp/products/detail/18",
  target: "屋根（スレート、セメント瓦、モニエル瓦、金属屋根）",
  specs: [
    "チタン複合特殊無機顔料で近赤外線を効果的に反射",
    "ラジカル制御技術で紫外線劣化を抑制",
    "21色展開",
  ],
  lifespan: "16〜20年",
};

const PRODUCT_SUPER_SHANETSU_THERMO_SI: ProductInfo = {
  name: "スーパーシャネツサーモSi",
  description: "コストを抑えつつ遮熱性と耐候性を両立したシリコン系屋根用遮熱塗料",
  url: "https://astecpaints.jp/products/detail/19",
  target: "屋根（スレート、セメント瓦、モニエル瓦、金属屋根）",
  specs: [
    "チタン複合特殊無機顔料で近赤外線を反射",
    "シリコン樹脂で耐候性とコストを両立",
    "21色展開",
  ],
  lifespan: "13〜16年",
};

const PRODUCT_SILICON_REVO500_IR: ProductInfo = {
  name: "シリコンREVO500-IR",
  description: "革命的な高耐候性と遮熱性を両立した次世代屋根用シリコン塗料",
  url: "https://astecpaints.jp/products/detail/408",
  target: "屋根全般（金属屋根、スレート、セメント瓦、アスファルトシングル）",
  specs: [
    "近赤外線を反射し室内温度上昇を抑制",
    "紫外線劣化に強いシリコン成分を豊富に配合",
    "ラジカル制御技術による長期耐候性",
    "69色展開",
  ],
  lifespan: "13〜16年",
};

const PRODUCT_FLUORINE_REVO500_IR: ProductInfo = {
  name: "フッ素REVO500-IR",
  description: "完全交互結合型フッ素樹脂で最高クラスの耐候性と遮熱性を実現した屋根用塗料",
  url: "https://astecpaints.jp/products/detail/407",
  target: "屋根全般（金属屋根、スレート、セメント瓦、アスファルトシングル）",
  specs: [
    "完全交互結合型フッ素樹脂で紫外線に強い",
    "特殊遮熱無機顔料で近赤外線を効果的に反射",
    "ラジカル制御型白色顔料＋HALS（光安定剤）で劣化を抑制",
    "69色展開",
  ],
  lifespan: "16〜20年",
};

const PRODUCT_REFINE_500MF_IR: ProductInfo = {
  name: "超低汚染リファイン500MF-IR",
  description: "無機成分配合で汚れにくく遮熱効果が長期持続する屋根用最高グレード塗料",
  url: "https://astecpaints.jp/products/detail/41",
  target: "屋根全般（金属屋根、スレート、セメント瓦、ガルバリウム鋼板）",
  specs: [
    "親水性セルフクリーニングで汚れを雨水が洗い流す",
    "遮熱効果が汚れで低下しにくい（遮熱保持性）",
    "防カビ・防藻性でJIS Z 2911試験合格",
    "69色展開",
  ],
  lifespan: "20〜24年",
};

// ===== 製品マスタ（外壁美観系） =====

const PRODUCT_MUKI_REVO1000: ProductInfo = {
  name: "無機REVO1000",
  description: "有機無機ハイブリッド樹脂で最高クラスの耐候性・低汚染性を実現した外壁用塗料",
  url: "https://astecpaints.jp/products/detail/410",
  target: "外壁（コンクリート、モルタル、ALC、窯業系サイディング、金属）",
  specs: [
    "有機無機ハイブリッド樹脂で緻密かつ強靭な塗膜",
    "ラジカル制御型白色顔料で劣化を抑制",
    "低汚染性：微細な汚染物質が付着しにくい",
    "防カビ・防藻性：JIS Z 2911試験合格",
    "69色展開（艶有/3分艶/艶消）",
  ],
  lifespan: "20〜22年",
};

const PRODUCT_MUKI_REVO1000_IR: ProductInfo = {
  name: "無機REVO1000-IR",
  description: "最高クラスの耐候性・低汚染性に遮熱性をプラスした外壁用塗料",
  url: "https://astecpaints.jp/products/detail/409",
  target: "外壁（コンクリート、モルタル、ALC、窯業系サイディング、金属、スレート）",
  specs: [
    "有機無機ハイブリッド樹脂で緻密かつ強靭な塗膜",
    "特殊遮熱無機顔料で近赤外線を反射",
    "低汚染性＋遮熱性＋防カビ防藻性の三拍子",
    "69色展開（艶有/3分艶/艶消）",
  ],
  lifespan: "20〜22年",
};

const PRODUCT_REFINE_1000MF_IR: ProductInfo = {
  name: "超低汚染リファイン1000MF-IR",
  description: "超低汚染・遮熱・防カビを兼ね備えた外壁用無機フッ素の最高グレード塗料",
  url: "https://astecpaints.jp/products/detail/40",
  target: "外壁（コンクリート、モルタル、ALC、窯業系サイディング）",
  specs: [
    "無機フッ素で緻密な塗膜を形成、汚れの浸入をブロック",
    "親水性セルフクリーニングで雨が汚れを洗い流す",
    "遮熱性能を併せ持つ",
    "防カビ・防藻性：JIS Z 2911試験合格",
    "69色展開",
  ],
  lifespan: "20〜24年",
};

const PRODUCT_REFINE_1000SI_IR: ProductInfo = {
  name: "超低汚染リファイン1000Si-IR",
  description: "コストパフォーマンスに優れた超低汚染・遮熱対応の外壁用シリコン塗料",
  url: "https://astecpaints.jp/products/detail/22",
  target: "外壁（コンクリート、モルタル、ALC、窯業系サイディング）",
  specs: [
    "無機成分配合のシリコン塗料で緻密な塗膜",
    "親水性により雨で汚れを洗い流す",
    "遮熱性能を併せ持つ",
    "69色展開",
  ],
  lifespan: "15〜18年",
};

const PRODUCT_SILICON_REVO1000_IR: ProductInfo = {
  name: "シリコンREVO1000-IR",
  description: "シリコン成分を従来比約3倍配合し超高耐候性・低汚染・遮熱を実現した外壁用塗料",
  url: "https://astecpaints.jp/products/detail/45",
  target: "外壁（コンクリート、モルタル、ALC、窯業系サイディング）",
  specs: [
    "シリコン成分を従来比約3倍配合",
    "低汚染性と遮熱性を高レベルで両立",
    "防カビ・防藻性",
    "69色展開",
  ],
  lifespan: "13〜16年",
};

const PRODUCT_SUPER_RADICAL_SILICON_Z: ProductInfo = {
  name: "スーパーラジカルシリコンZ",
  description: "ラジカル制御技術で長期間建物を保護する低汚染外壁用シリコン塗料",
  url: "https://astecpaints.jp/products/detail/406",
  target: "外壁（窯業系サイディング、モルタル、ALC、コンクリート）",
  specs: [
    "ラジカル制御型白色顔料で塗膜劣化を抑制",
    "二重構造アクリルシリコン樹脂で汚れ付着を防止",
    "防カビ・防藻性：JIS Z 2911合格",
    "69色展開（艶有/3分艶）",
  ],
  lifespan: "10〜12年",
};

// ===== テーマ別マッピング（屋根遮熱・外壁美観のみ） =====

const THEME_PRODUCT_MAPPINGS: ThemeProductMapping[] = [
  // ----- 屋根遮熱系 -----
  {
    themeName: "屋根の遮熱塗装",
    keywords: ["遮熱塗装", "遮熱塗料", "屋根 遮熱", "屋根 暑さ", "屋根 温度", "屋根 断熱"],
    products: [PRODUCT_SUPER_SHANETSU_THERMO_F, PRODUCT_FLUORINE_REVO500_IR, PRODUCT_REFINE_500MF_IR],
    writingNote: "屋根遮熱ではスーパーシャネツサーモシリーズが代表製品。予算に応じてSi（シリコン）/F（フッ素）を使い分ける点を訴求。",
  },
  {
    themeName: "屋根塗装・塗り替え",
    keywords: ["屋根塗装", "屋根 塗り替え", "屋根 塗装 費用", "屋根 塗装 時期", "屋根 メンテナンス"],
    products: [PRODUCT_SUPER_SHANETSU_THERMO_F, PRODUCT_SUPER_SHANETSU_THERMO_SI, PRODUCT_FLUORINE_REVO500_IR],
    writingNote: "屋根の塗り替えなら遮熱機能付きを選ぶのが現在の主流。グレード別（シリコン/フッ素/無機フッ素）の耐用年数と費用感を示す。",
  },
  {
    themeName: "暑さ対策・室温低減",
    keywords: ["暑さ対策", "室温", "2階 暑い", "小屋裏", "夏 暑い", "遮熱", "猛暑"],
    products: [PRODUCT_SUPER_SHANETSU_THERMO_F, PRODUCT_SUPER_SHANETSU_THERMO_SI],
    writingNote: "住宅の暑さの根本原因は屋根からの輻射熱。遮熱塗装で屋根表面温度を大幅に低減し、室内温度と冷房負荷を下げる効果を説明。",
  },
  // ----- 外壁美観系 -----
  {
    themeName: "外壁の美観維持・低汚染",
    keywords: ["外壁 汚れ", "外壁 美観", "低汚染", "セルフクリーニング", "雨だれ", "外壁 きれい", "外壁 色あせ"],
    products: [PRODUCT_REFINE_1000MF_IR, PRODUCT_MUKI_REVO1000, PRODUCT_REFINE_1000SI_IR],
    writingNote: "超低汚染リファインシリーズの親水性セルフクリーニング機能を中心に訴求。雨が汚れを洗い流す仕組みを具体的に説明。",
  },
  {
    themeName: "外壁塗装・塗り替え",
    keywords: ["外壁塗装", "外壁 塗り替え", "外壁 塗装 費用", "外壁 塗装 時期", "外壁 メンテナンス"],
    products: [PRODUCT_MUKI_REVO1000_IR, PRODUCT_REFINE_1000MF_IR, PRODUCT_SILICON_REVO1000_IR],
    writingNote: "外壁塗装なら低汚染＋遮熱のダブル機能が現在のトレンド。グレード別（シリコン/無機/無機フッ素）の耐用年数と特徴を示す。",
  },
  {
    themeName: "外壁の防カビ・防藻",
    keywords: ["カビ", "防カビ", "藻", "コケ", "苔", "外壁 緑", "北面 汚れ"],
    products: [PRODUCT_MUKI_REVO1000, PRODUCT_REFINE_1000MF_IR, PRODUCT_SUPER_RADICAL_SILICON_Z],
    writingNote: "防カビ・防藻はJIS Z 2911試験合格製品を選ぶことが重要。低汚染性との組み合わせで長期的な美観維持を提案。",
  },
];

/**
 * キーワードと構成案からマッチするテーマを判定し、
 * 関連製品情報をプロンプト挿入用テキストとして返す。
 * 屋根遮熱・外壁美観に該当しない場合は空文字を返す（製品紹介しない）。
 */
export function buildProductRecommendationText(keyword: string, outline: string): string {
  const combinedText = (keyword + " " + outline).toLowerCase();

  const matchedThemes: Array<{ theme: ThemeProductMapping; score: number }> = [];

  for (const theme of THEME_PRODUCT_MAPPINGS) {
    let score = 0;
    for (const kw of theme.keywords) {
      if (kw.includes(" ")) {
        const parts = kw.split(" ");
        if (parts.every((part) => combinedText.includes(part))) {
          score += 2;
        }
      } else if (combinedText.includes(kw)) {
        score++;
      }
    }
    if (score > 0) {
      matchedThemes.push({ theme, score });
    }
  }

  if (matchedThemes.length === 0) {
    console.log("ℹ️ 製品レコメンド: マッチするテーマなし（屋根遮熱・外壁美観以外のためスキップ）");
    return "";
  }

  matchedThemes.sort((a, b) => b.score - a.score);

  const selectedThemes = matchedThemes.slice(0, 2);
  const themeNames = selectedThemes.map((t) => t.theme.themeName).join("、");
  console.log("✅ 製品レコメンド: テーマ「" + themeNames + "」にマッチ");

  const seenProducts = new Set<string>();
  const productEntries: string[] = [];
  const writingNotes: string[] = [];

  for (const { theme } of selectedThemes) {
    if (theme.writingNote) {
      writingNotes.push("- " + theme.writingNote);
    }
    for (const product of theme.products) {
      if (seenProducts.has(product.name)) continue;
      seenProducts.add(product.name);
      if (productEntries.length >= 4) break;

      const specsText = product.specs.map((s) => "  - " + s).join("\n");
      productEntries.push(
        `■ ${product.name}\n` +
        `  概要: ${product.description}\n` +
        `  対象: ${product.target}\n` +
        `  耐用年数: ${product.lifespan}\n` +
        `  主なスペック:\n${specsText}\n` +
        `  詳細: ${product.url}`
      );
    }
  }

  const productListText = productEntries.join("\n\n");
  const writingNoteText = writingNotes.length > 0
    ? "\n■ テーマ別の訴求ポイント:\n" + writingNotes.join("\n")
    : "";

  return `
【自社製品の紹介指示（重要・独自性向上）】
この記事のテーマに関連するアステックペイントの製品があります。記事内で自然な形で具体的な製品名とスペックに言及し、競合記事にはない独自性を出してください。

■ 挿入ルール：
1. 製品名は正式名称で記載すること（例：「スーパーシャネツサーモF」）
2. 性能スペック（耐用年数、色数など）は具体的な数値で記載
3. 押し売り的にならないよう、読者の課題解決の文脈で自然に紹介する
4. 自社サービス訴求のH2セクションでは積極的に製品名を出してよい
5. それ以外のセクションでは「例えば〜のような製品もある」「〜という選択肢もある」など控えめな表現で1〜2回言及
6. 製品詳細ページURLへの内部リンクを <a href="URL" target="_blank" rel="noopener">製品名</a> 形式で挿入すること（自社サービス訴求セクション内で1〜2個）

■ 推薦製品一覧：

${productListText}
${writingNoteText}

重要：上記に記載のない製品名を勝手に創作しないこと。上記製品のみを使用すること。
`;
}
