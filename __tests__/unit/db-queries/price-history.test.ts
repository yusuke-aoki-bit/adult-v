/**
 * 価格履歴クエリのユニットテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPriceHistoryQueries } from '@adult-v/shared/db-queries/price-history';

// モックDB
const mockExecute = vi.fn();
const mockGetDb = () => ({
  execute: mockExecute,
});

describe('createPriceHistoryQueries', () => {
  const queries = createPriceHistoryQueries(mockGetDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordPrice', () => {
    it('価格履歴を正常に記録', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await queries.recordPrice(123, 1980, 980, 50);

      expect(result).toBe(true);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('sale_priceなしで記録可能', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await queries.recordPrice(123, 1980);

      expect(result).toBe(true);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('エラー時はfalseを返す', async () => {
      mockExecute.mockRejectedValueOnce(new Error('DB error'));

      const result = await queries.recordPrice(123, 1980);

      expect(result).toBe(false);
    });
  });

  describe('getPriceHistory', () => {
    it('価格履歴を取得', async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [
          { date: '2024-12-01', price: 1980, sale_price: 980, discount_percent: 50 },
          { date: '2024-11-15', price: 1980, sale_price: null, discount_percent: null },
        ],
      });

      const result = await queries.getPriceHistory(123);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2024-12-01',
        price: 1980,
        salePrice: 980,
        discountPercent: 50,
      });
      expect(result[1]!.salePrice).toBeUndefined();
    });

    it('空の結果を処理', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await queries.getPriceHistory(123);

      expect(result).toEqual([]);
    });

    it('オプションでlimitとdaysBackを指定可能', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      await queries.getPriceHistory(123, { limit: 30, daysBack: 90 });

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPriceHistoryByProductId', () => {
    it('normalized_product_idで価格履歴を取得', async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [
          { date: '2024-12-01', price: 1980, sale_price: 980, discount_percent: 50, asp_name: 'DMM' },
        ],
      });

      const result = await queries.getPriceHistoryByProductId('abc-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        date: '2024-12-01',
        price: 1980,
        salePrice: 980,
        discountPercent: 50,
        aspName: 'DMM',
      });
    });

    it('ASPフィルターを適用可能', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [] });

      await queries.getPriceHistoryByProductId('abc-123', { aspName: 'MGS' });

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPriceStats', () => {
    it('価格統計を取得', async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{
          min_price: 980,
          max_price: 2980,
          avg_price: 1500.5,
          min_sale_price: 500,
          max_discount: 75,
          record_count: 30,
          first_recorded: '2024-01-01',
          last_recorded: '2024-12-31',
        }],
      });

      const result = await queries.getPriceStats('abc-123');

      expect(result).toEqual({
        lowestPrice: 500,  // min_sale_priceが優先
        highestPrice: 2980,
        averagePrice: 1501, // 四捨五入
        maxDiscountPercent: 75,
        recordCount: 30,
        firstRecorded: '2024-01-01',
        lastRecorded: '2024-12-31',
      });
    });

    it('sale_priceがない場合はmin_priceを使用', async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{
          min_price: 980,
          max_price: 2980,
          avg_price: 1500,
          min_sale_price: null,
          max_discount: null,
          record_count: 10,
          first_recorded: '2024-01-01',
          last_recorded: '2024-12-31',
        }],
      });

      const result = await queries.getPriceStats('abc-123');

      expect(result?.lowestPrice).toBe(980);
      expect(result?.maxDiscountPercent).toBe(0);
    });

    it('記録がない場合はnullを返す', async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{ record_count: 0 }],
      });

      const result = await queries.getPriceStats('abc-123');

      expect(result).toBeNull();
    });

    it('ASPフィルターを適用可能', async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{ record_count: 0 }],
      });

      await queries.getPriceStats('abc-123', 'DMM');

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('batchRecordPrices', () => {
    it('バッチで価格を記録', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const records = [
        { productSourceId: 1, price: 1980 },
        { productSourceId: 2, price: 2980, salePrice: 1490, discountPercent: 50 },
      ];

      const result = await queries.batchRecordPrices(records);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('一部失敗時の集計', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('DB error'));

      const records = [
        { productSourceId: 1, price: 1980 },
        { productSourceId: 2, price: 2980 },
      ];

      const result = await queries.batchRecordPrices(records);

      // バッチサイズ100なので2件とも同じバッチで処理される
      // エラー時はバッチ全体がfailedになる
      expect(result.failed).toBeGreaterThan(0);
    });
  });
});

describe('SQLクエリのカラム名（ファイル検査）', () => {
  it('normalized_product_idカラムを使用（normalized_idではない）', async () => {
    // このテストは、price-history.tsファイルが
    // p.normalized_product_idを使用していることを確認
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(__dirname, '../../../packages/shared/src/db-queries/price-history.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // クエリ文字列にnormalized_product_idが含まれることを確認
    // （normalized_idだとDBエラーになる）
    expect(content).toContain('p.normalized_product_id');
    expect(content).not.toContain('p.normalized_id =');
  });
});
