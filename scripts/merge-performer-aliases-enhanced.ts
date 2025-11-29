import { getDb } from '../lib/db';
import { performers, performerAliases, productPerformers } from '../lib/db/schema';
import { sql, eq, inArray, and } from 'drizzle-orm';

/**
 * 拡張版女優名寄せスクリプト
 *
 * 機能:
 * 1. 文字列正規化マッチング（既存）
 * 2. performer_aliases を使用したマッチング（既存）
 * 3. 🆕 作品共起マッチング: 同じ作品に出演している女優を同一人物と判断
 * 4. 🆕 外部ソース（av-wiki, nakiny）の別名を活用したクロスマッチング
 */

interface MergeCandidate {
  mainId: number;
  mainName: string;
  duplicateId: number;
  duplicateName: string;
  reason: 'alias' | 'exact_match' | 'work_cooccurrence' | 'cross_source';
  confidence: number; // 0-100
  evidence?: string;
}

/**
 * 作品共起に基づくマッチング
 * 2人の女優が同じ作品に複数回出演している場合、同一人物の可能性が高い
 */
async function findWorkCooccurrenceMatches(db: any): Promise<MergeCandidate[]> {
  console.log('🔍 Finding matches based on work co-occurrence...\n');

  const candidates: MergeCandidate[] = [];

  // 同じ作品に出演している女優ペアを検出
  const cooccurrences = await db.execute(sql`
    SELECT
      pp1.performer_id as performer1_id,
      p1.name as performer1_name,
      pp2.performer_id as performer2_id,
      p2.name as performer2_name,
      COUNT(DISTINCT pp1.product_id) as common_products
    FROM product_performers pp1
    JOIN product_performers pp2 ON pp1.product_id = pp2.product_id
    JOIN performers p1 ON pp1.performer_id = p1.id
    JOIN performers p2 ON pp2.performer_id = p2.id
    WHERE pp1.performer_id < pp2.performer_id
    GROUP BY pp1.performer_id, p1.name, pp2.performer_id, p2.name
    HAVING COUNT(DISTINCT pp1.product_id) >= 3
    ORDER BY common_products DESC
  `);

  for (const row of cooccurrences.rows) {
    const {
      performer1_id,
      performer1_name,
      performer2_id,
      performer2_name,
      common_products,
    } = row as any;

    // 名前の類似度をチェック（正規化後）
    const normalized1 = performer1_name
      .normalize('NFKC')
      .replace(/\s+/g, '')
      .toLowerCase();
    const normalized2 = performer2_name
      .normalize('NFKC')
      .replace(/\s+/g, '')
      .toLowerCase();

    // 類似度計算（Levenshtein距離や部分一致）
    const similarity = calculateSimilarity(normalized1, normalized2);

    // 類似度が高い + 共通作品が多い場合、同一人物の可能性大
    if (similarity > 0.6 || common_products >= 5) {
      const confidence = Math.min(100, (similarity * 50) + (common_products * 5));

      candidates.push({
        mainId: performer1_id,
        mainName: performer1_name,
        duplicateId: performer2_id,
        duplicateName: performer2_name,
        reason: 'work_cooccurrence',
        confidence,
        evidence: `${common_products} common products, similarity: ${(similarity * 100).toFixed(0)}%`,
      });

      console.log(
        `  Found: "${performer2_name}" → "${performer1_name}" ` +
        `(${common_products} common products, similarity: ${(similarity * 100).toFixed(0)}%)`
      );
    }
  }

  return candidates;
}

/**
 * 外部ソース（av-wiki, nakiny）の別名を使ったクロスマッチング
 * 例: av-wikiに「明日花キララ」の別名「Asuka」が登録されている
 *     → データベースに「Asuka」という別の女優がいる
 *     → 両者が同じ作品に出演していれば同一人物
 */
async function findCrossSourceMatches(db: any): Promise<MergeCandidate[]> {
  console.log('🔍 Finding matches using cross-source aliases (av-wiki, nakiny)...\n');

  const candidates: MergeCandidate[] = [];

  // 外部ソースから取得した別名を取得
  const externalAliases = await db.execute(sql`
    SELECT
      pa.performer_id,
      p.name as main_name,
      pa.alias_name,
      pa.source
    FROM performer_aliases pa
    JOIN performers p ON pa.performer_id = p.id
    WHERE pa.source IN ('av-wiki', 'nakiny')
  `);

  for (const alias of externalAliases.rows) {
    const { performer_id, main_name, alias_name, source } = alias as any;

    // この別名と一致する別の女優がいるか確認
    const matchingPerformer = await db.execute(sql`
      SELECT id, name
      FROM performers
      WHERE id != ${performer_id}
      AND (
        name = ${alias_name}
        OR LOWER(REPLACE(name, ' ', '')) = LOWER(REPLACE(${alias_name}, ' ', ''))
      )
    `);

    if (matchingPerformer.rows.length > 0) {
      const match = matchingPerformer.rows[0] as any;

      // 2人の女優が共通の作品に出演しているか確認
      const commonProducts = await db.execute(sql`
        SELECT COUNT(DISTINCT pp1.product_id) as count
        FROM product_performers pp1
        JOIN product_performers pp2 ON pp1.product_id = pp2.product_id
        WHERE pp1.performer_id = ${performer_id}
        AND pp2.performer_id = ${match.id}
      `);

      const commonCount = (commonProducts.rows[0] as any).count || 0;

      // 外部ソースの別名マッチ + 共通作品がある = 高信頼度
      const confidence = commonCount > 0 ? 85 + Math.min(15, commonCount * 3) : 60;

      candidates.push({
        mainId: performer_id,
        mainName: main_name,
        duplicateId: match.id,
        duplicateName: match.name,
        reason: 'cross_source',
        confidence,
        evidence: `${source} alias "${alias_name}", ${commonCount} common products`,
      });

      console.log(
        `  Found: "${match.name}" → "${main_name}" ` +
        `(${source} alias: "${alias_name}", ${commonCount} common products)`
      );
    }
  }

  return candidates;
}

