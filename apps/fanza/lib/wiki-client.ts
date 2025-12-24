/**
 * AV Wiki / Seesaa Wiki クライアント
 * Re-exports from shared package
 */
export {
  fetchAVWikiData,
  fetchSeesaaWikiData,
  fetchActressWikiData,
} from '@adult-v/shared/lib/wiki-client';

export type { ActressWikiData } from '@adult-v/shared/lib/wiki-client';
