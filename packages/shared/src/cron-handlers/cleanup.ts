/**
 * データクリーンアップ API ハンドラー
 *
 * データベースの整合性チェックと重複データのクリーンアップ
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '../lib/cron-auth';
import type { SQL } from 'drizzle-orm';

const TIME_LIMIT = 150_000; // 150秒（Cloud Scheduler 180秒タイムアウトの83%）

export interface CleanupHandlerDeps {
  getDb: () => {
    execute: (sql: SQL) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
  };
  sql: typeof import('drizzle-orm').sql;
}

interface CleanupStats {
  duplicateProducts: number;
  duplicatePerformers: number;
  orphanedProductSources: number;
  orphanedProductVideos: number;
  orphanedProductPerformers: number;
  emptyProducts: number;
  expiredSales: number;
  saleFlagsUpdated: number;
  fixed: number;
  migratedSources: number;
  migratedPerformers: number;
  migratedVideos: number;
  migratedImages: number;
  migratedTags: number;
}

export function createCleanupHandler(deps: CleanupHandlerDeps) {
  const { getDb, sql } = deps;

  return async function GET(request: NextRequest) {
    if (!verifyCronRequest(request)) {
      return unauthorizedResponse();
    }

    const db = getDb();
    const startTime = Date.now();

    const stats: CleanupStats = {
      duplicateProducts: 0,
      duplicatePerformers: 0,
      orphanedProductSources: 0,
      orphanedProductVideos: 0,
      orphanedProductPerformers: 0,
      emptyProducts: 0,
      expiredSales: 0,
      saleFlagsUpdated: 0,
      fixed: 0,
      migratedSources: 0,
      migratedPerformers: 0,
      migratedVideos: 0,
      migratedImages: 0,
      migratedTags: 0,
    };

    const issues: string[] = [];
    const errors: string[] = [];

    try {
      const url = new URL(request['url']);
      const action = url.searchParams.get('action') || 'check';
      const type = url.searchParams.get('type') || 'all';

      console.log(`[cleanup] Starting: action=${action}, type=${type}`);

      // 1. 重複商品チェック（同じnormalized_product_idで複数レコード）
      if (type === 'all' || type === 'duplicates') {
        try {
          const duplicateProductsResult = await db.execute(sql`
            SELECT normalized_product_id, COUNT(*) as cnt
            FROM products
            GROUP BY normalized_product_id
            HAVING COUNT(*) > 1
          `);
          stats.duplicateProducts = duplicateProductsResult.rows.length;

          if (stats.duplicateProducts > 0) {
            issues.push(`重複商品: ${stats.duplicateProducts}件`);

            if (action === 'fix') {
              // 関連レコードを移行してから重複を削除
              // 各操作はデータ修正CTE（単一SQLで原子的に実行）

              // Step 1: product_sources を移行（同一asp_nameが既にある場合はスキップ→削除）
              const migrateSourcesResult = await db.execute(sql`
                WITH dups AS (
                  SELECT normalized_product_id, MAX(id) as keep_id
                  FROM products GROUP BY normalized_product_id HAVING COUNT(*) > 1
                ),
                dup_products AS (
                  SELECT p.id AS old_id, d.keep_id
                  FROM products p JOIN dups d
                    ON p.normalized_product_id = d.normalized_product_id AND p.id != d.keep_id
                )
                UPDATE product_sources ps
                SET product_id = dp.keep_id
                FROM dup_products dp
                WHERE ps.product_id = dp.old_id
                  AND NOT EXISTS (
                    SELECT 1 FROM product_sources ps2
                    WHERE ps2.product_id = dp.keep_id AND ps2.asp_name = ps.asp_name
                  )
              `);
              stats.migratedSources = (migrateSourcesResult as { rowCount?: number }).rowCount ?? 0;

              // 移行できなかった重複側のsourcesは削除（keep_id側に同asp_nameが存在）
              await db.execute(sql`
                WITH dups AS (
                  SELECT normalized_product_id, MAX(id) as keep_id
                  FROM products GROUP BY normalized_product_id HAVING COUNT(*) > 1
                ),
                dup_products AS (
                  SELECT p.id AS old_id, d.keep_id
                  FROM products p JOIN dups d
                    ON p.normalized_product_id = d.normalized_product_id AND p.id != d.keep_id
                )
                DELETE FROM product_sources ps
                USING dup_products dp
                WHERE ps.product_id = dp.old_id
              `);

              if (Date.now() - startTime > TIME_LIMIT) {
                issues.push('TIME_LIMIT到達 - 途中で停止');
                return buildResponse(stats, issues, errors, action, type, startTime);
              }

              // Step 2: product_performers を移行
              const migratePerformersResult = await db.execute(sql`
                WITH dups AS (
                  SELECT normalized_product_id, MAX(id) as keep_id
                  FROM products GROUP BY normalized_product_id HAVING COUNT(*) > 1
                ),
                dup_products AS (
                  SELECT p.id AS old_id, d.keep_id
                  FROM products p JOIN dups d
                    ON p.normalized_product_id = d.normalized_product_id AND p.id != d.keep_id
                )
                UPDATE product_performers pp
                SET product_id = dp.keep_id
                FROM dup_products dp
                WHERE pp.product_id = dp.old_id
                  AND NOT EXISTS (
                    SELECT 1 FROM product_performers pp2
                    WHERE pp2.product_id = dp.keep_id AND pp2.performer_id = pp.performer_id
                  )
              `);
              stats.migratedPerformers = (migratePerformersResult as { rowCount?: number }).rowCount ?? 0;

              await db.execute(sql`
                WITH dups AS (
                  SELECT normalized_product_id, MAX(id) as keep_id
                  FROM products GROUP BY normalized_product_id HAVING COUNT(*) > 1
                ),
                dup_products AS (
                  SELECT p.id AS old_id, d.keep_id
                  FROM products p JOIN dups d
                    ON p.normalized_product_id = d.normalized_product_id AND p.id != d.keep_id
                )
                DELETE FROM product_performers pp
                USING dup_products dp
                WHERE pp.product_id = dp.old_id
              `);

              // Step 3: product_videos を移行
              const migrateVideosResult = await db.execute(sql`
                WITH dups AS (
                  SELECT normalized_product_id, MAX(id) as keep_id
                  FROM products GROUP BY normalized_product_id HAVING COUNT(*) > 1
                ),
                dup_products AS (
                  SELECT p.id AS old_id, d.keep_id
                  FROM products p JOIN dups d
                    ON p.normalized_product_id = d.normalized_product_id AND p.id != d.keep_id
                )
                UPDATE product_videos pv
                SET product_id = dp.keep_id
                FROM dup_products dp
                WHERE pv.product_id = dp.old_id
                  AND NOT EXISTS (
                    SELECT 1 FROM product_videos pv2
                    WHERE pv2.product_id = dp.keep_id AND pv2.video_url = pv.video_url
                  )
              `);
              stats.migratedVideos = (migrateVideosResult as { rowCount?: number }).rowCount ?? 0;

              await db.execute(sql`
                WITH dups AS (
                  SELECT normalized_product_id, MAX(id) as keep_id
                  FROM products GROUP BY normalized_product_id HAVING COUNT(*) > 1
                ),
                dup_products AS (
                  SELECT p.id AS old_id, d.keep_id
                  FROM products p JOIN dups d
                    ON p.normalized_product_id = d.normalized_product_id AND p.id != d.keep_id
                )
                DELETE FROM product_videos pv
                USING dup_products dp
                WHERE pv.product_id = dp.old_id
              `);

              if (Date.now() - startTime > TIME_LIMIT) {
                issues.push('TIME_LIMIT到達 - 途中で停止');
                return buildResponse(stats, issues, errors, action, type, startTime);
              }

              // Step 4: product_images を移行
              const migrateImagesResult = await db.execute(sql`
                WITH dups AS (
                  SELECT normalized_product_id, MAX(id) as keep_id
                  FROM products GROUP BY normalized_product_id HAVING COUNT(*) > 1
                ),
                dup_products AS (
                  SELECT p.id AS old_id, d.keep_id
                  FROM products p JOIN dups d
                    ON p.normalized_product_id = d.normalized_product_id AND p.id != d.keep_id
                )
                UPDATE product_images pi
                SET product_id = dp.keep_id
                FROM dup_products dp
                WHERE pi.product_id = dp.old_id
                  AND NOT EXISTS (
                    SELECT 1 FROM product_images pi2
                    WHERE pi2.product_id = dp.keep_id AND pi2.image_url = pi.image_url
                  )
              `);
              stats.migratedImages = (migrateImagesResult as { rowCount?: number }).rowCount ?? 0;

              await db.execute(sql`
                WITH dups AS (
                  SELECT normalized_product_id, MAX(id) as keep_id
                  FROM products GROUP BY normalized_product_id HAVING COUNT(*) > 1
                ),
                dup_products AS (
                  SELECT p.id AS old_id, d.keep_id
                  FROM products p JOIN dups d
                    ON p.normalized_product_id = d.normalized_product_id AND p.id != d.keep_id
                )
                DELETE FROM product_images pi
                USING dup_products dp
                WHERE pi.product_id = dp.old_id
              `);

              // Step 5: product_tags を移行
              const migrateTagsResult = await db.execute(sql`
                WITH dups AS (
                  SELECT normalized_product_id, MAX(id) as keep_id
                  FROM products GROUP BY normalized_product_id HAVING COUNT(*) > 1
                ),
                dup_products AS (
                  SELECT p.id AS old_id, d.keep_id
                  FROM products p JOIN dups d
                    ON p.normalized_product_id = d.normalized_product_id AND p.id != d.keep_id
                )
                UPDATE product_tags pt
                SET product_id = dp.keep_id
                FROM dup_products dp
                WHERE pt.product_id = dp.old_id
                  AND NOT EXISTS (
                    SELECT 1 FROM product_tags pt2
                    WHERE pt2.product_id = dp.keep_id AND pt2.tag_id = pt.tag_id
                  )
              `);
              stats.migratedTags = (migrateTagsResult as { rowCount?: number }).rowCount ?? 0;

              await db.execute(sql`
                WITH dups AS (
                  SELECT normalized_product_id, MAX(id) as keep_id
                  FROM products GROUP BY normalized_product_id HAVING COUNT(*) > 1
                ),
                dup_products AS (
                  SELECT p.id AS old_id, d.keep_id
                  FROM products p JOIN dups d
                    ON p.normalized_product_id = d.normalized_product_id AND p.id != d.keep_id
                )
                DELETE FROM product_tags pt
                USING dup_products dp
                WHERE pt.product_id = dp.old_id
              `);

              // Step 6: 関連レコード移行完了後、重複商品を削除
              const deleteResult = await db.execute(sql`
                DELETE FROM products p
                WHERE EXISTS (
                  SELECT 1 FROM (
                    SELECT normalized_product_id, MAX(id) as keep_id
                    FROM products
                    GROUP BY normalized_product_id
                    HAVING COUNT(*) > 1
                  ) dup
                  WHERE p.normalized_product_id = dup.normalized_product_id
                    AND p.id != dup.keep_id
                )
              `);
              stats.fixed += (deleteResult as { rowCount?: number }).rowCount ?? stats.duplicateProducts;

              console.log(`[cleanup] 重複商品修正完了: migrated sources=${stats.migratedSources}, performers=${stats.migratedPerformers}, videos=${stats.migratedVideos}, images=${stats.migratedImages}, tags=${stats.migratedTags}`);
            }
          }
        } catch (error) {
          const msg = `重複商品チェック/修正エラー: ${error instanceof Error ? error.message : 'Unknown'}`;
          console.error(`[cleanup] ${msg}`);
          errors.push(msg);
        }

        if (Date.now() - startTime > TIME_LIMIT) {
          issues.push('TIME_LIMIT到達 - 途中で停止');
          return buildResponse(stats, issues, errors, action, type, startTime);
        }

        // 重複出演者チェック
        try {
          const duplicatePerformersResult = await db.execute(sql`
            SELECT name, COUNT(*) as cnt
            FROM performers
            GROUP BY name
            HAVING COUNT(*) > 1
          `);
          stats.duplicatePerformers = duplicatePerformersResult.rows.length;

          if (stats.duplicatePerformers > 0) {
            issues.push(`重複出演者: ${stats.duplicatePerformers}件`);

            if (action === 'fix') {
              // 一括処理: 重複演者のリンクを最小IDに移行し、重複レコードを削除

              // 1. 既に正しいリンクが存在する場合、重複側のリンクを削除
              await db.execute(sql`
                DELETE FROM product_performers pp
                WHERE EXISTS (
                  SELECT 1 FROM performers p
                  JOIN (
                    SELECT name, MIN(id) as min_id FROM performers GROUP BY name HAVING COUNT(*) > 1
                  ) dup ON p.name = dup.name AND p.id != dup.min_id
                  WHERE pp.performer_id = p.id
                    AND EXISTS (
                      SELECT 1 FROM product_performers pp2
                      WHERE pp2.product_id = pp.product_id AND pp2.performer_id = dup.min_id
                    )
                )
              `);

              // 2. 残りのリンクを最小IDに移行
              await db.execute(sql`
                UPDATE product_performers pp
                SET performer_id = dup.min_id
                FROM performers p
                JOIN (
                  SELECT name, MIN(id) as min_id FROM performers GROUP BY name HAVING COUNT(*) > 1
                ) dup ON p.name = dup.name AND p.id != dup.min_id
                WHERE pp.performer_id = p.id
              `);

              // 3. 重複演者のエイリアスも最小IDに移行
              await db.execute(sql`
                UPDATE performer_aliases pa
                SET performer_id = dup.min_id
                FROM performers p
                JOIN (
                  SELECT name, MIN(id) as min_id FROM performers GROUP BY name HAVING COUNT(*) > 1
                ) dup ON p.name = dup.name AND p.id != dup.min_id
                WHERE pa.performer_id = p.id
                  AND NOT EXISTS (
                    SELECT 1 FROM performer_aliases pa2
                    WHERE pa2.performer_id = dup.min_id AND pa2.alias_name = pa.alias_name
                  )
              `);

              // 重複エイリアスを削除
              await db.execute(sql`
                DELETE FROM performer_aliases pa
                USING performers p
                JOIN (
                  SELECT name, MIN(id) as min_id FROM performers GROUP BY name HAVING COUNT(*) > 1
                ) dup ON p.name = dup.name AND p.id != dup.min_id
                WHERE pa.performer_id = p.id
              `);

              // 4. 重複演者レコードを削除
              await db.execute(sql`
                DELETE FROM performers p
                WHERE EXISTS (
                  SELECT 1 FROM (
                    SELECT name, MIN(id) as min_id FROM performers GROUP BY name HAVING COUNT(*) > 1
                  ) dup
                  WHERE p.name = dup.name AND p.id != dup.min_id
                )
              `);

              stats.fixed += stats.duplicatePerformers;
            }
          }
        } catch (error) {
          const msg = `重複出演者チェック/修正エラー: ${error instanceof Error ? error.message : 'Unknown'}`;
          console.error(`[cleanup] ${msg}`);
          errors.push(msg);
        }
      }

      if (Date.now() - startTime > TIME_LIMIT) {
        issues.push('TIME_LIMIT到達 - 途中で停止');
        return buildResponse(stats, issues, errors, action, type, startTime);
      }

      // 2. 孤立レコードチェック
      if (type === 'all' || type === 'orphans') {
        // 孤立product_sources（存在しないproduct_idを参照）
        try {
          const orphanedSourcesResult = await db.execute(sql`
            SELECT COUNT(*) as cnt FROM product_sources ps
            WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = ps.product_id)
          `);
          stats.orphanedProductSources = parseInt((orphanedSourcesResult.rows[0] as { cnt: string }).cnt);

          if (stats.orphanedProductSources > 0) {
            issues.push(`孤立product_sources: ${stats.orphanedProductSources}件`);

            if (action === 'fix') {
              await db.execute(sql`
                DELETE FROM product_sources ps
                WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = ps.product_id)
              `);
              stats.fixed += stats.orphanedProductSources;
            }
          }
        } catch (error) {
          const msg = `孤立product_sourcesチェック/修正エラー: ${error instanceof Error ? error.message : 'Unknown'}`;
          console.error(`[cleanup] ${msg}`);
          errors.push(msg);
        }

        // 孤立product_videos
        try {
          const orphanedVideosResult = await db.execute(sql`
            SELECT COUNT(*) as cnt FROM product_videos pv
            WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pv.product_id)
          `);
          stats.orphanedProductVideos = parseInt((orphanedVideosResult.rows[0] as { cnt: string }).cnt);

          if (stats.orphanedProductVideos > 0) {
            issues.push(`孤立product_videos: ${stats.orphanedProductVideos}件`);

            if (action === 'fix') {
              await db.execute(sql`
                DELETE FROM product_videos pv
                WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pv.product_id)
              `);
              stats.fixed += stats.orphanedProductVideos;
            }
          }
        } catch (error) {
          const msg = `孤立product_videosチェック/修正エラー: ${error instanceof Error ? error.message : 'Unknown'}`;
          console.error(`[cleanup] ${msg}`);
          errors.push(msg);
        }

        // 孤立product_performers
        try {
          const orphanedPerformersResult = await db.execute(sql`
            SELECT COUNT(*) as cnt FROM product_performers pp
            WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pp.product_id)
               OR NOT EXISTS (SELECT 1 FROM performers pf WHERE pf.id = pp.performer_id)
          `);
          stats.orphanedProductPerformers = parseInt((orphanedPerformersResult.rows[0] as { cnt: string }).cnt);

          if (stats.orphanedProductPerformers > 0) {
            issues.push(`孤立product_performers: ${stats.orphanedProductPerformers}件`);

            if (action === 'fix') {
              await db.execute(sql`
                DELETE FROM product_performers pp
                WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pp.product_id)
                   OR NOT EXISTS (SELECT 1 FROM performers pf WHERE pf.id = pp.performer_id)
              `);
              stats.fixed += stats.orphanedProductPerformers;
            }
          }
        } catch (error) {
          const msg = `孤立product_performersチェック/修正エラー: ${error instanceof Error ? error.message : 'Unknown'}`;
          console.error(`[cleanup] ${msg}`);
          errors.push(msg);
        }
      }

      if (Date.now() - startTime > TIME_LIMIT) {
        issues.push('TIME_LIMIT到達 - 途中で停止');
        return buildResponse(stats, issues, errors, action, type, startTime);
      }

      // 3. 空の商品チェック（タイトルなし かつ 関連ソースなし）
      if (type === 'all' || type === 'empty') {
        try {
          const emptyProductsResult = await db.execute(sql`
            SELECT COUNT(*) as cnt FROM products p
            WHERE (p.title IS NULL OR p.title = '')
              AND NOT EXISTS (SELECT 1 FROM product_sources ps WHERE ps.product_id = p.id)
          `);
          stats.emptyProducts = parseInt((emptyProductsResult.rows[0] as { cnt: string }).cnt);

          if (stats.emptyProducts > 0) {
            issues.push(`タイトルなし＆ソースなし商品: ${stats.emptyProducts}件`);

            if (action === 'fix') {
              // 関連レコードも先にクリーンアップ
              await db.execute(sql`
                DELETE FROM product_performers pp
                WHERE pp.product_id IN (
                  SELECT p.id FROM products p
                  WHERE (p.title IS NULL OR p.title = '')
                    AND NOT EXISTS (SELECT 1 FROM product_sources ps WHERE ps.product_id = p.id)
                )
              `);
              await db.execute(sql`
                DELETE FROM product_videos pv
                WHERE pv.product_id IN (
                  SELECT p.id FROM products p
                  WHERE (p.title IS NULL OR p.title = '')
                    AND NOT EXISTS (SELECT 1 FROM product_sources ps WHERE ps.product_id = p.id)
                )
              `);
              await db.execute(sql`
                DELETE FROM product_images pi
                WHERE pi.product_id IN (
                  SELECT p.id FROM products p
                  WHERE (p.title IS NULL OR p.title = '')
                    AND NOT EXISTS (SELECT 1 FROM product_sources ps WHERE ps.product_id = p.id)
                )
              `);
              await db.execute(sql`
                DELETE FROM product_tags pt
                WHERE pt.product_id IN (
                  SELECT p.id FROM products p
                  WHERE (p.title IS NULL OR p.title = '')
                    AND NOT EXISTS (SELECT 1 FROM product_sources ps WHERE ps.product_id = p.id)
                )
              `);
              await db.execute(sql`
                DELETE FROM products p
                WHERE (p.title IS NULL OR p.title = '')
                  AND NOT EXISTS (SELECT 1 FROM product_sources ps WHERE ps.product_id = p.id)
              `);
              stats.fixed += stats.emptyProducts;
            }
          }
        } catch (error) {
          const msg = `空商品チェック/修正エラー: ${error instanceof Error ? error.message : 'Unknown'}`;
          console.error(`[cleanup] ${msg}`);
          errors.push(msg);
        }
      }

      // 4. 期限切れセールのクリーンアップ（常に実行）
      if (Date.now() - startTime < TIME_LIMIT) {
        try {
          // product_sales.is_active を FALSE に（期限切れ分）
          const expiredResult = await db.execute(sql`
            UPDATE product_sales
            SET is_active = FALSE, updated_at = NOW()
            WHERE is_active = TRUE AND end_at IS NOT NULL AND end_at < NOW()
          `);
          stats.expiredSales = (expiredResult as { rowCount?: number }).rowCount ?? 0;

          if (stats.expiredSales > 0) {
            issues.push(`期限切れセール非アクティブ化: ${stats.expiredSales}件`);

            // has_active_sale フラグを更新（現在trueの商品のみ再計算）
            const flagResult = await db.execute(sql`
              UPDATE products p
              SET has_active_sale = EXISTS (
                SELECT 1 FROM product_sources ps
                JOIN product_sales psl ON psl.product_source_id = ps.id
                WHERE ps.product_id = p.id AND psl.is_active = TRUE
                  AND (psl.end_at IS NULL OR psl.end_at > NOW())
              ), updated_at = NOW()
              WHERE p.has_active_sale = TRUE
            `);
            stats.saleFlagsUpdated = (flagResult as { rowCount?: number }).rowCount ?? 0;

            console.log(`[cleanup] セール期限切れ処理: expired=${stats.expiredSales}, flags_updated=${stats.saleFlagsUpdated}`);
          }
        } catch (error) {
          const msg = `セール期限切れ処理エラー: ${error instanceof Error ? error.message : 'Unknown'}`;
          console.error(`[cleanup] ${msg}`);
          errors.push(msg);
        }
      }

      return buildResponse(stats, issues, errors, action, type, startTime);

    } catch (error) {
      console.error('[cleanup] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stats,
          errors,
        },
        { status: 500 }
      );
    }
  };

  function buildResponse(
    stats: CleanupStats,
    issues: string[],
    errors: string[],
    action: string,
    type: string,
    startTime: number,
  ) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    const totalIssues = stats.duplicateProducts + stats.duplicatePerformers +
                        stats.orphanedProductSources + stats.orphanedProductVideos +
                        stats.orphanedProductPerformers + stats.emptyProducts;

    return NextResponse.json({
      success: errors.length === 0,
      message: action === 'fix'
        ? `Cleanup completed: ${stats.fixed} issues fixed${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
        : `Check completed: ${totalIssues} issues found`,
      params: { action, type },
      issues,
      errors,
      stats,
      duration: `${duration}s`,
    });
  }
}