/**
 * 既存のロジック: 別名テーブルベースのマッチング
 */
async function findAliasMatches(db: any): Promise<MergeCandidate[]> {
  console.log('🔍 Finding matches based on registered aliases...\n');

  const candidates: MergeCandidate[] = [];
  const aliases = await db.select().from(performerAliases);

  for (const alias of aliases) {
    const duplicatePerformer = await db.query.performers.findFirst({
      where: eq(performers.name, alias.aliasName),
    });

    if (duplicatePerformer) {
      const mainPerformer = await db.query.performers.findFirst({
        where: eq(performers.id, alias.performerId),
      });

      if (mainPerformer && mainPerformer.id !== duplicatePerformer.id) {
        candidates.push({
          mainId: mainPerformer.id,
          mainName: mainPerformer.name,
          duplicateId: duplicatePerformer.id,
          duplicateName: duplicatePerformer.name,
          reason: 'alias',
          confidence: 90,
        });
      }
    }
  }

  return candidates;
}

/**
 * 既存のロジック: 完全一致する名前を検出
 */
async function findExactMatches(db: any): Promise<MergeCandidate[]> {
  console.log('🔍 Finding exact name matches...\n');

  const candidates: MergeCandidate[] = [];
  const allPerformers = await db.select().from(performers);

  const normalizedMap = new Map<string, number[]>();

  for (const performer of allPerformers) {
    const normalized = performer.name
      .normalize('NFKC')
      .replace(/\s+/g, '')
      .toLowerCase();

    if (!normalizedMap.has(normalized)) {
      normalizedMap.set(normalized, []);
    }
    normalizedMap.get(normalized)!.push(performer.id);
  }

  for (const [normalized, ids] of normalizedMap) {
    if (ids.length > 1) {
      const sortedIds = ids.sort((a, b) => a - b);
      const mainId = sortedIds[0];
      const mainPerformer = allPerformers.find(p => p.id === mainId)!;

      for (let i = 1; i < sortedIds.length; i++) {
        const duplicateId = sortedIds[i];
        const duplicatePerformer = allPerformers.find(p => p.id === duplicateId)!;

        candidates.push({
          mainId,
          mainName: mainPerformer.name,
          duplicateId,
          duplicateName: duplicatePerformer.name,
          reason: 'exact_match',
          confidence: 100,
        });
      }
    }
  }

  return candidates;
}

/**
 * 文字列類似度計算（簡易版Levenshtein距離）
 */
function calculateSimilarity(str1: string, str2: string): number {
  // 部分一致チェック
  if (str1.includes(str2) || str2.includes(str1)) {
    return 0.8;
  }

  // Levenshtein距離の簡易計算
  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str1.length][str2.length];
}

/**
 * マージ候補を重複排除
 */
