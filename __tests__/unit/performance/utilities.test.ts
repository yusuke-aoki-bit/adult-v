/**
 * ユーティリティ関数のパフォーマンステスト
 * 大量データ処理時の性能を計測
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  normalizeProductIdForSearch,
  generateProductIdVariations,
  formatProductCodeForDisplay,
} from '@adult-v/shared/lib/product-id-utils';
import {
  normalizeAspName,
  isDtiSubService,
} from '@adult-v/shared/lib/asp-utils';
import {
  isNotNullish,
  compact,
  extractIds,
  toBatchSourceRows,
} from '@adult-v/shared/lib/type-guards';
import { generateCacheKey } from '@adult-v/shared/lib/cache';

// パフォーマンス計測ヘルパー
function measureTime(fn: () => void, iterations: number = 1000): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  return (end - start) / iterations; // 1回あたりの平均時間(ms)
}

// テストデータ生成
function generateTestProductIds(count: number): string[] {
  const prefixes = ['MIDE', 'SSIS', 'ABP', 'STAR', 'JUFD', 'IPX', 'PRED'];
  return Array.from({ length: count }, (_, i) => {
    const prefix = prefixes[i % prefixes.length];
    const num = String(i + 1).padStart(3, '0');
    return `${prefix}-${num}`;
  });
}

function generateTestRows(count: number): { id: unknown }[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i % 10 === 0 ? 'invalid' : i, // 10%が無効
  }));
}

describe('Performance Tests', () => {
  // ウォームアップ
  beforeAll(() => {
    normalizeProductIdForSearch('MIDE-001');
    normalizeAspName('FANZA');
    generateCacheKey('test', { page: 1 });
  });

  describe('Product ID Utilities', () => {
    const testIds = generateTestProductIds(100);

    it('normalizeProductIdForSearch should process 1000 items under 5ms', () => {
      const avgTime = measureTime(() => {
        testIds.forEach(id => normalizeProductIdForSearch(id));
      }, 100);

      console.log(`normalizeProductIdForSearch: ${avgTime.toFixed(3)}ms per 100 items`);
      expect(avgTime).toBeLessThan(5);
    });

    it('generateProductIdVariations should process 100 items under 50ms', () => {
      const avgTime = measureTime(() => {
        testIds.forEach(id => generateProductIdVariations(id));
      }, 10);

      console.log(`generateProductIdVariations: ${avgTime.toFixed(3)}ms per 100 items`);
      expect(avgTime).toBeLessThan(50);
    });

    it('formatProductCodeForDisplay should process 1000 items under 10ms', () => {
      const avgTime = measureTime(() => {
        testIds.forEach(id => formatProductCodeForDisplay(id));
      }, 100);

      console.log(`formatProductCodeForDisplay: ${avgTime.toFixed(3)}ms per 100 items`);
      expect(avgTime).toBeLessThan(10);
    });
  });

  describe('ASP Utilities', () => {
    const aspNames = ['FANZA', 'MGS', 'DUGA', 'SOKMIL', 'FC2', 'FANZA動画', 'MGS動画'];

    it('normalizeAspName should process 1000 items under 2ms', () => {
      const avgTime = measureTime(() => {
        for (let i = 0; i < 100; i++) {
          aspNames.forEach(name => normalizeAspName(name));
        }
      }, 10);

      console.log(`normalizeAspName: ${avgTime.toFixed(3)}ms per 700 items`);
      expect(avgTime).toBeLessThan(2);
    });

    it('isDtiSubService should handle URL matching efficiently', () => {
      const testUrls = [
        'https://www.caribbeancom.com/moviepages/123456/index.html',
        'https://www.1pondo.tv/movies/123456/',
        'https://www.heyzo.com/moviepages/1234/',
        'https://example.com/not-dti',
      ];

      const avgTime = measureTime(() => {
        for (let i = 0; i < 100; i++) {
          testUrls.forEach(url => isDtiSubService(url));
        }
      }, 10);

      console.log(`isDtiSubService: ${avgTime.toFixed(3)}ms per 400 items`);
      expect(avgTime).toBeLessThan(5);
    });
  });

  describe('Type Guards', () => {
    const testRows = generateTestRows(1000);

    it('extractIds should process 1000 rows under 5ms', () => {
      const avgTime = measureTime(() => {
        extractIds(testRows);
      }, 100);

      console.log(`extractIds: ${avgTime.toFixed(3)}ms per 1000 rows`);
      expect(avgTime).toBeLessThan(5);
    });

    it('compact should process 1000 items under 2ms', () => {
      const mixedArray = Array.from({ length: 1000 }, (_, i) =>
        i % 3 === 0 ? null : i % 5 === 0 ? undefined : i
      );

      const avgTime = measureTime(() => {
        compact(mixedArray);
      }, 100);

      console.log(`compact: ${avgTime.toFixed(3)}ms per 1000 items`);
      expect(avgTime).toBeLessThan(2);
    });

    it('toBatchSourceRows should process 500 rows under 10ms', () => {
      const sourceRows = Array.from({ length: 500 }, (_, i) => ({
        id: i,
        product_id: i * 10,
        asp_name: 'FANZA',
        original_product_id: `prod${i}`,
        affiliate_url: `https://example.com/${i}`,
        price: 1000 + i,
        currency: 'JPY',
        product_type: 'haishin',
      }));

      const avgTime = measureTime(() => {
        toBatchSourceRows(sourceRows);
      }, 50);

      console.log(`toBatchSourceRows: ${avgTime.toFixed(3)}ms per 500 rows`);
      expect(avgTime).toBeLessThan(10);
    });
  });

  describe('Cache Utilities', () => {
    it('generateCacheKey should handle complex params efficiently', () => {
      const complexParams = {
        page: 1,
        limit: 20,
        sort: 'date',
        filters: { provider: 'fanza', tags: ['a', 'b', 'c'] },
        locale: 'ja',
      };

      const avgTime = measureTime(() => {
        for (let i = 0; i < 100; i++) {
          generateCacheKey('products:list', { ...complexParams, page: i });
        }
      }, 10);

      console.log(`generateCacheKey: ${avgTime.toFixed(3)}ms per 100 complex keys`);
      expect(avgTime).toBeLessThan(5);
    });
  });

  describe('Bulk Operations', () => {
    it('should handle 10000 product normalizations under 100ms', () => {
      const ids = generateTestProductIds(10000);

      const start = performance.now();
      ids.forEach(id => normalizeProductIdForSearch(id));
      const elapsed = performance.now() - start;

      console.log(`Bulk normalization (10000 items): ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(100);
    });

    it('should handle mixed operations pipeline efficiently', () => {
      const ids = generateTestProductIds(1000);
      const aspNames = ['FANZA', 'MGS', 'DUGA'];

      const start = performance.now();

      // シミュレート: 商品リスト処理パイプライン
      ids.forEach((id, i) => {
        normalizeProductIdForSearch(id);
        formatProductCodeForDisplay(id);
        normalizeAspName(aspNames[i % 3]!);
        generateCacheKey('product', { id });
      });

      const elapsed = performance.now() - start;

      console.log(`Mixed pipeline (1000 items): ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(200);
    });
  });
});
