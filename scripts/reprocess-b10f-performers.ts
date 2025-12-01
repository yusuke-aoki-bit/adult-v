/**
 * b10f商品のタイトルから出演者を抽出して紐づけるスクリプト
 *
 * b10fはraw_csv_dataにカラム12（index 11）に出演者情報がある場合があるが、
 * データがない場合はタイトルから「まるっと！XXX」パターンなどで抽出する
 *
 * 使用法:
 * DATABASE_URL="..." npx tsx scripts/reprocess-b10f-performers.ts [--limit=N] [--dry-run]
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import {
  isValidPerformerName,
  normalizePerformerName,
  parsePerformerNames,
} from '../lib/performer-validation';

const db = getDb();

interface ProductRow {
  id: number;
  title: string;
  original_product_id: string;
}

interface Stats {
  processed: number;
  performersExtracted: number;
  linksCreated: number;
  skipped: number;
  errors: number;
}

/**
 * タイトルから出演者名を抽出
 */
function extractPerformersFromTitle(title: string): string[] {
  const performerNames: string[] = [];

  // パターン1: 「まるっと！XXX」
  const marutto = title.match(/まるっと[！!]?\s*([^\s　]+(?:[\s　][^\s　]+)?)/);
  if (marutto && marutto[1]) {
    const name = marutto[1].trim().replace(/[\s　]+.+$/, ''); // 後続の文字列を削除
    if (isValidPerformerName(name)) {
      performerNames.push(name);
    }
  }

  // パターン2: 「XXX COMPLETE BOX」
  const completeBox = title.match(/^([^\s　]+(?:[\s　][^\s　]+)?)\s*COMPLETE\s*BOX/i);
  if (completeBox && completeBox[1]) {
    const name = completeBox[1].trim();
    if (isValidPerformerName(name)) {
      performerNames.push(name);
    }
  }

  // パターン3: 「XXX コンプリートBOX」
  const completeBoxJp = title.match(
    /^([^\s　]+(?:[\s　][^\s　]+)?)\s*コンプリート/
  );
  if (completeBoxJp && completeBoxJp[1]) {
    const name = completeBoxJp[1].trim();
    if (isValidPerformerName(name)) {
      performerNames.push(name);
    }
  }

  // パターン4: 「XXX 8時間」「XXX ○時間」
  const hoursPattern = title.match(
    /^([^\d]+(?:[\s　][^\d]+)?)\s*\d+時間/
  );
  if (hoursPattern && hoursPattern[1]) {
    const name = hoursPattern[1].trim();
    // 「まるっと！」などのプレフィックスを除去
    const cleanName = name.replace(/^(?:まるっと[！!]?\s*|完全保存版\s*|永久保存版\s*)/g, '').trim();
    if (cleanName && isValidPerformerName(cleanName)) {
      performerNames.push(cleanName);
    }
  }

  // パターン5: 「S級XXX」「S級美女XXX」など
  const sClass = title.match(/S級(?:美女|素人|女優)?\s*([^\s　]+)/);
  if (sClass && sClass[1]) {
    const name = sClass[1].trim();
    if (isValidPerformerName(name)) {
      performerNames.push(name);
    }
  }

  // パターン6: タイトル先頭の人名っぽい文字列（ひらがな/カタカナ/漢字 2-6文字）
  const leadingName = title.match(/^([ぁ-んァ-ヶ一-龯]{2,6}(?:[\s　][ぁ-んァ-ヶ一-龯]{2,6})?)/);
  if (leadingName && leadingName[1]) {
    const name = leadingName[1].trim();
    // 一般的な単語を除外
    const excludePatterns = /^(完全|永久|保存|特別|豪華|限定|厳選|最新|人気|話題|究極|至高|極上)/;
    if (!excludePatterns.test(name) && isValidPerformerName(name)) {
      performerNames.push(name);
    }
  }

  // 重複を削除
  return [...new Set(performerNames)];
}

