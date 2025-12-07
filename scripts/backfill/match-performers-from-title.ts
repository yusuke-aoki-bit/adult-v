/**
 * 商品タイトルから出演者名を検出して紐付け
 * 既存のperformersテーブルの名前を使ってマッチング
 */

import { db } from '../../lib/db/index.js';
import { sql } from 'drizzle-orm';

interface MatchStats {
  total: number;
  matched: number;
  newLinks: number;
  errors: number;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const aspArg = args.find(arg => arg.startsWith('--asp='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 500;
  const targetAsp = aspArg ? aspArg.split('=')[1] : 'DUGA';
  const dryRun = args.includes('--dry-run');

  console.log('=== 出演者名マッチング ===');
  console.log(`Target ASP: ${targetAsp}`);
  console.log(`Limit: ${limit}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  const stats: MatchStats = {
    total: 0,
    matched: 0,
    newLinks: 0,
    errors: 0,
  };

  // 既存の出演者名リストを取得（3文字以上のみ）
  const performersResult = await db.execute(sql`
    SELECT id, name FROM performers
    WHERE LENGTH(name) >= 3
    ORDER BY LENGTH(name) DESC
  `);
  const performerList = performersResult.rows as { id: number; name: string }[];
  console.log(`Loaded ${performerList.length} performers for matching`);

  // 別名（エイリアス）も取得して出演者IDにマッピング
  const aliasesResult = await db.execute(sql`
    SELECT performer_id, alias_name FROM performer_aliases
    WHERE LENGTH(alias_name) >= 3
  `);
  const aliasToPerformer = new Map<string, number>();
  for (const row of aliasesResult.rows as { performer_id: number; alias_name: string }[]) {
    aliasToPerformer.set(row.alias_name, row.performer_id);
  }
  console.log(`Loaded ${aliasToPerformer.size} performer aliases\n`);

  // 出演者のいない商品を取得
  const productsResult = await db.execute(sql`
    SELECT p.id, p.title, p.normalized_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = ${targetAsp}
      AND NOT EXISTS (SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id)
    ORDER BY p.id
    LIMIT ${limit}
  `);
  const products = productsResult.rows as { id: number; title: string; normalized_product_id: string }[];
  console.log(`Found ${products.length} products without performers\n`);

  for (const product of products) {
    stats.total++;
    const title = product.title || '';

    // タイトルから出演者名を検索（名前と別名の両方でマッチング）
    const matchedPerformerIds = new Set<number>();
    const matchedNames: string[] = [];

    // まず出演者名で検索
    for (const performer of performerList) {
      if (title.includes(performer.name)) {
        matchedPerformerIds.add(performer.id);
        matchedNames.push(performer.name);
      }
    }

    // 次に別名で検索
    for (const [alias, performerId] of aliasToPerformer) {
      if (title.includes(alias) && !matchedPerformerIds.has(performerId)) {
        matchedPerformerIds.add(performerId);
        matchedNames.push(`${alias}(alias)`);
      }
    }

    if (matchedPerformerIds.size > 0) {
      stats.matched++;
      console.log(`[${stats.total}] ${product.normalized_product_id}: ${matchedNames.join(', ')}`);

      if (!dryRun) {
        for (const performerId of matchedPerformerIds) {
          try {
            await db.execute(sql`
              INSERT INTO product_performers (product_id, performer_id)
              VALUES (${product.id}, ${performerId})
              ON CONFLICT DO NOTHING
            `);
            stats.newLinks++;
          } catch (error) {
            stats.errors++;
          }
        }
      } else {
        stats.newLinks += matchedPerformerIds.size;
      }
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`Total processed: ${stats.total}`);
  console.log(`Products with matches: ${stats.matched}`);
  console.log(`New performer links: ${stats.newLinks}`);
  console.log(`Errors: ${stats.errors}`);

  if (dryRun) {
    console.log('\n(Dry run - no changes made)');
  }

  // 結果確認
  const afterStats = await db.execute(sql`
    SELECT COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN ps.product_id END) as with_performer,
           COUNT(DISTINCT ps.product_id) as total
    FROM product_sources ps
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE ps.asp_name = ${targetAsp}
  `);
  console.log(`\n${targetAsp} performer coverage after:`, afterStats.rows[0]);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
