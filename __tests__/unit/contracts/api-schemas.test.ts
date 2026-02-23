/**
 * API応答スキーマ検証テスト（Contract Test）
 * フロントエンドが期待するAPIレスポンス構造を保証
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ============================================================
// Schema Definitions (API契約)
// ============================================================

/**
 * 商品一覧APIレスポンススキーマ
 */
const ProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  normalizedProductId: z.string().optional(),
  makerProductCode: z.string().optional(),
  originalProductId: z.string().optional(),
  description: z.string().optional(),
  price: z.number(),
  currency: z.enum(['JPY', 'USD']),
  category: z.string(),
  imageUrl: z.string(),
  affiliateUrl: z.string(),
  provider: z.string(),
  providerLabel: z.string(),
  actressId: z.string().optional(),
  actressName: z.string().optional(),
  performers: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    )
    .optional(),
  releaseDate: z.string().optional(),
  duration: z.number().optional(),
  tags: z.array(z.string()),
  isFeatured: z.boolean(),
  isNew: z.boolean(),
  isFuture: z.boolean(),
  productType: z.enum(['haishin', 'dvd', 'monthly']).optional(),
  discount: z.number().optional(),
  salePrice: z.number().optional(),
  regularPrice: z.number().optional(),
  saleEndAt: z.string().optional(),
  sampleImages: z.array(z.string()).optional(),
  sampleVideos: z
    .array(
      z.object({
        url: z.string(),
        type: z.string(),
        quality: z.string().optional(),
        duration: z.number().optional(),
      }),
    )
    .optional(),
  aiReview: z.string().optional(),
  aiReviewUpdatedAt: z.string().optional(),
  alternativeSources: z
    .array(
      z.object({
        aspName: z.string(),
        price: z.number(),
        salePrice: z.number().optional(),
        affiliateUrl: z.string(),
        productId: z.number(),
      }),
    )
    .optional(),
});

const ProductListResponseSchema = z.object({
  products: z.array(ProductSchema),
  total: z.number(),
  page: z.number(),
  perPage: z.number(),
  totalPages: z.number(),
});

/**
 * 女優一覧APIレスポンススキーマ
 */
const ActressSchema = z.object({
  id: z.string(),
  name: z.string(),
  catchcopy: z.string(),
  description: z.string().optional(),
  heroImage: z.string(),
  thumbnail: z.string(),
  primaryGenres: z.array(z.string()),
  services: z.array(z.string()),
  metrics: z.object({
    releaseCount: z.number(),
    trendingScore: z.number(),
    fanScore: z.number(),
  }),
  highlightWorks: z.array(z.any()),
  tags: z.array(z.string()),
  aliases: z.array(z.string()).optional(),
  aiReview: z
    .object({
      summary: z.string().optional(),
      bodyType: z.string().optional(),
      personality: z.string().optional(),
      performance: z.string().optional(),
    })
    .optional(),
  aiReviewUpdatedAt: z.string().optional(),
});

const ActressListResponseSchema = z.object({
  actresses: z.array(ActressSchema),
  total: z.number(),
  page: z.number(),
  perPage: z.number(),
});

/**
 * 検索APIレスポンススキーマ
 */
const SearchResultSchema = z.object({
  products: z.array(ProductSchema).optional(),
  actresses: z.array(ActressSchema).optional(),
  query: z.string(),
  total: z.number(),
});

/**
 * エラーレスポンススキーマ
 */
const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  statusCode: z.number().optional(),
});

// ============================================================
// Contract Tests
// ============================================================

