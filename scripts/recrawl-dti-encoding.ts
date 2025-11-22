/**
 * 文字化けしたDTI商品を再クロールして修正するスクリプト
 * カリビアンコムプレミアムと一本道のデータを再取得
 * Run with: DATABASE_URL="..." npx tsx scripts/recrawl-dti-encoding.ts
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { products, productCache } from '../lib/db/schema';
import { eq, like, or } from 'drizzle-orm';
import iconv from 'iconv-lite';

/**
 * Detect encoding from HTML content or response headers
 */
function detectEncoding(buffer: Buffer, contentType?: string): string {
  // Check Content-Type header first
  if (contentType) {
    const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
    if (charsetMatch) {
      return charsetMatch[1].toLowerCase();
    }
  }

  // Try to detect from HTML meta tags (check first 2048 bytes)
  const head = buffer.slice(0, 2048).toString('ascii');

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

  // Default to EUC-JP for Japanese sites (most DTI sites use EUC-JP)
  return 'euc-jp';
}

/**
 * Decode buffer to string with proper encoding
 */
function decodeHtml(buffer: Buffer, contentType?: string): string {
  let encoding = detectEncoding(buffer, contentType);

  // Normalize encoding names
  encoding = encoding
    .replace('shift_jis', 'Shift_JIS')
    .replace('shift-jis', 'Shift_JIS')
    .replace('sjis', 'Shift_JIS')
    .replace('euc-jp', 'EUC-JP')
    .replace('eucjp', 'EUC-JP');

  try {
    if (encoding.toLowerCase() === 'utf-8' || encoding.toLowerCase() === 'utf8') {
      return buffer.toString('utf-8');
    }
    // Use iconv-lite for other encodings
    return iconv.decode(buffer, encoding);
  } catch (error) {
    console.warn(`Failed to decode with ${encoding}, trying EUC-JP`);
    try {
      return iconv.decode(buffer, 'EUC-JP');
    } catch {
      return buffer.toString('utf-8');
    }
  }
}

/**
 * Parse title from HTML
 */
function parseTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    let title = titleMatch[1].trim();
    // Clean up title
    title = title.replace(/\s*\|[^|]*$/, ''); // Remove " | SiteName" suffix
    title = title.replace(/\s*-[^-]*$/, ''); // Remove " - SiteName" suffix
    return title;
  }
  return null;
}

/**
 * Parse description from HTML
 */
function parseDescription(html: string): string | null {
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
  if (descMatch) {
    return descMatch[1].trim();
  }
  return null;
}

/**
 * Check if text contains garbled characters
 */
function isGarbled(text: string): boolean {
  // Check for common garbled patterns
  if (/[\ufffd]|[\u0080-\u009f]|[\x00-\x1f]/.test(text)) {
    return true;
  }
  // Check if text contains valid Japanese characters
  const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
  // If no Japanese characters and contains lots of high bytes, likely garbled
  if (!hasJapanese && /[\x80-\xff]{3,}/.test(text)) {
    return true;
  }
  return false;
}

async function recrawlDtiData() {
  console.log('Re-crawling DTI data with proper encoding...\n');

  const db = getDb();

  // 文字化けしているDTI商品を取得（カリビアンコムプレミアムと一本道）
  const garbledProducts = await db
    .select()
    .from(products)
    .where(
      or(
        like(products.normalizedProductId, 'カリビアンコムプレミアム-%'),
        like(products.normalizedProductId, '一本道-%')
      )
    );

  console.log(`Found ${garbledProducts.length} products to check\n`);

  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const product of garbledProducts) {
    // Check if title is garbled
    if (!isGarbled(product.title)) {
      skippedCount++;
      continue;
    }

    try {
      // Extract URL from product cache
      const cache = await db
        .select()
        .from(productCache)
        .where(eq(productCache.productId, product.id))
        .limit(1);

      if (cache.length === 0) {
        console.log(`  No cache found for: ${product.normalizedProductId}`);
        skippedCount++;
        continue;
      }

      const url = cache[0].affiliateUrl;
      if (!url) {
        console.log(`  No URL for: ${product.normalizedProductId}`);
        errorCount++;
        continue;
      }

      console.log(`  Re-fetching: ${product.normalizedProductId}`);
      console.log(`    URL: ${url}`);

      // Fetch the page
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`    HTTP ${response.status}`);
        errorCount++;
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || undefined;
      const html = decodeHtml(buffer, contentType);

      // Parse new title
      const newTitle = parseTitle(html);
      const newDescription = parseDescription(html);

      if (!newTitle) {
        console.log(`    Could not parse title`);
        errorCount++;
        continue;
      }

      // Check if new title has Japanese characters
      const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(newTitle);
      if (!hasJapanese) {
        console.log(`    New title has no Japanese: ${newTitle.substring(0, 50)}`);
        errorCount++;
        continue;
      }

      console.log(`    Old: ${product.title.substring(0, 40)}...`);
      console.log(`    New: ${newTitle.substring(0, 40)}...`);

      // Update product
      await db
        .update(products)
        .set({
          title: newTitle,
          description: newDescription || product.description,
        })
        .where(eq(products.id, product.id));

      fixedCount++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

      if (fixedCount % 10 === 0) {
        console.log(`\n  Progress: ${fixedCount} fixed, ${skippedCount} skipped, ${errorCount} errors\n`);
      }
    } catch (error) {
      console.error(`  Error: ${error}`);
      errorCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`DTI Re-crawl Complete!`);
  console.log(`========================================`);
  console.log(`Fixed: ${fixedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
}

recrawlDtiData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
