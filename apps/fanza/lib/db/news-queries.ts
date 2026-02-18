/**
 * ニュースDBクエリ
 * 共有パッケージのファクトリーを使用
 */
import { getDb } from './index';
import { createNewsQueries } from '@adult-v/shared/db-queries';

const queries = createNewsQueries({
  getDb: getDb as never,
});

export const { getLatestNews, getNewsByCategory, getNewsBySlug } = queries;
