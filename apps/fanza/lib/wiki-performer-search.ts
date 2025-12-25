/**
 * Wiki出演者インデックスから出演者名を検索
 * 商品タイトル、メーカー名から出演者を検索
 */

import { db } from './db';
import { wikiPerformerIndex } from './db/schema';
import {
  createWikiPerformerSearchQueries,
  type WikiPerformerSearchResult,
} from '@adult-v/shared/db-queries';

// 依存性を注入してクエリを生成
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queries = createWikiPerformerSearchQueries({
  db: db as any,
  wikiPerformerIndex: wikiPerformerIndex as any,
});

// Re-export type
export type { WikiPerformerSearchResult };

// Re-export functions
export const searchPerformerByMakerAndTitle =
  queries.searchPerformerByMakerAndTitle;
export const searchPerformerByName = queries.searchPerformerByName;
export const detectPerformerFromTitle = queries.detectPerformerFromTitle;
export const searchPerformerByProductCode = queries.searchPerformerByProductCode;
