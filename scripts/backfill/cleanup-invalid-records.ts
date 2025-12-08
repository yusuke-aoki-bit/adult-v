/**
 * 全ASPの無効なレコード（トップページにリダイレクトされたもの）を削除するスクリプト
 *
 * 削除対象:
 * - タイトルがトップページのタイトル（ASPごとに異なるパターン）
 * - タイトルが極端に短い（5文字未満）
 * - 説明文がトップページの汎用説明文
 * - プレースホルダータイトル（ASP名-ID形式）
 */

import { db } from '../../lib/db/index.js';
import { products, productSources, productImages, productVideos, productPerformers, productTags } from '../../lib/db/schema.js';
import { eq, sql } from 'drizzle-orm';

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '500');
const ASP_FILTER = process.argv.find(arg => arg.startsWith('--asp='))?.split('=')[1] || null;

// ASPごとの無効タイトルパターン
const INVALID_TITLE_PATTERNS: Record<string, string[]> = {
  FC2: [
    'FC2動画アダルト',
    'FC2コンテンツマーケット',
    'FC2 コンテンツマーケット',
    'アダルト 有料アダルト動画',
    'FC2動画 - アダルト',
  ],
  MGS: [
    'エロ動画・アダルトビデオ-MGS動画',
    'MGS動画＜プレステージ グループ＞',
    'MGS動画（成人認証）',
    'エロ動画・アダルトビデオ -MGS動画',
  ],
  ソクミル: [
    'アダルト動画',
    'ソクミル - アダルト動画',
    '人気のアダルトビデオを高画質・低価格',
  ],
  DUGA: [
    'DUGA -デュガ-',
    'アダルト動画 DUGA',
  ],
  Japanska: [
    'Japanska',
    '無修正動画一覧',
    '幅広いジャンル',
  ],
  HEYZO: [
    'HEYZO',
    'HEYZO - 無修正',
  ],
  一本道: [
    '一本道',
    '1pondo',
  ],
  カリビアンコム: [
    'カリビアンコム',
    'Caribbeancom',
  ],
  カリビアンコムプレミアム: [
    'カリビアンコムプレミアム',
    'Caribbeancom Premium',
  ],
  b10f: [
    'b10f',
    'B10F',
  ],
  天然むすめ: [
    '天然むすめ',
    '10musume',
  ],
};

// ASPごとの無効説明文パターン（部分一致）
const INVALID_DESCRIPTION_PATTERNS: Record<string, string[]> = {
  FC2: [
    'FC2が運営するアダルト動画の販売サイト',
    'FC2コンテンツマーケットで販売中',
    'お気に入りのFC2動画を',
  ],
  MGS: [
    'プレステージグループのMGS動画は、10年以上の運営実績',
    '独占作品をはじめ、人気AV女優、素人、アニメ、VR作品など',
  ],
  ソクミル: [
    'アダルト動画・エロ動画ソクミル',
    '人気のアダルトビデオを高画質・低価格',
    '全作品無料のサンプル動画付き',
  ],
  DUGA: [
    'DUGAは国内最大級のアダルト動画配信サイト',
  ],
  Japanska: [
    '幅広いジャンル',
  ],
};

// 全ASPで共通の無効パターン（正規表現）
const COMMON_INVALID_PATTERNS = {
  // タイトルパターン（完全一致または明確なエラー表示のみ）
  titleRegex: [
    /^18歳未満/,
    /^年齢確認$/,
    /^age verification$/i,
    /^404\s*(not\s*found|error)?$/i,
    /^not\s*found$/i,
    /^ページが見つかりません$/,
    /^お探しのページ.*見つかりません/,
    /^お探しの商品.*見つかりません/,
    /^商品が見つかりません/,
    /^エラー$/,
    /^error$/i,
  ],
  descriptions: [
    '18歳未満.*閲覧.*禁止',
    '年齢確認.*18歳以上',
  ],
};

