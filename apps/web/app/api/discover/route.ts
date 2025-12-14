import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const excludeIdsParam = searchParams.get('excludeIds');
    const excludeIds = excludeIdsParam ? excludeIdsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
    const locale = searchParams.get('locale') || 'ja';

    const conditions = [];

    // 除外ID
    if (excludeIds.length > 0) {
      conditions.push(sql`p.id NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})`);
    }

    // サンプル画像がある作品のみ
    conditions.push(sql`p.sample_images IS NOT NULL AND jsonb_array_length(p.sample_images) > 0`);

    // FANZA以外の作品のみ（規約対応）
    conditions.push(sql`EXISTS (
      SELECT 1 FROM product_sources ps2
      WHERE ps2.product_id = p.id AND ps2.asp_name != 'FANZA'
    )`);

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    // タイトルのローカライズ
    const titleColumn = locale === 'en' ? sql`COALESCE(p.title_en, p.title)`
      : locale === 'zh' ? sql`COALESCE(p.title_zh, p.title)`
      : locale === 'ko' ? sql`COALESCE(p.title_ko, p.title)`
      : sql`p.title`;

    const result = await db.execute(sql`
      SELECT
        p.id,
        ${titleColumn} as title,
        p.image_url,
        p.sample_images,
        p.release_date,
        p.duration,
        ps.price,
        ps.asp_name as provider,
        ps.affiliate_url,
        array_agg(DISTINCT perf.name) FILTER (WHERE perf.name IS NOT NULL) as performers
      FROM products p
      LEFT JOIN LATERAL (
        SELECT price, asp_name, affiliate_url FROM product_sources
        WHERE product_id = p.id AND asp_name != 'FANZA'
        ORDER BY price NULLS LAST
        LIMIT 1
      ) ps ON true
      LEFT JOIN product_performers pp ON p.id = pp.product_id
      LEFT JOIN performers perf ON pp.performer_id = perf.id
      ${whereClause}
      GROUP BY p.id, p.title, p.title_en, p.title_zh, p.title_ko, p.image_url, p.sample_images, p.release_date, p.duration, ps.price, ps.asp_name, ps.affiliate_url
      ORDER BY RANDOM()
      LIMIT 1
    `);

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ product: null });
    }

    const row = result.rows[0] as Record<string, unknown>;
    const product = {
      id: row.id as number,
      title: row.title as string,
      imageUrl: row.image_url as string,
      sampleImages: row.sample_images as string[] | null,
      releaseDate: row.release_date as string | null,
      duration: row.duration as number | null,
      price: row.price as number | null,
      provider: row.provider as string | null,
      affiliateUrl: row.affiliate_url as string | null,
      performers: (row.performers as string[] | null)?.filter(Boolean) || [],
    };

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Error fetching random product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