/**
 * raw_csv_dataから出演者を抽出
 */
async function extractFromCsvData(
  originalProductId: string
): Promise<string[]> {
  const csvResult = await db.execute(sql`
    SELECT raw_data
    FROM raw_csv_data
    WHERE product_id = ${originalProductId}
       OR product_id LIKE ${'%' + originalProductId}
    LIMIT 1
  `);

  if (csvResult.rows.length === 0) {
    return [];
  }

  const row = csvResult.rows[0] as { raw_data: any };
  if (!row.raw_data) return [];

  const data =
    typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data;

  // 配列形式: index 11 (12番目カラム) が出演者
  if (Array.isArray(data) && data.length >= 12) {
    const col12 = data[11];
    if (col12 && typeof col12 === 'string' && col12.trim()) {
      return parsePerformerNames(col12);
    }
  }

  // オブジェクト形式: "12"キーや"出演"キーを探す
  if (typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (
        (key === '12' || key === '11' || key.includes('出演') || key.includes('performer')) &&
        typeof value === 'string' &&
        value.trim()
      ) {
        return parsePerformerNames(value);
      }
    }
  }

  return [];
}

async function reprocessB10fPerformers() {
  console.log('=== b10f 出演者再処理スクリプト ===\n');

  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 1000;
  const dryRun = process.argv.includes('--dry-run');

  console.log(`設定: limit=${limit}, dryRun=${dryRun}\n`);

  const stats: Stats = {
    processed: 0,
    performersExtracted: 0,
    linksCreated: 0,
    skipped: 0,
    errors: 0,
  };

  // 出演者が未登録のb10f商品を取得
  console.log('【1】出演者未登録のb10f商品を取得...');
  const productsResult = await db.execute(sql`
    SELECT p.id, p.title, ps.original_product_id
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE ps.asp_name = 'b10f'
      AND pp.product_id IS NULL
    ORDER BY p.id
    LIMIT ${limit}
  `);

  const products = productsResult.rows as unknown as ProductRow[];
  console.log(`処理対象: ${products.length}件\n`);

  for (const product of products) {
    try {
      stats.processed++;

      // 1. まずraw_csv_dataから抽出を試みる
      let performerNames = await extractFromCsvData(product.original_product_id);

      // 2. CSVになければタイトルから抽出
      if (performerNames.length === 0) {
        performerNames = extractPerformersFromTitle(product.title);
      }

      if (performerNames.length === 0) {
        stats.skipped++;
        continue;
      }

      console.log(
        `[${stats.processed}/${products.length}] ID:${product.id} "${product.title.substring(0, 40)}...": ${performerNames.join(', ')}`
      );

      if (dryRun) {
        stats.performersExtracted += performerNames.length;
        continue;
      }

      // 出演者を登録
      for (const performerName of performerNames) {
        const normalized = normalizePerformerName(performerName);
        if (!normalized) continue;

        // performers テーブルにupsert
        const performerResult = await db.execute(sql`
          INSERT INTO performers (name)
          VALUES (${normalized})
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `);
        const performerId = (performerResult.rows[0] as { id: number }).id;
        stats.performersExtracted++;

        // product_performers テーブルにリンク
        const linkResult = await db.execute(sql`
          INSERT INTO product_performers (product_id, performer_id)
          VALUES (${product.id}, ${performerId})
          ON CONFLICT DO NOTHING
          RETURNING product_id
        `);

        if (linkResult.rowCount && linkResult.rowCount > 0) {
          stats.linksCreated++;
        }
      }
    } catch (error) {
      stats.errors++;
      console.error(`Error processing product ${product.id}:`, error);
    }
  }

  console.log('\n=== 処理結果 ===');
  console.table([stats]);

  if (dryRun) {
    console.log(
      '\n⚠️  DRY RUN モード。実際に保存するには --dry-run を外して実行してください'
    );
  }

  process.exit(0);
}

reprocessB10fPerformers().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
