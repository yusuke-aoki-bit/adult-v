import { NextRequest, NextResponse } from 'next/server';

export interface AlsoViewedHandlerDeps {
  getDb: () => any;
  products: any;
  productSources: any;
  sql: any;
}

export function createAlsoViewedHandler(deps: AlsoViewedHandlerDeps) {
  return async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params;
      const productId = parseInt(id, 10);

      if (isNaN(productId)) {
        return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
      }

      const { searchParams } = new URL(request.url);
      const limit = Math.min(parseInt(searchParams.get('limit') || '6', 10), 12);

      const db = deps.getDb();

      const alsoViewedResult = await db.execute(deps.sql`
        WITH product_viewers AS (
          SELECT DISTINCT session_id
          FROM product_views
          WHERE product_id = ${productId}
            AND session_id IS NOT NULL
        ),
        viewer_count AS (
          SELECT COUNT(DISTINCT session_id) as total FROM product_viewers
        ),
        co_viewed AS (
          SELECT
            pv.product_id,
            COUNT(DISTINCT pv.session_id) as co_view_count
          FROM product_views pv
          INNER JOIN product_viewers pv_ref ON pv.session_id = pv_ref.session_id
          WHERE pv.product_id != ${productId}
          GROUP BY pv.product_id
          HAVING COUNT(DISTINCT pv.session_id) >= 2
        )
        SELECT
          p.id,
          p.title,
          p.normalized_product_id as "normalizedProductId",
          p.default_thumbnail_url as "imageUrl",
          cv.co_view_count as "coViewCount",
          ROUND((cv.co_view_count::numeric / GREATEST(vc.total, 1)) * 100) as "coViewRate",
          (SELECT COUNT(*) FROM product_views WHERE product_id = p.id) as "viewCount"
        FROM ${deps.products} p
        INNER JOIN co_viewed cv ON p.id = cv.product_id
        CROSS JOIN viewer_count vc
        WHERE NOT EXISTS (
          SELECT 1 FROM ${deps.productSources} ps
          WHERE ps.product_id = p.id
          AND ps.asp_name = 'DTI'
        )
        ORDER BY cv.co_view_count DESC, "viewCount" DESC
        LIMIT ${limit}
      `);

      const alsoViewed = (alsoViewedResult.rows as any[]).map((row: any) => ({
        id: row.id,
        title: row.title || '',
        normalizedProductId: row.normalizedProductId,
        imageUrl: row.imageUrl,
        coViewRate: Number(row.coViewRate),
        viewCount: Number(row.viewCount),
      }));

      return NextResponse.json({ success: true, alsoViewed, productId });
    } catch (error) {
      console.error('[Also Viewed API] Error:', error);
      return NextResponse.json({ success: false, fallback: true, alsoViewed: [], productId: null });
    }
  };
}
