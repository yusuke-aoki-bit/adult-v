/**
 * タイトルから出演者名を抽出してproduct_performersに紐付けるバックフィル
 * カリビアンコムプレミアム、b10f等のタイトルに名前が含まれるケース
 */

import { getDb } from '../../lib/db/index.js';
import { performers, productPerformers } from '../../lib/db/schema.js';
import { sql, eq } from 'drizzle-orm';
import { isValidPerformerName } from '../../lib/performer-validation.js';

const db = getDb();

// 日本人名のパターン（ひらがな、カタカナ、漢字）
const JAPANESE_NAME_PATTERN = /[ぁ-んァ-ヶー一-龯]{2,10}/g;

// 外国人名のパターン
const FOREIGN_NAME_PATTERN = /[A-Z][a-z]+(?:[・\s][A-Z][a-z]+)+/g;

// 除外すべきワード
const EXCLUDED_WORDS = new Set([
  '中出し', '生中出し', '美少女', '熟女', '人妻', '巨乳', '爆乳', '美乳',
  '痴女', 'ギャル', 'スレンダー', 'ムチムチ', 'エロ動画', 'アダルト',
  '動画', 'ビデオ', '特典映像', 'オリジナル', '限定', 'セール',
  'コンテンツマーケット', 'カリビアンコム', 'プレミアム', '無修正',
  'マニアック', 'フェチ', 'サイト', '女体',
]);

function extractPerformersFromTitle(title: string): string[] {
  const performers: string[] = [];

  // タイトル後半（｜以降）から名前を探す
  const parts = title.split(/[|｜]/);
  const searchText = parts.length > 1 ? parts[0] : title;

  // 外国人名を抽出
  const foreignMatches = searchText.match(FOREIGN_NAME_PATTERN);
  if (foreignMatches) {
    for (const name of foreignMatches) {
      const trimmed = name.trim();
      if (isValidPerformerName(trimmed) && !EXCLUDED_WORDS.has(trimmed)) {
        performers.push(trimmed);
      }
    }
  }

  // 日本人名パターン: 「姓 名」または「名前」
  // タイトル末尾に名前があるパターン
  const jpNameMatch = searchText.match(/\s([ぁ-んァ-ヶー一-龯]{2,5}[ぁ-んァ-ヶー一-龯]{2,5})\s*$/);
  if (jpNameMatch) {
    const name = jpNameMatch[1];
    if (isValidPerformerName(name) && !EXCLUDED_WORDS.has(name)) {
      performers.push(name);
    }
  }

  // 「名前1 名前2」形式（スペース区切りの複数出演者）
  const multiNameMatch = searchText.match(/([ぁ-んァ-ヶー一-龯]{2,10}\s+[ぁ-んァ-ヶー一-龯]{2,10}(?:\s+[ぁ-んァ-ヶー一-龯]{2,10})*)\s*$/);
  if (multiNameMatch) {
    const names = multiNameMatch[1].split(/\s+/);
    for (const name of names) {
      if (name.length >= 2 && isValidPerformerName(name) && !EXCLUDED_WORDS.has(name)) {
        if (!performers.includes(name)) {
          performers.push(name);
        }
      }
    }
  }

  return performers;
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
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '1000');
  const prefix = args.find((a) => a.startsWith('--prefix='))?.split('=')[1] || '';

  console.log('=== タイトルから出演者抽出バックフィル ===\n');
  if (dryRun) {
    console.log('⚠️  DRY RUN モード（--execute で実行）\n');
  }
  console.log(`Limit: ${limit}`);
  console.log(`Prefix: ${prefix || '(all)'}\n`);

  // 対象製品を取得
  let query;
  if (prefix) {
    query = sql`
      SELECT p.id, p.normalized_product_id, p.title
      FROM products p
      WHERE NOT EXISTS (SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id)
      AND p.normalized_product_id LIKE ${prefix + '%'}
      AND p.title IS NOT NULL
      AND p.title != ''
      ORDER BY p.id DESC
      LIMIT ${limit}
    `;
  } else {
    query = sql`
      SELECT p.id, p.normalized_product_id, p.title
      FROM products p
      WHERE NOT EXISTS (SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id)
      AND (
        p.normalized_product_id LIKE 'カリビアンコムプレミアム-%' OR
        p.normalized_product_id LIKE 'b10f-%'
      )
      AND p.title IS NOT NULL
      AND p.title != ''
      ORDER BY p.id DESC
      LIMIT ${limit}
    `;
  }

  const result = await db.execute(query);
  const products = result.rows as any[];
  console.log(`✅ 対象製品: ${products.length}件\n`);

  let processed = 0;
  let extracted = 0;
  let newRelations = 0;

  for (const product of products) {
    const performerNames = extractPerformersFromTitle(product.title);

    if (performerNames.length > 0) {
      extracted++;
      console.log(`[${product.normalized_product_id}] ${performerNames.join(', ')}`);

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
    }

    processed++;

    if (processed % 100 === 0) {
      console.log(`進捗: ${processed}/${products.length}`);
    }
  }

  console.log('\n=== 結果 ===');
  console.log(`処理済み: ${processed}件`);
  console.log(`抽出成功: ${extracted}件`);
  console.log(`紐付け: ${newRelations}件`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN モード。実行するには --execute オプションを付けてください');
  } else {
    console.log('\n✅ 処理完了');
  }

  process.exit(0);
}

main().catch(console.error);
