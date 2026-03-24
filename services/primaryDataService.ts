/**
 * Primary Data Service
 *
 * Supabase一次情報DBからのデータ取得サービス
 *
 * 主要機能:
 * 1. キーワード全文検索（PostgreSQL tsvector使用）
 * 2. カテゴリ・タグによる絞り込み検索
 * 3. 記事執筆用のマークダウンコンテキスト構築
 * 4. エラーハンドリング（Supabase接続失敗時はスキップ）
 */

import {
  getSupabaseClient,
  isSupabaseAvailable,
  ChunkWithSource,
  Source,
  Document,
  Chunk,
} from './supabaseClient';

// Re-export isSupabaseAvailable for external use
export { isSupabaseAvailable };

export interface SearchOptions {
  keyword?: string; // 全文検索キーワード
  category?: string; // カテゴリ絞り込み
  tags?: string[]; // タグ絞り込み（AND条件）
  limit?: number; // 取得件数制限（デフォルト: 20）
}

export interface SearchResult {
  chunks: ChunkWithSource[];
  total: number;
  query: SearchOptions;
}

/**
 * キーワードで全文検索
 * PostgreSQLのtsvector型を利用した高速全文検索
 */
export async function searchByKeyword(
  keyword: string,
  options: Omit<SearchOptions, 'keyword'> = {}
): Promise<SearchResult> {
  const client = getSupabaseClient();

  // Supabase未設定時は空配列を返す
  if (!client) {
    console.warn('[PrimaryData] Supabase未設定のため、検索をスキップします');
    return {
      chunks: [],
      total: 0,
      query: { keyword, ...options },
    };
  }

  try {
    const limit = options.limit || 20;

    // クエリビルダー
    let query = client
      .from('chunks')
      .select(
        `
        *,
        document:documents(
          *,
          source:sources(*)
        )
      `,
        { count: 'exact' }
      )
      .ilike('sentence', `%${keyword}%`); // 日本語はILIKEで部分一致検索する

    // カテゴリ絞り込み
    if (options.category) {
      query = query.eq('category', options.category);
    }

    // タグ絞り込み（配列の部分一致）
    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        query = query.contains('tags', [tag]);
      }
    }

    // 実行
    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[PrimaryData] 検索エラー:', error);
      return {
        chunks: [],
        total: 0,
        query: { keyword, ...options },
      };
    }

    console.log(`[PrimaryData] 検索成功: ${data.length}件ヒット（全${count}件中）`);

    return {
      chunks: data as ChunkWithSource[],
      total: count || 0,
      query: { keyword, ...options },
    };
  } catch (error) {
    console.error('[PrimaryData] 検索例外:', error);
    return {
      chunks: [],
      total: 0,
      query: { keyword, ...options },
    };
  }
}

/**
 * カテゴリで検索
 */
export async function searchByCategory(
  category: string,
  limit: number = 20
): Promise<SearchResult> {
  const client = getSupabaseClient();

  if (!client) {
    console.warn('[PrimaryData] Supabase未設定のため、検索をスキップします');
    return {
      chunks: [],
      total: 0,
      query: { category, limit },
    };
  }

  try {
    const { data, error, count } = await client
      .from('chunks')
      .select(
        `
        *,
        document:documents(
          *,
          source:sources(*)
        )
      `,
        { count: 'exact' }
      )
      .eq('category', category)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[PrimaryData] カテゴリ検索エラー:', error);
      return {
        chunks: [],
        total: 0,
        query: { category, limit },
      };
    }

    console.log(`[PrimaryData] カテゴリ検索成功: ${data.length}件`);

    return {
      chunks: data as ChunkWithSource[],
      total: count || 0,
      query: { category, limit },
    };
  } catch (error) {
    console.error('[PrimaryData] カテゴリ検索例外:', error);
    return {
      chunks: [],
      total: 0,
      query: { category, limit },
    };
  }
}

/**
 * タグで検索（AND条件）
 */
export async function searchByTags(
  tags: string[],
  limit: number = 20
): Promise<SearchResult> {
  const client = getSupabaseClient();

  if (!client) {
    console.warn('[PrimaryData] Supabase未設定のため、検索をスキップします');
    return {
      chunks: [],
      total: 0,
      query: { tags, limit },
    };
  }

  try {
    let query = client
      .from('chunks')
      .select(
        `
        *,
        document:documents(
          *,
          source:sources(*)
        )
      `,
        { count: 'exact' }
      );

    // 複数タグのAND条件
    for (const tag of tags) {
      query = query.contains('tags', [tag]);
    }

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[PrimaryData] タグ検索エラー:', error);
      return {
        chunks: [],
        total: 0,
        query: { tags, limit },
      };
    }

    console.log(`[PrimaryData] タグ検索成功: ${data.length}件`);

    return {
      chunks: data as ChunkWithSource[],
      total: count || 0,
      query: { tags, limit },
    };
  } catch (error) {
    console.error('[PrimaryData] タグ検索例外:', error);
    return {
      chunks: [],
      total: 0,
      query: { tags, limit },
    };
  }
}

/**
 * 複合検索（キーワード + カテゴリ + タグ）
 */
