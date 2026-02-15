/**
 * バッチDB操作ユーティリティ
 *
 * cron-handlers内のN+1クエリや逐次INSERT/UPDATEを
 * バッチ操作に置き換えるための共通関数群
 */

import { sql } from 'drizzle-orm';
import type { DbExecutor } from '../db-queries/types';

const CHUNK_SIZE = 500;

/** チャンク分割ヘルパー */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ============================================================
// performers テーブル用
// ============================================================

export interface PerformerUpsertData {
  name: string;
  nameKana?: string | null;
  profileImageUrl?: string | null;
}

/**
 * performers テーブルへのバッチUPSERT
 * INSERT ... ON CONFLICT (name) DO UPDATE SET で一括処理
 * @returns 挿入/更新された performer の { id, name } リスト
 */
export async function batchUpsertPerformers(
  db: DbExecutor,
  performers: PerformerUpsertData[],
): Promise<{ id: number; name: string }[]> {
  if (performers.length === 0) return [];

  const results: { id: number; name: string }[] = [];

  for (const batch of chunk(performers, CHUNK_SIZE)) {
    // VALUES句を構築
    const valuesClauses = batch.map(
      (p) => sql`(${p.name}, ${p.nameKana ?? null}, ${p.profileImageUrl ?? null})`
    );

    // sql.join で結合
    const valuesJoined = sql.join(valuesClauses, sql`, `);

    const result = await db.execute(sql`
      INSERT INTO performers (name, name_kana, profile_image_url)
      VALUES ${valuesJoined}
      ON CONFLICT (name) DO UPDATE SET
        name_kana = COALESCE(EXCLUDED.name_kana, performers.name_kana),
        profile_image_url = COALESCE(EXCLUDED.profile_image_url, performers.profile_image_url)
      RETURNING id, name
    `);

    for (const row of result.rows) {
      results.push({ id: row['id'] as number, name: row['name'] as string });
    }
  }

  return results;
}

/**
 * performers テーブルから名前で一括検索
 * @returns Map<name, id>
 */
export async function batchLookupPerformersByName(
  db: DbExecutor,
  names: string[],
): Promise<Map<string, number>> {
  if (names.length === 0) return new Map();

  const map = new Map<string, number>();

  for (const batch of chunk(names, CHUNK_SIZE)) {
    const nameValues = sql.join(batch.map(n => sql`${n}`), sql`, `);
    const result = await db.execute(sql`
      SELECT id, name FROM performers WHERE name IN (${nameValues})
    `);

    for (const row of result.rows) {
      map.set(row['name'] as string, row['id'] as number);
    }
  }

  return map;
}

// ============================================================
// product_performers 中間テーブル用
// ============================================================

export interface ProductPerformerLink {
  productId: number;
  performerId: number;
}

/**
 * product_performers テーブルへのバッチINSERT
 * ON CONFLICT DO NOTHING で重複を安全にスキップ
 * @returns 挿入された件数
 */
export async function batchInsertProductPerformers(
  db: DbExecutor,
  links: ProductPerformerLink[],
): Promise<number> {
  if (links.length === 0) return 0;

  // 重複除去
  const unique = new Map<string, ProductPerformerLink>();
  for (const link of links) {
    const key = `${link.productId}:${link.performerId}`;
    unique.set(key, link);
  }
  const uniqueLinks = [...unique.values()];

  let insertedCount = 0;

  for (const batch of chunk(uniqueLinks, CHUNK_SIZE)) {
    const valuesClauses = batch.map(
      (l) => sql`(${l.productId}, ${l.performerId})`
    );
    const valuesJoined = sql.join(valuesClauses, sql`, `);

    const result = await db.execute(sql`
      INSERT INTO product_performers (product_id, performer_id)
      VALUES ${valuesJoined}
      ON CONFLICT DO NOTHING
    `);

    insertedCount += result.rowCount ?? 0;
  }

  return insertedCount;
}

// ============================================================
// 汎用バッチUPDATE
// ============================================================

