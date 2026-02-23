import { NextRequest, NextResponse } from 'next/server';

export interface SearchAiHandlerDeps {
  getDb: () => any;
  tags: any;
  performers: any;
  eq: any;
  desc: any;
  sql: any;
  ilike: any;
  or: any;
  analyzeSearchQuery: (query: string, options: any) => Promise<any>;
}

export function createSearchAiHandler(deps: SearchAiHandlerDeps) {
  return async function POST(request: NextRequest) {
    try {
      const { query, locale = 'ja' } = await request.json();

      if (!query || typeof query !== 'string') {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
      }

      const db = deps.getDb();

      const genresResult = await db
        .select({ name: deps.tags.name })
        .from(deps.tags)
        .where(deps.eq(deps.tags.category, 'genre'))
        .limit(50);
      const availableGenres = genresResult.map((r: any) => r.name);

      const performersResult = await db
        .select({ name: deps.performers.name })
        .from(deps.performers)
        .orderBy(deps.desc(deps.performers.releaseCount))
        .limit(30);
      const popularPerformers = performersResult.map((r: any) => r.name);

      const analysis = await deps.analyzeSearchQuery(query, { availableGenres, popularPerformers });

      if (!analysis) {
        return NextResponse.json({
          success: true,
          searchParams: { q: query },
          analysis: null,
          message: 'Fallback to keyword search',
        });
      }

      const searchParams: Record<string, string | string[]> = {};

      if (analysis.expandedQuery) {
        searchParams['q'] = analysis.expandedQuery;
      } else if (analysis.keywords.length > 0) {
        searchParams['q'] = analysis.keywords.join(' ');
      }

      if (analysis.suggestedFilters?.includeGenres?.length) {
        const genreNames = analysis.suggestedFilters.includeGenres;
        const genreIdsResult = await db
          .select({ id: deps.tags.id })
          .from(deps.tags)
          .where(
            deps.sql`${deps.tags.category} = 'genre' AND ${deps.tags.name} = ANY(ARRAY[${deps.sql.join(
              genreNames.map((n: string) => deps.sql`${n}`),
              deps.sql`, `,
            )}]::text[])`,
          );
        if (genreIdsResult.length > 0) searchParams['include'] = genreIdsResult.map((r: any) => String(r.id));
      }

      if (analysis.suggestedFilters?.excludeGenres?.length) {
        const excludeNames = analysis.suggestedFilters.excludeGenres;
        const excludeIdsResult = await db
          .select({ id: deps.tags.id })
          .from(deps.tags)
          .where(
            deps.sql`${deps.tags.category} = 'genre' AND ${deps.tags.name} = ANY(ARRAY[${deps.sql.join(
              excludeNames.map((n: string) => deps.sql`${n}`),
              deps.sql`, `,
            )}]::text[])`,
          );
        if (excludeIdsResult.length > 0) searchParams['exclude'] = excludeIdsResult.map((r: any) => String(r.id));
      }

      if (analysis.intent === 'search_actress' && analysis.performers.length > 0) {
        const performerName = analysis.performers[0];
        const performerResult = await db
          .select({ id: deps.performers.id })
          .from(deps.performers)
          .where(
            deps.or(
              deps.ilike(deps.performers.name, `%${performerName}%`),
              deps.ilike(deps.performers.nameKana, `%${performerName}%`),
            ),
          )
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

      if (analysis.suggestedFilters?.onSale) searchParams['onSale'] = 'true';
      if (analysis.suggestedFilters?.minRating) searchParams['minRating'] = String(analysis.suggestedFilters.minRating);
      if (analysis.suggestedFilters?.priceRange) {
        if (analysis.suggestedFilters.priceRange.min != null)
          searchParams['minPrice'] = String(analysis.suggestedFilters.priceRange.min);
        if (analysis.suggestedFilters.priceRange.max != null)
          searchParams['maxPrice'] = String(analysis.suggestedFilters.priceRange.max);
      }
      if (analysis.suggestedFilters?.releaseDateRange) {
        if (analysis.suggestedFilters.releaseDateRange.from)
          searchParams['dateFrom'] = analysis.suggestedFilters.releaseDateRange.from;
        if (analysis.suggestedFilters.releaseDateRange.to)
          searchParams['dateTo'] = analysis.suggestedFilters.releaseDateRange.to;
      }
      if (analysis.suggestedFilters?.sortBy) searchParams['sort'] = analysis.suggestedFilters.sortBy;

      return NextResponse.json({
        success: true,
        searchParams,
        analysis,
        relatedTerms: analysis.relatedTerms,
        message:
          analysis.intent === 'search_product'
            ? '作品を検索します'
            : analysis.intent === 'recommendation'
              ? 'おすすめ作品を探します'
              : '検索結果を表示します',
      });
    } catch (error) {
      console.error('[AI Search API] Error:', error);
      return NextResponse.json({
        success: false,
        fallback: true,
        searchParams: {},
        analysis: null,
        message: 'AI search temporarily unavailable, please use keyword search',
      });
    }
  };
}
