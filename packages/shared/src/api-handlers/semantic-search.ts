import { NextRequest, NextResponse } from 'next/server';

export interface SemanticSearchHandlerDeps {
  getDb: () => any;
  sql: any;
  generateQueryEmbedding: (query: string) => Promise<number[]>;
}

export function createSemanticSearchHandler(deps: SemanticSearchHandlerDeps) {
  return async function GET(request: NextRequest) {
    try {
      const searchParams = request.nextUrl.searchParams;
      const query = searchParams.get('q');
      const limitParam = searchParams.get('limit');
      const offsetParam = searchParams.get('offset');
      const hybridParam = searchParams.get('hybrid');

      if (!query) return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
      if (query.length > 500)
        return NextResponse.json({ error: 'Search query is too long (max 500 characters)' }, { status: 400 });

      const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100);
      const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0);
      const useHybrid = hybridParam === 'true';

      if (!process.env['GEMINI_API_KEY'] && !process.env['GOOGLE_API_KEY']) {
        return NextResponse.json({ error: 'Semantic search is not configured' }, { status: 503 });
      }

      const db = deps.getDb();
      const queryEmbedding = await deps.generateQueryEmbedding(query);
      const embeddingString = `[${queryEmbedding.join(',')}]`;

      let results;

      if (useHybrid) {
        results = await db.execute(deps.sql`
          WITH semantic_results AS (
            SELECT p.id, p.normalized_product_id, p.title, p.release_date, p.default_thumbnail_url,
              1 - (p.embedding <=> ${embeddingString}::vector) as semantic_score,
              ROW_NUMBER() OVER (ORDER BY p.embedding <=> ${embeddingString}::vector) as semantic_rank
            FROM products p WHERE p.embedding IS NOT NULL ORDER BY p.embedding <=> ${embeddingString}::vector LIMIT 100
          ),
          keyword_results AS (
            SELECT p.id, ts_rank(p.search_vector, websearch_to_tsquery('simple', ${query})) as keyword_score,
              ROW_NUMBER() OVER (ORDER BY ts_rank(p.search_vector, websearch_to_tsquery('simple', ${query})) DESC) as keyword_rank
            FROM products p WHERE p.search_vector @@ websearch_to_tsquery('simple', ${query}) LIMIT 100
          ),
          combined AS (
            SELECT COALESCE(s.id, k.id) as id, COALESCE(s.normalized_product_id, p.normalized_product_id) as normalized_product_id,
              COALESCE(s.title, p.title) as title, COALESCE(s.release_date, p.release_date) as release_date,
              COALESCE(s.default_thumbnail_url, p.default_thumbnail_url) as default_thumbnail_url,
              COALESCE(s.semantic_score, 0) as semantic_score, COALESCE(k.keyword_score, 0) as keyword_score,
              COALESCE(1.0 / (60 + s.semantic_rank), 0) + COALESCE(1.0 / (60 + k.keyword_rank), 0) as rrf_score
            FROM semantic_results s FULL OUTER JOIN keyword_results k ON s.id = k.id LEFT JOIN products p ON k.id = p.id
          )
          SELECT c.id, c.normalized_product_id as "normalizedProductId", c.title, c.release_date as "releaseDate",
            c.default_thumbnail_url as "thumbnailUrl", c.semantic_score as "semanticScore", c.keyword_score as "keywordScore",
            c.rrf_score as "score",
            (SELECT MIN(pp.price) FROM product_prices pp JOIN product_sources ps ON pp.source_id = ps.id WHERE ps.product_id = c.id AND pp.price > 0) as "minPrice",
            (SELECT json_agg(json_build_object('id', pe.id, 'name', pe.name)) FROM product_performers ppr JOIN performers pe ON ppr.performer_id = pe.id WHERE ppr.product_id = c.id LIMIT 3) as performers
          FROM combined c ORDER BY c.rrf_score DESC LIMIT ${limit} OFFSET ${offset}
        `);
      } else {
        results = await db.execute(deps.sql`
          SELECT p.id, p.normalized_product_id as "normalizedProductId", p.title, p.release_date as "releaseDate",
            p.default_thumbnail_url as "thumbnailUrl", 1 - (p.embedding <=> ${embeddingString}::vector) as "score",
            (SELECT MIN(pp.price) FROM product_prices pp JOIN product_sources ps ON pp.source_id = ps.id WHERE ps.product_id = p.id AND pp.price > 0) as "minPrice",
            (SELECT json_agg(json_build_object('id', pe.id, 'name', pe.name)) FROM product_performers ppr JOIN performers pe ON ppr.performer_id = pe.id WHERE ppr.product_id = p.id LIMIT 3) as performers
          FROM products p WHERE p.embedding IS NOT NULL ORDER BY p.embedding <=> ${embeddingString}::vector LIMIT ${limit} OFFSET ${offset}
        `);
      }

      return NextResponse.json({
        query,
        mode: useHybrid ? 'hybrid' : 'semantic',
        results: results.rows,
        pagination: { limit, offset, hasMore: results.rows.length === limit },
      });
    } catch (error) {
      console.error('Semantic search error:', error);
      return NextResponse.json({
        query: '',
        mode: 'semantic',
        results: [],
        fallback: true,
        pagination: { limit: 20, offset: 0, hasMore: false },
      });
    }
  };
}
