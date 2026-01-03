/**
 * フッター用内部リンクAPI
 * 人気ジャンル、シリーズ、メーカーを返す（SEO内部リンク強化用）
 */

import { getDb } from '@/lib/db';
import { tags, productTags } from '@/lib/db/schema';
import { createFooterLinksHandler } from '@adult-v/shared/api-handlers';

// 1時間キャッシュ
export const revalidate = 3600;

export const GET = createFooterLinksHandler({
  getDb,
  tags,
  productTags,
});