interface InvalidRecord {
  productId: number;
  title: string | null;
  description: string | null;
  sourceId: number;
  originalProductId: string;
  aspName: string;
  reason: string;
}

async function findInvalidRecords(): Promise<InvalidRecord[]> {
  console.log('🔍 無効なレコードを検索中...\n');

  // 対象ASPのリスト
  const targetAsps = ASP_FILTER ? [ASP_FILTER] : Object.keys(INVALID_TITLE_PATTERNS);
  const aspCondition = ASP_FILTER
    ? sql`ps.asp_name = ${ASP_FILTER}`
    : sql`ps.asp_name IN (${sql.join(targetAsps.map(a => sql`${a}`), sql`, `)})`;

  // 複合クエリで無効レコードを検索
  const result = await db.execute(sql`
    SELECT
      p.id as product_id,
      p.title,
      p.description,
      ps.id as source_id,
      ps.original_product_id,
      ps.asp_name
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ${aspCondition}
    AND (
      -- タイトルが空または極端に短い（3文字以下）
      p.title IS NULL
      OR p.title = ''
      OR LENGTH(p.title) < 4
      -- FC2のトップページタイトル
      OR p.title LIKE '%FC2動画アダルト%'
      OR p.title LIKE '%FC2コンテンツマーケット%'
      OR p.title LIKE '%FC2 コンテンツマーケット%'
      -- MGSのトップページタイトル
      OR p.title LIKE '%エロ動画・アダルトビデオ-MGS動画%'
      OR p.title LIKE '%MGS動画＜プレステージ%'
      OR p.title LIKE '%MGS動画（成人認証）%'
      -- ソクミルのトップページ
      OR p.title LIKE 'ソクミル - アダルト動画%'
      -- プレースホルダータイトル（ASP-ID形式）
      OR p.title ~ ('^' || ps.asp_name || '-[0-9]+$')
      OR p.title ~ ('^ソクミル-[0-9]+$')
      OR p.title ~ ('^Japanska-[0-9]+$')
      -- 共通の無効パターン（完全一致または明確なエラー表示のみ）
      OR p.title = 'ページが見つかりません'
      OR p.title ~ '^404\s*(not\s*found|error)?$'
      OR p.title ~ '^エラー$'
      OR p.title ~ '^error$'
      OR p.title ~ '^お探しの商品.*見つかりません'
      OR p.title ~ '^商品が見つかりません'
      -- 説明文がトップページ
      OR p.description LIKE '%FC2が運営するアダルト動画の販売サイト%'
      OR p.description LIKE '%プレステージグループのMGS動画は、10年以上の運営実績%'
      OR p.description LIKE '%人気のアダルトビデオを高画質・低価格%'
    )
    ORDER BY ps.asp_name, p.id
    LIMIT ${LIMIT}
  `);

  // 検出理由を判定
  const records: InvalidRecord[] = [];
  for (const row of result.rows as any[]) {
    const title = row.title as string | null;
    const description = row.description as string | null;
    const aspName = row.asp_name as string;

    let reason = '不明';

    if (!title || title.trim() === '') {
      reason = 'タイトルが空';
    } else if (title.length < 4) {
      reason = `タイトルが短い (${title.length}文字)`;
    } else if (new RegExp(`^${aspName}-\\d+$`).test(title) ||
               /^ソクミル-\d+$/.test(title) ||
               /^Japanska-\d+$/.test(title)) {
      reason = 'プレースホルダータイトル';
    } else {
      // ASP固有のパターンチェック
      const aspPatterns = INVALID_TITLE_PATTERNS[aspName] || [];
      for (const pattern of aspPatterns) {
        if (title.includes(pattern)) {
          reason = `トップページタイトル: ${pattern}`;
          break;
        }
      }

      // 説明文チェック
      if (reason === '不明' && description) {
        const descPatterns = INVALID_DESCRIPTION_PATTERNS[aspName] || [];
        for (const pattern of descPatterns) {
          if (description.includes(pattern)) {
            reason = `トップページ説明文: ${pattern.substring(0, 30)}...`;
            break;
          }
        }
      }

      // 共通パターンチェック（正規表現）
      if (reason === '不明') {
        for (const pattern of COMMON_INVALID_PATTERNS.titleRegex) {
          if (pattern.test(title)) {
            reason = `共通パターン: ${pattern.source}`;
            break;
          }
        }
      }
    }

    records.push({
      productId: row.product_id,
      title,
      description,
      sourceId: row.source_id,
      originalProductId: row.original_product_id,
      aspName,
      reason,
    });
  }

  return records;
}

