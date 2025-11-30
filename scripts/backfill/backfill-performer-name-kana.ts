/**
 * Google Custom Search APIを使って演者の読み仮名(nameKana)を取得するバックフィルスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/backfill/backfill-performer-name-kana.ts --limit=100
 *   npx tsx scripts/backfill/backfill-performer-name-kana.ts --limit=100 --dry-run
 *   npx tsx scripts/backfill/backfill-performer-name-kana.ts --performer-id=12345
 *
 * 前提条件:
 *   - GOOGLE_API_KEY が .env.local に設定されていること
 *   - GOOGLE_CUSTOM_SEARCH_ENGINE_ID が .env.local に設定されていること
 *
 * 注意:
 *   - Google Custom Search APIは1日あたり100クエリまで無料
 *   - それ以上は$5/1000クエリの課金が発生
 *   - レート制限を避けるため、1秒間隔でクエリを実行
 */

import { getDb } from '../../lib/db';
import { performers } from '../../lib/db/schema';
import { sql, eq, isNull, and, or, not, like } from 'drizzle-orm';
import { searchActressReading, checkGoogleApiConfig } from '../../lib/google-apis';

const db = getDb();

// 無効な名前パターン（これらはスキップ）
const INVALID_NAME_PATTERNS = [
  /^素人/,
  /^応募者/,
  /^企画/,
  /^不明/,
  /^-+$/,
  /^N\/A$/i,
  /^\d+$/,  // 数字のみ
  /^[A-Za-z0-9\s]+$/,  // 英数字のみ（外国人名の可能性があるためスキップ）
];

// 最低文字数
const MIN_NAME_LENGTH = 2;

interface PerformerInfo {
  id: number;
  name: string;
  nameKana: string | null;
}

/**
 * カタカナをひらがなに変換
 */
function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) - 0x60)
  );
}

/**
 * 名前がカタカナのみかチェック
 */
function isKatakanaOnly(name: string): boolean {
  return /^[ァ-ヺー\s]+$/.test(name);
}

/**
 * 名前がひらがなのみかチェック
 */
function isHiraganaOnly(name: string): boolean {
  return /^[ぁ-ゖー\s]+$/.test(name);
}

/**
 * 名前が有効かチェック
 */
function isValidName(name: string): boolean {
  if (!name || name.length < MIN_NAME_LENGTH) return false;

  for (const pattern of INVALID_NAME_PATTERNS) {
    if (pattern.test(name)) return false;
  }

  return true;
}

