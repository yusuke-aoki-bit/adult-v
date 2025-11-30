/**
 * Google Cloud Vision APIを使って商品画像を分析しタグを付けるスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/backfill/analyze-images-vision.ts --limit=100
 *   npx tsx scripts/backfill/analyze-images-vision.ts --dry-run
 *
 * 前提条件:
 *   - GOOGLE_API_KEY が .env.local に設定されていること
 *
 * 機能:
 *   - 商品のサムネイル画像を分析
 *   - 顔検出：出演者数の推定
 *   - ラベル検出：画像の内容タグを自動付与
 */

import { getDb } from '../../lib/db';
import { products, productTags, tags } from '../../lib/db/schema';
import { sql, eq, and, isNull } from 'drizzle-orm';
import { detectFaces, labelImage, checkGoogleApiConfig } from '../../lib/google-apis';

const db = getDb();

// ラベルとタグのマッピング
const LABEL_TAG_MAPPING: Record<string, string[]> = {
  // 場所
  'bedroom': ['寝室', '屋内'],
  'bathroom': ['浴室', '屋内'],
  'office': ['オフィス', 'OL'],
  'classroom': ['教室', '学園もの'],
  'hotel': ['ホテル'],
  'outdoor': ['野外', '屋外'],
  'beach': ['ビーチ', '野外'],
  'pool': ['プール'],
  // 服装
  'uniform': ['制服'],
  'swimsuit': ['水着'],
  'lingerie': ['ランジェリー'],
  'costume': ['コスプレ'],
  // その他
  'massage': ['マッサージ'],
  'sports': ['スポーツ'],
};

/**
 * ラベルからタグを推定
 */
function labelsToTags(labels: { description: string; score: number }[]): string[] {
  const tagSet = new Set<string>();

  for (const label of labels) {
    const lowerLabel = label.description.toLowerCase();

    for (const [keyword, mappedTags] of Object.entries(LABEL_TAG_MAPPING)) {
      if (lowerLabel.includes(keyword) && label.score > 0.7) {
        mappedTags.forEach((t) => tagSet.add(t));
      }
    }
  }

  return Array.from(tagSet);
}

/**
 * タグ名からタグIDを取得（なければ作成）
 */
async function getOrCreateTag(tagName: string): Promise<number> {
  // 既存のタグを検索
  const existing = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.name, tagName))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // 新規作成
  const result = await db
    .insert(tags)
    .values({
      name: tagName,
      slug: tagName.toLowerCase().replace(/\s+/g, '-'),
    })
    .returning({ id: tags.id });

  return result[0].id;
}

/**
 * 商品にタグをリンク
 */
async function linkProductTag(productId: number, tagId: number): Promise<boolean> {
  try {
    const existing = await db
      .select()
      .from(productTags)
      .where(and(eq(productTags.productId, productId), eq(productTags.tagId, tagId)))
      .limit(1);

    if (existing.length > 0) {
      return false;
    }

    await db.insert(productTags).values({
      productId,
      tagId,
    });

    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '50');
  const dryRun = args.includes('--dry-run');
  const offset = parseInt(args.find((a) => a.startsWith('--offset='))?.split('=')[1] || '0');

  console.log('=== Vision APIを使った画像分析 ===\n');
  console.log(`設定: limit=${limit}, offset=${offset}, dryRun=${dryRun}\n`);

  // API設定を確認
  const apiConfig = checkGoogleApiConfig();
  if (!apiConfig.vision) {
    console.error('\n❌ Google Vision APIが設定されていません');
    console.error('   .env.localに GOOGLE_API_KEY を設定してください');
    process.exit(1);
  }

  console.log('✅ Google Vision API: 設定済み\n');

  // サムネイルがある商品を取得
  const targetProducts = await db.execute(sql`
    SELECT p.id, p.title, p.thumbnail
    FROM products p
    WHERE p.thumbnail IS NOT NULL
      AND p.thumbnail != ''
      AND p.thumbnail LIKE 'http%'
    ORDER BY p.id
    OFFSET ${offset}
    LIMIT ${limit}
  `);

  console.log(`📋 対象商品: ${targetProducts.rows.length}件\n`);

  if (targetProducts.rows.length === 0) {
    console.log('✅ 処理対象の商品がありません');
    process.exit(0);
  }

  // 統計
  let processed = 0;
  let facesDetected = 0;
  let tagsAdded = 0;
  let failed = 0;

  for (const row of targetProducts.rows) {
    const product = row as { id: number; title: string; thumbnail: string };
    processed++;

    console.log(`[${processed}/${targetProducts.rows.length}] ${product.title.substring(0, 40)}...`);

    try {
      // 顔検出
      const faces = await detectFaces(product.thumbnail);
      if (faces.length > 0) {
        facesDetected += faces.length;
        console.log(`  👤 顔検出: ${faces.length}人`);

        // 出演者数に基づくタグ
        if (!dryRun && faces.length > 1) {
          const tagId = await getOrCreateTag('複数出演');
          await linkProductTag(product.id, tagId);
        }
      }

      // ラベル検出
      const labels = await labelImage(product.thumbnail);
      if (labels.length > 0) {
        console.log(`  🏷️ ラベル: ${labels.slice(0, 5).map((l) => l.description).join(', ')}`);

        // ラベルからタグに変換
        const suggestedTags = labelsToTags(labels);
        if (suggestedTags.length > 0) {
          console.log(`  📌 推定タグ: ${suggestedTags.join(', ')}`);

          if (!dryRun) {
            for (const tagName of suggestedTags) {
              const tagId = await getOrCreateTag(tagName);
              const linked = await linkProductTag(product.id, tagId);
              if (linked) tagsAdded++;
            }
          }
        }
      }
    } catch (error) {
      failed++;
      console.error(`  ❌ エラー:`, error);
    }

    // レート制限対策
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // 結果表示
  console.log('\n=== 完了 ===');
  console.log(`処理済み商品: ${processed}件`);
  console.log(`検出した顔: ${facesDetected}件`);
  console.log(`追加したタグ: ${tagsAdded}件`);
  console.log(`エラー: ${failed}件`);

  if (dryRun) {
    console.log('\n⚠️ dry-runモードのため、実際の変更は行われていません');
  }

  process.exit(0);
}

main().catch(console.error);
