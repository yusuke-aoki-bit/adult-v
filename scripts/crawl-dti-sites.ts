/**
 * DTI sites crawler script
 * Crawls product pages directly from DTI affiliated sites
 * Run with: npx tsx scripts/crawl-dti-sites.ts
 */

// Set DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { createHash } from 'crypto';
import { getDb } from '../lib/db/index';
import { products, performers, productPerformers, tags, productTags, productSources, productCache, rawHtmlData } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import iconv from 'iconv-lite';
import { generateDTILink } from '../lib/affiliate';

/**
 * Detect encoding from HTML content or response headers
 */
function detectEncoding(buffer: Buffer, contentType?: string, url?: string): string {
  // Check Content-Type header first
  if (contentType) {
    const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
    if (charsetMatch) {
      return charsetMatch[1].toLowerCase();
    }
  }

  // URL-based detection for known DTI sites (they use EUC-JP)
  if (url) {
    if (url.includes('caribbeancompr.com') ||
        url.includes('caribbeancom.com') ||
        url.includes('1pondo.tv') ||
        url.includes('heyzo.com')) {
      return 'euc-jp';
    }
  }

  // Try to detect from HTML meta tags (check first 4096 bytes)
  // Use 'latin1' to preserve raw bytes without corruption
  const head = buffer.slice(0, 4096).toString('latin1');

  // Pattern 1: <meta charset="xxx">
  const charsetMatch1 = head.match(/<meta\s+charset=["']?([^"'\s>]+)/i);
  if (charsetMatch1) {
    return charsetMatch1[1].toLowerCase();
  }

  // Pattern 2: <meta http-equiv="Content-Type" content="text/html; charset=xxx">
  const charsetMatch2 = head.match(/content=["'][^"']*charset=([^"'\s;]+)/i);
  if (charsetMatch2) {
    return charsetMatch2[1].toLowerCase();
  }

  // Default to UTF-8
  return 'utf-8';
}

/**
 * Decode buffer to string with proper encoding
 */
function decodeHtml(buffer: Buffer, contentType?: string, url?: string): string {
  const encoding = detectEncoding(buffer, contentType, url);
  console.log(`    🔤 Detected encoding: ${encoding} for ${url?.substring(0, 50) || 'unknown'}`);

  // Normalize encoding names
  const normalizedEncoding = encoding
    .replace('shift_jis', 'shift-jis')
    .replace('shift-jis', 'Shift_JIS')
    .replace('sjis', 'Shift_JIS')
    .replace('euc-jp', 'EUC-JP')
    .replace('eucjp', 'EUC-JP');

  try {
    if (normalizedEncoding.toLowerCase() === 'utf-8' || normalizedEncoding.toLowerCase() === 'utf8') {
      return buffer.toString('utf-8');
    }
    // Use iconv-lite for other encodings
    return iconv.decode(buffer, normalizedEncoding);
  } catch (error) {
    console.warn(`Failed to decode with ${normalizedEncoding}, falling back to UTF-8`);
    return buffer.toString('utf-8');
  }
}

interface CrawlConfig {
  siteName: string;
  siteId: string;
  baseUrl: string;
  urlPattern: string;
  idFormat: 'MMDDYY_NNN' | 'MMDDYY_NNNN' | 'NNNN';
  startId?: string;
  endId?: string;
  maxConcurrent?: number;
  reverseMode?: boolean; // True = 過去に向かって遡る、False = 未来に向かって進む
}

const CRAWL_CONFIGS: CrawlConfig[] = [
  {
    siteName: 'カリビアンコムプレミアム',
    siteId: '2477',
    baseUrl: 'https://www.caribbeancompr.com',
    urlPattern: 'https://www.caribbeancompr.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '112024_001', // Start from recent date: Nov 20, 2024
    endId: '010115_001', // Go back to Jan 1, 2015 (10 years of data)
    reverseMode: true, // 過去に向かって遡る
    maxConcurrent: 3,
  },
  {
    siteName: '一本道',
    siteId: '2470',
    baseUrl: 'https://www.1pondo.tv',
    urlPattern: 'https://www.1pondo.tv/movies/{id}/',
    idFormat: 'MMDDYY_NNN',
    startId: '112024_001', // Start from recent date: Nov 20, 2024
    endId: '010115_001', // Go back to Jan 1, 2015 (10 years of data)
    reverseMode: true, // 過去に向かって遡る
    maxConcurrent: 3,
  },
  {
    siteName: 'カリビアンコム',
    siteId: '2478',
    baseUrl: 'https://www.caribbeancom.com',
    urlPattern: 'https://www.caribbeancom.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '112024_001', // Start from recent date: Nov 20, 2024
    endId: '010115_001', // Go back to Jan 1, 2015 (10 years of data)
    reverseMode: true, // 過去に向かって遡る
    maxConcurrent: 3,
  },
  {
    siteName: 'HEYZO',
    siteId: '2665',
    baseUrl: 'https://www.heyzo.com',
    urlPattern: 'https://www.heyzo.com/moviepages/{id}/index.html',
    idFormat: 'NNNN',
    startId: '0001', // Start from the very first
    endId: '9999', // Go up to maximum
    maxConcurrent: 3,
  },
];

/**
 * Generate next ID based on format
 */
function generateNextId(currentId: string, format: string, reverse: boolean = false): string | null {
  if (format === 'NNNN') {
    // Simple numeric increment: 0001 -> 0002 -> ... -> 9999
    const num = parseInt(currentId);
    if (reverse) {
      if (num <= 1) return null;
      return String(num - 1).padStart(4, '0');
    } else {
      if (num >= 9999) return null;
      return String(num + 1).padStart(4, '0');
    }
  }

  if (format === 'MMDDYY_NNN' || format === 'MMDDYY_NNNN') {
    // Date-based format: MMDDYY_NNN or MMDDYY_NNNN
    const [datePart, seqPart] = currentId.split('_');
    const maxSeq = format === 'MMDDYY_NNN' ? 10 : 20; // 1日のリリース数は多くても10-20本程度
    const seqLen = format === 'MMDDYY_NNN' ? 3 : 4;

    const seq = parseInt(seqPart);

    if (reverse) {
      // 逆方向: シーケンス番号をインクリメント（001→002→...→010まで）
      // その日のリリースを全てチェックしてから前日へ
      if (seq < maxSeq) {
        return `${datePart}_${String(seq + 1).padStart(seqLen, '0')}`;
      }

      // 前日に移動（001から開始）
      const mm = parseInt(datePart.substring(0, 2));
      const dd = parseInt(datePart.substring(2, 4));
      const yy = parseInt(datePart.substring(4, 6));

      const date = new Date(2000 + yy, mm - 1, dd);
      date.setDate(date.getDate() - 1);

      // 2000年より前には行かない
      if (date.getFullYear() < 2000) return null;

      const prevMM = String(date.getMonth() + 1).padStart(2, '0');
      const prevDD = String(date.getDate()).padStart(2, '0');
      const prevYY = String(date.getFullYear() % 100).padStart(2, '0');

      return `${prevMM}${prevDD}${prevYY}_${String(1).padStart(seqLen, '0')}`;
    } else {
      // 順方向: シーケンス番号をインクリメント
      if (seq < maxSeq) {
        return `${datePart}_${String(seq + 1).padStart(seqLen, '0')}`;
      }

      // 翌日に移動
      const mm = parseInt(datePart.substring(0, 2));
      const dd = parseInt(datePart.substring(2, 4));
      const yy = parseInt(datePart.substring(4, 6));

      const date = new Date(2000 + yy, mm - 1, dd);
      date.setDate(date.getDate() + 1);

      // Stop if we've reached current date
      const now = new Date();
      if (date > now) return null;

      const nextMM = String(date.getMonth() + 1).padStart(2, '0');
      const nextDD = String(date.getDate()).padStart(2, '0');
      const nextYY = String(date.getFullYear() % 100).padStart(2, '0');

      return `${nextMM}${nextDD}${nextYY}_${String(1).padStart(seqLen, '0')}`;
    }
  }

  return null;
}

/**
 * Parse HTML content and extract basic info
 */
async function parseHtmlContent(html: string, siteName: string): Promise<{
  title?: string;
  description?: string;
  actors?: string[];
  releaseDate?: string;
  imageUrl?: string;
  sampleImages?: string[];
  price?: number;
} | null> {
  try {
    // Basic HTML parsing with regex (simplified)
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);

    // Extract price (DTI sites use USD)
    // Pattern 1: var ec_price = parseFloat('50.00');
    let price: number | undefined;
    const priceMatch = html.match(/var\s+ec_price\s*=\s*parseFloat\s*\(\s*['"](\d+(?:\.\d+)?)['"]\s*\)/);
    if (priceMatch) {
      const usdPrice = parseFloat(priceMatch[1]);
      // Convert USD to JPY (approximate rate: 150)
      price = Math.round(usdPrice * 150);
    }

    // Pattern 2: ec_item_price = '50.00' or similar
    if (!price) {
      const itemPriceMatch = html.match(/ec_item_price\s*=\s*['"]?(\d+(?:\.\d+)?)['"]?/);
      if (itemPriceMatch) {
        const usdPrice = parseFloat(itemPriceMatch[1]);
        price = Math.round(usdPrice * 150);
      }
    }

    // Pattern 3: Japanese yen price ¥1,980 or 1,980円
    if (!price) {
      const yenMatch = html.match(/[¥￥]?\s*(\d{1,3}(?:,\d{3})*)\s*円/);
      if (yenMatch) {
        price = parseInt(yenMatch[1].replace(/,/g, ''));
      }
    }

    // Try to extract actor names from multiple patterns
    let actors: string[] = [];

    // Pattern 1: JavaScript variable ec_item_brand (カリビアンコム系)
    const brandMatch = html.match(/var\s+ec_item_brand\s*=\s*['"]([^'"]+)['"]/);
    if (brandMatch && brandMatch[1]) {
      actors = [brandMatch[1]];
    }

    // Pattern 2: Title format "女優名 【ふりがな】 タイトル" (HEYZO系)
    if (actors.length === 0 && titleMatch) {
      const titleActorMatch = titleMatch[1].match(/^([^\s【]+)\s*【[^】]+】/);
      if (titleActorMatch) {
        actors = [titleActorMatch[1]];
      }
    }

    // Pattern 3: HTML content with 出演者 label
    if (actors.length === 0) {
      const actorMatches = html.match(/出演者?[:：]?\s*([^<\n]+)/i);
      if (actorMatches) {
        actors = actorMatches[1].split(/[、,]/).map(a => a.trim()).filter(a => a);
      }
    }

    // Try to extract release date
    const dateMatch = html.match(/配信日[:：]?\s*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})/);
    const releaseDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}` : undefined;

    // Try to extract thumbnail
    const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    // Extract sample images (multiple patterns for DTI sites)
    const sampleImages: string[] = [];

    // Pattern 1: Sample image gallery members (カリビアンコム系)
    const memberGalleryMatches = html.matchAll(/<a[^>]*href=["']([^"']*members[^"']*gallery[^"']*\.jpg)["']/gi);
    for (const match of memberGalleryMatches) {
      if (!sampleImages.includes(match[1])) {
        sampleImages.push(match[1]);
      }
    }

    // Pattern 2: Movie thumb images
    const movieThumbMatches = html.matchAll(/<img[^>]*src=["']([^"']*moviepages[^"']*\.jpg)["']/gi);
    for (const match of movieThumbMatches) {
      if (!sampleImages.includes(match[1])) {
        sampleImages.push(match[1]);
      }
    }

    // Pattern 3: Sample image links (一本道系)
    const sampleLinkMatches = html.matchAll(/<a[^>]*href=["']([^"']*\/posters\/[^"']*\.jpg)["']/gi);
    for (const match of sampleLinkMatches) {
      if (!sampleImages.includes(match[1])) {
        sampleImages.push(match[1]);
      }
    }

    // Pattern 4: HEYZO sample images
    const heyzoMatches = html.matchAll(/<img[^>]*src=["']([^"']*\/contents\/[^"']*sample[^"']*\.jpg)["']/gi);
    for (const match of heyzoMatches) {
      if (!sampleImages.includes(match[1])) {
        sampleImages.push(match[1]);
      }
    }

    // Pattern 5: Generic sample image patterns
    const genericSampleMatches = html.matchAll(/<img[^>]*src=["']([^"']*sample[^"']*\.jpg)["']/gi);
    for (const match of genericSampleMatches) {
      const url = match[1];
      if (!sampleImages.includes(url) && url !== imageUrl) {
        sampleImages.push(url);
      }
    }

    return {
      title: titleMatch ? titleMatch[1].replace(/\s*-.*$/, '').trim() : undefined,
      description: descMatch ? descMatch[1].trim() : undefined,
      actors,
      releaseDate,
      imageUrl,
      sampleImages: sampleImages.length > 0 ? sampleImages : undefined,
      price,
    };
  } catch (error) {
    console.error(`Error parsing HTML:`, error);
    return null;
  }
}

/**
 * Crawl a single site configuration
 */
async function crawlSite(config: CrawlConfig) {
  console.log(`\nStarting crawl for ${config.siteName}...`);
  console.log(`URL Pattern: ${config.urlPattern}`);
  console.log(`Starting from ID: ${config.startId}\n`);

  const db = getDb();
  let currentId = config.startId!;
  let foundCount = 0;
  let notFoundCount = 0;
  let importedCount = 0;
  let skippedCount = 0;
  let consecutiveNotFound = 0;
  const MAX_CONSECUTIVE_NOT_FOUND = 50; // Stop after 50 consecutive 404s

  while (currentId) {
    // Stop if end ID is specified and reached
    if (config.endId) {
      if (config.reverseMode && currentId < config.endId) {
        console.log(`Reached end ID: ${config.endId}`);
        break;
      } else if (!config.reverseMode && currentId > config.endId) {
        console.log(`Reached end ID: ${config.endId}`);
        break;
      }
    }

    // Stop if too many consecutive not found
    if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
      console.log(`Stopping: ${MAX_CONSECUTIVE_NOT_FOUND} consecutive products not found`);
      break;
    }

    const url = config.urlPattern.replace('{id}', currentId);

    // 既に生データが存在するかチェック
    const existingRawHtml = await db
      .select()
      .from(rawHtmlData)
      .where(
        and(
          eq(rawHtmlData.source, config.siteName),
          eq(rawHtmlData.productId, currentId)
        )
      )
      .limit(1);

    let shouldFetch = true;
    let htmlContent = '';

    if (existingRawHtml.length > 0) {
      // 既存の生データを使用
      htmlContent = existingRawHtml[0].htmlContent;
      shouldFetch = false;
      console.log(`  ⚡ Using cached HTML: ${currentId}`);
    }

    // Fetch product page (if needed)
    let productData = null;
    if (shouldFetch) {
      try {
        const response = await fetch(url);

        if (!response.ok) {
          notFoundCount++;
          consecutiveNotFound++;

          // Log every 10 not found
          if (notFoundCount % 10 === 0) {
            console.log(`  Progress: ${foundCount} found, ${notFoundCount} not found (current: ${currentId})`);
          }

          // Generate next ID
          const nextId = generateNextId(currentId, config.idFormat, config.reverseMode);
          if (!nextId) break;
          currentId = nextId;

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') || undefined;
        htmlContent = decodeHtml(buffer, contentType, url);

        // 生データのハッシュを計算
        const hash = createHash('sha256').update(htmlContent).digest('hex');

        // 生データを保存
        await db.insert(rawHtmlData).values({
          source: config.siteName,
          productId: currentId,
          url,
          htmlContent,
          hash,
        });

        console.log(`  💾 Saved HTML: ${currentId}`);
      } catch (error) {
        console.error(`  ❌ Error fetching ${currentId}:`, error);
        notFoundCount++;
        consecutiveNotFound++;

        // Generate next ID
        const nextId = generateNextId(currentId, config.idFormat, config.reverseMode);
        if (!nextId) break;
        currentId = nextId;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
    }

    // Parse HTML content
    productData = await parseHtmlContent(htmlContent, config.siteName);

    if (!productData || !productData.title) {
      notFoundCount++;
      consecutiveNotFound++;

      // Log every 10 not found
      if (notFoundCount % 10 === 0) {
        console.log(`  Progress: ${foundCount} found, ${notFoundCount} not found (current: ${currentId})`);
      }
    } else {
      foundCount++;
      consecutiveNotFound = 0; // Reset consecutive counter

      console.log(`  ✓ Found: ${currentId} - ${productData.title?.substring(0, 50)}...`);

      try {
        const normalizedProductId = `${config.siteName}-${currentId}`;

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
        } else {
          // Insert product
          const [insertedProduct] = await db
            .insert(products)
            .values({
              normalizedProductId,
              title: productData.title,
              description: productData.description || '',
              releaseDate: productData.releaseDate,
            })
            .returning({ id: products.id });

          productId = insertedProduct.id;

          // Generate affiliate URL using clear-tv.com format
          const affiliateUrl = generateDTILink(url);

          // Insert product source
          await db.insert(productSources).values({
            productId,
            aspName: 'DTI',
            originalProductId: currentId,
            affiliateUrl: affiliateUrl,
            price: productData.price || 0,
            dataSource: 'CRAWL',
          });

          // Insert product cache
          await db.insert(productCache).values({
            productId,
            aspName: 'DTI',
            price: productData.price || 0,
            affiliateUrl: affiliateUrl,
            thumbnailUrl: productData.imageUrl,
            sampleImages: productData.sampleImages || null,
            inStock: true,
          });

          // Insert actors
          if (productData.actors && productData.actors.length > 0) {
            for (const actorName of productData.actors) {
              if (!actorName) continue;

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
                  .values({ name: actorName })
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
          }

          // Link to site tag
          const existingSiteTag = await db
            .select()
            .from(tags)
            .where(eq(tags.name, config.siteName))
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

          // 生データの処理完了をマーク
          if (existingRawHtml.length > 0) {
            await db
              .update(rawHtmlData)
              .set({ processedAt: new Date() })
              .where(eq(rawHtmlData.id, existingRawHtml[0].id));
          } else {
            // 新規保存したデータにも処理完了をマーク
            await db
              .update(rawHtmlData)
              .set({ processedAt: new Date() })
              .where(
                and(
                  eq(rawHtmlData.source, config.siteName),
                  eq(rawHtmlData.productId, currentId)
                )
              );
          }
        }
      } catch (error) {
        console.error(`  ❌ Error importing ${currentId}:`, error);
      }
    }

    // Generate next ID
    const nextId = generateNextId(currentId, config.idFormat, config.reverseMode);
    if (!nextId) break;
    currentId = nextId;

    // Rate limiting - wait between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n${config.siteName} - Crawl Summary:`);
  console.log(`  ✓ Found: ${foundCount}`);
  console.log(`  ✓ Imported: ${importedCount}`);
  console.log(`  ⚠️  Skipped: ${skippedCount}`);
  console.log(`  ⚠️  Not Found: ${notFoundCount}`);
}

/**
 * Main crawl function
 */
async function crawlDTISites() {
  try {
    console.log('Starting DTI sites crawler...\n');
    console.log(`Crawling ${CRAWL_CONFIGS.length} sites\n`);

    for (const config of CRAWL_CONFIGS) {
      await crawlSite(config);
    }

    console.log('\n========================================');
    console.log('DTI Sites Crawl Completed!');
    console.log('========================================\n');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

crawlDTISites();
