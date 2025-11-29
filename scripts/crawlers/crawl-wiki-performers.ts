/**
 * Wiki sites performer crawler
 * Crawls performer names from av-wiki.net and seesaawiki.jp/av_neme
 * Run with: npx tsx scripts/crawl-wiki-performers.ts
 */

// Set DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { createHash } from 'crypto';
import { getDb } from '../../lib/db/index';
import { performers, performerAliases, products, productPerformers, rawHtmlData } from '../../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import iconv from 'iconv-lite';

interface PerformerData {
  name: string;
  productId: string;
  source: 'av-wiki' | 'seesaawiki';
}

interface ProductData {
  productId: string;
  title?: string;
  releaseDate?: string;
  studio?: string;
  series?: string;
  performers: string[];
  thumbnailUrl?: string;
  source: 'av-wiki' | 'seesaawiki';
}

/**
 * Detect encoding from HTML content
 */
function detectEncoding(buffer: Buffer, url: string): string {
  // seesaawiki uses EUC-JP
  if (url.includes('seesaawiki.jp')) {
    return 'euc-jp';
  }

  // av-wiki uses UTF-8 (WordPress default)
  if (url.includes('av-wiki.net')) {
    return 'utf-8';
  }

  // Try to detect from HTML meta tags
  const head = buffer.slice(0, 4096).toString('latin1');

  // Pattern 1: <meta charset="xxx">
  const charsetMatch1 = head.match(/<meta\s+charset=["']?([^"'\s>]+)/i);
  if (charsetMatch1) {
    return charsetMatch1[1].toLowerCase();
  }

  // Pattern 2: <meta http-equiv="Content-Type" content="text/html; charset=xxx">
  const charsetMatch2 = head.match(/charset=([^"'\s>]+)/i);
  if (charsetMatch2) {
    return charsetMatch2[1].toLowerCase();
  }

  return 'utf-8'; // default
}

/**
 * Fetch HTML content with proper encoding handling
 */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.log(`  ✗ HTTP ${response.status} for ${url}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const encoding = detectEncoding(buffer, url);
    console.log(`    🔤 Detected encoding: ${encoding} for ${url}`);

    const html = iconv.decode(buffer, encoding);

    // Rate limiting: 3000ms between requests
    await new Promise(resolve => setTimeout(resolve, 3000));

    return html;
  } catch (error) {
    console.error(`  ✗ Error fetching ${url}:`, error);
    return null;
  }
}

/**
 * Parse av-wiki.net article pages
 */
function parseAvWiki(html: string, url: string): { performers: PerformerData[], products: ProductData[] } {
  const performerResults: PerformerData[] = [];
  const productResults: ProductData[] = [];

  // Look for post content in WordPress
  const contentMatch = html.match(/<div class="entry-body">[\s\S]*?<\/div>/);
  if (!contentMatch) return { performers: performerResults, products: productResults };

  const content = contentMatch[0];

  // Extract product info from structured data
  const productMap = new Map<string, ProductData>();

  // Look for tables with product information
  const tableRows = content.match(/<tr[\s\S]*?<\/tr>/g) || [];

  let currentProductId: string | null = null;
  let currentPerformers: string[] = [];
  let currentTitle: string | null = null;
  let currentReleaseDate: string | null = null;

  for (const row of tableRows) {
    // Extract product ID
    const productIdMatch = row.match(/([A-Z]{2,10}-?\d{3,6})/i);
    if (productIdMatch) {
      const productId = productIdMatch[1].toUpperCase();

      // Save previous product if exists
      if (currentProductId && currentPerformers.length > 0) {
        productMap.set(currentProductId, {
          productId: currentProductId,
          title: currentTitle || undefined,
          releaseDate: currentReleaseDate || undefined,
          performers: currentPerformers,
          source: 'av-wiki'
        });

        // Add performer data
        for (const name of currentPerformers) {
          performerResults.push({
            name,
            productId: currentProductId,
            source: 'av-wiki'
          });
        }
      }

      // Start new product
      currentProductId = productId;
      currentPerformers = [];
      currentTitle = null;
      currentReleaseDate = null;
    }

    // Extract title
    if (row.includes('タイトル') || row.includes('作品名')) {
      const titleMatch = row.match(/>([^<>]{5,100})</);
      if (titleMatch) {
        currentTitle = titleMatch[1].trim();
      }
    }

    // Extract performers
    if (row.includes('出演者') || row.includes('女優') || row.includes('AV女優')) {
      const nameMatches = row.match(/>([^<>]{2,30})</g) || [];
      for (const match of nameMatches) {
        const name = match.replace(/>/g, '').replace(/</g, '').trim();
        // Skip labels and IDs
        if (name &&
            !name.match(/出演|女優|AV/) &&
            !name.match(/^[A-Z0-9]+-\d+$/) &&
            name.length > 1 &&
            name.length < 30) {
          currentPerformers.push(name);
        }
      }
    }

    // Extract release date
    if (row.includes('発売日') || row.includes('配信日')) {
      const dateMatch = row.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
      if (dateMatch) {
        currentReleaseDate = dateMatch[1];
      }
    }
  }

  // Save last product
  if (currentProductId && currentPerformers.length > 0) {
    productMap.set(currentProductId, {
      productId: currentProductId,
      title: currentTitle || undefined,
      releaseDate: currentReleaseDate || undefined,
      performers: currentPerformers,
      source: 'av-wiki'
    });

    for (const name of currentPerformers) {
      performerResults.push({
        name,
        productId: currentProductId,
        source: 'av-wiki'
      });
    }
  }

  productResults.push(...Array.from(productMap.values()));

  return { performers: performerResults, products: productResults };
}

/**
 * Parse seesaawiki.jp article pages
 */
function parseSeesaawiki(html: string, url: string): { performers: PerformerData[], products: ProductData[] } {
  const performerResults: PerformerData[] = [];
  const productResults: ProductData[] = [];

  // Look for wiki content
  const contentMatch = html.match(/<div id="wiki-content">[\s\S]*?<\/div>/);
  if (!contentMatch) return { performers: performerResults, products: productResults };

  const content = contentMatch[0];

  // Extract product info
  const productMap = new Map<string, ProductData>();

  const tableRows = content.match(/<tr[\s\S]*?<\/tr>/g) || [];

  let currentProductId: string | null = null;
  let currentPerformers: string[] = [];
  let currentTitle: string | null = null;
  let currentReleaseDate: string | null = null;

  for (const row of tableRows) {
    // Extract product ID
    const productIdMatch = row.match(/([A-Z]{2,10}-?\d{3,6})/i);
    if (productIdMatch) {
      const productId = productIdMatch[1].toUpperCase();

      // Save previous product
      if (currentProductId && currentPerformers.length > 0) {
        productMap.set(currentProductId, {
          productId: currentProductId,
          title: currentTitle || undefined,
          releaseDate: currentReleaseDate || undefined,
          performers: currentPerformers,
          source: 'seesaawiki'
        });

        for (const name of currentPerformers) {
          performerResults.push({
            name,
            productId: currentProductId,
            source: 'seesaawiki'
          });
        }
      }

      // Start new product
      currentProductId = productId;
      currentPerformers = [];
      currentTitle = null;
      currentReleaseDate = null;
    }

    // Extract title
    if (row.includes('タイトル') || row.includes('作品名')) {
      const titleMatch = row.match(/>([^<>]{5,100})</);
      if (titleMatch) {
        currentTitle = titleMatch[1].trim();
      }
    }

    // Extract performers
    if (row.includes('出演') || row.includes('女優')) {
      const nameMatches = row.match(/>([^<>]{2,30})</g) || [];
      for (const match of nameMatches) {
        const name = match.replace(/>/g, '').replace(/</g, '').trim();
        if (name &&
            !name.match(/出演|女優/) &&
            !name.match(/^[A-Z0-9]+-\d+$/) &&
            name.length > 1 &&
            name.length < 30) {
          currentPerformers.push(name);
        }
      }
    }

    // Extract release date
    if (row.includes('発売') || row.includes('配信')) {
      const dateMatch = row.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
      if (dateMatch) {
        currentReleaseDate = dateMatch[1];
      }
    }
  }

  // Save last product
  if (currentProductId && currentPerformers.length > 0) {
    productMap.set(currentProductId, {
      productId: currentProductId,
      title: currentTitle || undefined,
      releaseDate: currentReleaseDate || undefined,
      performers: currentPerformers,
      source: 'seesaawiki'
    });

    for (const name of currentPerformers) {
      performerResults.push({
        name,
        productId: currentProductId,
        source: 'seesaawiki'
      });
    }
  }

  productResults.push(...Array.from(productMap.values()));

  return { performers: performerResults, products: productResults };
}

/**
 * Get or create performer
 */
async function getOrCreatePerformer(db: any, name: string): Promise<number> {
  // Normalize name
  const normalizedName = name.trim();

  // Check if performer exists
  const existing = await db.select()
    .from(performers)
    .where(eq(performers.name, normalizedName))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create new performer
  const slug = normalizedName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '');

  const result = await db.insert(performers)
    .values({
      name: normalizedName,
      slug: slug + '-' + Date.now(),
    })
    .returning({ id: performers.id });

  console.log(`  ✨ Created new performer: ${normalizedName}`);
  return result[0].id;
}

/**
 * Get or create product from wiki data
 */
async function getOrCreateProduct(db: any, productData: ProductData): Promise<number | null> {
  const normalizedId = productData.productId.toLowerCase().replace(/[^a-z0-9]/g, '-');

  // Check if product exists by normalizedProductId
  const existing = await db.select()
    .from(products)
    .where(eq(products.normalizedProductId, normalizedId))
    .limit(1);

  if (existing.length > 0) {
    // Update product if we have new information
    if (productData.title || productData.releaseDate) {
      const updateData: any = {};
      if (productData.title) updateData.title = productData.title;
      if (productData.releaseDate) updateData.releaseDate = new Date(productData.releaseDate);

      if (Object.keys(updateData).length > 0) {
        await db.update(products)
          .set(updateData)
          .where(eq(products.id, existing[0].id));
        console.log(`  📝 Updated product: ${productData.productId}`);
      }
    }
    return existing[0].id;
  }

  // Create new product
  const newProduct = await db.insert(products)
    .values({
      id: productData.productId,
      normalizedProductId: normalizedId,
      title: productData.title || productData.productId,
      releaseDate: productData.releaseDate ? new Date(productData.releaseDate) : null,
      thumbnailUrl: productData.thumbnailUrl,
    })
    .returning({ id: products.id });

  console.log(`  ✨ Created new product: ${productData.productId}`);
  return newProduct[0].id;
}

/**
 * Link performer to product
 */
async function linkPerformerToProduct(
  db: any,
  performerId: number,
  productId: string
): Promise<void> {
  // Check if product exists
  const product = await db.select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (product.length === 0) {
    console.log(`  ⚠️  Product not found: ${productId}`);
    return;
  }

  // Check if link already exists
  const existingLink = await db.select()
    .from(productPerformers)
    .where(and(
      eq(productPerformers.productId, productId),
      eq(productPerformers.performerId, performerId)
    ))
    .limit(1);

  if (existingLink.length > 0) {
    return; // Already linked
  }

  // Create link
  await db.insert(productPerformers)
    .values({
      productId,
      performerId,
    });

  console.log(`  🔗 Linked performer ${performerId} to product ${productId}`);
}

/**
 * Save raw HTML data
 */
async function saveRawHtml(
  db: any,
  url: string,
  html: string,
  source: string
): Promise<void> {
  const hash = createHash('md5').update(url).digest('hex');

  // Extract product ID from URL or use hash as fallback
  const productIdMatch = url.match(/\/([^\/]+)\/?$/);
  const productId = productIdMatch ? productIdMatch[1] : hash.substring(0, 20);

  try {
    await db.insert(rawHtmlData)
      .values({
        url,
        hash,
        source,
        productId,
        htmlContent: html,
      })
      .onConflictDoNothing(); // Skip if already exists
  } catch (error) {
    console.log(`  ⚠️  Could not save raw HTML: ${error}`);
  }
}

/**
 * Crawl av-wiki.net sitemap to find article pages
 */
async function crawlAvWikiSitemap(db: any, limit: number = 100): Promise<void> {
  console.log('\n📚 Crawling av-wiki.net...');

  // Get recent posts from WordPress REST API
  const feedUrl = 'https://av-wiki.net/wp-json/wp/v2/posts?per_page=' + Math.min(limit, 100);

  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      console.error('Failed to fetch av-wiki feed');
      return;
    }

    const posts = await response.json() as any[];
    console.log(`Found ${posts.length} posts`);

    let processed = 0;
    for (const post of posts) {
      const url = post.link;
      console.log(`\nProcessing: ${post.title.rendered}`);

      const html = await fetchHtml(url);
      if (!html) continue;

      await saveRawHtml(db, url, html, 'av-wiki');

      const { performers, products } = parseAvWiki(html, url);
      console.log(`  Found ${performers.length} performer-product pairs, ${products.length} products`);

      // Process products first
      for (const productData of products) {
        await getOrCreateProduct(db, productData);

        // Link all performers to this product
        for (const performerName of productData.performers) {
          const performerId = await getOrCreatePerformer(db, performerName);
          await linkPerformerToProduct(db, performerId, productData.productId);
        }
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`Progress: ${processed}/${posts.length} articles processed`);
      }
    }

    console.log(`\n✅ av-wiki.net crawl complete: ${processed} articles processed`);
  } catch (error) {
    console.error('Error crawling av-wiki:', error);
  }
}

/**
 * Crawl seesaawiki.jp recent changes
 */
async function crawlSeesaawiki(db: any, limit: number = 100): Promise<void> {
  console.log('\n📚 Crawling seesaawiki.jp...');

  // Get recent changes page
  const recentUrl = 'https://seesaawiki.jp/av_neme/bbs/recent';

  try {
    const html = await fetchHtml(recentUrl);
    if (!html) {
      console.error('Failed to fetch seesaawiki recent changes');
      return;
    }

    // Extract article links from recent changes
    const linkMatches = html.match(/href="(\/av_neme\/d\/[^"]+)"/g) || [];
    const uniqueLinks = Array.from(new Set(linkMatches.map(m => m.match(/href="([^"]+)"/)?.[1])))
      .filter(Boolean)
      .slice(0, limit) as string[];

    console.log(`Found ${uniqueLinks.length} article links`);

    let processed = 0;
    for (const path of uniqueLinks) {
      const url = 'https://seesaawiki.jp' + path;
      console.log(`\nProcessing: ${url}`);

      const articleHtml = await fetchHtml(url);
      if (!articleHtml) continue;

      await saveRawHtml(db, url, articleHtml, 'seesaawiki');

      const { performers, products } = parseSeesaawiki(articleHtml, url);
      console.log(`  Found ${performers.length} performer-product pairs, ${products.length} products`);

      // Process products first
      for (const productData of products) {
        await getOrCreateProduct(db, productData);

        // Link all performers to this product
        for (const performerName of productData.performers) {
          const performerId = await getOrCreatePerformer(db, performerName);
          await linkPerformerToProduct(db, performerId, productData.productId);
        }
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`Progress: ${processed}/${uniqueLinks.length} articles processed`);
      }
    }

    console.log(`\n✅ seesaawiki.jp crawl complete: ${processed} articles processed`);
  } catch (error) {
    console.error('Error crawling seesaawiki:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const site = args[0] || 'both'; // av-wiki, seesaawiki, or both
  const limit = parseInt(args[1]) || 100;

  console.log('🚀 Starting wiki performer crawler...');
  console.log(`Site: ${site}, Limit: ${limit}`);

  const db = getDb();

  try {
    if (site === 'av-wiki' || site === 'both') {
      await crawlAvWikiSitemap(db, limit);
    }

    if (site === 'seesaawiki' || site === 'both') {
      await crawlSeesaawiki(db, limit);
    }

    console.log('\n✅ Wiki crawler completed successfully!');
  } catch (error) {
    console.error('❌ Crawler failed:', error);
    process.exit(1);
  }
}

main();
