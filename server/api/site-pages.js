/**
 * サイトページ取得API
 * sitemap.xml からサイト内全ページを取得し、タイトル付きで返す
 * 内部リンク挿入用データソース
 */

const fetch = require("node-fetch");

// インメモリキャッシュ（ドメインごと、1時間有効）
const pageCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * URLからHTMLのtitleタグ内容を取得
 */
async function fetchPageTitle(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOBot/1.0)" },
      timeout: 5000,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (match) return match[1].trim().replace(/\s*[|\-–—]\s*.*$/, "").trim();
    return null;
  } catch {
    return null;
  }
}

/**
 * sitemap.xml からURL一覧を取得（sitemapindex対応）
 */
async function fetchSitemapUrls(sitemapUrl, depth = 0) {
  if (depth > 2) return [];

  try {
    const res = await fetch(sitemapUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOBot/1.0)" },
      timeout: 10000,
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // sitemapindex の場合：子sitemapを再帰取得
    if (xml.includes("<sitemapindex")) {
      const childUrls = [];
      const matches = xml.matchAll(/<loc>\s*(https?[^<]+)\s*<\/loc>/gi);
      for (const m of matches) {
        const childUrls2 = await fetchSitemapUrls(m[1].trim(), depth + 1);
        childUrls.push(...childUrls2);
        if (childUrls.length >= 500) break;
      }
      return childUrls;
    }

    // 通常sitemap：<url><loc>...</loc></url> を抽出
    const urls = [];
    const matches = xml.matchAll(/<url>[\s\S]*?<loc>\s*(https?[^<]+)\s*<\/loc>[\s\S]*?<\/url>/gi);
    for (const m of matches) {
      urls.push(m[1].trim());
    }
    return urls;
  } catch (err) {
    console.warn(`⚠️ sitemap取得失敗: ${sitemapUrl} - ${err.message}`);
    return [];
  }
}

/**
 * ドメインのsitemap.xmlから全ページを取得してタイトル付きリストを返す
 * GET /api/site-pages?domain=https://example.com
 */
async function getSitePages(req, res) {
  const domain = (req.query.domain || process.env.VITE_COMPANY_MEDIA_URL || process.env.VITE_COMPANY_SITE_URL || "").replace(/\/$/, "");

  if (!domain) {
    return res.status(400).json({
      success: false,
      error: "domain パラメータ、または VITE_COMPANY_MEDIA_URL 環境変数が必要です",
    });
  }

  console.log(`🗺️ サイトページ取得開始: ${domain}`);

  // キャッシュ確認
  const cached = pageCache.get(domain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`✅ キャッシュヒット: ${domain} (${cached.pages.length}件)`);
    return res.json({ success: true, count: cached.pages.length, pages: cached.pages, cached: true });
  }

  try {
    // sitemap候補URLを試す
    const sitemapCandidates = [
      `${domain}/sitemap.xml`,
      `${domain}/sitemap_index.xml`,
      `${domain}/sitemap-index.xml`,
      `${domain}/wp-sitemap.xml`,
    ];

    let allUrls = [];
    for (const candidate of sitemapCandidates) {
      allUrls = await fetchSitemapUrls(candidate);
      if (allUrls.length > 0) {
        console.log(`✅ sitemap取得成功: ${candidate} (${allUrls.length}件)`);
        break;
      }
    }

    if (allUrls.length === 0) {
      return res.status(404).json({
        success: false,
        error: `sitemap.xml が見つかりませんでした: ${domain}`,
      });
    }

    // 同一ドメインのURLのみ残す
    const sameOriginUrls = allUrls.filter((url) => url.startsWith(domain));

    // タイトル取得（最大100件、並列10件ずつ）
    const maxPages = Math.min(sameOriginUrls.length, 100);
    const pages = [];
    const batchSize = 10;

    for (let i = 0; i < maxPages; i += batchSize) {
      const batch = sameOriginUrls.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (url) => {
          const title = await fetchPageTitle(url);
          return { url, title: title || urlToTitle(url) };
        })
      );
      pages.push(...results);
      console.log(`  進捗: ${Math.min(i + batchSize, maxPages)}/${maxPages} 件`);
    }

    // キャッシュ保存
    pageCache.set(domain, { pages, timestamp: Date.now() });
    console.log(`✅ サイトページ取得完了: ${pages.length}件`);

    res.json({ success: true, count: pages.length, pages });
  } catch (error) {
    console.error("❌ サイトページ取得エラー:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * URLパスからタイトルを推測するフォールバック
 * 例: /blog/ai-article-writing → "ai article writing"
 */
function urlToTitle(url) {
  try {
    const path = new URL(url).pathname;
    const slug = path.replace(/\/$/, "").split("/").pop() || "";
    return slug.replace(/[-_]/g, " ").replace(/\.\w+$/, "");
  } catch {
    return url;
  }
}

/**
 * キャッシュをクリア（ドメイン指定、または全件）
 * POST /api/site-pages/clear-cache
 */
async function clearCache(req, res) {
  const domain = req.query.domain;
  if (domain) {
    pageCache.delete(domain);
    res.json({ success: true, message: `キャッシュをクリアしました: ${domain}` });
  } else {
    pageCache.clear();
    res.json({ success: true, message: "全キャッシュをクリアしました" });
  }
}

module.exports = { getSitePages, clearCache };
