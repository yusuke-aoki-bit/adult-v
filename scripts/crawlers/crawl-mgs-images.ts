/**
 * MGS商品の画像を一括で再クロールするスクリプト
 * 画像URLパターンを使用して画像を生成し、存在確認を行う
 *
 * Usage:
 *   npx tsx scripts/crawlers/crawl-mgs-images.ts --limit 100 --offset 0
 */

import { getDb } from '../../lib/db';
import { products, productSources, productImages } from '../../lib/db/schema';
import { eq, and, isNull, or } from 'drizzle-orm';

interface Args {
  limit: number;
  offset: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let limit = 100;
  let offset = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--offset' && args[i + 1]) {
      offset = parseInt(args[i + 1]);
      i++;
    }
  }

  return { limit, offset };
}

/**
 * MGS商品IDから画像URLを生成
 * 例: "300MIUM-1150" or "300MIUM1150" -> "https://image.mgstage.com/images/prestigepremium/300mium/1150/pb_e_300mium-1150.jpg"
 */
function generateImageUrls(productId: string): string[] {
  const images: string[] = [];

  // 商品IDを解析（ハイフンありなし両対応、数字を含むシリーズ名にも対応）
  // "300MIUM-1150" -> series="300mium", number="1150"
  // "300MIUM1150" -> series="300mium", number="1150"
  // "SIRO-4000" -> series="siro", number="4000"
  // "SIRO4000" -> series="siro", number="4000"
  // "259LUXU1006" -> series="259luxu", number="1006"
  const match = productId.match(/^([A-Z0-9]+?)[\-\s]?(\d{3,})$/i);
  if (!match) {
    return [];
  }

  const series = match[1].toLowerCase();
  const number = match[2];

  // シリーズ名のマッピング（MGSのディレクトリ構造に合わせる）
  // SOD Create series use prefixed series names (e.g., STARS-492 -> 107stars-492)
  const seriesMapping: Record<string, { directory: string; seriesPrefix?: string }> = {
    '300mium': { directory: 'prestigepremium' },
    '300maan': { directory: 'prestigepremium' },
    '300ntk': { directory: 'prestigepremium' },
    'siro': { directory: 'shirouto' },
    '259luxu': { directory: 'luxutv' },
    'gni': { directory: 'prestige' },
    '200gana': { directory: 'nanpatv' },
    'mfcs': { directory: 'doc' },
    'abp': { directory: 'prestige' },
    'abw': { directory: 'prestige' },
    'abf': { directory: 'prestige' },
    // SOD Create series with prefixes
    'stars': { directory: 'sodcreate', seriesPrefix: '107stars' },
    'cawd': { directory: 'sodcreate', seriesPrefix: '406cawd' },
  };

  const mapping = seriesMapping[series] || { directory: 'prestige' };
  const directory = mapping.directory;
  const actualSeries = mapping.seriesPrefix || series;

  // 基本URLパターン
  const baseUrl = `https://image.mgstage.com/images/${directory}/${actualSeries}/${number}`;

  // パッケージ画像（必ずハイフン付きのフォーマット）
  images.push(`${baseUrl}/pb_e_${actualSeries}-${number}.jpg`);

  // サンプル画像（0から開始、通常0-20枚程度、必ずハイフン付きのフォーマット）
  for (let i = 0; i <= 20; i++) {
    images.push(`${baseUrl}/cap_e_${i}_${actualSeries}-${number}.jpg`);
  }

  return images;
}

/**
 * 画像URLが存在するか確認（HEADリクエスト）
 */
async function checkImageExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 商品の有効な画像URLを取得
 */
async function fetchProductImages(productId: string): Promise<string[]> {
  try {
    const candidateUrls = generateImageUrls(productId);
    const validImages: string[] = [];

    for (const url of candidateUrls) {
      const exists = await checkImageExists(url);
      if (exists) {
        validImages.push(url);
      }
      // レート制限対策（短い待機）
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return validImages;
  } catch (error) {
    console.error(`Failed to fetch images for ${productId}:`, error);
    return [];
  }
}

async function crawlMgsImages() {
  const { limit, offset } = parseArgs();
  const db = getDb();

  console.log(`🚀 Starting MGS image crawler (limit: ${limit}, offset: ${offset})\n`);

  try {
    // MGS商品で画像がない、または少ない商品を取得
    const mgsProducts = await db
      .select({
        productId: productSources.productId,
        originalProductId: productSources.originalProductId,
      })
      .from(productSources)
      .leftJoin(products, eq(productSources.productId, products.id))
      .where(
        and(
          eq(productSources.aspName, 'MGS'),
          or(
            isNull(products.defaultThumbnailUrl),
            eq(products.defaultThumbnailUrl, '')
          )
        )
      )
      .limit(limit)
      .offset(offset);

    console.log(`📊 Found ${mgsProducts.length} MGS products to process\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < mgsProducts.length; i++) {
      const product = mgsProducts[i];

      console.log(`[${i + 1}/${mgsProducts.length}] Processing: ${product.originalProductId}`);

      try {
        // 画像URLを生成して存在確認
        const images = await fetchProductImages(product.originalProductId);

        if (images.length === 0) {
          console.log(`  ⚠️  No images found`);
          failCount++;
          continue;
        }

        console.log(`  ✅ Found ${images.length} images`);

        // サムネイル画像をproductsテーブルに保存
        if (images.length > 0) {
          await db
            .update(products)
            .set({
              defaultThumbnailUrl: images[0],
            })
            .where(eq(products.id, product.productId));
        }

        // 全画像をproduct_imagesテーブルに保存
        for (let j = 0; j < images.length; j++) {
          await db.insert(productImages).values({
            productId: product.productId,
            imageUrl: images[j],
            imageType: j === 0 ? 'thumbnail' : 'sample',
            displayOrder: j,
            aspName: 'MGS',
          }).onConflictDoNothing();
        }

        successCount++;

        // レート制限対策（画像チェックで既に待機しているため短め）
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`  ❌ Error:`, error);
        failCount++;
      }
    }

    console.log(`\n✅ Completed: ${successCount} success, ${failCount} failed`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

crawlMgsImages()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
