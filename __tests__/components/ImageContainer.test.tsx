/**
 * Image Container Style Tests
 * 画像コンテナのスタイルテスト
 *
 * Tailwind 4でJITコンパイルされないクラスの代わりに
 * インラインスタイルが正しく適用されているかを確認
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, fill, ...props }: { src: string; alt: string; fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      data-fill={fill ? 'true' : undefined}
      {...props}
    />
  ),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/products',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: 'ja' }),
}));

describe('Image Container Styles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ProductCardBase Image Container', () => {
    test('should have height style in full mode', async () => {
      const { ProductCardBase } = await import('@adult-v/shared/components/ProductCard');

      const mockProduct = {
        id: 12345,
        title: 'テスト商品',
        imageUrl: 'https://example.com/image.jpg',
        price: 1980,
        provider: 'FANZA',
        providerLabel: 'FANZA',
      };

      const { container } = render(
        <ProductCardBase
          product={mockProduct}
          theme="dark"
          placeholderImage="https://example.com/placeholder.jpg"
          FavoriteButton={() => <button>Favorite</button>}
          ViewedButton={() => <button>Viewed</button>}
          ImageLightbox={() => <div />}
          StarRating={() => <div>★★★★☆</div>}
          formatPrice={(price: number) => `¥${price.toLocaleString()}`}
          getVariant={() => 'control'}
          trackCtaClick={vi.fn()}
        />
      );

      // 画像コンテナが height: 18rem を持っていることを確認
      const imageContainers = container.querySelectorAll('[style*="height"]');
      expect(imageContainers.length).toBeGreaterThan(0);

      const hasCorrectHeight = Array.from(imageContainers).some(el => {
        const style = (el as HTMLElement).style.height;
        return style === '18rem';
      });
      expect(hasCorrectHeight).toBe(true);
    });

    test('should have aspectRatio style in compact mode', async () => {
      const { ProductCardBase } = await import('@adult-v/shared/components/ProductCard');

      const mockProduct = {
        id: 12345,
        title: 'テスト商品',
        imageUrl: 'https://example.com/image.jpg',
        price: 1980,
        provider: 'FANZA',
        providerLabel: 'FANZA',
      };

      const { container } = render(
        <ProductCardBase
          product={mockProduct}
          theme="dark"
          compact={true}
          placeholderImage="https://example.com/placeholder.jpg"
          FavoriteButton={() => <button>Favorite</button>}
          ViewedButton={() => <button>Viewed</button>}
          ImageLightbox={() => <div />}
          StarRating={() => <div>★★★★☆</div>}
          formatPrice={(price: number) => `¥${price.toLocaleString()}`}
          getVariant={() => 'control'}
          trackCtaClick={vi.fn()}
        />
      );

      // 画像コンテナが aspectRatio: 2/3 を持っていることを確認
      const aspectContainers = container.querySelectorAll('[style*="aspect"]');
      expect(aspectContainers.length).toBeGreaterThan(0);

      const hasCorrectAspect = Array.from(aspectContainers).some(el => {
        const style = (el as HTMLElement).style.aspectRatio;
        return style === '2 / 3' || style === '2/3';
      });
      expect(hasCorrectAspect).toBe(true);
    });
  });

  describe('ProductSkeleton Styles', () => {
    test('should have height style in normal mode', async () => {
      const { ProductSkeleton } = await import('@adult-v/shared/components');

      const { container } = render(<ProductSkeleton count={1} compact={false} />);

      // スケルトンが height: 18rem を持っていることを確認
      const skeletonImages = container.querySelectorAll('[style*="height"]');
      expect(skeletonImages.length).toBeGreaterThan(0);

      const hasCorrectHeight = Array.from(skeletonImages).some(el => {
        const style = (el as HTMLElement).style.height;
        return style === '18rem';
      });
      expect(hasCorrectHeight).toBe(true);
    });

    test('should have aspectRatio style in compact mode', async () => {
      const { ProductSkeleton } = await import('@adult-v/shared/components');

      const { container } = render(<ProductSkeleton count={1} compact={true} />);

      // スケルトンが aspectRatio: 2/3 を持っていることを確認
      const aspectContainers = container.querySelectorAll('[style*="aspect"]');
      expect(aspectContainers.length).toBeGreaterThan(0);

      const hasCorrectAspect = Array.from(aspectContainers).some(el => {
        const style = (el as HTMLElement).style.aspectRatio;
        return style === '2 / 3' || style === '2/3';
      });
      expect(hasCorrectAspect).toBe(true);
    });
  });

  describe('ActressCardSkeleton Styles', () => {
    test('should have aspectRatio 3/4 in compact mode', async () => {
      const { ActressCardSkeleton } = await import('@adult-v/shared/components');

      const { container } = render(<ActressCardSkeleton compact={true} />);

      const aspectContainers = container.querySelectorAll('[style*="aspect"]');
      expect(aspectContainers.length).toBeGreaterThan(0);

      const hasCorrectAspect = Array.from(aspectContainers).some(el => {
        const style = (el as HTMLElement).style.aspectRatio;
        return style === '3 / 4' || style === '3/4';
      });
      expect(hasCorrectAspect).toBe(true);
    });

    test('should have aspectRatio 4/5 in full mode', async () => {
      const { ActressCardSkeleton } = await import('@adult-v/shared/components');

      const { container } = render(<ActressCardSkeleton compact={false} />);

      const aspectContainers = container.querySelectorAll('[style*="aspect"]');
      expect(aspectContainers.length).toBeGreaterThan(0);

      const hasCorrectAspect = Array.from(aspectContainers).some(el => {
        const style = (el as HTMLElement).style.aspectRatio;
        return style === '4 / 5' || style === '4/5';
      });
      expect(hasCorrectAspect).toBe(true);
    });
  });
});

describe('No Arbitrary Tailwind Classes', () => {
  test('should not use aspect-[x/y] classes in shared components', async () => {
    // This test verifies that we're not using Tailwind arbitrary classes
    // that might not be generated by JIT compiler

    const fs = await import('fs');
    const path = await import('path');

    const sharedDir = path.resolve(__dirname, '../../packages/shared/src/components');

    const checkFile = (filePath: string): string[] => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const matches = content.match(/aspect-\[\d+\/\d+\]/g) || [];
      return matches;
    };

    const walkDir = (dir: string): string[] => {
      let results: string[] = [];
      try {
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            results = results.concat(walkDir(filePath));
          } else if (file.endsWith('.tsx')) {
            const matches = checkFile(filePath);
            if (matches.length > 0) {
              results.push(`${filePath}: ${matches.join(', ')}`);
            }
          }
        }
      } catch {
        // Directory might not exist in test environment
      }
      return results;
    };

    const violations = walkDir(sharedDir);

    if (violations.length > 0) {
      console.log('Found aspect-[x/y] classes that should be converted to inline styles:');
      violations.forEach(v => console.log(`  - ${v}`));
    }

    expect(violations.length).toBe(0);
  });

  test('should not use h-72 class in shared components', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const sharedDir = path.resolve(__dirname, '../../packages/shared/src/components');

    const checkFile = (filePath: string): boolean => {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Match h-72 but not sm:h-72, md:h-72 etc., and not inside comments
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        if (/\bh-72\b/.test(line) && !/:h-72/.test(line)) {
          return true;
        }
      }
      return false;
    };

    const walkDir = (dir: string): string[] => {
      let results: string[] = [];
      try {
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            results = results.concat(walkDir(filePath));
          } else if (file.endsWith('.tsx')) {
            if (checkFile(filePath)) {
              results.push(filePath);
            }
          }
        }
      } catch {
        // Directory might not exist in test environment
      }
      return results;
    };

    const violations = walkDir(sharedDir);

    if (violations.length > 0) {
      console.log('Found h-72 class that should be converted to inline styles:');
      violations.forEach(v => console.log(`  - ${v}`));
    }

    expect(violations.length).toBe(0);
  });
});
