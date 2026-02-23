/**
 * データ構造スナップショットテスト
 * マッパー出力やAPI応答の構造変更を検知
 */
import { describe, it, expect } from 'vitest';
import {
  mapProductToType,
  mapPerformerToActressTypeSync,
  type DbProduct,
  type DbPerformer,
  type PerformerData,
  type TagData,
  type ImageData,
  type VideoData,
  type SaleData,
  type SourceData,
  type ProductMapperDeps,
  type MapperDeps,
} from '@adult-v/shared/db-queries/mappers';

// 固定のテスト日付（スナップショットの安定性のため）
const FIXED_DATE = new Date('2024-06-15T00:00:00.000Z');

describe('Data Structure Snapshots', () => {
  describe('Product Mapping', () => {
    const mockDeps: ProductMapperDeps = {
      mapLegacyProvider: (aspName: string) => aspName.toLowerCase() as 'fanza',
      getProviderLabel: (aspName: string) => aspName.toUpperCase(),
      getLocalizedPerformerName: (p: PerformerData) => p.name,
      getLocalizedTagName: (t: TagData) => t.name,
      getLocalizedTitle: (p: DbProduct) => p.title,
      getLocalizedDescription: (p: DbProduct) => p.description || undefined,
    };

    it('matches minimal product snapshot', () => {
      const product: DbProduct = {
        id: 1,
        title: 'テスト作品',
      };

      const result = mapProductToType(product, mockDeps, [], []);

      // 動的な値を固定
      const snapshot = {
        ...result,
        isNew: false,
        isFuture: false,
      };

      expect(snapshot).toMatchSnapshot();
    });

    it('matches full product snapshot', () => {
      const product: DbProduct = {
        id: 12345,
        title: 'フル情報テスト作品',
        normalizedProductId: 'ssis001',
        makerProductCode: 'SSIS-001',
        releaseDate: '2024-01-15',
        duration: 120,
        description: '作品の詳細説明テキスト',
        defaultThumbnailUrl: 'https://example.com/thumb.jpg',
        titleEn: 'Full Info Test Product',
        descriptionEn: 'Product description in English',
      };

      const performers: PerformerData[] = [
        { id: 1, name: '女優A', nameKana: 'ジョユウA', nameEn: 'Actress A' },
        { id: 2, name: '女優B', nameKana: 'ジョユウB' },
      ];

      const tags: TagData[] = [
        { id: 1, name: '巨乳', category: 'body', nameEn: 'Big Breasts' },
        { id: 2, name: '美脚', category: 'body' },
        { id: 3, name: 'OL', category: 'situation' },
      ];

      const source: SourceData = {
        aspName: 'FANZA',
        affiliateUrl: 'https://affiliate.example.com/product/12345',
        price: 1980,
        currency: 'JPY',
        originalProductId: 'ssis00001',
        productType: 'haishin',
      };

      const images: ImageData[] = [
        { imageUrl: 'https://example.com/img1.jpg', imageType: 'thumbnail', displayOrder: 1 },
        { imageUrl: 'https://example.com/img2.jpg', imageType: 'sample', displayOrder: 2 },
      ];

      const videos: VideoData[] = [
        { videoUrl: 'https://example.com/sample.mp4', videoType: 'sample', quality: 'HD', duration: 60 },
      ];

      const sale: SaleData = {
        regularPrice: 1980,
        salePrice: 980,
        discountPercent: 50,
        endAt: FIXED_DATE,
      };

      const result = mapProductToType(product, mockDeps, performers, tags, source, null, images, videos, 'ja', sale);

      // 動的な値を固定
      const snapshot = {
        ...result,
        isNew: false,
        isFuture: false,
      };

      expect(snapshot).toMatchSnapshot();
    });
  });

  describe('Actress Mapping', () => {
    const mockDeps: MapperDeps = {
      getLocalizedPerformerName: (p: DbPerformer) => p.name,
      getLocalizedPerformerBio: (p: DbPerformer) => p.bio || undefined,
      getLocalizedAiReview: () => undefined,
    };

    it('matches minimal actress snapshot', () => {
      const performer: DbPerformer = {
        id: 1,
        name: 'テスト女優',
      };

      const result = mapPerformerToActressTypeSync(performer, 0, mockDeps);
      expect(result).toMatchSnapshot();
    });

    it('matches full actress snapshot', () => {
      const performer: DbPerformer = {
        id: 12345,
        name: 'フル情報テスト女優',
        nameKana: 'フルジョウホウテストジョユウ',
        bio: '詳細なプロフィール情報',
        profileImageUrl: 'https://example.com/profile.jpg',
        nameEn: 'Full Info Test Actress',
        bioEn: 'Detailed profile information',
        age: 25,
        birthDate: '1999-01-15',
        height: 165,
        bust: 88,
        waist: 58,
        hip: 86,
        cupSize: 'F',
      };

      const result = mapPerformerToActressTypeSync(performer, 150, mockDeps, {
        thumbnailUrl: 'https://example.com/thumb.jpg',
        services: ['FANZA', 'MGS', 'DUGA'],
        aliases: ['別名1', '別名2'],
        locale: 'ja',
      });

      expect(result).toMatchSnapshot();
    });
  });

  describe('Utility Output Snapshots', () => {
    it('ASP normalization map snapshot', async () => {
      const { JA_TO_EN_MAP, UPPER_TO_LOWER_MAP, DTI_URL_PATTERNS } = await import('@adult-v/shared/lib/asp-utils');

      expect({
        JA_TO_EN_MAP,
        UPPER_TO_LOWER_MAP,
        DTI_URL_PATTERNS: Object.fromEntries(Object.entries(DTI_URL_PATTERNS).map(([k, v]) => [k, v.toString()])),
      }).toMatchSnapshot();
    });

    it('Product ID variations snapshot', async () => {
      const { generateProductIdVariations } = await import('@adult-v/shared/lib/product-id-utils');

      // 各パターンの代表例
      const testCases = {
        standard: generateProductIdVariations('MIDE-001').sort(),
        fanza: generateProductIdVariations('mide00001').sort(),
        mgs: generateProductIdVariations('259LUXU-1234').sort(),
        dti: generateProductIdVariations('123456_01').sort(),
      };

      expect(testCases).toMatchSnapshot();
    });
  });
});
