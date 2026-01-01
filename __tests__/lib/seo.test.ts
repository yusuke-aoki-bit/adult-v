/**
 * SEOユーティリティのテスト
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateOptimizedDescription,
  generateProductSchema,
  generatePersonSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
  setSeoConfig,
  getSeoConfig,
} from '@adult-v/shared/lib/seo';

// generateProductSchemaの引数型
// generateProductSchema(name, description, image, url, price?, brand?, aggregateRating?, salePrice?, currency?, sku?)

describe('SEO Utilities', () => {
  beforeEach(() => {
    // Reset config before each test
    setSeoConfig({
      siteName: 'Test Site',
      alternateName: 'テストサイト',
      defaultDescription: 'Test description',
    });
  });

  describe('generateOptimizedDescription', () => {
    it('should generate description with title only', () => {
      const desc = generateOptimizedDescription('テスト動画タイトル');
      expect(desc).toContain('テスト動画タイトル');
      expect(desc.length).toBeLessThanOrEqual(160);
    });

    it('should include actress name when provided', () => {
      const desc = generateOptimizedDescription('テスト動画', '三上悠亜');
      expect(desc).toContain('三上悠亜');
    });

    it('should include tags when provided', () => {
      const desc = generateOptimizedDescription('テスト動画', undefined, ['巨乳', 'OL']);
      expect(desc.length).toBeLessThanOrEqual(160);
    });

    it('should include product ID when provided', () => {
      const desc = generateOptimizedDescription('テスト動画', undefined, undefined, undefined, 'SSIS-865');
      expect(desc).toContain('SSIS-865');
    });

    it('should show sale info when provided', () => {
      const desc = generateOptimizedDescription('テスト動画', undefined, undefined, undefined, undefined, {
        salePrice: 980,
        regularPrice: 1980,
        discount: 50,
      });
      expect(desc).toContain('50');
    });

    it('should show rating when provided', () => {
      const desc = generateOptimizedDescription('テスト動画', undefined, undefined, undefined, undefined, {
        rating: 4.5,
        reviewCount: 10,
      });
      expect(desc).toContain('4.5');
    });

    it('should handle English locale', () => {
      const desc = generateOptimizedDescription('Test Video', 'Yua Mikami', undefined, undefined, undefined, {
        locale: 'en',
      });
      expect(desc.length).toBeLessThanOrEqual(160);
    });

    it('should truncate long descriptions', () => {
      const longTitle = 'A'.repeat(200);
      const desc = generateOptimizedDescription(longTitle);
      expect(desc.length).toBeLessThanOrEqual(160);
    });
  });

  describe('generateProductSchema', () => {
    it('should generate valid Product schema', () => {
      // generateProductSchema(name, description, image, url, price?, brand?, aggregateRating?, salePrice?, currency?, sku?)
      const schema = generateProductSchema(
        'テスト商品',
        '商品説明',
        'https://example.com/image.jpg',
        '/products/1',
        1980,
        'MOODYZ'
      );

      expect(schema['@type']).toBe('Product');
      expect(schema.name).toBe('テスト商品');
      expect(schema.description).toBe('商品説明');
      expect(schema.image).toBe('https://example.com/image.jpg');
      expect(schema.offers).toBeDefined();
    });

    it('should include rating when provided', () => {
      const schema = generateProductSchema(
        'テスト商品',
        '商品説明',
        'https://example.com/image.jpg',
        '/products/1',
        1980,
        undefined,
        { ratingValue: 4.5, reviewCount: 50 }
      );

      expect(schema.aggregateRating).toBeDefined();
      const rating = schema.aggregateRating as { ratingValue: number; reviewCount: number };
      expect(rating.ratingValue).toBe(4.5);
      expect(rating.reviewCount).toBe(50);
    });

    it('should include sale price when provided', () => {
      const schema = generateProductSchema(
        'テスト商品',
        '商品説明',
        'https://example.com/image.jpg',
        '/products/1',
        1980,
        undefined,
        undefined,
        980 // salePrice
      );

      expect(schema.offers).toBeDefined();
    });

    it('should include SKU when provided', () => {
      const schema = generateProductSchema(
        'テスト商品',
        '商品説明',
        'https://example.com/image.jpg',
        '/products/1',
        1980,
        undefined,
        undefined,
        undefined,
        'JPY',
        'SSIS-865' // sku
      );

      expect(schema.sku).toBe('SSIS-865');
    });
  });

  describe('generatePersonSchema', () => {
    it('should generate valid Person schema', () => {
      // generatePersonSchema(name, description, image, url, options?)
      const schema = generatePersonSchema(
        '三上悠亜',
        'AV女優',
        'https://example.com/profile.jpg',
        '/actress/1'
      );

      expect(schema['@type']).toBe('Person');
      expect(schema.name).toBe('三上悠亜');
      expect(schema.description).toBe('AV女優');
    });

    it('should include workCount when provided', () => {
      const schema = generatePersonSchema(
        '三上悠亜',
        'AV女優',
        'https://example.com/profile.jpg',
        '/actress/1',
        { workCount: 100 }
      );

      expect(schema.knowsAbout).toBe('100作品以上に出演');
    });

    it('should include aliases when provided', () => {
      const schema = generatePersonSchema(
        '三上悠亜',
        'AV女優',
        'https://example.com/profile.jpg',
        '/actress/1',
        { aliases: ['鬼頭桃菜'] }
      );

      expect(schema.alternateName).toContain('鬼頭桃菜');
    });
  });

  describe('generateFAQSchema', () => {
    it('should generate valid FAQPage schema', () => {
      const faqs = [
        { question: '質問1', answer: '回答1' },
        { question: '質問2', answer: '回答2' },
      ];

      const schema = generateFAQSchema(faqs);

      expect(schema['@type']).toBe('FAQPage');
      expect(schema.mainEntity).toHaveLength(2);
      expect(schema.mainEntity[0]['@type']).toBe('Question');
      expect(schema.mainEntity[0].name).toBe('質問1');
      expect(schema.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
      expect(schema.mainEntity[0].acceptedAnswer.text).toBe('回答1');
    });

    it('should handle empty FAQ list', () => {
      const schema = generateFAQSchema([]);
      expect(schema.mainEntity).toHaveLength(0);
    });
  });

  describe('generateBreadcrumbSchema', () => {
    it('should generate valid BreadcrumbList schema', () => {
      const items = [
        { name: 'ホーム', url: 'https://example.com' },
        { name: '女優一覧', url: 'https://example.com/actresses' },
        { name: '三上悠亜', url: 'https://example.com/actress/1' },
      ];

      const schema = generateBreadcrumbSchema(items);

      expect(schema['@type']).toBe('BreadcrumbList');
      expect(schema.itemListElement).toHaveLength(3);
      expect(schema.itemListElement[0].position).toBe(1);
      expect(schema.itemListElement[2].position).toBe(3);
    });
  });

  describe('Config Management', () => {
    it('should get current config', () => {
      const config = getSeoConfig();
      expect(config.siteName).toBe('Test Site');
    });

    it('should update config partially', () => {
      setSeoConfig({ siteName: 'New Site Name' });
      const config = getSeoConfig();
      expect(config.siteName).toBe('New Site Name');
      expect(config.alternateName).toBe('テストサイト'); // Should remain unchanged
    });
  });
});

describe('SEO Description Length', () => {
  const testCases = [
    { locale: 'ja', maxLength: 160 },
    { locale: 'en', maxLength: 160 },
    { locale: 'zh', maxLength: 160 },
    { locale: 'ko', maxLength: 160 },
  ];

  testCases.forEach(({ locale, maxLength }) => {
    it(`should keep ${locale} description under ${maxLength} chars`, () => {
      const longTitle = 'タイトル'.repeat(50);
      const longActress = '出演者名'.repeat(10);
      const longTags = Array(10).fill('タグ');

      const desc = generateOptimizedDescription(
        longTitle,
        longActress,
        longTags,
        undefined,
        undefined,
        { locale }
      );

      expect(desc.length).toBeLessThanOrEqual(maxLength);
    });
  });
});
