/**
 * DTI Image Backfill Script
 * Fetches thumbnail images for DTI products that are missing them
 *
 * DTI sites use predictable image URL patterns based on product ID
 * This script generates thumbnail URLs directly without fetching pages
 *
 * Data structure in DB:
 * - asp_name = 'DTI'
 * - normalized_product_id = サイト名(日本語) + '-' + 商品ID
 *   例: '一本道-112024_001', 'HEYZO-3789', 'カリビアンコムプレミアム-112024_001'
 */

import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

// サイト名（日本語）からURLパターンへのマッピング
const DTI_SITES: Record<string, {
  siteKey: string;
  baseUrl: string;
  thumbPattern: string;
  altPatterns: string[];
}> = {
  '一本道': {
    siteKey: '1pondo',
    baseUrl: 'https://www.1pondo.tv',
    thumbPattern: 'https://www.1pondo.tv/assets/sample/{id}/str.jpg',
    altPatterns: [
      'https://www.1pondo.tv/assets/sample/{id}/popu.jpg',
      'https://www.1pondo.tv/assets/sample/{id}/thum_b.jpg',
    ],
  },
  'カリビアンコム': {
    siteKey: 'caribbeancom',
    baseUrl: 'https://www.caribbeancom.com',
    thumbPattern: 'https://www.caribbeancom.com/moviepages/{id}/images/l_l.jpg',
    altPatterns: [
      'https://www.caribbeancom.com/moviepages/{id}/images/main_b.jpg',
      'https://www.caribbeancom.com/moviepages/{id}/images/l.jpg',
    ],
  },
  'カリビアンコムプレミアム': {
    siteKey: 'caribbeancompr',
    baseUrl: 'https://www.caribbeancompr.com',
    thumbPattern: 'https://www.caribbeancompr.com/moviepages/{id}/images/l_l.jpg',
    altPatterns: [
      'https://www.caribbeancompr.com/moviepages/{id}/images/main_b.jpg',
      'https://www.caribbeancompr.com/moviepages/{id}/images/l.jpg',
    ],
  },
  'パコパコママ': {
    siteKey: 'pacopacomama',
    baseUrl: 'https://www.pacopacomama.com',
    thumbPattern: 'https://www.pacopacomama.com/moviepages/{id}/images/l_l.jpg',
    altPatterns: [
      'https://www.pacopacomama.com/moviepages/{id}/images/main_b.jpg',
      'https://www.pacopacomama.com/moviepages/{id}/images/l.jpg',
    ],
  },
  '天然むすめ': {
    siteKey: '10musume',
    baseUrl: 'https://www.10musume.com',
    thumbPattern: 'https://www.10musume.com/moviepages/{id}/images/l_l.jpg',
    altPatterns: [
      'https://www.10musume.com/moviepages/{id}/images/main_b.jpg',
      'https://www.10musume.com/moviepages/{id}/images/l.jpg',
    ],
  },
  'HEYZO': {
    siteKey: 'heyzo',
    baseUrl: 'https://www.heyzo.com',
    thumbPattern: 'https://www.heyzo.com/contents/3000/{id}/images/player_thumbnail.jpg',
    altPatterns: [
      'https://www.heyzo.com/contents/3000/{id}/images/thumbnail.jpg',
      'https://www.heyzo.com/contents/3000/{id}/images/main.jpg',
    ],
  },
  // サポート対象外のサイト（スキップ用）
  'うんこたれ': {
    siteKey: 'unkotare',
    baseUrl: '',
    thumbPattern: '',
    altPatterns: [],
  },
  '女体のしんぴ': {
    siteKey: 'nyotai',
    baseUrl: '',
    thumbPattern: '',
    altPatterns: [],
  },
  'Hey動画': {
    siteKey: 'heydouga',
    baseUrl: '',
    thumbPattern: '',
    altPatterns: [],
  },
};

/**
 * normalized_product_idからサイト名と商品IDを抽出
 * 例: '一本道-112024_001' -> { siteName: '一本道', productId: '112024_001' }
 */
