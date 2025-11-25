import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { products, productSources, performers, productPerformers } from '@/lib/db/schema';
import { desc, eq, sql, and } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
const SITE_NAME = 'Adult Viewer Lab';

export const dynamic = 'force-dynamic';
export const revalidate = 1800; // 30 minutes

// Allowed providers (excluding DTI)
const ALLOWED_PROVIDERS = ['DUGA', 'MGS', 'DMM'];

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
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const db = getDb();
    const { name } = await params;
    const providerName = decodeURIComponent(name).toUpperCase();

    // Validate provider name
    if (!ALLOWED_PROVIDERS.includes(providerName)) {
      return new Response('Invalid or disallowed provider', { status: 400 });
    }

    // Get 50 most recent products from this provider (excluding DTI)
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
      .innerJoin(productSources, eq(products.id, productSources.productId))
      .where(
        and(
          eq(productSources.aspName, providerName),
          sql`NOT EXISTS (
            SELECT 1 FROM ${productSources} ps
            WHERE ps.product_id = ${products.id}
            AND ps.asp_name = 'DTI'
          )`
        )
      )
      .orderBy(desc(products.releaseDate))
      .limit(50);

    // Get performers for each product
    const productsWithPerformers = await Promise.all(
      recentProducts.map(async (product) => {
        const productPerformersList = await db
          .select({
            name: performers.name,
          })
          .from(performers)
          .innerJoin(productPerformers, eq(performers.id, productPerformers.performerId))
          .where(eq(productPerformers.productId, product.id))
          .limit(5);

        return {
          ...product,
          performers: productPerformersList,
        };
      })
    );

    // Build RSS items
    const items = productsWithPerformers
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

        const performerTags = product.performers
          .map((p) => `<dc:creator>${escapeXml(p.name)}</dc:creator>`)
          .join('\n    ');

        return `  <item>
    <title>${title}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${description}</description>
    <category>${escapeXml(providerName)}</category>${performerTags ? '\n    ' + performerTags : ''}${mediaContent}
  </item>`;
      })
      .join('\n');

    const buildDate = new Date().toUTCString();
    const providerNameEscaped = escapeXml(providerName);

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(SITE_NAME)} - ${providerNameEscaped}の新着動画</title>
    <link>${BASE_URL}/ja/search?aspNames=${encodeURIComponent(providerName)}</link>
    <description>${providerNameEscaped}配信サイトの最新AV作品情報を配信</description>
    <language>ja</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed/provider/${encodeURIComponent(providerName.toLowerCase())}" rel="self" type="application/rss+xml" />
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
    console.error('Error generating provider RSS feed:', error);
    return new Response('Error generating RSS feed', { status: 500 });
  }
}
