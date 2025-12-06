/**
 * DUGA CSVから出演者を紐付けるバックフィルスクリプト
 * raw_csv_dataテーブルの「出演者」カラムを使用
 */

import { getDb } from '../../lib/db';
import { performers, productPerformers, products } from '../../lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { isValidPerformerName } from '../../lib/performer-validation.js';

const db = getDb();

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
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '10000');

  console.log('=== DUGA CSV 出演者紐付けバックフィル ===\n');
  if (dryRun) {
    console.log('⚠️  DRY RUN モード（--execute で実行）\n');
  }
  console.log(`Limit: ${limit}\n`);

  // raw_csv_dataとproductsを結合して出演者情報を取得
  const csvData = await db.execute(sql`
    SELECT
      r.product_id as csv_product_id,
      r.raw_data->>'出演者' as performer_name,
      p.id as product_id,
      p.title
    FROM raw_csv_data r
    JOIN products p ON p.normalized_product_id = 'duga-' || r.product_id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE r.source = 'DUGA'
    AND pp.product_id IS NULL
    AND r.raw_data->>'出演者' IS NOT NULL
    AND r.raw_data->>'出演者' != ''
    AND r.raw_data->>'出演者' != '-'
    ORDER BY p.id DESC
    LIMIT ${limit}
  `);

  console.log(`✅ 未紐付き商品（出演者情報あり）: ${csvData.rows.length}件\n`);

  let processed = 0;
  let newRelations = 0;
  let skippedInvalid = 0;
  let errors = 0;

  for (const row of csvData.rows as any[]) {
    const performerStr = row.performer_name as string;
    if (!performerStr) continue;

    // カンマ、スペース、改行で分割
    const names = performerStr
      .split(/[,、\s\n]+/)
      .map((n) => n.trim())
      .filter((n) => n.length >= 2);

    for (const name of names) {
      if (!isValidPerformerName(name)) {
        skippedInvalid++;
        continue;
      }

      if (!dryRun) {
        try {
          const performerId = await findOrCreatePerformer(name);
          if (performerId) {
            await db
              .insert(productPerformers)
              .values({
                productId: row.product_id,
                performerId: performerId,
              })
              .onConflictDoNothing();
            newRelations++;
          }
        } catch (e) {
          errors++;
        }
      } else {
        newRelations++;
      }
    }

    processed++;

    if (processed % 500 === 0) {
      console.log(`進捗: ${processed}/${csvData.rows.length} (紐付け: ${newRelations}件)`);
    }
  }

  console.log('\n=== 結果 ===');
  console.log(`処理済み: ${processed}件`);
  console.log(`紐付け: ${newRelations}件`);
  console.log(`無効スキップ: ${skippedInvalid}件`);
  console.log(`エラー: ${errors}件`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN モード。実行するには --execute オプションを付けてください');
  } else {
    console.log('\n✅ 処理完了');
  }

  process.exit(0);
}

main().catch(console.error);
