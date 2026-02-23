/**
 * News API Handler
 */

import { NextRequest, NextResponse } from 'next/server';
import type { NewsArticleRow } from '../db-queries/news-queries';

export interface NewsHandlerDeps {
  getLatestNews: (limit?: number) => Promise<NewsArticleRow[]>;
  getNewsByCategory: (
    category: string | null,
    page?: number,
    limit?: number,
  ) => Promise<{ articles: NewsArticleRow[]; total: number }>;
}

export function createNewsHandler(deps: NewsHandlerDeps) {
  return async function GET(request: NextRequest) {
    try {
      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const mode = url.searchParams.get('mode'); // 'latest' for top page

      if (mode === 'latest') {
        const articles = await deps.getLatestNews(limit);
        return NextResponse.json({ articles });
      }

      const result = await deps.getNewsByCategory(category, page, limit);
      return NextResponse.json(result);
    } catch (error) {
      console.error('[News API] Error:', error);
      return NextResponse.json({ articles: [], total: 0 });
    }
  };
}

export const newsRevalidate = 600; // 10分キャッシュ
