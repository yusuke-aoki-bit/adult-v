/**
 * セール予測API
 * 過去のセール履歴に基づいて将来のセール確率を予測
 */

import { getDb, sql } from '@adult-v/database';
import { createSalePredictionHandler } from '@adult-v/shared/api-handlers';

export const GET = createSalePredictionHandler({
  getDb,
  sql,
});
