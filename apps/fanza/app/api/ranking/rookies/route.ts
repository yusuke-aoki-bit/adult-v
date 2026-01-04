import { getDb } from '@/lib/db';
import { performers, productPerformers, products } from '@adult-v/database';
import { eq, desc, gte, and, sql } from 'drizzle-orm';
import { createRookiePerformersHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 60; // 1分キャッシュ（ランキングは頻繁に更新）

export const GET = createRookiePerformersHandler({
  getDb,
  performers,
  productPerformers,
  products,
  eq,
  desc,
  gte,
  and,
  sql,
});
