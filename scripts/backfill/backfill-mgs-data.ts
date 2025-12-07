/**
 * MGS商品データのバックフィル
 * raw_html_dataから価格とジャンルを抽出してDBに保存
 */

import * as cheerio from 'cheerio';
import { db } from '../../lib/db/index.js';
import { sql } from 'drizzle-orm';

interface BackfillStats {
  total: number;
  pricesUpdated: number;
  genresAdded: number;
  errors: number;
  skipped: number;
}

/**
 * HTMLから価格を抽出
 */
function extractPrice(html: string): number | null {
  const $ = cheerio.load(html);
  const priceTd = $('th:contains("価格")').next('td');
  const priceText = priceTd.text().trim();
  const delPrice = priceTd.find('del, .price_del, s, strike').text().trim();
  const delPriceMatch = delPrice.match(/(\d+(?:,\d+)*)/);
  const priceMatch = priceText.match(/(\d+(?:,\d+)*)/g);

  if (delPriceMatch && priceMatch && priceMatch.length >= 1) {
    const regularPrice = parseInt(delPriceMatch[1].replace(/,/g, ''));
    const salePriceStr = priceMatch.find(p => parseInt(p.replace(/,/g, '')) !== regularPrice) || priceMatch[priceMatch.length - 1];
    const salePrice = parseInt(salePriceStr.replace(/,/g, ''));
    if (salePrice < regularPrice) {
      return salePrice;
    }
  } else if (priceMatch) {
    return parseInt(priceMatch[0].replace(/,/g, ''));
  }

  return null;
}

/**
 * HTMLからジャンルを抽出
 */
function extractGenres(html: string): string[] {
  const $ = cheerio.load(html);
  const genres: string[] = [];
  $('th:contains("ジャンル")').next('td').find('a').each((_, elem) => {
    const genre = $(elem).text().trim();
    if (genre) genres.push(genre);
  });
  return genres;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 1000;
  const dryRun = args.includes('--dry-run');

  console.log('=== MGSデータバックフィル ===');
  console.log(`Limit: ${limit}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  const stats: BackfillStats = {
    total: 0,
    pricesUpdated: 0,
    genresAdded: 0,
    errors: 0,
    skipped: 0,
  };

  // raw_html_dataからMGSデータを取得
  const rawData = await db.execute(sql`
    SELECT r.id, r.product_id, r.html_content, ps.id as source_id, ps.price as current_price
    FROM raw_html_data r
    JOIN product_sources ps ON r.product_id = ps.original_product_id AND ps.asp_name = 'MGS'
    WHERE r.source = 'MGS'
      AND r.html_content IS NOT NULL
    ORDER BY r.id
    LIMIT ${limit}
  `);

  console.log(`Found ${rawData.rows.length} MGS records to process\n`);

  for (const row of rawData.rows as any[]) {
    stats.total++;
    const { id, product_id, html_content, source_id, current_price } = row;

    try {
      if (!html_content) {
        stats.skipped++;
        continue;
      }

      // 価格を抽出
      const price = extractPrice(html_content);

      // ジャンルを抽出
      const genres = extractGenres(html_content);

      if (stats.total % 100 === 0) {
        console.log(`[${stats.total}] Processing ${product_id}...`);
      }

      // 価格を更新（現在NULLの場合のみ）
      if (price !== null && current_price === null) {
        if (!dryRun) {
          await db.execute(sql`
            UPDATE product_sources
            SET price = ${price}
            WHERE id = ${source_id}
          `);
        }
        stats.pricesUpdated++;
      }

      // ジャンルを保存
      if (genres.length > 0) {
        // product_sourcesからproduct_idを取得
        const productResult = await db.execute(sql`
          SELECT product_id FROM product_sources WHERE id = ${source_id}
        `);
        const productId = (productResult.rows[0] as any)?.product_id;

        if (productId) {
          for (const genreName of genres) {
            if (!dryRun) {
              // ジャンルタグを取得または作成
              const existingTag = await db.execute(sql`
                SELECT id FROM tags WHERE name = ${genreName} AND category = 'genre'
              `);

              let tagId: number;
              if (existingTag.rows.length === 0) {
                const newTag = await db.execute(sql`
                  INSERT INTO tags (name, category) VALUES (${genreName}, 'genre')
                  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                  RETURNING id
                `);
                tagId = (newTag.rows[0] as any).id;
              } else {
                tagId = (existingTag.rows[0] as any).id;
              }

              // 商品とタグの紐付け
              await db.execute(sql`
                INSERT INTO product_tags (product_id, tag_id)
                VALUES (${productId}, ${tagId})
                ON CONFLICT DO NOTHING
              `);
            }
            stats.genresAdded++;
          }
        }
      }

    } catch (error) {
      console.error(`Error processing ${product_id}:`, error);
      stats.errors++;
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`Total processed: ${stats.total}`);
  console.log(`Prices updated: ${stats.pricesUpdated}`);
  console.log(`Genres added: ${stats.genresAdded}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Skipped: ${stats.skipped}`);

  if (dryRun) {
    console.log('\n(Dry run - no changes made)');
  }

  // 結果確認
  const priceCheck = await db.execute(sql`
    SELECT COUNT(*) as with_price, COUNT(*) FILTER (WHERE price IS NULL) as without_price
    FROM product_sources WHERE asp_name = 'MGS'
  `);
  console.log('\nMGS price stats after backfill:', priceCheck.rows[0]);

  const genreCheck = await db.execute(sql`
    SELECT COUNT(*) as count FROM tags WHERE category = 'genre'
  `);
  console.log('Genre tags count:', (genreCheck.rows[0] as any).count);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