export interface BatchUpdateEntry<T> {
  id: number;
  value: T;
}

/**
 * 汎用バッチUPDATE（CASE WHEN式で1クエリN件更新）
 *
 * 例: batchUpdateColumn(db, 'performers', 'id', 'release_count', updates)
 * → UPDATE performers SET release_count = CASE
 *     WHEN id = 1 THEN 10
 *     WHEN id = 2 THEN 20
 *   END
 *   WHERE id IN (1, 2)
 */
export async function batchUpdateColumn(
  db: DbExecutor,
  tableName: string,
  idColumn: string,
  valueColumn: string,
  updates: BatchUpdateEntry<string | number | boolean | null>[],
): Promise<number> {
  if (updates.length === 0) return 0;

  let totalUpdated = 0;

  for (const batch of chunk(updates, CHUNK_SIZE)) {
    // CASE WHEN 式を構築
    const caseClauses = batch.map(
      (u) => sql`WHEN ${sql.raw(idColumn)} = ${u.id} THEN ${u.value}`
    );
    const caseJoined = sql.join(caseClauses, sql` `);

    // WHERE IN のIDリスト
    const ids = sql.join(batch.map(u => sql`${u.id}`), sql`, `);

    const result = await db.execute(sql`
      UPDATE ${sql.raw(tableName)}
      SET ${sql.raw(valueColumn)} = CASE ${caseJoined} END
      WHERE ${sql.raw(idColumn)} IN (${ids})
    `);

    totalUpdated += result.rowCount ?? 0;
  }

  return totalUpdated;
}

/**
 * 汎用バッチDELETE（WHERE id IN で一括削除）
 */
export async function batchDelete(
  db: DbExecutor,
  tableName: string,
  idColumn: string,
  ids: number[],
): Promise<number> {
  if (ids.length === 0) return 0;

  let totalDeleted = 0;

  for (const batch of chunk(ids, CHUNK_SIZE)) {
    const idValues = sql.join(batch.map(id => sql`${id}`), sql`, `);

    const result = await db.execute(sql`
      DELETE FROM ${sql.raw(tableName)}
      WHERE ${sql.raw(idColumn)} IN (${idValues})
    `);

    totalDeleted += result.rowCount ?? 0;
  }

  return totalDeleted;
}

/**
 * 複数カラムを同時にバッチUPDATE
 *
 * 例: batchUpdateMultipleColumns(db, 'performers', 'id', [
 *   { id: 1, values: { release_count: 10, latest_release_date: '2024-01-01' } },
 *   { id: 2, values: { release_count: 20, latest_release_date: '2024-02-01' } },
 * ])
 */
export async function batchUpdateMultipleColumns(
  db: DbExecutor,
  tableName: string,
  idColumn: string,
  updates: { id: number; values: Record<string, string | number | boolean | null> }[],
): Promise<number> {
  if (updates.length === 0) return 0;

  let totalUpdated = 0;

  for (const batch of chunk(updates, CHUNK_SIZE)) {
    // 更新対象のカラム一覧を取得
    const columns = Object.keys(batch[0]!.values);
    if (columns.length === 0) continue;

    // 各カラムの CASE WHEN 式を構築
    const setClauses = columns.map((col) => {
      const caseClauses = batch.map(
        (u) => sql`WHEN ${sql.raw(idColumn)} = ${u.id} THEN ${u.values[col] ?? null}`
      );
      const caseJoined = sql.join(caseClauses, sql` `);
      return sql`${sql.raw(col)} = CASE ${caseJoined} END`;
    });
    const setJoined = sql.join(setClauses, sql`, `);

    // WHERE IN のIDリスト
    const ids = sql.join(batch.map(u => sql`${u.id}`), sql`, `);

    const result = await db.execute(sql`
      UPDATE ${sql.raw(tableName)}
      SET ${setJoined}
      WHERE ${sql.raw(idColumn)} IN (${ids})
    `);

    totalUpdated += result.rowCount ?? 0;
  }

  return totalUpdated;
}
