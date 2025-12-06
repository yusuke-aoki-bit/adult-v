/**
 * b10f系タイトルから出演者名を抽出するバックフィル
 * タイトル末尾の全角スペース後に出演者名があるパターン
 * 例: 「魅惑の黒パンスト女上司　依本しおり」→「依本しおり」
 */

import { getDb } from '../../lib/db/index.js';
import { performers, productPerformers } from '../../lib/db/schema.js';
import { sql, eq } from 'drizzle-orm';
import { isValidPerformerName } from '../../lib/performer-validation.js';

const db = getDb();

// 名前として有効なパターン
// - 姓名形式: 漢字2-4文字 + ひらがな/カタカナ2-4文字（例: 依本しおり、天月あず）
// - 単名形式: ひらがな/カタカナのみ2-4文字（例: りんね、みく）
// - 姓名形式（漢字のみ）: 漢字2-4文字 + 漢字1-2文字（例: 二羽紗愛）

function isValidNamePattern(name: string): boolean {
  // 姓名形式: 漢字1-4文字 + ひらがな/カタカナ2-4文字
  if (/^[一-龯]{1,4}[ぁ-んァ-ヶー]{2,4}$/.test(name)) return true;

  // 単名形式: ひらがな/カタカナのみ2-4文字
  if (/^[ぁ-んァ-ヶー]{2,4}$/.test(name)) return true;

  // 姓名形式（漢字のみ）: 漢字2-4文字 + 漢字1-2文字（計4-6文字）
  if (/^[一-龯]{4,6}$/.test(name)) return true;

  return false;
}

// 除外ワード（タイトル末尾に来やすい単語）
const EXCLUDED_SUFFIX = new Set([
  '中出し', '生中出し', '顔射', 'フェラ', 'パイズリ', '手コキ',
  '騎乗位', 'バック', '正常位', 'アナル', '潮吹き', '絶頂',
  '巨乳', '爆乳', '美乳', '貧乳', '巨尻', '美尻',
  'ロリ', 'ギャル', '痴女', '淫乱', '変態', '人妻', '熟女',
  'エステ', 'マッサージ', 'ソープ', 'デリヘル',
  '総集編', 'コレクション', 'ベスト', 'スペシャル',
  '連発', '本番', '発射', '射精', '挿入',
  '初撮り', '初登場', 'デビュー', '新人',
  'セックス', 'エッチ', 'ハメ撮り', '個撮',
  '前編', '後編', '上巻', '下巻', '完全版', '増刊号',
  // タイトルの断片
  '男狩り', '輪姦', 'レズ', '逆レイプ', '夜這い', '大全集',
  '盗撮', '月間', 'パンチラ', '女子高生', '美熟女', '熟女編',
]);

// 追加の除外パターン
const EXCLUDED_PATTERNS = [
  /^第[一二三四五六七八九十0-9]+[話章巻編回]$/,
  /^[0-9]+連発$/,
  /^[0-9]+本番$/,
  /^Vol\.[0-9]+$/i,
  /^Part[0-9]+$/i,
  /^\d+$/,
  // タイトル断片パターン
  /編$/,  // 〜編で終わる
  /女$/,  // 〜女で終わる（マワされ女など）
  /男$/,  // 〜男で終わる
  /責め$/,
  /遊び?$/,
  /の現場$/,
  /三重奏$/,
  /奉仕$/,
  /絞り$/,
  /咀嚼$/,
  /接吻$/,
  /まんこ$/,
  /ちんこ$/,
  /淫語$/,
  /快感$/,
  /快楽$/,
  /発射$/,
  /連続$/,
  /月間$/,
  /レイプ$/,
  /志願$/,
  /拝受$/,
  /猟奇$/,
  /調教$/,
  /輪姦$/,
  /凌辱$/,
  /強制$/,
  /パンチラ$/,
  /中毒$/,  // 苦痛中毒
  /覚醒$/,  // 精飲覚醒
  /[二三四五六七八九十〇0-9]+[歳才]$/,  // 三十七歳、四十一歳
];

function extractPerformerFromB10fTitle(title: string): string | null {
  if (!title) return null;

  // 全角スペースで分割してタイトル末尾を取得
  const parts = title.split('　');
  if (parts.length < 2) return null;

  // 最後のパートを取得
  const lastPart = parts[parts.length - 1].trim();

  // 半角スペースも考慮して最後の部分だけ取得
  const subParts = lastPart.split(' ');
  const candidate = subParts[subParts.length - 1].trim();

  // 括弧などを除去
  const cleaned = candidate.replace(/[（）()【】「」『』]/g, '').trim();

  // 長さチェック（2-10文字）
  if (cleaned.length < 2 || cleaned.length > 10) return null;

  // 除外ワードチェック
  if (EXCLUDED_SUFFIX.has(cleaned)) return null;

  // 除外パターンチェック
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(cleaned)) return null;
  }

  // 名前パターンチェック
  if (!isValidNamePattern(cleaned)) return null;

  // 標準バリデーション
  if (!isValidPerformerName(cleaned)) return null;

  return cleaned;
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
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '5000');

  console.log('=== b10f タイトルから出演者抽出 ===\n');
  if (dryRun) {
    console.log('⚠️  DRY RUN モード（--execute で実行）\n');
  }
  console.log(`Limit: ${limit}\n`);

  // 未紐付きのb10f製品を取得
  const result = await db.execute(sql`
    SELECT p.id, p.normalized_product_id, p.title
    FROM products p
    WHERE NOT EXISTS (SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id)
    AND p.normalized_product_id LIKE 'b10f-%'
    AND p.title IS NOT NULL
    AND p.title LIKE '%　%'
    ORDER BY p.id DESC
    LIMIT ${limit}
  `);

  const products = result.rows as any[];
  console.log(`✅ 対象製品（全角スペースあり）: ${products.length}件\n`);

  let processed = 0;
  let extracted = 0;
  let newRelations = 0;

  for (const product of products) {
    const performerName = extractPerformerFromB10fTitle(product.title);

    if (performerName) {
      extracted++;
      console.log(`[${product.normalized_product_id}] ${performerName} ← 「${product.title.substring(0, 40)}...」`);

      if (!dryRun) {
        try {
          const performerId = await findOrCreatePerformer(performerName);
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
      } else {
        newRelations++;
      }
    }

    processed++;

    if (processed % 500 === 0) {
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
