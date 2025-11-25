import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { products, performers, productPerformers, productSources } from '@/lib/db/schema';
import { desc, eq, sql, and } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
const SITE_NAME = 'Adult Viewer Lab';

export const dynamic = 'force-dynamic';
export const revalidate = 1800; // 30 minutes

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const performerId = parseInt(id);

    if (isNaN(performerId)) {
      return new Response('Invalid performer ID', { status: 400 });
    }

    // Get actress information
    const [actress] = await db
      .select({
        id: performers.id,
        name: performers.name,
      })
      .from(performers)
      .where(eq(performers.id, performerId))
      .limit(1);

    if (!actress) {
      return new Response('Actress not found', { status: 404 });
    }

    // Get 50 most recent products for this actress (excluding DTI)
    const recentProducts = await db
      .select({
        id: products.id,
        title: products.title,
        description: products.description,
        releaseDate: products.releaseDate,
        defaultThumbnailUrl: products.defaultThumbnailUrl,
        runtime: products.runtime,
        createdAt: products.createdAt,
      })
      .from(products)
      .innerJoin(productPerformers, eq(products.id, productPerformers.productId))
      .where(
        and(
          eq(productPerformers.performerId, performerId),
          sql`NOT EXISTS (
            SELECT 1 FROM ${productSources} ps
            WHERE ps.product_id = ${products.id}
            AND ps.asp_name = 'DTI'
          )`
        )
      )
      .orderBy(desc(products.releaseDate))
      .limit(50);

    // Build RSS items
    const items = recentProducts
      .map((product) => {
        const link = `${BASE_URL}/ja/products/${product.id}`;
        const pubDate = (product.releaseDate || product.createdAt || new Date()).toUTCString();
        const description = escapeXml(product.description || product.title || '');
        const title = escapeXml(product.title || '');

        let mediaContent = '';
        if (product.defaultThumbnailUrl) {
          mediaContent = `
    <media:content url="${escapeXml(product.defaultThumbnailUrl)}" medium="image" />
    <media:thumbnail url="${escapeXml(product.defaultThumbnailUrl)}" />`;
        }

        return `  <item>
    <title>${title}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${description}</description>
    <dc:creator>${escapeXml(actress.name)}</dc:creator>${mediaContent}
  </item>`;
      })
      .join('\n');

    const buildDate = new Date().toUTCString();
    const actressNameEscaped = escapeXml(actress.name);

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(SITE_NAME)} - ${actressNameEscaped}の新着動画</title>
    <link>${BASE_URL}/ja/actress/${performerId}</link>
    <description>${actressNameEscaped}の最新AV作品情報を配信</description>
    <language>ja</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed/actress/${performerId}" rel="self" type="application/rss+xml" />
    <ttl>30</ttl>
${items}
  </channel>
</rss>`;

    return new Response(rss, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800',
      },
    });
  } catch (error) {
    console.error('Error generating actress RSS feed:', error);
    return new Response('Error generating RSS feed', { status: 500 });
  }
}
