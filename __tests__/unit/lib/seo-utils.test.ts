/**
 * SEO Utilities テスト
 * seo-utils.ts の画像Alt属性生成関数のテスト
 */
import { describe, it, expect } from 'vitest';
import { generateActressAltText, generateSampleImageAltText } from '@adult-v/shared/lib/seo-utils';

describe('generateActressAltText', () => {
  it('should generate alt text with name only', () => {
    const alt = generateActressAltText({ name: '三上悠亜' });
    expect(alt).toBe('三上悠亜');
  });

  it('should include alias when provided', () => {
    const alt = generateActressAltText({
      name: '三上悠亜',
      aliases: ['鬼頭桃菜', '別名2'],
    });
    expect(alt).toContain('三上悠亜');
    expect(alt).toContain('(鬼頭桃菜)');
  });

  it('should include product count when provided', () => {
    const alt = generateActressAltText({
      name: '三上悠亜',
      productCount: 150,
    });
    expect(alt).toContain('出演150作品');
  });

  it('should include services when provided', () => {
    const alt = generateActressAltText({
      name: '三上悠亜',
      services: ['FANZA', 'MGS', 'DUGA'],
    });
    expect(alt).toContain('FANZA・MGS');
    // Only first 2 services should be included
    expect(alt).not.toContain('DUGA');
  });

  it('should combine all fields correctly', () => {
    const alt = generateActressAltText({
      name: '三上悠亜',
      aliases: ['鬼頭桃菜'],
      productCount: 150,
      services: ['FANZA', 'MGS'],
    });
    expect(alt).toBe('三上悠亜 | (鬼頭桃菜) | 出演150作品 | FANZA・MGS');
  });

  it('should handle zero product count', () => {
    const alt = generateActressAltText({
      name: '新人女優',
      productCount: 0,
    });
    expect(alt).toBe('新人女優');
    expect(alt).not.toContain('出演');
  });

  it('should handle empty arrays', () => {
    const alt = generateActressAltText({
      name: 'テスト',
      aliases: [],
      services: [],
    });
    expect(alt).toBe('テスト');
  });
});

describe('generateSampleImageAltText', () => {
  it('should generate alt text with title and index', () => {
    const alt = generateSampleImageAltText({ title: 'テスト動画タイトル' }, 0);
    expect(alt).toBe('テスト動画タイトル - サンプル画像1');
  });

  it('should include actress name when provided', () => {
    const alt = generateSampleImageAltText({ title: 'テスト動画', actressName: '三上悠亜' }, 0);
    expect(alt).toBe('テスト動画 - 三上悠亜 - サンプル画像1');
  });

  it('should use 1-indexed image numbers', () => {
    const alt = generateSampleImageAltText({ title: 'テスト' }, 4);
    expect(alt).toContain('サンプル画像5');
  });

  it('should handle index 0 correctly', () => {
    const alt = generateSampleImageAltText({ title: 'テスト' }, 0);
    expect(alt).toContain('サンプル画像1');
  });

  it('should handle large index values', () => {
    const alt = generateSampleImageAltText({ title: 'テスト' }, 99);
    expect(alt).toContain('サンプル画像100');
  });

  it('should handle long titles', () => {
    const longTitle = 'これは非常に長いタイトルです'.repeat(10);
    const alt = generateSampleImageAltText({ title: longTitle, actressName: '女優名' }, 0);
    expect(alt).toContain(longTitle);
    expect(alt).toContain('女優名');
    expect(alt).toContain('サンプル画像1');
  });

  it('should handle empty actress name', () => {
    const alt = generateSampleImageAltText({ title: 'テスト', actressName: '' }, 0);
    // Empty string should not add extra separator
    expect(alt).toBe('テスト - サンプル画像1');
  });
});