export async function search(options: SearchOptions): Promise<SearchResult> {
  // キーワードがある場合はsearchByKeywordを使用
  if (options.keyword) {
    return searchByKeyword(options.keyword, {
      category: options.category,
      tags: options.tags,
      limit: options.limit,
    });
  }

  // カテゴリのみ
  if (options.category && (!options.tags || options.tags.length === 0)) {
    return searchByCategory(options.category, options.limit);
  }

  // タグのみ
  if (options.tags && options.tags.length > 0 && !options.category) {
    return searchByTags(options.tags, options.limit);
  }

  // カテゴリ + タグ
  if (options.category && options.tags && options.tags.length > 0) {
    const client = getSupabaseClient();

    if (!client) {
      console.warn('[PrimaryData] Supabase未設定のため、検索をスキップします');
      return {
        chunks: [],
        total: 0,
        query: options,
      };
    }

    try {
      const limit = options.limit || 20;

      let query = client
        .from('chunks')
        .select(
          `
          *,
          document:documents(
            *,
            source:sources(*)
          )
        `,
          { count: 'exact' }
        )
        .eq('category', options.category);

      for (const tag of options.tags) {
        query = query.contains('tags', [tag]);
      }

      const { data, error, count } = await query
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[PrimaryData] 複合検索エラー:', error);
        return {
          chunks: [],
          total: 0,
          query: options,
        };
      }

      console.log(`[PrimaryData] 複合検索成功: ${data.length}件`);

      return {
        chunks: data as ChunkWithSource[],
        total: count || 0,
        query: options,
      };
    } catch (error) {
      console.error('[PrimaryData] 複合検索例外:', error);
      return {
        chunks: [],
        total: 0,
        query: options,
      };
    }
  }

  // 条件なしの場合は空配列
  console.warn('[PrimaryData] 検索条件が指定されていません');
  return {
    chunks: [],
    total: 0,
    query: options,
  };
}

/**
 * 記事執筆用のマークダウンコンテキストを構築
 *
 * 検索結果をマークダウン形式に整形して返す
 * エージェントがプロンプトに含めやすいフォーマット
 */
export function buildMarkdownContext(result: SearchResult): string {
  if (result.chunks.length === 0) {
    return '';
  }

  const lines: string[] = [];

  lines.push('# 一次情報データベースからの関連情報\n');
  lines.push(`検索条件: ${JSON.stringify(result.query, null, 2)}\n`);
  lines.push(`ヒット件数: ${result.chunks.length}件（全${result.total}件中）\n`);
  lines.push('---\n');

  // ソース単位でグルーピング
  const groupedBySource: Record<string, ChunkWithSource[]> = {};

  for (const chunk of result.chunks) {
    const sourceId = chunk.source_id;
    if (!groupedBySource[sourceId]) {
      groupedBySource[sourceId] = [];
    }
    groupedBySource[sourceId].push(chunk);
  }

  // ソースごとに出力
  for (const [sourceId, chunks] of Object.entries(groupedBySource)) {
    const firstChunk = chunks[0];
    const document = firstChunk.document;
    const source = document?.source;

    if (source) {
      lines.push(`## ${source.title}`);
      lines.push(`**種別**: ${source.source_type}`);
      if (source.url) {
        lines.push(`**URL**: ${source.url}`);
      }
    } else {
      lines.push(`## ソースID: ${sourceId}`);
      lines.push('**種別**: 不明');
    }
    lines.push('');

    // チャンクを出力
    for (const chunk of chunks) {
      const docTitle = chunk.document?.title || '無題のドキュメント';
      lines.push(`### ${docTitle}`);
      if (chunk.category) {
        lines.push(`**カテゴリ**: ${chunk.category}`);
      }
      if (chunk.tags && chunk.tags.length > 0) {
        lines.push(`**タグ**: ${chunk.tags.join(', ')}`);
      }
      lines.push('');
      lines.push(chunk.sentence);
      lines.push('');
    }

    lines.push('---\n');
  }

  return lines.join('\n');
}

/**
 * キーワードから関連コンテキストを取得（エージェント向けヘルパー）
 *
 * 検索 → マークダウン構築を一括で実行
 */
export async function getContextForKeyword(
  keyword: string,
  options: Omit<SearchOptions, 'keyword'> = {}
): Promise<string> {
  // Supabase未設定時は空文字列
  if (!isSupabaseAvailable()) {
    console.log('[PrimaryData] Supabase未設定のため、コンテキスト取得をスキップ');
    return '';
  }

  const result = await searchByKeyword(keyword, options);

  // ヒットなしの場合も空文字列
  if (result.chunks.length === 0) {
    console.log(`[PrimaryData] キーワード「${keyword}」に関連する一次情報が見つかりませんでした`);
    return '';
  }

  return buildMarkdownContext(result);
}

/**
 * 複数キーワードから関連コンテキストを取得
 *
 * 複数キーワードをOR条件で検索し、統合されたコンテキストを返す
 */
export async function getContextForKeywords(
  keywords: string[],
  options: Omit<SearchOptions, 'keyword'> = {}
): Promise<string> {
  if (!isSupabaseAvailable()) {
    console.log('[PrimaryData] Supabase未設定のため、コンテキスト取得をスキップ');
    return '';
  }

  if (keywords.length === 0) {
    return '';
  }

  // 各キーワードで検索
  const results = await Promise.all(
    keywords.map((kw) => searchByKeyword(kw, options))
  );

  // 重複排除（chunk_idでユニーク化）
  const uniqueChunks = new Map<string, ChunkWithSource>();
  for (const result of results) {
    for (const chunk of result.chunks) {
      if (!uniqueChunks.has(chunk.chunk_id)) {
        uniqueChunks.set(chunk.chunk_id, chunk);
      }
    }
  }

  // 統合結果を作成
  const mergedResult: SearchResult = {
    chunks: Array.from(uniqueChunks.values()),
    total: uniqueChunks.size,
    query: { keyword: keywords.join(' OR '), ...options },
  };

  if (mergedResult.chunks.length === 0) {
    console.log(`[PrimaryData] キーワード「${keywords.join(', ')}」に関連する一次情報が見つかりませんでした`);
    return '';
  }

  return buildMarkdownContext(mergedResult);
}
