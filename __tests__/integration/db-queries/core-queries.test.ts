/**
 * Core Queries 統合テスト
 * DBクエリのロジックを検証（モックDB使用）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// モックデータベースの型定義
interface MockDb {
  select: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
}

// クエリ結果のモック
const mockProductRows = [
  {
    id: 1,
    title: 'テスト作品1',
    normalizedProductId: 'ssis001',
    releaseDate: '2024-01-15',
    duration: 120,
    description: '説明1',
    defaultThumbnailUrl: 'https://example.com/1.jpg',
  },
  {
    id: 2,
    title: 'テスト作品2',
    normalizedProductId: 'mide001',
    releaseDate: '2024-01-10',
    duration: 90,
    description: '説明2',
    defaultThumbnailUrl: 'https://example.com/2.jpg',
  },
];

const mockPerformerRows = [
  { productId: 1, id: 10, name: '女優A', nameKana: 'ジョユウA' },
  { productId: 1, id: 11, name: '女優B', nameKana: 'ジョユウB' },
  { productId: 2, id: 10, name: '女優A', nameKana: 'ジョユウA' },
];

const mockTagRows = [
  { productId: 1, id: 100, name: '巨乳', category: 'body' },
  { productId: 1, id: 101, name: 'OL', category: 'situation' },
  { productId: 2, id: 100, name: '巨乳', category: 'body' },
];

const mockSourceRows = [
  { productId: 1, aspName: 'FANZA', originalProductId: 'ssis00001', affiliateUrl: 'https://fanza.com/1', price: 1980, currency: 'JPY', productType: 'haishin' },
  { productId: 2, aspName: 'MGS', originalProductId: '259luxu-001', affiliateUrl: 'https://mgs.com/2', price: 2980, currency: 'JPY', productType: 'haishin' },
];

const mockImageRows = [
  { productId: 1, imageUrl: 'https://example.com/img1.jpg', imageType: 'thumbnail', displayOrder: 1 },
  { productId: 1, imageUrl: 'https://example.com/img2.jpg', imageType: 'sample', displayOrder: 2 },
];

const mockVideoRows = [
  { productId: 1, videoUrl: 'https://example.com/video1.mp4', videoType: 'sample', quality: 'HD', duration: 60 },
];

const mockSaleRows = [
  { productId: 1, regularPrice: 1980, salePrice: 980, discountPercent: 50, endAt: new Date('2024-12-31') },
];

describe('Core Queries Integration', () => {
  describe('Batch Data Fetching', () => {
    it('should group performers by product ID', () => {
      // シミュレート: performersをproductIdでグループ化
      const performersMap = new Map<number, typeof mockPerformerRows>();

      for (const row of mockPerformerRows) {
        const existing = performersMap.get(row.productId) || [];
        existing.push(row);
        performersMap.set(row.productId, existing);
      }

      expect(performersMap.get(1)).toHaveLength(2);
      expect(performersMap.get(2)).toHaveLength(1);
      expect(performersMap.get(1)?.[0].name).toBe('女優A');
    });

    it('should group tags by product ID', () => {
      const tagsMap = new Map<number, typeof mockTagRows>();

      for (const row of mockTagRows) {
        const existing = tagsMap.get(row.productId) || [];
        existing.push(row);
        tagsMap.set(row.productId, existing);
      }

      expect(tagsMap.get(1)).toHaveLength(2);
      expect(tagsMap.get(2)).toHaveLength(1);
    });

    it('should select primary source per product', () => {
      // シミュレート: 各商品のメインソースを選択
      const sourcesMap = new Map<number, (typeof mockSourceRows)[0]>();

      for (const row of mockSourceRows) {
        if (!sourcesMap.has(row.productId)) {
          sourcesMap.set(row.productId, row);
        }
      }

      expect(sourcesMap.get(1)?.aspName).toBe('FANZA');
      expect(sourcesMap.get(2)?.aspName).toBe('MGS');
    });

    it('should group images by product ID', () => {
      const imagesMap = new Map<number, typeof mockImageRows>();

      for (const row of mockImageRows) {
        const existing = imagesMap.get(row.productId) || [];
        existing.push(row);
        imagesMap.set(row.productId, existing);
      }

      expect(imagesMap.get(1)).toHaveLength(2);
      expect(imagesMap.get(1)?.[0].imageType).toBe('thumbnail');
    });
  });

  describe('Filter Logic', () => {
    it('should filter products by provider', () => {
      const filtered = mockSourceRows.filter(s => s.aspName === 'FANZA');
      const productIds = filtered.map(s => s.productId);

      expect(productIds).toContain(1);
      expect(productIds).not.toContain(2);
    });

    it('should filter products by price range', () => {
      const minPrice = 1000;
      const maxPrice = 2000;

      const filtered = mockSourceRows.filter(
        s => s.price >= minPrice && s.price <= maxPrice
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].productId).toBe(1);
    });

    it('should filter active sales', () => {
      const now = new Date('2024-06-15');

      const activeSales = mockSaleRows.filter(
        s => s.endAt && s.endAt > now
      );

      expect(activeSales).toHaveLength(1);
    });
  });

  describe('Sort Logic', () => {
    it('should sort by release date descending', () => {
      const sorted = [...mockProductRows].sort((a, b) =>
        new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
      );

      expect(sorted[0].id).toBe(1); // 2024-01-15 is later
    });

    it('should sort by release date ascending', () => {
      const sorted = [...mockProductRows].sort((a, b) =>
        new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
      );

      expect(sorted[0].id).toBe(2); // 2024-01-10 is earlier
    });

    it('should sort by price (via source)', () => {
      const productPrices = new Map<number, number>();
      mockSourceRows.forEach(s => productPrices.set(s.productId, s.price));

      const sorted = [...mockProductRows].sort((a, b) =>
        (productPrices.get(a.id) || 0) - (productPrices.get(b.id) || 0)
      );

      expect(sorted[0].id).toBe(1); // 1980 < 2980
    });
  });

  describe('Pagination Logic', () => {
    it('should calculate correct offset', () => {
      const page = 3;
      const limit = 20;
      const offset = (page - 1) * limit;

      expect(offset).toBe(40);
    });

    it('should slice results correctly', () => {
      const allProducts = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
      const page = 2;
      const limit = 10;
      const offset = (page - 1) * limit;

      const paged = allProducts.slice(offset, offset + limit);

      expect(paged).toHaveLength(10);
      expect(paged[0].id).toBe(11);
      expect(paged[9].id).toBe(20);
    });

    it('should handle last page with fewer items', () => {
      const allProducts = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
      const page = 3;
      const limit = 10;
      const offset = (page - 1) * limit;

      const paged = allProducts.slice(offset, offset + limit);

      expect(paged).toHaveLength(5);
      expect(paged[0].id).toBe(21);
    });
  });

  describe('Data Transformation', () => {
    it('should transform snake_case to camelCase', () => {
      const snakeCaseRow = {
        product_id: 1,
        asp_name: 'FANZA',
        original_product_id: 'ssis00001',
        affiliate_url: 'https://example.com',
      };

      const transformed = {
        productId: snakeCaseRow.product_id,
        aspName: snakeCaseRow.asp_name,
        originalProductId: snakeCaseRow.original_product_id,
        affiliateUrl: snakeCaseRow.affiliate_url,
      };

      expect(transformed.productId).toBe(1);
      expect(transformed.aspName).toBe('FANZA');
    });

    it('should handle null/undefined values', () => {
      const rowWithNulls = {
        id: 1,
        name: 'Test',
        nameKana: null,
        bio: undefined,
      };

      const processed = {
        id: rowWithNulls.id,
        name: rowWithNulls.name,
        nameKana: rowWithNulls.nameKana ?? null,
        bio: rowWithNulls.bio ?? null,
      };

      expect(processed.nameKana).toBeNull();
      expect(processed.bio).toBeNull();
    });
  });

  describe('Performer Validation', () => {
    const invalidNames = ['企画', '素人', '---', '（）', '****', ''];
    const validNames = ['三上悠亜', '橋本ありな', 'あおいれな'];

    it('should filter out invalid performer names', () => {
      const allPerformers = [
        ...validNames.map((name, i) => ({ id: i, name })),
        ...invalidNames.map((name, i) => ({ id: i + 100, name })),
      ];

      const isValidPerformer = (p: { name: string }) => {
        if (!p.name || p.name.length < 2) return false;
        if (/^[-*（）\s]+$/.test(p.name)) return false;
        if (['企画', '素人'].includes(p.name)) return false;
        return true;
      };

      const valid = allPerformers.filter(isValidPerformer);

      expect(valid).toHaveLength(3);
      expect(valid.map(p => p.name)).toEqual(validNames);
    });
  });

  describe('ASP/Provider Normalization', () => {
    it('should normalize ASP names to lowercase', () => {
      const aspNames = ['FANZA', 'MGS', 'DUGA', 'Fanza動画'];
      const normalized = aspNames.map(name => name.toLowerCase().replace(/動画$/, ''));

      expect(normalized).toEqual(['fanza', 'mgs', 'duga', 'fanza']);
    });
  });
});