function deduplicateCandidates(candidates: MergeCandidate[]): MergeCandidate[] {
  const uniqueMap = new Map<string, MergeCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.mainId}-${candidate.duplicateId}`;
    const existing = uniqueMap.get(key);

    // 信頼度が高い方を採用
    if (!existing || candidate.confidence > existing.confidence) {
      uniqueMap.set(key, candidate);
    }
  }

  return Array.from(uniqueMap.values());
}

/**
 * メイン処理
 */
async function mergePerformerAliasesEnhanced() {
  const db = getDb();

  console.log('=== 拡張版女優名寄せ（作品情報活用） ===\n');

  // すべてのマッチング手法を実行
  const aliasMatches = await findAliasMatches(db);
  const exactMatches = await findExactMatches(db);
  const workMatches = await findWorkCooccurrenceMatches(db);
  const crossSourceMatches = await findCrossSourceMatches(db);

  // 全候補を統合
  let allCandidates = [
    ...aliasMatches,
    ...exactMatches,
    ...workMatches,
    ...crossSourceMatches,
  ];

  // 重複排除
  allCandidates = deduplicateCandidates(allCandidates);

  // 信頼度でソート
  allCandidates.sort((a, b) => b.confidence - a.confidence);

  console.log(`\n📊 Total merge candidates: ${allCandidates.length}\n`);

  if (allCandidates.length === 0) {
    console.log('✓ No duplicates found!');
    process.exit(0);
  }

  // マージプランを表示
  console.log('=== Merge Plan (sorted by confidence) ===\n');

  // 信頼度別に分類
  const highConfidence = allCandidates.filter(c => c.confidence >= 80);
  const mediumConfidence = allCandidates.filter(c => c.confidence >= 60 && c.confidence < 80);
  const lowConfidence = allCandidates.filter(c => c.confidence < 60);

  console.log(`🟢 High Confidence (${highConfidence.length}):`);
  for (const candidate of highConfidence.slice(0, 10)) {
    console.log(
      `  [${candidate.reason}] "${candidate.duplicateName}" → "${candidate.mainName}" ` +
      `(${candidate.confidence}%${candidate.evidence ? ', ' + candidate.evidence : ''})`
    );
  }
  if (highConfidence.length > 10) {
    console.log(`  ... and ${highConfidence.length - 10} more`);
  }

  console.log(`\n🟡 Medium Confidence (${mediumConfidence.length}):`);
  for (const candidate of mediumConfidence.slice(0, 5)) {
    console.log(
      `  [${candidate.reason}] "${candidate.duplicateName}" → "${candidate.mainName}" ` +
      `(${candidate.confidence}%${candidate.evidence ? ', ' + candidate.evidence : ''})`
    );
  }
  if (mediumConfidence.length > 5) {
    console.log(`  ... and ${mediumConfidence.length - 5} more`);
  }

  console.log(`\n🟠 Low Confidence (${lowConfidence.length}):`);
  for (const candidate of lowConfidence.slice(0, 3)) {
    console.log(
      `  [${candidate.reason}] "${candidate.duplicateName}" → "${candidate.mainName}" ` +
      `(${candidate.confidence}%${candidate.evidence ? ', ' + candidate.evidence : ''})`
    );
  }
  if (lowConfidence.length > 3) {
    console.log(`  ... and ${lowConfidence.length - 3} more`);
  }

  // --execute フラグチェック
  const executeFlag = process.argv.includes('--execute');
  const minConfidence = parseInt(
    process.argv.find(arg => arg.startsWith('--min-confidence='))?.split('=')[1] || '80'
  );

  if (!executeFlag) {
    console.log('\n⚠️  This is a DRY RUN. No changes will be made.');
    console.log(`   Run with --execute --min-confidence=${minConfidence} to apply changes.\n`);
    console.log(`   Example: npx tsx scripts/merge-performer-aliases-enhanced.ts --execute --min-confidence=80`);
    process.exit(0);
  }

  // 実行
  console.log(`\n=== Executing Merge (min confidence: ${minConfidence}%) ===\n`);

  const toMerge = allCandidates.filter(c => c.confidence >= minConfidence);
  let mergedCount = 0;
  let productRelationsMoved = 0;

  for (const candidate of toMerge) {
    try {
      console.log(
        `Merging: "${candidate.duplicateName}" → "${candidate.mainName}" ` +
        `(confidence: ${candidate.confidence}%)`
      );

      // product_performersの関係を移動
      const existingRelations = await db
        .select()
        .from(productPerformers)
        .where(eq(productPerformers.performerId, candidate.duplicateId));

      for (const relation of existingRelations) {
        const existingMain = await db
          .select()
          .from(productPerformers)
          .where(
            and(
              eq(productPerformers.productId, relation.productId),
              eq(productPerformers.performerId, candidate.mainId)
            )
          );

        if (existingMain.length === 0) {
          await db
            .update(productPerformers)
            .set({ performerId: candidate.mainId })
            .where(
              and(
                eq(productPerformers.productId, relation.productId),
                eq(productPerformers.performerId, candidate.duplicateId)
              )
            );

          productRelationsMoved++;
        } else {
          await db
            .delete(productPerformers)
            .where(
              and(
                eq(productPerformers.productId, relation.productId),
                eq(productPerformers.performerId, candidate.duplicateId)
              )
            );
        }
      }

      // 重複performerを削除
      await db.delete(performers).where(eq(performers.id, candidate.duplicateId));

      mergedCount++;
      console.log(`  ✓ Merged successfully`);
    } catch (error: any) {
      console.error(`  ❌ Error merging ${candidate.duplicateName}:`, error.message);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total merged: ${mergedCount}`);
  console.log(`Product relations moved: ${productRelationsMoved}`);

  const finalCount = await db.execute(sql`SELECT COUNT(*) as count FROM performers`);
  console.log(`\nFinal performer count: ${(finalCount.rows[0] as any).count}`);

  process.exit(0);
}

mergePerformerAliasesEnhanced().catch(console.error);
