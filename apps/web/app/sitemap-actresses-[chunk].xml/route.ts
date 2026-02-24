import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { performers, products } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';
const CHUNK_SIZE = 5000;

export const revalidate = 3600;

export async function generateStaticParams() {
  return Array.from({ length: 8 }, (_, i) => ({ chunk: String(i) }));
}

export async function GET(_request: NextRequest, props: { params: Promise<{ chunk: string }> }) {
  const resolvedParams = await props.params;
  const chunkStr = resolvedParams?.chunk;
  if (!chunkStr) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      {
        headers: { 'Content-Type': 'application/xml' },
      },
    );
  }
  const chunk = parseInt(chunkStr);

  if (isNaN(chunk) || chunk < 0 || chunk > 100) {
    return new Response('Invalid chunk parameter', { status: 400 });
  }

  const offset = chunk * CHUNK_SIZE;

  try {
    const db = getDb();

    // 女優を商品数順に取得（lastmod用に最新商品の更新日も取得）
    const performerList = await db
      .select({
        id: performers.id,
        productCount: sql<number>`COUNT(DISTINCT pp.product_id)`.as('product_count'),
        lastUpdated: sql<string>`MAX(${products.updatedAt})`.as('last_updated'),
      })
      .from(performers)
      .leftJoin(sql`product_performers pp`, sql`${performers.id} = pp.performer_id`)
      .leftJoin(products, sql`pp.product_id = ${products.id}`)
      .groupBy(performers.id)
      .orderBy(desc(sql`product_count`))
      .limit(CHUNK_SIZE)
      .offset(offset);

    // Generate XML sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${performerList
  .map((performer) => {
    const lastMod = performer.lastUpdated ? new Date(performer.lastUpdated).toISOString() : new Date().toISOString();
    // Priority based on product count (more products = higher priority)
    const priority = Math.min(0.9, 0.5 + (Number(performer.productCount) / 1000) * 0.1).toFixed(1);

    const actressPath = `/actress/${performer.id}`;
    return `  <url>
    <loc>${BASE_URL}${actressPath}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="${BASE_URL}${actressPath}" />
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}${actressPath}?hl=en" />
    <xhtml:link rel="alternate" hreflang="zh" href="${BASE_URL}${actressPath}?hl=zh" />
    <xhtml:link rel="alternate" hreflang="zh-TW" href="${BASE_URL}${actressPath}?hl=zh-TW" />
    <xhtml:link rel="alternate" hreflang="ko" href="${BASE_URL}${actressPath}?hl=ko" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${actressPath}" />
  </url>`;
  })
  .join('\n')}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error(`Error generating actress sitemap chunk ${chunk}:`, error);
    return new Response('Error generating sitemap', { status: 500 });
  }
}
