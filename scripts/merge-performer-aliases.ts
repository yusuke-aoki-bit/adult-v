import { getDb } from '../lib/db';
import { performers, performerAliases, productPerformers } from '../lib/db/schema';
import { sql, eq, inArray } from 'drizzle-orm';

/**
 * 女優の別名を考慮してperformersテーブルをマージ
 *
 * 例:
 * - 「椎名ななみ」と「椎名なな美」が別レコードで存在
 * - performer_aliases に「椎名なな美」が「椎名ななみ」の別名として登録されている
 * - → 「椎名なな美」を「椎名ななみ」にマージ
 */

interface MergeCandidate {
  mainId: number;
  mainName: string;
  duplicateId: number;
  duplicateName: string;
  reason: 'alias' | 'exact_match';
}

async function mergePerformerAliases() {
  const db = getDb();

  console.log('=== Merging Performer Aliases ===\n');

  // ステップ1: 別名テーブルから重複候補を検出
  console.log('📊 Finding merge candidates based on aliases...\n');

  const mergeCandidates: MergeCandidate[] = [];

  // performer_aliasesから別名を取得
  const aliases = await db.select().from(performerAliases);

  console.log(`Found ${aliases.length} registered aliases`);

  for (const alias of aliases) {
    // この別名と同じ名前のperformerが存在するか確認
    const duplicatePerformer = await db.query.performers.findFirst({
      where: eq(performers.name, alias.aliasName),
    });

    if (duplicatePerformer) {
      // メインのperformerを取得
      const mainPerformer = await db.query.performers.findFirst({
        where: eq(performers.id, alias.performerId),
      });

      if (mainPerformer && mainPerformer.id !== duplicatePerformer.id) {
        mergeCandidates.push({
          mainId: mainPerformer.id,
          mainName: mainPerformer.name,
          duplicateId: duplicatePerformer.id,
          duplicateName: duplicatePerformer.name,
          reason: 'alias',
        });

        console.log(`  Found: "${duplicatePerformer.name}" → "${mainPerformer.name}" (alias match)`);
      }
    }
  }

  // ステップ2: 完全一致する名前を検出（正規化後）
  console.log('\n📊 Finding exact name matches...\n');

  const allPerformers = await db.select().from(performers);

  // 名前を正規化して重複を検出
  const normalizedMap = new Map<string, number[]>();

  for (const performer of allPerformers) {
    // 正規化: 半角・全角統一、スペース削除
    const normalized = performer.name
      .normalize('NFKC')
      .replace(/\s+/g, '')
      .toLowerCase();

    if (!normalizedMap.has(normalized)) {
      normalizedMap.set(normalized, []);
    }
    normalizedMap.get(normalized)!.push(performer.id);
  }

  // 重複がある正規化名を抽出
  for (const [normalized, ids] of normalizedMap) {
    if (ids.length > 1) {
      // IDが小さい方をメインとする
      const sortedIds = ids.sort((a, b) => a - b);
      const mainId = sortedIds[0];
      const mainPerformer = allPerformers.find(p => p.id === mainId)!;

      for (let i = 1; i < sortedIds.length; i++) {
        const duplicateId = sortedIds[i];
        const duplicatePerformer = allPerformers.find(p => p.id === duplicateId)!;

        // 既に追加されていないか確認
        const exists = mergeCandidates.some(
          c => c.mainId === mainId && c.duplicateId === duplicateId
        );

        if (!exists) {
          mergeCandidates.push({
            mainId,
            mainName: mainPerformer.name,
            duplicateId,
            duplicateName: duplicatePerformer.name,
            reason: 'exact_match',
          });

          console.log(`  Found: "${duplicatePerformer.name}" → "${mainPerformer.name}" (exact match)`);
        }
      }
    }
  }

  console.log(`\n📊 Total merge candidates: ${mergeCandidates.length}\n`);

  if (mergeCandidates.length === 0) {
    console.log('✓ No duplicates found!');
    process.exit(0);
  }

  // ステップ3: マージ実行の確認
  console.log('=== Merge Plan ===\n');
  for (const candidate of mergeCandidates.slice(0, 10)) {
    console.log(`  [${candidate.reason}] "${candidate.duplicateName}" (ID: ${candidate.duplicateId}) → "${candidate.mainName}" (ID: ${candidate.mainId})`);
  }

  if (mergeCandidates.length > 10) {
    console.log(`  ... and ${mergeCandidates.length - 10} more\n`);
  }

  // --execute フラグがない場合はドライラン
  const executeFlag = process.argv.includes('--execute');

  if (!executeFlag) {
    console.log('\n⚠️  This is a DRY RUN. No changes will be made.');
    console.log('   Run with --execute flag to apply changes.\n');
    process.exit(0);
  }

  // ステップ4: マージ実行
  console.log('\n=== Executing Merge ===\n');

  let mergedCount = 0;
  let productRelationsMoved = 0;

  for (const candidate of mergeCandidates) {
    try {
      console.log(`Merging: "${candidate.duplicateName}" → "${candidate.mainName}"`);

      // product_performersの関係を移動
      const existingRelations = await db
        .select()
        .from(productPerformers)
        .where(eq(productPerformers.performerId, candidate.duplicateId));

      for (const relation of existingRelations) {
        // 既に同じ関係が存在するか確認
        const existingMain = await db
          .select()
          .from(productPerformers)
          .where(
            sql`${productPerformers.productId} = ${relation.productId} AND ${productPerformers.performerId} = ${candidate.mainId}`
          );

        if (existingMain.length === 0) {
          // 重複関係を新しいperformer_idに変更
          await db
            .update(productPerformers)
            .set({ performerId: candidate.mainId })
            .where(
              sql`${productPerformers.productId} = ${relation.productId} AND ${productPerformers.performerId} = ${candidate.duplicateId}`
            );

          productRelationsMoved++;
        } else {
          // 既に関係が存在する場合は古い方を削除
          await db
            .delete(productPerformers)
            .where(
              sql`${productPerformers.productId} = ${relation.productId} AND ${productPerformers.performerId} = ${candidate.duplicateId}`
            );
        }
      }

      // 重複performerを削除（CASCADE により performer_aliases, performer_images も削除される）
      await db.delete(performers).where(eq(performers.id, candidate.duplicateId));

      mergedCount++;
      console.log(`  ✓ Merged successfully (${productRelationsMoved} product relations moved)`);

    } catch (error) {
      console.error(`  ❌ Error merging ${candidate.duplicateName}:`, error);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total merged: ${mergedCount}`);
  console.log(`Product relations moved: ${productRelationsMoved}`);

  // 最終確認
  const finalCount = await db.select({ count: sql`count(*)` }).from(performers);
  console.log(`\nFinal performer count: ${finalCount[0].count}`);

  process.exit(0);
}

mergePerformerAliases().catch(console.error);
