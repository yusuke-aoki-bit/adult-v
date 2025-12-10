import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { products, productSources } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
const CHUNK_SIZE = 10000;

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chunk: string }> }
) {
  const { chunk: chunkStr } = await params;
  const chunk = parseInt(chunkStr);
  const offset = chunk * CHUNK_SIZE;

  try {
    const db = getDb();

    // DTI以外の商品を取得（優先度順: 新しい商品を優先）
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

    // Generate XML sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${productList
  .map((product) => {
    const lastMod = (product.updatedAt || new Date()).toISOString();
    return `  <url>
    <loc>${BASE_URL}/ja/products/${product.id}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="${BASE_URL}/ja/products/${product.id}" />
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/en/products/${product.id}" />
    <xhtml:link rel="alternate" hreflang="zh" href="${BASE_URL}/zh/products/${product.id}" />
    <xhtml:link rel="alternate" hreflang="ko" href="${BASE_URL}/ko/products/${product.id}" />
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
