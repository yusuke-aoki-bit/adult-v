/**
 * セール情報保存ヘルパー
 */

import { getDb } from './db';
import {
  createSaleHelperQueries,
  type SaleInfo,
} from '@adult-v/shared/db-queries';

// 依存性を注入してクエリを生成
const queries = createSaleHelperQueries({
  getDb: getDb as Parameters<typeof createSaleHelperQueries>[0]['getDb'],
});

// Re-export type
export type { SaleInfo };

// Re-export functions
export const saveSaleInfo = queries.saveSaleInfo;
export const deactivateSale = queries.deactivateSale;
export const deactivateExpiredSales = queries.deactivateExpiredSales;
