/**
 * MGS商品の出演者を商品詳細ページから取得して紐付け
 * MGSの商品詳細ページから出演者情報を取得し、既存のperformersと照合
 */

import { db } from '../../lib/db/index.js';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

const DELAY_MS = 1000;

interface LinkStats {
  total: number;
  fetched: number;
  linked: number;
  errors: number;
}

async function fetchMgsProductPage(productId: string): Promise<string[]> {
  const url = `https://www.mgstage.com/product/product_detail/${productId}/`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'adc=1',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();

    // 年齢認証ページをチェック
    if (html.includes('年齢認証') && html.includes('18歳以上')) {
      return [];
    }

    const $ = cheerio.load(html);
    const performers: string[] = [];

    // 出演者情報を抽出
    // MGSの構造: <th>出演：</th><td><a>出演者名</a></td>
    $('th').each((_, th) => {
      const $th = $(th);
      const thText = $th.text().trim();
      if (thText === '出演：' || thText === '出演') {
        const $td = $th.next('td');
        if ($td.length) {
          // リンクから出演者名を取得
          $td.find('a').each((_, link) => {
            const name = $(link).text().trim();
            if (name && name.length >= 2) {
              performers.push(name);
            }
          });
          // リンクがない場合はテキストから取得
          if (performers.length === 0) {
            const text = $td.text().trim();
            if (text && text !== '----') {
              text.split(/[,、\s]+/).forEach(name => {
                const trimmed = name.trim();
                if (trimmed && trimmed.length >= 2) {
                  performers.push(trimmed);
                }
              });
            }
          }
        }
      }
    });

    return performers;
  } catch (error) {
    console.error(`  Error fetching ${productId}:`, error);
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
  const dryRun = args.includes('--dry-run');
  const performerIdArg = args.find(arg => arg.startsWith('--performer='));
  const targetPerformerId = performerIdArg ? parseInt(performerIdArg.split('=')[1]) : null;

  console.log('=== MGS出演者紐付け ===');
  console.log(`Limit: ${limit}`);
  console.log(`Dry run: ${dryRun}`);
  if (targetPerformerId) {
    console.log(`Target performer ID: ${targetPerformerId}`);
  }
  console.log('');

  const stats: LinkStats = {
    total: 0,
    fetched: 0,
    linked: 0,
    errors: 0,
  };

  // 既存の出演者名マップを作成
  const performersResult = await db.execute(sql`
    SELECT id, name FROM performers WHERE LENGTH(name) >= 2
  `);
  const performerMap = new Map<string, number>();
  for (const row of performersResult.rows as { id: number; name: string }[]) {
    performerMap.set(row.name, row.id);
  }
  console.log(`Loaded ${performerMap.size} performers\n`);

  let productsQuery;
  if (targetPerformerId) {
    // 特定の出演者に紐づいた商品から同じMGS商品を探す
    productsQuery = await db.execute(sql`
      SELECT DISTINCT ps.original_product_id, p.id as product_id
      FROM product_performers pp
      JOIN products p ON pp.product_id = p.id
      JOIN product_sources ps ON p.id = ps.product_id
      WHERE pp.performer_id = ${targetPerformerId}
        AND ps.asp_name = 'MGS'
      LIMIT ${limit}
    `);
  } else {
    // MGS商品で出演者が紐づいていないものを取得
    productsQuery = await db.execute(sql`
      SELECT ps.original_product_id, ps.product_id
      FROM product_sources ps
      WHERE ps.asp_name = 'MGS'
        AND NOT EXISTS (
          SELECT 1 FROM product_performers pp WHERE pp.product_id = ps.product_id
        )
      ORDER BY ps.id DESC
      LIMIT ${limit}
    `);
  }

  const products = productsQuery.rows as { original_product_id: string; product_id: number }[];
  console.log(`Found ${products.length} MGS products to process\n`);

  for (const product of products) {
    stats.total++;
    const productId = product.original_product_id;

    console.log(`[${stats.total}/${products.length}] ${productId}`);

    const performerNames = await fetchMgsProductPage(productId);

    if (performerNames.length > 0) {
      stats.fetched++;
      console.log(`  Found performers: ${performerNames.join(', ')}`);

      for (const name of performerNames) {
        const performerId = performerMap.get(name);
        if (performerId) {
          if (!dryRun) {
            try {
              await db.execute(sql`
                INSERT INTO product_performers (product_id, performer_id)
                VALUES (${product.product_id}, ${performerId})
                ON CONFLICT DO NOTHING
              `);
              stats.linked++;
              console.log(`    ✓ Linked: ${name} (ID: ${performerId})`);
            } catch (error) {
              stats.errors++;
            }
          } else {
            stats.linked++;
            console.log(`    [DRY] Would link: ${name} (ID: ${performerId})`);
          }
        } else {
          console.log(`    ⚠ Performer not found in DB: ${name}`);
        }
      }
    } else {
      console.log(`  No performers found`);
    }

    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  console.log('\n=== 完了 ===');
  console.log(`Total processed: ${stats.total}`);
  console.log(`Products with performers: ${stats.fetched}`);
  console.log(`New links created: ${stats.linked}`);
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
