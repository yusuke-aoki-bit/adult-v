import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { products, productSources } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';
const CHUNK_SIZE = 10000;

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chunk: string }> }
) {
  const { chunk: chunkStr } = await params;
  const chunk = parseInt(chunkStr);
  const offset = chunk * CHUNK_SIZE;

  try {
    const db = getDb();

    const productList = await db
      .select({
        id: products.id,
        updatedAt: products.updatedAt,
        releaseDate: products.releaseDate,
      })
      .from(products)
      .where(
        sql`NOT EXISTS (
          SELECT 1 FROM ${productSources} ps
          WHERE ps.product_id = ${products.id}
          AND ps.asp_name = 'DTI'
        )`
      )
      .orderBy(desc(products.releaseDate))
      .limit(CHUNK_SIZE)
      .offset(offset);

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${productList
  .map((product) => {
    const lastMod = (product.updatedAt || new Date()).toISOString();
    const productPath = `/products/${product.id}`;
    return `  <url>
    <loc>${BASE_URL}${productPath}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="${BASE_URL}${productPath}" />
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}${productPath}?hl=en" />
    <xhtml:link rel="alternate" hreflang="zh" href="${BASE_URL}${productPath}?hl=zh" />
    <xhtml:link rel="alternate" hreflang="zh-TW" href="${BASE_URL}${productPath}?hl=zh-TW" />
    <xhtml:link rel="alternate" hreflang="ko" href="${BASE_URL}${productPath}?hl=ko" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${productPath}" />
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
    console.error(`Error generating product sitemap chunk ${chunk}:`, error);
    return new Response('Error generating sitemap', { status: 500 });
  }
}
