/**
 * HEYZO公式サイトから出演者情報を取得して紐付け
 */

import * as cheerio from 'cheerio';
import { getDb } from '../../lib/db/index.js';
import { performers, productPerformers } from '../../lib/db/schema.js';
import { sql, eq } from 'drizzle-orm';
import { isValidPerformerName } from '../../lib/performer-validation.js';

const db = getDb();
const RATE_LIMIT_MS = 1500;

/**
 * HEYZO公式から出演者を取得
 */
async function lookupFromHeyzo(movieId: string): Promise<string[]> {
  const performerList: string[] = [];
  try {
    // HEYZO-0947 → 0947
    const numericId = movieId.replace('HEYZO-', '');
    const url = `https://www.heyzo.com/moviepages/${numericId}/index.html`;

    console.log(`  URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });

    if (!response.ok) {
      console.log(`  HTTP ${response.status}`);
      return performerList;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 出演者名を取得（複数パターンを試す）

    // パターン1: table-actorから取得
    $('.table-actor a').each((_, elem) => {
      const name = $(elem).text().trim();
      if (name && isValidPerformerName(name) && !performerList.includes(name)) {
        performerList.push(name);
      }
    });

    // パターン2: actorクラスから取得
    if (performerList.length === 0) {
      $('.actor a').each((_, elem) => {
        const name = $(elem).text().trim();
        if (name && isValidPerformerName(name) && !performerList.includes(name)) {
          performerList.push(name);
        }
      });
    }

    // パターン3: タイトルから抽出 (【女優名】形式)
    if (performerList.length === 0) {
      const title = $('h1').first().text();
      const match = title.match(/【([^】]+)】/);
      if (match) {
        const names = match[1].split(/[、,\s]+/);
        for (const name of names) {
          const trimmed = name.trim();
          if (trimmed && isValidPerformerName(trimmed) && !performerList.includes(trimmed)) {
            performerList.push(trimmed);
          }
        }
      }
    }

    // パターン4: movieInfoセクションから取得
    if (performerList.length === 0) {
      $('td:contains("出演")').next('td').find('a').each((_, elem) => {
        const name = $(elem).text().trim();
        if (name && isValidPerformerName(name) && !performerList.includes(name)) {
          performerList.push(name);
        }
      });
    }

    return performerList;
  } catch (e) {
    console.error('  Error:', e);
    return performerList;
  }
}

async function findOrCreatePerformer(name: string): Promise<number | null> {
  try {
    let performer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });

    if (performer) {
      return performer.id;
    }

    const [newPerformer] = await db
      .insert(performers)
      .values({
        name: name,
        nameKana: null,
      })
      .returning();

    return newPerformer.id;
  } catch {
    const existingPerformer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });
    return existingPerformer?.id || null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '100');

  console.log('=== HEYZO 公式サイトから出演者取得 ===\n');
  if (dryRun) {
    console.log('⚠️  DRY RUN モード（--execute で実行）\n');
  }
  console.log(`Limit: ${limit}\n`);

  // 未紐付きのHEYZO製品を取得
  const query = sql`
    SELECT p.id, p.normalized_product_id, p.title
    FROM products p
    WHERE p.normalized_product_id LIKE 'HEYZO-%'
    AND NOT EXISTS (SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id)
    ORDER BY p.normalized_product_id
    LIMIT ${limit}
  `;

  const result = await db.execute(query);
  const products = result.rows as any[];
  console.log(`✅ 対象製品: ${products.length}件\n`);

  let processed = 0;
  let found = 0;
  let newRelations = 0;

  for (const product of products) {
    console.log(`[${processed + 1}/${products.length}] ${product.normalized_product_id}`);

    const performerNames = await lookupFromHeyzo(product.normalized_product_id);

    if (performerNames.length > 0) {
      found++;
      console.log(`  → 出演者: ${performerNames.join(', ')}`);

      if (!dryRun) {
        for (const name of performerNames) {
          try {
            const performerId = await findOrCreatePerformer(name);
            if (performerId) {
              await db
                .insert(productPerformers)
                .values({
                  productId: product.id,
                  performerId: performerId,
                })
                .onConflictDoNothing();
              newRelations++;
            }
          } catch (e) {
            // ignore
          }
        }
      } else {
        newRelations += performerNames.length;
      }
    } else {
      console.log(`  → 見つかりませんでした`);
    }

    processed++;
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  console.log('\n=== 結果 ===');
  console.log(`処理済み: ${processed}件`);
  console.log(`取得成功: ${found}件`);
  console.log(`紐付け: ${newRelations}件`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN モード。実行するには --execute オプションを付けてください');
  } else {
    console.log('\n✅ 処理完了');
  }

  process.exit(0);
}

main().catch(console.error);