describe('API Contract Tests', () => {
  describe('Product Schema', () => {
    it('should validate minimal product', () => {
      const minimalProduct = {
        id: '1',
        title: 'テスト作品',
        price: 1980,
        currency: 'JPY',
        category: 'premium',
        imageUrl: 'https://example.com/image.jpg',
        affiliateUrl: 'https://example.com/affiliate',
        provider: 'fanza',
        providerLabel: 'FANZA',
        tags: [],
        isFeatured: false,
        isNew: false,
        isFuture: false,
      };

      const result = ProductSchema.safeParse(minimalProduct);
      expect(result.success).toBe(true);
    });

    it('should validate full product with all optional fields', () => {
      const fullProduct = {
        id: '12345',
        title: 'フル情報テスト作品',
        normalizedProductId: 'ssis001',
        makerProductCode: 'SSIS-001',
        originalProductId: 'ssis00001',
        description: '作品の説明',
        price: 1980,
        currency: 'JPY',
        category: 'premium',
        imageUrl: 'https://example.com/image.jpg',
        affiliateUrl: 'https://example.com/affiliate',
        provider: 'fanza',
        providerLabel: 'FANZA',
        actressId: '1',
        actressName: 'テスト女優',
        performers: [{ id: '1', name: 'テスト女優' }],
        releaseDate: '2024-01-15',
        duration: 120,
        tags: ['巨乳', '美脚'],
        isFeatured: true,
        isNew: true,
        isFuture: false,
        productType: 'haishin',
        discount: 50,
        salePrice: 980,
        regularPrice: 1980,
        saleEndAt: '2024-12-31T23:59:59Z',
        sampleImages: ['https://example.com/sample1.jpg'],
        sampleVideos: [{ url: 'https://example.com/video.mp4', type: 'sample' }],
        aiReview: 'AIレビュー',
        alternativeSources: [{ aspName: 'MGS', price: 2000, affiliateUrl: 'https://mgs.com', productId: 12345 }],
      };

      const result = ProductSchema.safeParse(fullProduct);
      expect(result.success).toBe(true);
    });

    it('should reject invalid currency', () => {
      const invalidProduct = {
        id: '1',
        title: 'テスト',
        price: 1980,
        currency: 'EUR', // Invalid
        category: 'premium',
        imageUrl: 'url',
        affiliateUrl: 'url',
        provider: 'fanza',
        providerLabel: 'FANZA',
        tags: [],
        isFeatured: false,
        isNew: false,
        isFuture: false,
      };

      const result = ProductSchema.safeParse(invalidProduct);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const incompleteProduct = {
        id: '1',
        title: 'テスト',
        // price missing
      };

      const result = ProductSchema.safeParse(incompleteProduct);
      expect(result.success).toBe(false);
    });
  });

  describe('Product List Response Schema', () => {
    it('should validate product list response', () => {
      const response = {
        products: [
          {
            id: '1',
            title: 'テスト',
            price: 1980,
            currency: 'JPY',
            category: 'premium',
            imageUrl: 'url',
            affiliateUrl: 'url',
            provider: 'fanza',
            providerLabel: 'FANZA',
            tags: [],
            isFeatured: false,
            isNew: false,
            isFuture: false,
          },
        ],
        total: 100,
        page: 1,
        perPage: 20,
        totalPages: 5,
      };

      const result = ProductListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate empty product list', () => {
      const response = {
        products: [],
        total: 0,
        page: 1,
        perPage: 20,
        totalPages: 0,
      };

      const result = ProductListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('Actress Schema', () => {
    it('should validate minimal actress', () => {
      const actress = {
        id: '1',
        name: 'テスト女優',
        catchcopy: '',
        heroImage: 'https://example.com/hero.jpg',
        thumbnail: 'https://example.com/thumb.jpg',
        primaryGenres: ['premium'],
        services: ['fanza'],
        metrics: {
          releaseCount: 50,
          trendingScore: 0,
          fanScore: 0,
        },
        highlightWorks: [],
        tags: [],
      };

      const result = ActressSchema.safeParse(actress);
      expect(result.success).toBe(true);
    });

    it('should validate actress with AI review', () => {
      const actress = {
        id: '1',
        name: 'テスト女優',
        catchcopy: 'キャッチコピー',
        description: 'プロフィール',
        heroImage: 'url',
        thumbnail: 'url',
        primaryGenres: ['premium'],
        services: ['fanza', 'mgs'],
        metrics: { releaseCount: 100, trendingScore: 80, fanScore: 90 },
        highlightWorks: [],
        tags: ['巨乳'],
        aliases: ['別名1', '別名2'],
        aiReview: {
          summary: 'サマリー',
          bodyType: '体型説明',
          personality: '性格',
          performance: 'パフォーマンス',
        },
        aiReviewUpdatedAt: '2024-01-15T00:00:00Z',
      };

      const result = ActressSchema.safeParse(actress);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Response Schema', () => {
    it('should validate error response', () => {
      const error = {
        error: 'Not Found',
        message: 'Product not found',
        statusCode: 404,
      };

      const result = ErrorResponseSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('should validate minimal error', () => {
      const error = { error: 'Internal Server Error' };

      const result = ErrorResponseSchema.safeParse(error);
      expect(result.success).toBe(true);
    });
  });

  describe('Schema Export Verification', () => {
    it('should export all required schemas', () => {
      expect(ProductSchema).toBeDefined();
      expect(ProductListResponseSchema).toBeDefined();
      expect(ActressSchema).toBeDefined();
      expect(ActressListResponseSchema).toBeDefined();
      expect(SearchResultSchema).toBeDefined();
      expect(ErrorResponseSchema).toBeDefined();
    });
  });
});

// Export schemas for use in other tests
export {
  ProductSchema,
  ProductListResponseSchema,
  ActressSchema,
  ActressListResponseSchema,
  SearchResultSchema,
  ErrorResponseSchema,
};
