/**
 * カリビアンコムプレミアムから出演者情報を取得するバックフィルスクリプト
 * サイトの「出演」欄から女優名を取得
 */

import * as cheerio from 'cheerio';
import { getDb } from '../../lib/db/index.js';
import { performers, productPerformers } from '../../lib/db/schema.js';
import { sql, eq } from 'drizzle-orm';
import { isValidPerformerName } from '../../lib/performer-validation.js';

const db = getDb();
const RATE_LIMIT_MS = 3000;

async function fetchPerformersFromCaribbeancom(productCode: string): Promise<string[]> {
  try {
    // product_idから品番を抽出 (例: カリビアンコムプレミアム-102324_001 → 102324-001)
    const match = productCode.match(/(\d+)_(\d+)$/);
    if (!match) return [];

    const code = `${match[1]}-${match[2]}`;
    const url = `https://www.caribbeancompr.com/moviepages/${code}/index.html`;

    console.log(`  Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });

    if (!response.ok) {
      console.log(`  HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const performerNames: string[] = [];

    // 「出演」欄を探す
    $('li, div, span').each((_, elem) => {
      const text = $(elem).text();
      if (text.includes('出演') && text.includes('：')) {
        const match = text.match(/出演[：:]\s*(.+)/);
        if (match) {
          // カンマ、スペース、読点で分割
          const names = match[1].split(/[,、\s]+/).filter(n => n.trim());
          for (const name of names) {
            const trimmed = name.trim();
            if (isValidPerformerName(trimmed)) {
              performerNames.push(trimmed);
            }
          }
        }
      }
    });

    // 別パターン: actress-name クラスなど
    $('.actress-name, [class*="actress"], a[href*="/listpages/actor"]').each((_, elem) => {
      const name = $(elem).text().trim();
      if (isValidPerformerName(name) && !performerNames.includes(name)) {
        performerNames.push(name);
      }
    });

    return performerNames;
  } catch (e) {
    console.log(`  Error: ${e}`);
    return [];
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

  console.log('=== カリビアンコムプレミアム 出演者取得バックフィル ===\n');
  if (dryRun) {
    console.log('⚠️  DRY RUN モード（--execute で実行）\n');
  }
  console.log(`Limit: ${limit}\n`);

  // 未紐付きのカリビアンコムプレミアム製品を取得
  const products = await db.execute(sql`
    SELECT p.id, p.normalized_product_id, p.title
    FROM products p
    WHERE NOT EXISTS (SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id)
    AND p.normalized_product_id LIKE 'カリビアンコムプレミアム-%'
    ORDER BY p.id DESC
    LIMIT ${limit}
  `);

  console.log(`✅ 対象製品: ${products.rows.length}件\n`);

  let processed = 0;
  let found = 0;
  let newRelations = 0;

  for (const row of products.rows as any[]) {
    console.log(`[${processed + 1}/${products.rows.length}] ${row.normalized_product_id}`);

    const performerNames = await fetchPerformersFromCaribbeancom(row.normalized_product_id);

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
                  productId: row.id,
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