/**
 * 1秒間待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '50');
  const dryRun = args.includes('--dry-run');
  const performerId = args.find((a) => a.startsWith('--performer-id='))?.split('=')[1];
  const skipKatakana = args.includes('--skip-katakana'); // カタカナ名をスキップ

  console.log('=== Google Custom Search APIを使った読み仮名取得 ===\n');
  console.log(`設定: limit=${limit}, dryRun=${dryRun}, skipKatakana=${skipKatakana}`);
  if (performerId) console.log(`特定演者: ${performerId}`);

  // API設定を確認
  const apiConfig = checkGoogleApiConfig();
  if (!apiConfig.customSearch) {
    console.error('\n❌ Google Custom Search APIが設定されていません');
    console.error('   .env.localに以下を設定してください:');
    console.error('   - GOOGLE_API_KEY');
    console.error('   - GOOGLE_CUSTOM_SEARCH_ENGINE_ID');
    process.exit(1);
  }

  console.log('✅ Google Custom Search API: 設定済み\n');

  // 対象の演者を取得
  let targetPerformers: PerformerInfo[];

  if (performerId) {
    // 特定の演者のみ
    const result = await db
      .select({ id: performers.id, name: performers.name, nameKana: performers.nameKana })
      .from(performers)
      .where(eq(performers.id, parseInt(performerId)));
    targetPerformers = result;
  } else {
    // nameKanaが未設定の演者を取得
    // 作品紐付きのある演者を優先（より重要な演者）
    const result = await db.execute(sql`
      SELECT DISTINCT p.id, p.name, p.name_kana as "nameKana"
      FROM performers p
      LEFT JOIN product_performers pp ON p.id = pp.performer_id
      WHERE p.name_kana IS NULL OR p.name_kana = ''
      ORDER BY
        CASE WHEN pp.performer_id IS NOT NULL THEN 0 ELSE 1 END,
        p.id
      LIMIT ${limit}
    `);
    targetPerformers = result.rows as any[];
  }

  console.log(`📋 対象演者: ${targetPerformers.length}人\n`);

  if (targetPerformers.length === 0) {
    console.log('✅ nameKanaが未設定の演者はいません');
    process.exit(0);
  }

  // 統計
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let alreadyKana = 0;

  for (const performer of targetPerformers) {
    processed++;
    const { id, name, nameKana } = performer;

    console.log(`[${processed}/${targetPerformers.length}] ${name} (ID: ${id})`);

    // 既にnameKanaがある場合はスキップ
    if (nameKana && nameKana.length > 0) {
      console.log(`  ⏭️ 既にnameKanaあり: ${nameKana}`);
      skipped++;
      continue;
    }

    // 無効な名前はスキップ
    if (!isValidName(name)) {
      console.log(`  ⏭️ 無効な名前のためスキップ`);
      skipped++;
      continue;
    }

    // 既にひらがなの場合
    if (isHiraganaOnly(name)) {
      console.log(`  ✅ 既にひらがな: ${name}`);
      if (!dryRun) {
        await db
          .update(performers)
          .set({ nameKana: name.replace(/\s+/g, '') })
          .where(eq(performers.id, id));
      }
      alreadyKana++;
      updated++;
      continue;
    }

    // カタカナの場合
    if (isKatakanaOnly(name)) {
      if (skipKatakana) {
        console.log(`  ⏭️ カタカナのためスキップ`);
        skipped++;
        continue;
      }
      const hiragana = katakanaToHiragana(name.replace(/\s+/g, ''));
      console.log(`  ✅ カタカナ→ひらがな: ${hiragana}`);
      if (!dryRun) {
        await db
          .update(performers)
          .set({ nameKana: hiragana })
          .where(eq(performers.id, id));
      }
      alreadyKana++;
      updated++;
      continue;
    }

    // Google Custom Search APIで検索
    try {
      const reading = await searchActressReading(name);

      if (reading) {
        console.log(`  ✅ 読み仮名取得: ${reading}`);
        if (!dryRun) {
          await db
            .update(performers)
            .set({ nameKana: reading })
            .where(eq(performers.id, id));
        }
        updated++;
      } else {
        console.log(`  ❌ 読み仮名が見つかりませんでした`);
        failed++;
      }
    } catch (error) {
      console.error(`  ❌ APIエラー:`, error);
      failed++;
    }

    // レート制限を避けるため1秒待機
    if (processed < targetPerformers.length) {
      await sleep(1000);
    }
  }

  // 結果表示
  console.log('\n=== 完了 ===');
  console.log(`処理済み: ${processed}人`);
  console.log(`更新: ${updated}人`);
  console.log(`  - API取得: ${updated - alreadyKana}人`);
  console.log(`  - 既存かな/カナ: ${alreadyKana}人`);
  console.log(`スキップ: ${skipped}人`);
  console.log(`失敗: ${failed}人`);

  if (dryRun) {
    console.log('\n⚠️ dry-runモードのため、実際の更新は行われていません');
  }

  // 最終統計
  if (!dryRun) {
    const stats = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN name_kana IS NOT NULL AND name_kana != '' THEN 1 END) as with_kana,
        ROUND(100.0 * COUNT(CASE WHEN name_kana IS NOT NULL AND name_kana != '' THEN 1 END) / COUNT(*), 1) as rate
      FROM performers
    `);
    console.log('\n=== 全体統計 ===');
    console.table(stats.rows);
  }

  process.exit(0);
}

main().catch(console.error);
