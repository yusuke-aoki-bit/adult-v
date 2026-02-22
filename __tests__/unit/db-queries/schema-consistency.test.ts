/**
 * DBスキーマとAPIクエリのカラム名一致テスト
 *
 * このテストは、APIで使用されるカラム名が実際のDBスキーマと
 * 一致していることを確認します。
 *
 * 背景: normalized_id vs normalized_product_id のような
 * カラム名の不一致によるランタイムエラーを防止
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// プロジェクトルートからの相対パス
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

describe('DBスキーマとAPIカラム名の一致', () => {
  describe('productsテーブル', () => {
    // DBスキーマで定義されているカラム名
    const productsColumns = [
      'id',
      'title',
      'normalized_product_id',  // NOT 'normalized_id'
      'default_thumbnail_url',
      'release_date',
      'duration_seconds',
      'created_at',
      'updated_at',
    ];

    it('price-history.tsがnormalized_product_idを使用', () => {
      const filePath = path.join(PROJECT_ROOT, 'packages/shared/src/db-queries/price-history.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // 正しいカラム名を使用していることを確認
      expect(content).toContain('p.normalized_product_id');

      // 間違ったカラム名を使用していないことを確認
      expect(content).not.toContain('p.normalized_id =');
    });

    it('also-viewed ハンドラーがnormalized_product_idを使用', () => {
      const filePath = path.join(PROJECT_ROOT, 'packages/shared/src/api-handlers/also-viewed.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // normalized_product_idのエイリアスとして使用
      expect(content).toContain('normalized_product_id');
    });
  });

  describe('product_viewsテーブル', () => {
    // DBスキーマで定義されているカラム名
    const productViewsColumns = [
      'id',
      'product_id',
      'session_id',  // 協調フィルタリングに必要
      'viewed_at',
      'created_at',
    ];

    it('also-viewed ハンドラーがsession_idカラムを使用', () => {
      const filePath = path.join(PROJECT_ROOT, 'packages/shared/src/api-handlers/also-viewed.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // session_idを使用した協調フィルタリングクエリ
      expect(content).toContain('session_id');
      expect(content).toContain('SELECT DISTINCT session_id');
    });
  });

  describe('price_historyテーブル', () => {
    // DBスキーマで定義されているカラム名（0032_add_price_history.sql）
    const priceHistoryColumns = [
      'id',
      'product_source_id',
      'price',
      'sale_price',
      'discount_percent',
      'recorded_at',
    ];

    it('price-history.tsがスキーマ定義のカラム名を使用', () => {
      const filePath = path.join(PROJECT_ROOT, 'packages/shared/src/db-queries/price-history.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // スキーマで定義されたカラム名を使用
      priceHistoryColumns.forEach(column => {
        expect(content).toContain(column);
      });
    });
  });

  describe('product_sourcesテーブル', () => {
    it('asp_nameカラムを使用', () => {
      const filePath = path.join(PROJECT_ROOT, 'packages/shared/src/db-queries/price-history.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('ps.asp_name');
    });
  });

  describe('sale_patternsテーブル', () => {
    // DBスキーマで定義されているカラム名（0033_add_sale_patterns.sql）
    // 実際のスキーマはproduct_source_id, performer_id, maker_idを使用
    const salePatternsColumns = [
      'id',
      'product_source_id',
      'performer_id',
      'maker_id',
      'pattern_type',
      'avg_discount_percent',
      'last_sale_date',
      'created_at',
    ];

    it('sale_patternsテーブルが正しいカラム名で定義', () => {
      const filePath = path.join(PROJECT_ROOT, 'drizzle/migrations/0033_add_sale_patterns.sql');
      const content = fs.readFileSync(filePath, 'utf-8');

      // 主要カラムの存在確認
      expect(content).toContain('product_source_id');
      expect(content).toContain('pattern_type');
      expect(content).toContain('avg_discount_percent');
    });
  });
});

describe('マイグレーションファイルの整合性', () => {
  it('price_historyテーブルのマイグレーションが存在', () => {
    const filePath = path.join(PROJECT_ROOT, 'drizzle/migrations/0032_add_price_history.sql');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('sale_patternsテーブルのマイグレーションが存在', () => {
    const filePath = path.join(PROJECT_ROOT, 'drizzle/migrations/0033_add_sale_patterns.sql');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('product_views session_idインデックスのマイグレーションが存在', () => {
    const filePath = path.join(PROJECT_ROOT, 'drizzle/migrations/0031_add_additional_performance_indexes.sql');
    const content = fs.readFileSync(filePath, 'utf-8');

    // session_idを使用したインデックス定義
    expect(content).toContain('session_id');
  });
});
