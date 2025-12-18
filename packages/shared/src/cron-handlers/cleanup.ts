/**
 * データクリーンアップ API ハンドラー
 *
 * データベースの整合性チェックと重複データのクリーンアップ
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '../lib/cron-auth';
import type { SQL } from 'drizzle-orm';

export interface CleanupHandlerDeps {
  getDb: () => {
    execute: (sql: SQL) => Promise<{ rows: unknown[] }>;
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
  fixed: number;
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
      fixed: 0,
    };

    try {
      const url = new URL(request.url);
      const action = url.searchParams.get('action') || 'check';
      const type = url.searchParams.get('type') || 'all';

      console.log(`[cleanup] Starting: action=${action}, type=${type}`);

      const issues: string[] = [];

      // 1. 重複商品チェック（同じnormalized_product_idで複数レコード）
      if (type === 'all' || type === 'duplicates') {
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
            // 重複を解消（最新のレコードを残す）
            for (const row of duplicateProductsResult.rows as { normalized_product_id: string }[]) {
              await db.execute(sql`
                DELETE FROM products
                WHERE normalized_product_id = ${row.normalized_product_id}
                  AND id NOT IN (
                    SELECT MAX(id) FROM products WHERE normalized_product_id = ${row.normalized_product_id}
                  )
              `);
              stats.fixed++;
            }
          }
        }

        // 重複出演者チェック
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
            for (const row of duplicatePerformersResult.rows as { name: string }[]) {
              // 最小IDを取得
              const minIdResult = await db.execute(sql`
                SELECT MIN(id) as min_id FROM performers WHERE name = ${row.name}
              `);
              const minId = (minIdResult.rows[0] as { min_id: number }).min_id;

              // 他のIDの関連を最小IDに移行
              await db.execute(sql`
                UPDATE product_performers
                SET performer_id = ${minId}
                WHERE performer_id IN (
                  SELECT id FROM performers WHERE name = ${row.name} AND id != ${minId}
                )
                ON CONFLICT DO NOTHING
              `);

              // 重複レコードを削除
              await db.execute(sql`
                DELETE FROM performers
                WHERE name = ${row.name} AND id != ${minId}
              `);
              stats.fixed++;
            }
          }
        }
      }

      // 2. 孤立レコードチェック
      if (type === 'all' || type === 'orphans') {
        // 孤立product_sources（存在しないproduct_idを参照）
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

        // 孤立product_videos
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

        // 孤立product_performers
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
      }

      // 3. 空の商品チェック（タイトルなし）
      if (type === 'all' || type === 'empty') {
        const emptyProductsResult = await db.execute(sql`
          SELECT COUNT(*) as cnt FROM products
          WHERE title IS NULL OR title = ''
        `);
        stats.emptyProducts = parseInt((emptyProductsResult.rows[0] as { cnt: string }).cnt);

        if (stats.emptyProducts > 0) {
          issues.push(`タイトルなし商品: ${stats.emptyProducts}件`);

          if (action === 'fix') {
            await db.execute(sql`
              DELETE FROM products
              WHERE title IS NULL OR title = ''
            `);
            stats.fixed += stats.emptyProducts;
          }
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      const totalIssues = stats.duplicateProducts + stats.duplicatePerformers +
                          stats.orphanedProductSources + stats.orphanedProductVideos +
                          stats.orphanedProductPerformers + stats.emptyProducts;

      return NextResponse.json({
        success: true,
        message: action === 'fix'
          ? `Cleanup completed: ${stats.fixed} issues fixed`
          : `Check completed: ${totalIssues} issues found`,
        params: { action, type },
        issues,
        stats,
        duration: `${duration}s`,
      });

    } catch (error) {
      console.error('[cleanup] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stats,
        },
        { status: 500 }
      );
    }
  };
}
