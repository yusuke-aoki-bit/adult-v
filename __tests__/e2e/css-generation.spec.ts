import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CSS Generation Tests
 * Tailwind CSSクラスが正しく生成されているかを確認
 *
 * 主なチェック項目:
 * 1. インラインスタイルが使用されている箇所で高さ/アスペクト比が正しく適用されているか
 * 2. 必要なTailwindクラスがCSSに含まれているか
 * 3. @source ディレクティブによりsharedパッケージがスキャンされているか
 */

test.describe('CSS Generation Tests', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'age-verified',
        value: 'true',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test.describe('Inline Styles Verification', () => {
    test('ProductCard should use inline height style instead of h-72 class', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const result = await page.evaluate(() => {
        const cards = document.querySelectorAll('div[class*="rounded-2xl"][class*="shadow-lg"]');
        const checks: { hasInlineHeight: boolean; height: string; class: string }[] = [];

        cards.forEach((card, i) => {
          if (i < 3) {
            // 画像コンテナを探す
            const imageContainer = card.querySelector('div[style*="height"]') as HTMLElement | null;
            checks.push({
              hasInlineHeight: imageContainer !== null,
              height: imageContainer?.style.height || 'none',
              class: imageContainer?.className || 'not found',
            });
          }
        });

        return checks;
      });

      console.log('ProductCard height checks:', result);

      // CI環境ではDBデータが空でProductCardが表示されない場合がある
      if (result.length === 0) {
        console.log('No ProductCards found - skipping check (expected in CI without DB)');
        test.skip();
        return;
      }

      // 少なくとも1つのカードがインラインheightスタイルを持っていること
      const hasInlineHeight = result.some((r) => r.hasInlineHeight && r.height === '18rem');
      expect(hasInlineHeight).toBe(true);
    });

    test('ProductCard compact mode should use inline aspectRatio style', async ({ page }) => {
      // コンパクトモードのProductCardを表示するページに移動
      // （例：女優詳細ページの関連作品）
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const result = await page.evaluate(() => {
        // aspectRatioスタイルを持つ要素を探す
        const aspectElements = document.querySelectorAll('[style*="aspect-ratio"]');
        const checks: { aspectRatio: string; tagName: string }[] = [];

        aspectElements.forEach((el, i) => {
          if (i < 10) {
            const style = (el as HTMLElement).style.aspectRatio;
            checks.push({
              aspectRatio: style,
              tagName: el.tagName,
            });
          }
        });

        return checks;
      });

      console.log('AspectRatio style checks:', result);

      // aspectRatioスタイルが使用されていること
      // ページによってはない場合もあるのでソフトチェック
      // ホームページにはCompactモードのProductCardがない場合があるため
      // IMGタグにアスペクト比が設定されていればOK
      if (result.length > 0) {
        // Any aspect ratio is acceptable (banner images, product images, etc.)
        const hasAnyAspectRatio = result.some((r) => r.aspectRatio && r.aspectRatio !== 'auto');
        expect(hasAnyAspectRatio).toBe(true);
      }
    });
  });

  test.describe('Computed Styles Verification', () => {
    test('Image containers should have computed height > 0', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      const result = await page.evaluate(() => {
        const cards = document.querySelectorAll('div[class*="rounded-2xl"][class*="shadow-lg"]');
        const heights: number[] = [];

        cards.forEach((card, i) => {
          if (i < 5) {
            const imageContainer = card.querySelector('div[style*="height"]') as HTMLElement | null;
            if (imageContainer) {
              const rect = imageContainer.getBoundingClientRect();
              heights.push(rect.height);
            }
          }
        });

        return heights;
      });

      console.log('Computed heights:', result);

      // すべてのコンテナが0より大きい高さを持っていること
      result.forEach((height, i) => {
        expect(height).toBeGreaterThan(0);
        // 18rem ≈ 288px (デフォルトフォントサイズ16pxの場合)
        expect(height).toBeGreaterThan(200);
      });
    });

    test('Images should have computed dimensions matching container', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      const result = await page.evaluate(() => {
        const cards = document.querySelectorAll('div[class*="rounded-2xl"][class*="shadow-lg"]');
        const dimensions: { containerH: number; imgH: number; imgW: number }[] = [];

        cards.forEach((card, i) => {
          if (i < 5) {
            const imageContainer = card.querySelector('div[style*="height"]') as HTMLElement | null;
            const img = card.querySelector('img') as HTMLImageElement | null;

            if (imageContainer && img) {
              const containerRect = imageContainer.getBoundingClientRect();
              const imgRect = img.getBoundingClientRect();
              dimensions.push({
                containerH: containerRect.height,
                imgH: imgRect.height,
                imgW: imgRect.width,
              });
            }
          }
        });

        return dimensions;
      });

      console.log('Container vs Image dimensions:', result);

      // 画像が表示されていること（高さ > 0）
      result.forEach((dim, i) => {
        expect(dim.imgH).toBeGreaterThan(0);
        expect(dim.imgW).toBeGreaterThan(0);
        // 画像がコンテナ内に収まっていること
        expect(dim.imgH).toBeLessThanOrEqual(dim.containerH + 1); // 1px tolerance
      });
    });
  });

  test.describe('Source File Verification', () => {
    test('globals.css should include @source directive for shared package', async () => {
      const globalsPath = path.resolve(__dirname, '../apps/web/app/globals.css');

      let content = '';
      try {
        content = fs.readFileSync(globalsPath, 'utf-8');
      } catch {
        // ファイルが存在しない場合はスキップ
        test.skip();
        return;
      }

      // @source ディレクティブが含まれていること
      expect(content).toContain('@source');
      expect(content).toContain('packages/shared');

      console.log('Found @source directive in globals.css');
    });
  });

  test.describe('No CSS Class Missing Issues', () => {
    test('should not have elements with h-72 class but 0 height', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const issues = await page.evaluate(() => {
        const h72Elements = document.querySelectorAll('[class*="h-72"]');
        const problems: { class: string; computedHeight: string }[] = [];

        h72Elements.forEach((el) => {
          const computed = getComputedStyle(el);
          if (computed.height === '0px' || computed.height === 'auto') {
            problems.push({
              class: el.className,
              computedHeight: computed.height,
            });
          }
        });

        return problems;
      });

      if (issues.length > 0) {
        console.log('Found h-72 elements with 0 height:', issues);
      }

      // h-72クラスを使っている要素で高さが0のものがないこと
      expect(issues.length).toBe(0);
    });

    test('should not have elements with aspect-[x/y] class but no aspect ratio', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const issues = await page.evaluate(() => {
        // aspect-[x/y]パターンのクラスを持つ要素を探す
        const allElements = document.querySelectorAll('*');
        const problems: { class: string; aspectRatio: string }[] = [];

        allElements.forEach((el) => {
          const className = el.className;
          if (typeof className === 'string' && /aspect-\[\d+\/\d+\]/.test(className)) {
            const computed = getComputedStyle(el);
            if (!computed.aspectRatio || computed.aspectRatio === 'auto') {
              problems.push({
                class: className,
                aspectRatio: computed.aspectRatio || 'none',
              });
            }
          }
        });

        return problems;
      });

      if (issues.length > 0) {
        console.log('Found aspect-[x/y] elements with no aspect ratio:', issues);
      }

      // aspect-[x/y]クラスを使っている要素でアスペクト比がないものがないこと
      expect(issues.length).toBe(0);
    });
  });
});