async function deleteProduct(productId: number) {
  // 関連データを削除（外部キー制約の順番に注意）
  await db.delete(productImages).where(eq(productImages.productId, productId));
  await db.delete(productVideos).where(eq(productVideos.productId, productId));
  await db.delete(productPerformers).where(eq(productPerformers.productId, productId));
  await db.delete(productTags).where(eq(productTags.productId, productId));
  await db.delete(productSources).where(eq(productSources.productId, productId));

  // 最後に商品を削除
  await db.delete(products).where(eq(products.id, productId));
}

async function main() {
  console.log('='.repeat(60));
  console.log('全ASP 無効レコード クリーンアップスクリプト');
  console.log('='.repeat(60));
  console.log(`モード: ${DRY_RUN ? 'DRY RUN (削除しない)' : '実行'}`);
  console.log(`処理上限: ${LIMIT}件`);
  console.log(`対象ASP: ${ASP_FILTER || '全て'}`);
  console.log('');

  const invalidRecords = await findInvalidRecords();

  console.log(`\n📊 検出された無効レコード: ${invalidRecords.length}件\n`);

  if (invalidRecords.length === 0) {
    console.log('✅ 無効なレコードは見つかりませんでした');
    return;
  }

  // ASPごとに集計
  const aspCounts: Record<string, number> = {};
  for (const record of invalidRecords) {
    aspCounts[record.aspName] = (aspCounts[record.aspName] || 0) + 1;
  }
  console.log('ASPごとの件数:');
  for (const [asp, count] of Object.entries(aspCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${asp}: ${count}件`);
  }
  console.log('');

  // サンプル表示
  console.log('サンプル（最初の20件）:');
  console.log('-'.repeat(80));
  for (const record of invalidRecords.slice(0, 20)) {
    console.log(`  ASP: ${record.aspName}`);
    console.log(`  ID: ${record.productId} (Original: ${record.originalProductId})`);
    console.log(`  タイトル: ${record.title?.substring(0, 60) || '(空)'}`);
    console.log(`  理由: ${record.reason}`);
    console.log('-'.repeat(80));
  }

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUNモードのため、削除は実行されません');
    console.log('実際に削除するには --dry-run オプションを外して実行してください');
    return;
  }

  console.log('\n🗑️  削除を開始します...\n');

  let deleted = 0;
  let errors = 0;
  const deletedByAsp: Record<string, number> = {};

  for (const record of invalidRecords) {
    try {
      await deleteProduct(record.productId);
      deleted++;
      deletedByAsp[record.aspName] = (deletedByAsp[record.aspName] || 0) + 1;
      console.log(`  ✅ 削除: [${record.aspName}] ${record.originalProductId} - ${record.reason}`);
    } catch (error) {
      errors++;
      console.error(`  ❌ エラー: [${record.aspName}] ${record.originalProductId}`, error);
    }

    // 進捗表示
    if ((deleted + errors) % 50 === 0) {
      console.log(`\n  進捗: ${deleted + errors}/${invalidRecords.length} (削除: ${deleted}, エラー: ${errors})\n`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('完了');
  console.log('='.repeat(60));
  console.log(`  削除成功: ${deleted}件`);
  console.log(`  エラー: ${errors}件`);
  console.log('\nASPごとの削除件数:');
  for (const [asp, count] of Object.entries(deletedByAsp).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${asp}: ${count}件`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