function parseNormalizedProductId(normalizedId: string): { siteName: string; productId: string } | null {
  const match = normalizedId.match(/^(.+?)-(.+)$/);
  if (!match) return null;
  return {
    siteName: match[1],
    productId: match[2],
  };
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit'));
  const limit = limitArg ? parseInt(limitArg.split('=')[1] || '1000') : 1000;

  console.log('🖼️  DTI Image Backfill Script\n');
  console.log('='.repeat(80));

  const db = getDb();

  // Get DTI products without thumbnails (asp_name = 'DTI')
  // サポート対象サイトのみ取得: 一本道、カリビアンコム、カリビアンコムプレミアム、パコパコママ、天然むすめ、HEYZO
  const productsResult = await db.execute(sql`
    SELECT
      p.id,
      p.normalized_product_id,
      ps.asp_name,
      ps.original_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'DTI'
    AND (p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = '')
    AND (
      p.normalized_product_id LIKE '一本道-%'
      OR p.normalized_product_id LIKE 'カリビアンコム-%'
      OR p.normalized_product_id LIKE 'カリビアンコムプレミアム-%'
      OR p.normalized_product_id LIKE 'パコパコママ-%'
      OR p.normalized_product_id LIKE '天然むすめ-%'
      OR p.normalized_product_id LIKE 'HEYZO-%'
    )
    ORDER BY p.id DESC
    LIMIT ${limit}
  `);

  const products = productsResult.rows as any[];
  console.log(`Found ${products.length} DTI products without thumbnails\n`);

  if (products.length === 0) {
    console.log('No products to process');
    process.exit(0);
  }

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const normalizedId = product.normalized_product_id;

    // normalized_product_idからサイト名と商品IDを抽出
    const parsed = parseNormalizedProductId(normalizedId);
    if (!parsed) {
      console.log(`\n[${i + 1}/${products.length}] ⚠️ Cannot parse: ${normalizedId}`);
      skippedCount++;
      continue;
    }

    const { siteName, productId } = parsed;

    console.log(`\n[${i + 1}/${products.length}] Processing: ${normalizedId}`);
    console.log(`  Site: ${siteName}, Product ID: ${productId}`);

    const siteConfig = DTI_SITES[siteName];
    if (!siteConfig) {
      console.log(`  ⚠️ Unknown site: ${siteName}`);
      skippedCount++;
      continue;
    }

    // サポート対象外のサイトはスキップ
    if (!siteConfig.thumbPattern) {
      console.log(`  ⏭️ Skipped (unsupported site)`);
      skippedCount++;
      continue;
    }

    // Generate thumbnail URL
    let thumbnailUrl: string;

    if (siteName === 'HEYZO') {
      // HEYZO uses numeric IDs like "3789" -> pad to 4 digits
      thumbnailUrl = siteConfig.thumbPattern.replace('{id}', productId.padStart(4, '0'));
    } else {
      // Other sites use date-based IDs like "112024_001"
      thumbnailUrl = siteConfig.thumbPattern.replace('{id}', productId);
    }

    console.log(`  Thumbnail URL: ${thumbnailUrl}`);

    try {
      // Verify the URL works
      const response = await fetch(thumbnailUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (response.ok) {
        // Update product with thumbnail URL
        await db.execute(sql`
          UPDATE products
          SET default_thumbnail_url = ${thumbnailUrl},
              updated_at = NOW()
          WHERE id = ${product.id}
        `);

        // Also save to product_images
        await db.execute(sql`
          INSERT INTO product_images (product_id, asp_name, image_url, image_type, display_order)
          VALUES (${product.id}, 'DTI', ${thumbnailUrl}, 'thumbnail', 0)
          ON CONFLICT DO NOTHING
        `);

        console.log(`  ✓ Success`);
        successCount++;
      } else {
        console.log(`  ❌ Image not found (${response.status})`);

        // Try alternative URL patterns
        let found = false;

        for (const altPattern of siteConfig.altPatterns) {
          const altUrl = siteName === 'HEYZO'
            ? altPattern.replace('{id}', productId.padStart(4, '0'))
            : altPattern.replace('{id}', productId);

          console.log(`  Trying alternative: ${altUrl}`);
          const altResponse = await fetch(altUrl, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });

          if (altResponse.ok) {
            await db.execute(sql`
              UPDATE products
              SET default_thumbnail_url = ${altUrl},
                  updated_at = NOW()
              WHERE id = ${product.id}
            `);

            await db.execute(sql`
              INSERT INTO product_images (product_id, asp_name, image_url, image_type, display_order)
              VALUES (${product.id}, 'DTI', ${altUrl}, 'thumbnail', 0)
              ON CONFLICT DO NOTHING
            `);

            console.log(`  ✓ Success (alternative)`);
            successCount++;
            found = true;
            break;
          }
        }

        if (!found) {
          errorCount++;
        }
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      errorCount++;
    }

    // Rate limiting
    if (i > 0 && i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Summary:');
  console.log(`  Total processed: ${products.length}`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Skipped (unsupported): ${skippedCount}`);
  console.log(`  Errors: ${errorCount}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
