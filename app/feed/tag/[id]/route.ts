import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { products, tags, productTags, productSources, performers, productPerformers } from '@/lib/db/schema';
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
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return new Response('Invalid tag ID', { status: 400 });
    }

    // Get tag information
    const [tag] = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
      })
      .from(tags)
      .where(eq(tags.id, tagId))
      .limit(1);

    if (!tag) {
      return new Response('Tag not found', { status: 404 });
    }

    // Get 50 most recent products for this tag (excluding DTI)
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
      .innerJoin(productTags, eq(products.id, productTags.productId))
      .where(
        and(
          eq(productTags.tagId, tagId),
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
    <category>${escapeXml(tag.name)}</category>${performerTags ? '\n    ' + performerTags : ''}${mediaContent}
  </item>`;
      })
      .join('\n');

    const buildDate = new Date().toUTCString();
    const tagNameEscaped = escapeXml(tag.name);
    const categoryLabel = tag.category ? ` (${escapeXml(tag.category)})` : '';

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(SITE_NAME)} - ${tagNameEscaped}${categoryLabel}の新着動画</title>
    <link>${BASE_URL}/ja/search?tags=${tagId}</link>
    <description>${tagNameEscaped}タグの最新AV作品情報を配信</description>
    <language>ja</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed/tag/${tagId}" rel="self" type="application/rss+xml" />
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
    console.error('Error generating tag RSS feed:', error);
    return new Response('Error generating RSS feed', { status: 500 });
  }
}
