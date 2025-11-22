/**
 * DTI RSS feed data import script
 * Fetches product data from DTI RSS feeds
 * Run with: DATABASE_URL="..." npx tsx scripts/seed-dti-rss.ts
 */

import { getDb } from '../lib/db/index';
import { products, performers, productPerformers, tags, productTags, productSources, productCache } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  ppvId: string;
  actorName: string;
  siteId: string;
}

const DTI_RSS_FEEDS = [
  { sid: 2477, siteName: 'カリビアンコムプレミアム', url: 'https://ad2widget.dtiserv2.com/rss?aid=239360&sid=2477' },
  { sid: 2468, siteName: 'カリビアンコム', url: 'https://ad2widget.dtiserv2.com/rss?aid=239360&sid=2468' },
  { sid: 2470, siteName: '一本道', url: 'https://ad2widget.dtiserv2.com/rss?aid=239360&sid=2470' },
  { sid: 2665, siteName: 'HEYZO', url: 'https://ad2widget.dtiserv2.com/rss?aid=239360&sid=2665' },
];

async function fetchRSSFeed(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

function parseRSSFeed(xmlContent: string, siteName: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Simple XML parsing using regex (basic implementation)
  const itemMatches = xmlContent.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const itemContent = match[1];

    // Handle both CDATA and plain text content
    const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
    const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
    const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
    const ppvIdMatch = itemContent.match(/<dtiaff:ppv_id>(.*?)<\/dtiaff:ppv_id>/);
    const actorMatch = itemContent.match(/<dtiaff:actor_name>(.*?)<\/dtiaff:actor_name>/);

    if (titleMatch && linkMatch) {
      items.push({
        title: titleMatch[1].trim(),
        link: linkMatch[1].trim(),
        description: descMatch?.[1]?.trim() || '',
        pubDate: pubDateMatch?.[1]?.trim() || '',
        ppvId: ppvIdMatch?.[1]?.trim() || '',
        actorName: actorMatch?.[1]?.trim() || '',
        siteId: siteName,
      });
    }
  }

  return items;
}

function parsePubDate(pubDateStr: string): string | undefined {
  if (!pubDateStr) return undefined;

  try {
    // Parse RFC 822 date format: "Wed, 19 Nov 2025 15:00:00 -0000"
    const date = new Date(pubDateStr);
    if (isNaN(date.getTime())) return undefined;

    // Format as YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    return undefined;
  }
}

async function seedDTIRSSData() {
  try {
    console.log('Starting DTI RSS feed import...\n');

    const db = getDb();
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const feed of DTI_RSS_FEEDS) {
      console.log(`Fetching RSS feed: ${feed.siteName} (sid=${feed.sid})...`);

      const xmlContent = await fetchRSSFeed(feed.url);

      if (!xmlContent) {
        console.log(`  ⚠️  Failed to fetch RSS feed for ${feed.siteName}`);
        skippedCount++;
        continue;
      }

      const items = parseRSSFeed(xmlContent, feed.siteName);
      console.log(`  Found ${items.length} products in feed\n`);

      for (const item of items) {
        try {
          const normalizedProductId = `DTI-${feed.sid}-${item.ppvId || item.title.substring(0, 20)}`;
          const title = item.title;
          const description = item.description;
          const releaseDate = parsePubDate(item.pubDate);
          const affiliateUrl = item.link;
          const actorName = item.actorName;

          if (!title) {
            console.log(`  ⚠️  Skipping invalid item: ${normalizedProductId}`);
            skippedCount++;
            continue;
          }

          // Check if product already exists
          const existingProduct = await db
            .select()
            .from(products)
            .where(eq(products.normalizedProductId, normalizedProductId))
            .limit(1);

          let productId: number;

          if (existingProduct.length > 0) {
            productId = existingProduct[0].id;
            skippedCount++;
            continue; // Product already exists, skip
          } else {
            // Insert product
            const [insertedProduct] = await db
              .insert(products)
              .values({
                normalizedProductId,
                title,
                description,
                releaseDate,
              })
              .returning({ id: products.id });

            productId = insertedProduct.id;
            console.log(`  ✓ Created product: ${title.substring(0, 50)}...`);
          }

          // Insert product source
          await db.insert(productSources).values({
            productId,
            aspName: 'DTI',
            originalProductId: item.ppvId || normalizedProductId,
            affiliateUrl,
            price: 0, // Price not available in RSS
            dataSource: 'RSS',
          });

          // Insert product cache
          await db.insert(productCache).values({
            productId,
            aspName: 'DTI',
            price: 0,
            affiliateUrl,
            inStock: true,
          });

          // Insert performer if provided
          if (actorName && actorName.trim() !== '') {
            const existingPerformer = await db
              .select()
              .from(performers)
              .where(eq(performers.name, actorName))
              .limit(1);

            let performerId: number;

            if (existingPerformer.length > 0) {
              performerId = existingPerformer[0].id;
            } else {
              const [insertedPerformer] = await db
                .insert(performers)
                .values({
                  name: actorName,
                })
                .returning({ id: performers.id });

              performerId = insertedPerformer.id;
            }

            // Link product to performer
            const existingLink = await db
              .select()
              .from(productPerformers)
              .where(
                and(
                  eq(productPerformers.productId, productId),
                  eq(productPerformers.performerId, performerId)
                )
              )
              .limit(1);

            if (existingLink.length === 0) {
              await db.insert(productPerformers).values({
                productId,
                performerId,
              });
            }
          }

          // Link product to site tag
          const existingSiteTag = await db
            .select()
            .from(tags)
            .where(eq(tags.name, feed.siteName))
            .limit(1);

          if (existingSiteTag.length > 0) {
            const tagId = existingSiteTag[0].id;

            const existingTagLink = await db
              .select()
              .from(productTags)
              .where(
                and(
                  eq(productTags.productId, productId),
                  eq(productTags.tagId, tagId)
                )
              )
              .limit(1);

            if (existingTagLink.length === 0) {
              await db.insert(productTags).values({
                productId,
                tagId,
              });
            }
          }

          importedCount++;

        } catch (error) {
          console.error(`  ❌ Error importing ${item.title}:`, error);
          errorCount++;
        }
      }

      console.log('');
    }

    console.log('\n========================================');
    console.log(`DTI RSS Import completed!`);
    console.log(`  ✓ Imported: ${importedCount}`);
    console.log(`  ⚠️  Skipped: ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

seedDTIRSSData();
