/**
 * ニュース自動生成 Cron ハンドラー
 *
 * 1日1回実行:
 * - 新着まとめ (new_releases): 直近24hの新着作品集計
 * - セール速報 (sales): 新規開始セール検出
 * - AI分析 (ai_analysis): 週1回（月曜のみ）トレンド分析
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import type { DbExecutor } from '../db-queries/types';

interface GenerateNewsStats {
  newReleasesGenerated: boolean;
  salesGenerated: boolean;
  aiAnalysisGenerated: boolean;
  errors: string[];
}

interface GenerateNewsDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
  generateNewsContent: (params: {
    type: 'new_releases' | 'sales' | 'ai_analysis';
    data: Record<string, unknown>;
  }) => Promise<{ title: string; excerpt: string; content: string } | null>;
}

function generateSlug(prefix: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${dateStr}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Strip stale/hallucinated dates from AI-generated titles and replace with today's date */
function sanitizeNewsTitle(title: string): string {
  const now = new Date();
  const todayStr = `${now.getMonth() + 1}月${now.getDate()}日`;
  // Replace placeholder dates like 〇月〇日 (handles both U+3007 and U+25CB)
  let sanitized = title.replace(/[〇○]月[〇○]日/g, todayStr);
  // Strip old parenthesized dates like (2024/05/15) or （2024/05/15）
  sanitized = sanitized.replace(/[（(]20\d{2}[/／]\d{1,2}[/／]\d{1,2}[)）]/g, '');
  // Strip old bracketed dates like 【2024/05/15】 or 【〇月〇日】
  sanitized = sanitized.replace(/【20\d{2}[/／]\d{1,2}[/／]\d{1,2}】/g, `【${todayStr}】`);
  sanitized = sanitized.replace(/【[〇○]月[〇○]日】/g, `【${todayStr}】`);
  return sanitized.trim();
}

