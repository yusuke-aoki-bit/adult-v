import { NextRequest, NextResponse } from 'next/server';
import { analyzeSearchQuery } from '@adult-v/shared/lib/llm-service';
import { getDb } from '@/lib/db';
import { tags, performers } from '@/lib/db/schema';
import { eq, desc, sql, ilike, or } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * AI検索API - 自然言語クエリを検索パラメータに変換
 * POST /api/search/ai
 */
export async function POST(request: NextRequest) {
  try {
    const { query, locale = 'ja' } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const db = getDb();

    // 利用可能なジャンルを取得
    const genresResult = await db
      .select({ name: tags.name })
      .from(tags)
      .where(eq(tags.category, 'genre'))
      .limit(50);
    const availableGenres = genresResult.map(r => r.name);

    // 人気女優を取得
    const performersResult = await db
      .select({ name: performers.name })
      .from(performers)
      .orderBy(desc(performers.releaseCount))
      .limit(30);
    const popularPerformers = performersResult.map(r => r.name);

    // LLMで自然言語クエリを解析
    const analysis = await analyzeSearchQuery(query, {
      availableGenres,
      popularPerformers,
    });

    if (!analysis) {
      // LLM解析失敗時はそのままキーワード検索
      return NextResponse.json({
        success: true,
        searchParams: {
          q: query,
        },
        analysis: null,
        message: 'Fallback to keyword search',
      });
    }

    // 解析結果から検索パラメータを構築
    const searchParams: Record<string, string | string[]> = {};

    // キーワードクエリ
    if (analysis.expandedQuery) {
      searchParams.q = analysis.expandedQuery;
    } else if (analysis.keywords.length > 0) {
      searchParams.q = analysis.keywords.join(' ');
    }

    // ジャンルフィルター
    if (analysis.suggestedFilters?.includeGenres?.length) {
      const genreNames = analysis.suggestedFilters.includeGenres;
      const genreIdsResult = await db
        .select({ id: tags.id })
        .from(tags)
        .where(sql`${tags.category} = 'genre' AND ${tags.name} = ANY(${genreNames})`);
      if (genreIdsResult.length > 0) {
        searchParams.include = genreIdsResult.map(r => String(r.id));
      }
    }

    // 除外ジャンル
    if (analysis.suggestedFilters?.excludeGenres?.length) {
      const excludeNames = analysis.suggestedFilters.excludeGenres;
      const excludeIdsResult = await db
        .select({ id: tags.id })
        .from(tags)
        .where(sql`${tags.category} = 'genre' AND ${tags.name} = ANY(${excludeNames})`);
      if (excludeIdsResult.length > 0) {
        searchParams.exclude = excludeIdsResult.map(r => String(r.id));
      }
    }

    // 女優検索の場合
    if (analysis.intent === 'search_actress' && analysis.performers.length > 0) {
      const performerName = analysis.performers[0];
      const performerResult = await db
        .select({ id: performers.id })
        .from(performers)
        .where(or(
          ilike(performers.name, `%${performerName}%`),
          ilike(performers.nameKana, `%${performerName}%`)
        ))
        .limit(1);
      if (performerResult.length > 0) {
        return NextResponse.json({
          success: true,
          redirect: `/${locale}/actress/${performerResult[0].id}`,
          analysis,
          message: `「${performerName}」さんのページへ移動します`,
        });
      }
    }

    // セール中フィルター
    if (analysis.suggestedFilters?.onSale) {
      searchParams.onSale = 'true';
    }

    return NextResponse.json({
      success: true,
      searchParams,
      analysis,
      relatedTerms: analysis.relatedTerms,
      message: analysis.intent === 'search_product'
        ? '作品を検索します'
        : analysis.intent === 'recommendation'
        ? 'おすすめ作品を探します'
        : '検索結果を表示します',
    });

  } catch (error) {
    console.error('[AI Search API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
