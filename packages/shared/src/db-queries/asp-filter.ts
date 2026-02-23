/**
 * ASPフィルタ条件生成ユーティリティ
 * サイトモードに応じたSQLフィルタ条件を生成
 *
 * Note: DIパターンのため、テーブル型は any を使用
 * 将来的にはジェネリクスを使った型安全な実装を検討
 */
import { sql, SQL } from 'drizzle-orm';
import { buildAspNormalizationSql } from '../lib/asp-utils';

/**
 * サイトモード
 * - 'all': 全ASP対応（FANZA専用商品を除外）- adult-v用
 * - 'fanza-only': FANZA商品のみ - fanzaサイト用
 */
export type SiteMode = 'all' | 'fanza-only';

/**
 * ASPフィルタ条件を生成
 * @param productsTable - productsテーブル参照
 * @param productSourcesTable - product_sourcesテーブル参照
 * @param siteMode - サイトモード
 */
export function createAspFilterCondition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productsTable: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSourcesTable: any,
  siteMode: SiteMode,
): SQL {
  if (siteMode === 'fanza-only') {
    // FANZAサイト: FANZA商品のみを表示
    return sql`EXISTS (
      SELECT 1 FROM ${productSourcesTable} ps_fanza
      WHERE ps_fanza.product_id = ${productsTable.id}
      AND ps_fanza.asp_name = 'FANZA'
    )`;
  }

  // adult-v: FANZA専用商品を除外（他ASPがある商品は許可）
  return sql`(EXISTS (
    SELECT 1 FROM ${productSourcesTable} ps_check
    WHERE ps_check.product_id = ${productsTable.id}
    AND ps_check.asp_name != 'FANZA'
  ) OR NOT EXISTS (
    SELECT 1 FROM ${productSourcesTable} ps_fanza
    WHERE ps_fanza.product_id = ${productsTable.id}
    AND ps_fanza.asp_name = 'FANZA'
  ))`;
}

/**
 * プロバイダー名をASP名にマッピング（レジストリから導出）
 */
export { PROVIDER_TO_ASP_MAPPING } from '../asp-registry';
import { PROVIDER_TO_ASP_MAPPING } from '../asp-registry';

/**
 * プロバイダーフィルタ条件を生成
 */
export function createProviderFilterCondition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productsTable: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSourcesTable: any,
  provider: string,
): SQL {
  const aspNames = PROVIDER_TO_ASP_MAPPING[provider.toLowerCase()] || [provider];

  if (aspNames.length === 1) {
    return sql`EXISTS (
      SELECT 1 FROM ${productSourcesTable} ps
      WHERE ps.product_id = ${productsTable.id}
      AND ps.asp_name = ${aspNames[0]}
    )`;
  }

  return sql`EXISTS (
    SELECT 1 FROM ${productSourcesTable} ps
    WHERE ps.product_id = ${productsTable.id}
    AND ps.asp_name IN (${sql.join(
      aspNames.map((name) => sql`${name}`),
      sql`, `,
    )})
  )`;
}

/**
 * DTIサブサービスを含む複数プロバイダーフィルタ条件を生成
 * URLからDTIサブサービスを判定（buildAspNormalizationSqlを使用）
 */
export function createMultiProviderFilterCondition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productsTable: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSourcesTable: any,
  providers: string[],
): SQL {
  // サブクエリ内ではproduct_sourcesのaffiliate_urlを使用（外部テーブル参照を避ける）
  const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'ps.affiliate_url');
  return sql`EXISTS (
    SELECT 1 FROM ${productSourcesTable} ps
    WHERE ps.product_id = ${productsTable.id}
    AND (${sql.raw(aspNormalizeSql)}) IN (${sql.join(
      providers.map((p) => sql`${p.toLowerCase()}`),
      sql`, `,
    )})
  )`;
}

/**
 * DTIサブサービスを含む除外プロバイダーフィルタ条件を生成
 * URLからDTIサブサービスを判定（buildAspNormalizationSqlを使用）
 */
export function createExcludeProviderFilterCondition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productsTable: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productSourcesTable: any,
  excludeProviders: string[],
): SQL {
  // サブクエリ内ではproduct_sourcesのaffiliate_urlを使用（外部テーブル参照を避ける）
  const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'ps.affiliate_url');
  return sql`NOT EXISTS (
    SELECT 1 FROM ${productSourcesTable} ps
    WHERE ps.product_id = ${productsTable.id}
    AND (${sql.raw(aspNormalizeSql)}) IN (${sql.join(
      excludeProviders.map((p) => sql`${p.toLowerCase()}`),
      sql`, `,
    )})
  )`;
}

/**
 * 女優用ASPフィルタ条件を生成
 * @param performersTable - performersテーブル参照
 * @param siteMode - サイトモード
 */
export function createActressAspFilterCondition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  performersTable: any,
  siteMode: SiteMode,
): SQL {
  if (siteMode === 'fanza-only') {
    // FANZAサイト: FANZA商品に出演している女優のみ
    return sql`EXISTS (
      SELECT 1 FROM product_performers pp
      INNER JOIN product_sources ps ON pp.product_id = ps.product_id
      WHERE pp.performer_id = ${performersTable.id}
      AND ps.asp_name = 'FANZA'
    )`;
  }

  // adult-v: FANZA専用女優を除外（NULLも許可）
  return sql`(${performersTable.isFanzaOnly} = FALSE OR ${performersTable.isFanzaOnly} IS NULL)`;
}