export function createGenerateNewsHandler(deps: GenerateNewsDeps) {
  return async function GET(request: NextRequest) {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const db = deps.getDb();
    const stats: GenerateNewsStats = {
      newReleasesGenerated: false,
      salesGenerated: false,
      aiAnalysisGenerated: false,
      errors: [],
    };

    // === 1. 新着まとめ ===
    try {
      // 同日の new_releases が既にあればスキップ
      const existingNewReleases = await db.execute(sql`
        SELECT id FROM news_articles
        WHERE category = 'new_releases'
          AND published_at >= CURRENT_DATE
        LIMIT 1
      `);

      if (existingNewReleases.rows.length === 0) {
        // 直近24hの新着作品を集計
        const newProductsResult = await db.execute(sql`
          SELECT
            COUNT(*) as total_count,
            COUNT(CASE WHEN ps.asp_name = 'FANZA' THEN 1 END) as fanza_count,
            COUNT(CASE WHEN ps.asp_name = 'MGS' THEN 1 END) as mgs_count,
            COUNT(CASE WHEN ps.asp_name = 'DUGA' THEN 1 END) as duga_count,
            COUNT(CASE WHEN ps.asp_name = 'SOKMIL' THEN 1 END) as sokmil_count,
            COUNT(CASE WHEN ps.asp_name = 'DTI' THEN 1 END) as dti_count,
            COUNT(CASE WHEN ps.asp_name = 'FC2' THEN 1 END) as fc2_count
          FROM products p
          JOIN product_sources ps ON p.id = ps.product_id
          WHERE p.created_at >= NOW() - INTERVAL '24 hours'
        `);

        const counts = newProductsResult.rows[0] as Record<string, number>;
        const totalCount = Number(counts['total_count'] || 0);

        if (totalCount > 0) {
          // 注目の新着（レビュー付き or 人気女優出演）
          const topNewProducts = await db.execute(sql`
            SELECT p.title, p.normalized_product_id
            FROM products p
            WHERE p.created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY p.created_at DESC
            LIMIT 5
          `);

          const newsContent = await deps.generateNewsContent({
            type: 'new_releases',
            data: {
              totalCount,
              fanzaCount: Number(counts['fanza_count'] || 0),
              mgsCount: Number(counts['mgs_count'] || 0),
              dugaCount: Number(counts['duga_count'] || 0),
              sokmilCount: Number(counts['sokmil_count'] || 0),
              dtiCount: Number(counts['dti_count'] || 0),
              fc2Count: Number(counts['fc2_count'] || 0),
              topProducts: topNewProducts.rows,
            },
          });

          if (newsContent) {
            const slug = generateSlug('new-releases');
            await db.execute(sql`
              INSERT INTO news_articles (slug, category, title, excerpt, content, source, status, published_at)
              VALUES (${slug}, 'new_releases', ${sanitizeNewsTitle(newsContent.title)}, ${newsContent.excerpt}, ${newsContent.content}, 'auto', 'published', NOW())
            `);
            stats.newReleasesGenerated = true;
          }
        }
      }
    } catch (error) {
      const msg = `[new_releases] ${error instanceof Error ? error.message : 'Unknown'}`;
      stats.errors.push(msg);
      console.error(msg);
    }

    // === 2. セール速報 ===
    try {
      const existingSales = await db.execute(sql`
        SELECT id FROM news_articles
        WHERE category = 'sales'
          AND published_at >= CURRENT_DATE
        LIMIT 1
      `);

      if (existingSales.rows.length === 0) {
        // 新規開始セールを検出
        const newSalesResult = await db.execute(sql`
          SELECT
            COUNT(*) as sale_count,
            MAX(ps.discount_percent) as max_discount,
            MIN(ps.end_at) as earliest_end
          FROM product_sales ps
          WHERE ps.start_at >= CURRENT_DATE - INTERVAL '1 day'
            AND ps.start_at <= CURRENT_DATE
        `);

        const saleData = newSalesResult.rows[0] as Record<string, unknown>;
        const saleCount = Number(saleData['sale_count'] || 0);

        if (saleCount > 0) {
          const newsContent = await deps.generateNewsContent({
            type: 'sales',
            data: {
              saleCount,
              maxDiscount: Number(saleData['max_discount'] || 0),
              earliestEnd: saleData['earliest_end'],
            },
          });

          if (newsContent) {
            const slug = generateSlug('sales');
            const expiresAt = saleData['earliest_end'] || null;
            await db.execute(sql`
              INSERT INTO news_articles (slug, category, title, excerpt, content, source, status, published_at, expires_at)
              VALUES (${slug}, 'sales', ${sanitizeNewsTitle(newsContent.title)}, ${newsContent.excerpt}, ${newsContent.content}, 'auto', 'published', NOW(), ${expiresAt as string | null})
            `);
            stats.salesGenerated = true;
          }
        }
      }
    } catch (error) {
      const msg = `[sales] ${error instanceof Error ? error.message : 'Unknown'}`;
      stats.errors.push(msg);
      console.error(msg);
    }

    // === 3. AI分析（月曜のみ） ===
    try {
      const today = new Date();
      const isMonday = today.getUTCDay() === 1;

      if (isMonday) {
        const existingAnalysis = await db.execute(sql`
          SELECT id FROM news_articles
          WHERE category = 'ai_analysis'
            AND published_at >= CURRENT_DATE
          LIMIT 1
        `);

        if (existingAnalysis.rows.length === 0) {
          // 週間トレンド: 急上昇女優
          const trendingPerformers = await db.execute(sql`
            SELECT pe.name, COUNT(*) as product_count
            FROM product_performers pp
            JOIN performers pe ON pp.performer_id = pe.id
            JOIN products p ON pp.product_id = p.id
            WHERE p.created_at >= NOW() - INTERVAL '7 days'
            GROUP BY pe.id, pe.name
            ORDER BY product_count DESC
            LIMIT 10
          `);

          // 週間新着数の推移
          const weeklyStats = await db.execute(sql`
            SELECT
              COUNT(*) as total_products,
              COUNT(DISTINCT pp.performer_id) as unique_performers
            FROM products p
            LEFT JOIN product_performers pp ON p.id = pp.product_id
            WHERE p.created_at >= NOW() - INTERVAL '7 days'
          `);

          const newsContent = await deps.generateNewsContent({
            type: 'ai_analysis',
            data: {
              trendingPerformers: trendingPerformers.rows,
              weeklyStats: weeklyStats.rows[0],
            },
          });

          if (newsContent) {
            const slug = generateSlug('weekly-analysis');
            await db.execute(sql`
              INSERT INTO news_articles (slug, category, title, excerpt, content, source, ai_model, status, featured, published_at)
              VALUES (${slug}, 'ai_analysis', ${sanitizeNewsTitle(newsContent.title)}, ${newsContent.excerpt}, ${newsContent.content}, 'gemini', 'gemini-2.0-flash', 'published', true, NOW())
            `);
            stats.aiAnalysisGenerated = true;
          }
        }
      }
    } catch (error) {
      const msg = `[ai_analysis] ${error instanceof Error ? error.message : 'Unknown'}`;
      stats.errors.push(msg);
      console.error(msg);
    }

    return NextResponse.json({
      success: stats.errors.length === 0,
      message: 'News generation completed',
      stats,
    });
  };
}
