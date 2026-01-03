/**
 * マッパー関数のテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapProductToType,
  mapPerformerToActressTypeSync,
  mapProductsWithBatchData,
  type DbPerformer,
  type DbProduct,
  type SourceData,
  type CacheData,
  type ImageData,
  type VideoData,
  type SaleData,
  type PerformerData,
  type TagData,
  type MapperDeps,
  type ProductMapperDeps,
  type MapProductsWithBatchDataDeps,
} from '@adult-v/shared/db-queries/mappers';
import type { BatchRelatedDataResult } from '@adult-v/shared/db-queries/core-queries';

describe('mappers', () => {
  describe('mapProductToType', () => {
    const mockDeps: ProductMapperDeps = {
      mapLegacyProvider: (aspName: string) => aspName.toLowerCase() as 'fanza' | 'mgs' | 'duga' | 'sokmil',
      getProviderLabel: (aspName: string) => aspName.toUpperCase(),
      getLocalizedPerformerName: (performer: PerformerData, locale: string) =>
        locale === 'en' && performer.nameEn ? performer.nameEn : performer.name,
      getLocalizedTagName: (tag: TagData, locale: string) =>
        locale === 'en' && tag.nameEn ? tag.nameEn : tag.name,
      getLocalizedTitle: (product: DbProduct, locale: string) =>
        locale === 'en' && product.titleEn ? product.titleEn : product.title,
      getLocalizedDescription: (product: DbProduct, locale: string) =>
        locale === 'en' && product.descriptionEn ? product.descriptionEn : product.description || undefined,
    };

    const baseProduct: DbProduct = {
      id: 1,
      title: 'テスト作品',
      normalizedProductId: 'mide001',
      makerProductCode: 'MIDE-001',
      releaseDate: '2024-01-15',
      duration: 120,
      description: '作品説明',
      defaultThumbnailUrl: 'https://example.com/thumb.jpg',
    };

    it('基本的なプロパティをマッピング', () => {
      const source: SourceData = {
        aspName: 'FANZA',
        affiliateUrl: 'https://affiliate.example.com',
        price: 1980,
        currency: 'JPY',
        originalProductId: 'mide00001',
        productType: 'haishin',
      };

      const result = mapProductToType(baseProduct, mockDeps, [], [], source);

      expect(result.id).toBe('1');
      expect(result.title).toBe('テスト作品');
      expect(result.normalizedProductId).toBe('mide001');
      expect(result.makerProductCode).toBe('MIDE-001');
      expect(result.price).toBe(1980);
      expect(result.currency).toBe('JPY');
      expect(result.provider).toBe('fanza');
      expect(result.providerLabel).toBe('FANZA');
      expect(result.affiliateUrl).toBe('https://affiliate.example.com');
      expect(result.duration).toBe(120);
      expect(result.productType).toBe('haishin');
    });

    it('出演者データをマッピング', () => {
      const performers: PerformerData[] = [
        { id: 1, name: '女優A', nameKana: 'ジョユウA', nameEn: 'Actress A' },
        { id: 2, name: '女優B', nameKana: 'ジョユウB', nameEn: 'Actress B' },
      ];

      const result = mapProductToType(baseProduct, mockDeps, performers, []);

      expect(result.actressId).toBe('1');
      expect(result.actressName).toBe('女優A');
      expect(result.performers).toHaveLength(2);
      expect(result.performers?.[0]).toEqual({ id: '1', name: '女優A' });
    });

    it('英語ロケールで出演者名をローカライズ', () => {
      const performers: PerformerData[] = [
        { id: 1, name: '女優A', nameKana: 'ジョユウA', nameEn: 'Actress A' },
      ];

      const result = mapProductToType(baseProduct, mockDeps, performers, [], null, null, undefined, undefined, 'en');

      expect(result.actressName).toBe('Actress A');
      expect(result.performers?.[0].name).toBe('Actress A');
    });

    it('タグデータをマッピング', () => {
      const tags: TagData[] = [
        { id: 1, name: 'ジャンル1', category: 'genre', nameEn: 'Genre 1' },
        { id: 2, name: 'ジャンル2', category: 'genre', nameEn: 'Genre 2' },
      ];

      const result = mapProductToType(baseProduct, mockDeps, [], tags);

      expect(result.tags).toHaveLength(2);
      expect(result.tags).toContain('ジャンル1');
      expect(result.tags).toContain('ジャンル2');
    });

    it('画像データをマッピング', () => {
      const images: ImageData[] = [
        { imageUrl: 'https://example.com/img1.jpg', imageType: 'thumbnail', displayOrder: 1 },
        { imageUrl: 'https://example.com/img2.jpg', imageType: 'sample', displayOrder: 2 },
      ];

      // defaultThumbnailUrlがある場合はそちらが優先
      const result = mapProductToType(baseProduct, mockDeps, [], [], null, null, images);

      expect(result.imageUrl).toBe('https://example.com/thumb.jpg'); // baseProductのdefaultThumbnailUrl
      expect(result.sampleImages).toHaveLength(2);
    });

    it('thumbnailタイプの画像を優先', () => {
      const images: ImageData[] = [
        { imageUrl: 'https://example.com/sample.jpg', imageType: 'sample', displayOrder: 1 },
        { imageUrl: 'https://example.com/thumb.jpg', imageType: 'thumbnail', displayOrder: 2 },
      ];

      // defaultThumbnailUrlがない商品
      const productWithoutThumb: DbProduct = {
        ...baseProduct,
        defaultThumbnailUrl: undefined,
      };

      const result = mapProductToType(productWithoutThumb, mockDeps, [], [], null, null, images);

      expect(result.imageUrl).toBe('https://example.com/thumb.jpg');
    });

    it('動画データをマッピング', () => {
      const videos: VideoData[] = [
        { videoUrl: 'https://example.com/video1.mp4', videoType: 'sample', quality: 'HD', duration: 60 },
      ];

      const result = mapProductToType(baseProduct, mockDeps, [], [], null, null, undefined, videos);

      expect(result.sampleVideos).toHaveLength(1);
      expect(result.sampleVideos?.[0]).toEqual({
        url: 'https://example.com/video1.mp4',
        type: 'sample',
        quality: 'HD',
        duration: 60,
      });
    });

    it('セールデータをマッピング', () => {
      const sale: SaleData = {
        regularPrice: 1980,
        salePrice: 980,
        discountPercent: 50,
        endAt: new Date('2024-12-31'),
      };

      const result = mapProductToType(baseProduct, mockDeps, [], [], null, null, undefined, undefined, 'ja', sale);

      expect(result.regularPrice).toBe(1980);
      expect(result.salePrice).toBe(980);
      expect(result.discount).toBe(50);
      expect(result.saleEndAt).toBe('2024-12-31T00:00:00.000Z');
    });

    it('新作判定（7日以内）', () => {
      const recentProduct: DbProduct = {
        ...baseProduct,
        releaseDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3日前
      };

      const result = mapProductToType(recentProduct, mockDeps, [], []);

      expect(result.isNew).toBe(true);
      expect(result.isFuture).toBe(false);
    });

    it('発売予定判定（未来の日付）', () => {
      const futureProduct: DbProduct = {
        ...baseProduct,
        releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7日後
      };

      const result = mapProductToType(futureProduct, mockDeps, [], []);

      expect(result.isNew).toBe(false);
      expect(result.isFuture).toBe(true);
    });

    it('キャッシュデータから価格・画像を取得', () => {
      const cache: CacheData = {
        price: 2980,
        thumbnailUrl: 'https://cache.example.com/thumb.jpg',
        affiliateUrl: 'https://cache.example.com/affiliate',
        sampleImages: ['https://cache.example.com/sample1.jpg'],
      };

      const productWithoutThumb: DbProduct = {
        ...baseProduct,
        defaultThumbnailUrl: undefined,
      };

      const result = mapProductToType(productWithoutThumb, mockDeps, [], [], null, cache);

      expect(result.price).toBe(2980);
      expect(result.imageUrl).toBe('https://cache.example.com/thumb.jpg');
    });

    it('画像がない場合はプレースホルダーを使用', () => {
      const productWithoutThumb: DbProduct = {
        ...baseProduct,
        defaultThumbnailUrl: undefined,
      };

      const result = mapProductToType(productWithoutThumb, mockDeps, [], []);

      // PRODUCT_PLACEHOLDERはplacehold.coのURLを使用
      expect(result.imageUrl).toContain('placehold');
    });
  });

  describe('mapPerformerToActressTypeSync', () => {
    const mockDeps: MapperDeps = {
      getLocalizedPerformerName: (performer: DbPerformer, locale: string) =>
        locale === 'en' && performer.nameEn ? performer.nameEn : performer.name,
      getLocalizedPerformerBio: (performer: DbPerformer, locale: string) =>
        locale === 'en' && performer.bioEn ? performer.bioEn : performer.bio || undefined,
      getLocalizedAiReview: (aiReview: string | null | undefined, locale: string) => {
        if (!aiReview) return undefined;
        try {
          const parsed = JSON.parse(aiReview);
          return parsed[locale] || parsed.ja;
        } catch {
          return undefined;
        }
      },
    };

    const basePerformer: DbPerformer = {
      id: 1,
      name: 'テスト女優',
      nameKana: 'テストジョユウ',
      bio: 'プロフィール',
      profileImageUrl: 'https://example.com/profile.jpg',
      nameEn: 'Test Actress',
      bioEn: 'Profile in English',
    };

    it('基本的なプロパティをマッピング', () => {
      const result = mapPerformerToActressTypeSync(basePerformer, 50, mockDeps);

      expect(result.id).toBe('1');
      expect(result.name).toBe('テスト女優');
      expect(result.description).toBe('プロフィール');
      expect(result.metrics.releaseCount).toBe(50);
    });

    it('英語ロケールでローカライズ', () => {
      const result = mapPerformerToActressTypeSync(basePerformer, 50, mockDeps, { locale: 'en' });

      expect(result.name).toBe('Test Actress');
      expect(result.description).toBe('Profile in English');
    });

    it('サムネイルURLを設定', () => {
      const result = mapPerformerToActressTypeSync(basePerformer, 50, mockDeps, {
        thumbnailUrl: 'https://example.com/thumb.jpg',
      });

      expect(result.thumbnail).toBe('https://example.com/thumb.jpg');
      expect(result.heroImage).toBe('https://example.com/thumb.jpg');
    });

    it('サービス（ASP）をProviderIdに変換', () => {
      const result = mapPerformerToActressTypeSync(basePerformer, 50, mockDeps, {
        services: ['FANZA', 'MGS', 'DUGA'],
      });

      expect(result.services).toContain('fanza');
      expect(result.services).toContain('mgs');
      expect(result.services).toContain('duga');
    });

    it('別名を設定', () => {
      const result = mapPerformerToActressTypeSync(basePerformer, 50, mockDeps, {
        aliases: ['別名1', '別名2'],
      });

      expect(result.aliases).toEqual(['別名1', '別名2']);
    });

    it('別名が空の場合はundefined', () => {
      const result = mapPerformerToActressTypeSync(basePerformer, 50, mockDeps, {
        aliases: [],
      });

      expect(result.aliases).toBeUndefined();
    });
  });

  describe('mapProductsWithBatchData', () => {
    const mockDeps: MapProductsWithBatchDataDeps = {
      mapLegacyProvider: (aspName: string) => aspName.toLowerCase() as 'fanza' | 'mgs' | 'duga',
      getProviderLabel: (aspName: string) => aspName.toUpperCase(),
      getLocalizedPerformerName: (performer: PerformerData) => performer.name,
      getLocalizedTagName: (tag: TagData) => tag.name,
      getLocalizedTitle: (product: DbProduct) => product.title,
      getLocalizedDescription: (product: DbProduct) => product.description || undefined,
      isValidPerformer: (performer: { name: string }) => performer.name.length > 0,
    };

    const products: DbProduct[] = [
      { id: 1, title: '作品1', releaseDate: '2024-01-01' },
      { id: 2, title: '作品2', releaseDate: '2024-01-02' },
    ];

    it('バッチデータで商品リストをマッピング', () => {
      const batchData: BatchRelatedDataResult = {
        performersMap: new Map([
          [1, [{ id: 1, name: '女優A', nameKana: null }]],
          [2, [{ id: 2, name: '女優B', nameKana: null }]],
        ]),
        tagsMap: new Map([
          [1, [{ id: 1, name: 'タグ1', category: 'genre' }]],
          [2, []],
        ]),
        imagesMap: new Map(),
        videosMap: new Map(),
        salesMap: new Map(),
        sourcesMap: new Map([
          [1, { aspName: 'FANZA', affiliateUrl: 'https://example1.com', price: 1000 }],
          [2, { aspName: 'MGS', affiliateUrl: 'https://example2.com', price: 2000 }],
        ]),
        allSourcesMap: new Map(),
      };

      const result = mapProductsWithBatchData(products, batchData, mockDeps);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].title).toBe('作品1');
      expect(result[0].actressName).toBe('女優A');
      expect(result[0].tags).toContain('タグ1');
      expect(result[0].price).toBe(1000);
      expect(result[1].id).toBe('2');
      expect(result[1].price).toBe(2000);
    });

    it('代替ソースをalternativeSourcesに追加', () => {
      const batchData: BatchRelatedDataResult = {
        performersMap: new Map(),
        tagsMap: new Map(),
        imagesMap: new Map(),
        videosMap: new Map(),
        salesMap: new Map(),
        sourcesMap: new Map([
          [1, { aspName: 'DUGA', affiliateUrl: 'https://duga.com', price: 1000 }],
        ]),
        allSourcesMap: new Map([
          [1, [
            { aspName: 'DUGA', affiliateUrl: 'https://duga.com', price: 1000 },
            { aspName: 'FANZA', affiliateUrl: 'https://fanza.com', price: 1200 },
            { aspName: 'MGS', affiliateUrl: 'https://mgs.com', price: 1100 },
          ]],
        ]),
      };

      const result = mapProductsWithBatchData([products[0]], batchData, mockDeps);

      expect(result[0].alternativeSources).toBeDefined();
      expect(result[0].alternativeSources).toHaveLength(2);
      // FANZAは特別処理でf.adult-v.comへのリンクに変換
      const fanzaSource = result[0].alternativeSources?.find(s => s.aspName === 'FANZA');
      expect(fanzaSource?.affiliateUrl).toContain('f.adult-v.com');
    });

    it('無効な出演者をフィルタリング', () => {
      const batchData: BatchRelatedDataResult = {
        performersMap: new Map([
          [1, [
            { id: 1, name: '女優A', nameKana: null },
            { id: 2, name: '', nameKana: null }, // 空の名前 → フィルタリングされる
          ]],
        ]),
        tagsMap: new Map(),
        imagesMap: new Map(),
        videosMap: new Map(),
        salesMap: new Map(),
        sourcesMap: new Map(),
        allSourcesMap: new Map(),
      };

      const result = mapProductsWithBatchData([products[0]], batchData, mockDeps);

      expect(result[0].performers).toHaveLength(1);
      expect(result[0].performers?.[0].name).toBe('女優A');
    });
  });
});
