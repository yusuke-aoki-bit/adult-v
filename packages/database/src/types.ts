/**
 * Drizzleテーブルの型定義
 * DI（依存性注入）パターンで使用するための型エクスポート
 */

import type { PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import {
  products,
  productSources,
  productPerformers,
  productTags,
  productImages,
  productVideos,
  productSales,
  productRatingSummary,
  performers,
  performerAliases,
  tags,
} from './schema';

// ============================================================
// テーブル型（DIで使用）
// ============================================================

/** productsテーブルの型 */
export type ProductsTable = typeof products;

/** productSourcesテーブルの型 */
export type ProductSourcesTable = typeof productSources;

/** productPerformersテーブルの型 */
export type ProductPerformersTable = typeof productPerformers;

/** productTagsテーブルの型 */
export type ProductTagsTable = typeof productTags;

/** productImagesテーブルの型 */
export type ProductImagesTable = typeof productImages;

/** productVideosテーブルの型 */
export type ProductVideosTable = typeof productVideos;

/** productSalesテーブルの型 */
export type ProductSalesTable = typeof productSales;

/** productRatingSummaryテーブルの型 */
export type ProductRatingSummaryTable = typeof productRatingSummary;

/** performersテーブルの型 */
export type PerformersTable = typeof performers;

/** performerAliasesテーブルの型 */
export type PerformerAliasesTable = typeof performerAliases;

/** tagsテーブルの型 */
export type TagsTable = typeof tags;

// ============================================================
// データベース型
// ============================================================

/** Drizzle DBインスタンスの型 */
export type DrizzleDb = NodePgDatabase;

/** getDb関数の型 */
export type GetDbFn = () => DrizzleDb;

// ============================================================
// 汎用テーブル型（型パラメータ付き）
// ============================================================

/** 任意のPgテーブル型 */
export type AnyPgTable = PgTableWithColumns<TableConfig>;
