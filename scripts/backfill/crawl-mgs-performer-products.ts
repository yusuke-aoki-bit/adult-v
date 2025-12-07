/**
 * MGS出演者ページから商品リストを取得して紐付け
 * 素人系の出演者など、タイトルに名前が含まれない場合に使用
 */

import { db } from '../../lib/db/index.js';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

const DELAY_MS = 1500;

interface CrawlStats {
  processed: number;
  productsFound: number;
  newLinks: number;
  errors: number;
}

async function fetchMgsPerformerPage(performerName: string): Promise<string[]> {
  // MGSの出演者検索URL（URLエンコードされた名前を使用）
  const encodedName = encodeURIComponent(performerName);
  const url = `https://www.mgstage.com/search/cSearch.php?actress=${encodedName}&type=top`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'adc=1',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });

    if (!response.ok) {
      console.log(`  HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();

    // 年齢認証ページをチェック
    if (html.includes('年齢認証') && html.includes('18歳以上')) {
      console.log(`  Age verification required`);
      return [];
    }

    const $ = cheerio.load(html);
    const productIds: string[] = [];

    // 商品リストから商品IDを抽出
    // MGSの構造: <a href="/product/product_detail/XXX-000/">
    $('a[href*="/product/product_detail/"]').each((_, link) => {
      const href = $(link).attr('href') || '';
      const match = href.match(/\/product\/product_detail\/([A-Za-z0-9-]+)\//);
      if (match) {
        productIds.push(match[1].toUpperCase());
      }
    });

    return [...new Set(productIds)]; // 重複を除去
  } catch (error) {
    console.error(`  Error: ${error}`);
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 50;
  const dryRun = args.includes('--dry-run');
  const performerIdArg = args.find(arg => arg.startsWith('--performer='));
  const targetPerformerId = performerIdArg ? parseInt(performerIdArg.split('=')[1]) : null;

  console.log('=== MGS出演者商品クローラー ===');
  console.log(`Limit: ${limit}`);
  console.log(`Dry run: ${dryRun}`);
  if (targetPerformerId) {
    console.log(`Target performer ID: ${targetPerformerId}`);
  }
  console.log('');

  const stats: CrawlStats = {
    processed: 0,
    productsFound: 0,
    newLinks: 0,
    errors: 0,
  };

  // 対象の出演者を取得
  let performersQuery;
  if (targetPerformerId) {
    performersQuery = await db.execute(sql`
      SELECT id, name FROM performers WHERE id = ${targetPerformerId}
    `);
  } else {
    // MGS商品に紐づいているが、紐付け数が少ない出演者を優先
    performersQuery = await db.execute(sql`
      SELECT p.id, p.name, COUNT(pp.product_id) as link_count
      FROM performers p
      JOIN product_performers pp ON p.id = pp.performer_id
      JOIN products prod ON pp.product_id = prod.id
      JOIN product_sources ps ON prod.id = ps.product_id
      WHERE ps.asp_name = 'MGS'
      GROUP BY p.id, p.name
      HAVING COUNT(pp.product_id) < 5
      ORDER BY link_count ASC
      LIMIT ${limit}
    `);
  }

  const performersToProcess = performersQuery.rows as { id: number; name: string }[];
  console.log(`Found ${performersToProcess.length} performers to process\n`);

  for (const performer of performersToProcess) {
    stats.processed++;
    console.log(`[${stats.processed}/${performersToProcess.length}] ${performer.name} (ID: ${performer.id})`);

    const productIds = await fetchMgsPerformerPage(performer.name);

    if (productIds.length > 0) {
      stats.productsFound += productIds.length;
      console.log(`  Found ${productIds.length} product(s): ${productIds.slice(0, 5).join(', ')}${productIds.length > 5 ? '...' : ''}`);

      for (const originalProductId of productIds) {
        // 商品をDBから検索
        const productResult = await db.execute(sql`
          SELECT p.id as product_id
          FROM products p
          JOIN product_sources ps ON p.id = ps.product_id
          WHERE ps.asp_name = 'MGS'
            AND UPPER(ps.original_product_id) = ${originalProductId}
          LIMIT 1
        `);

        if (productResult.rows.length > 0) {
          const productId = (productResult.rows[0] as { product_id: number }).product_id;

          if (!dryRun) {
            try {
              await db.execute(sql`
                INSERT INTO product_performers (product_id, performer_id)
                VALUES (${productId}, ${performer.id})
                ON CONFLICT DO NOTHING
              `);
              stats.newLinks++;
              console.log(`    ✓ Linked: ${originalProductId}`);
            } catch {
              stats.errors++;
            }
          } else {
            stats.newLinks++;
            console.log(`    [DRY] Would link: ${originalProductId}`);
          }
        }
      }
    } else {
      console.log(`  No products found`);
    }

    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  console.log('\n=== 完了 ===');
  console.log(`Performers processed: ${stats.processed}`);
  console.log(`Products found: ${stats.productsFound}`);
  console.log(`New links created: ${stats.newLinks}`);
  console.log(`Errors: ${stats.errors}`);

  if (dryRun) {
    console.log('\n(Dry run - no changes made)');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
