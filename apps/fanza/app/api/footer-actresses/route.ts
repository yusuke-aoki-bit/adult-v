/**
 * フッター用女優リストAPI
 * GSCデータに基づいて動的に更新される女優リストを返す
 */

import { getDb } from '@/lib/db';
import { footerFeaturedActresses } from '@/lib/db/schema';
import { createFooterActressesHandler } from '@adult-v/shared/api-handlers';

// 1時間キャッシュ
export const revalidate = 3600;

export const GET = createFooterActressesHandler({
  getDb,
  footerFeaturedActresses,
});
