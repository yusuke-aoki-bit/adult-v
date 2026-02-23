/**
 * ニュースクエリ
 */

import { sql } from 'drizzle-orm';
import { logDbErrorAndReturn } from '../lib/db-logger';
import type { DbExecutor } from './types';

export interface NewsArticleRow {
  id: number;
  slug: string;
  category: string;
  title: string;
  title_en: string | null;
  excerpt: string | null;
  content: string;
  image_url: string | null;
  source: string | null;
  source_url: string | null;
  status: string;
  featured: boolean;
  view_count: number;
  published_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsQueryDeps {
  getDb: () => DbExecutor;
}

export function createNewsQueries(deps: NewsQueryDeps) {
  const { getDb } = deps;

  return {
    /**
     * 最新ニュース取得（トップページ用）
     * featured記事を優先的に返す
     */
    async getLatestNews(limit = 5): Promise<NewsArticleRow[]> {
      try {
        const db = getDb();
        const result = await db.execute(sql`
          SELECT id, slug, category, title, title_en, excerpt, content,
                 image_url, source, source_url, status, featured,
                 view_count, published_at, expires_at, created_at, updated_at
          FROM news_articles
          WHERE status = 'published'
            AND (expires_at IS NULL OR expires_at > NOW())
          ORDER BY featured DESC, published_at DESC
          LIMIT ${limit}
        `);
        return result.rows as unknown as NewsArticleRow[];
      } catch (error) {
        return logDbErrorAndReturn(error, [], 'getLatestNews');
      }
    },

    /**
     * カテゴリ別ニュース取得（/newsページ用）
     */
    async getNewsByCategory(
      category: string | null,
      page = 1,
      limit = 20,
    ): Promise<{ articles: NewsArticleRow[]; total: number }> {
      try {
        const db = getDb();
        const offset = (page - 1) * limit;

        let articlesQuery;
        let countQuery;

        if (category) {
          articlesQuery = sql`
            SELECT id, slug, category, title, title_en, excerpt, content,
                   image_url, source, source_url, status, featured,
                   view_count, published_at, expires_at, created_at, updated_at
            FROM news_articles
            WHERE status = 'published'
              AND category = ${category}
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY published_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `;
          countQuery = sql`
            SELECT COUNT(*)::int as total
            FROM news_articles
            WHERE status = 'published'
              AND category = ${category}
              AND (expires_at IS NULL OR expires_at > NOW())
          `;
        } else {
          articlesQuery = sql`
            SELECT id, slug, category, title, title_en, excerpt, content,
                   image_url, source, source_url, status, featured,
                   view_count, published_at, expires_at, created_at, updated_at
            FROM news_articles
            WHERE status = 'published'
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY published_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `;
          countQuery = sql`
            SELECT COUNT(*)::int as total
            FROM news_articles
            WHERE status = 'published'
              AND (expires_at IS NULL OR expires_at > NOW())
          `;
        }

        const [articlesResult, countResult] = await Promise.all([db.execute(articlesQuery), db.execute(countQuery)]);

        return {
          articles: articlesResult.rows as unknown as NewsArticleRow[],
          total: (countResult.rows[0] as { total: number })?.total || 0,
        };
      } catch (error) {
        return logDbErrorAndReturn(error, { articles: [], total: 0 }, 'getNewsByCategory');
      }
    },

    /**
     * スラッグでニュース取得（詳細ページ用）
     */
    async getNewsBySlug(slug: string): Promise<NewsArticleRow | null> {
      try {
        const db = getDb();
        const result = await db.execute(sql`
          SELECT id, slug, category, title, title_en, excerpt, content,
                 image_url, source, source_url, status, featured,
                 view_count, published_at, expires_at, created_at, updated_at
          FROM news_articles
          WHERE slug = ${slug} AND status = 'published'
          LIMIT 1
        `);

        if (result.rows.length === 0) return null;

        // view_count を更新（fire and forget）
        db.execute(
          sql`
          UPDATE news_articles SET view_count = view_count + 1 WHERE slug = ${slug}
        `,
        ).catch(() => {});

        return result.rows[0] as unknown as NewsArticleRow;
      } catch (error) {
        return logDbErrorAndReturn(error, null, 'getNewsBySlug');
      }
    },
  };
}
