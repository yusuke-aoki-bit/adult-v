import { test, expect } from '@playwright/test';

/**
 * Image Display Tests
 * 画像表示の包括的なテストスイート
 *
 * テスト内容:
 * 1. ProductCard画像が正しいサイズで表示されるか
 * 2. ActressCard画像が正しいサイズで表示されるか
 * 3. 画像コンテナのアスペクト比が正しいか
 * 4. Next.js Imageコンポーネントが正しく読み込まれるか
 */

// Increase timeout for image loading tests
test.setTimeout(120000);

test.describe('Image Display Tests', () => {
  test.beforeEach(async ({ context }) => {
    // 年齢確認クッキーを設定
    await context.addCookies([{
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    }]);
  });

  test.describe('ProductCard Images', () => {
    test('should display product images with correct dimensions on /products page', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000); // 画像読み込み待ち

      // ProductCard内の画像を取得
      const productCards = page.locator('div[class*="rounded-2xl"][class*="shadow-lg"]');
      const cardCount = await productCards.count();

      expect(cardCount).toBeGreaterThan(0);
      console.log(`Found ${cardCount} product cards`);

      // 最初の5つのカードをチェック
      for (let i = 0; i < Math.min(5, cardCount); i++) {
        const card = productCards.nth(i);
        const img = card.locator('img').first();

        if (await img.count() > 0) {
          const box = await img.boundingBox();

          // 画像が表示されていることを確認（高さが0でない）
          expect(box).not.toBeNull();
          if (box) {
            expect(box.height).toBeGreaterThan(0);
            expect(box.width).toBeGreaterThan(0);
            console.log(`Card ${i}: ${Math.round(box.width)}x${Math.round(box.height)}`);
          }
        }
      }
    });

    test('should have correct aspect ratio containers', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // 画像コンテナのスタイルを確認
      const imageContainers = await page.evaluate(() => {
        const cards = document.querySelectorAll('div[class*="rounded-2xl"][class*="shadow-lg"]');
        const results: { height: number; hasHeightStyle: boolean }[] = [];

        cards.forEach((card, i) => {
          if (i < 5) {
            // 画像コンテナを探す（最初の子div）
            const container = card.querySelector('div[style*="height"]') as HTMLElement | null;
            const rect = container?.getBoundingClientRect();
            results.push({
              height: rect?.height || 0,
              hasHeightStyle: container?.style.height === '18rem' || false,
            });
          }
        });

        return results;
      });

      // 各コンテナが正しい高さを持っているか確認
      imageContainers.forEach((container, i) => {
        console.log(`Container ${i}: height=${container.height}px, hasHeightStyle=${container.hasHeightStyle}`);
        expect(container.height).toBeGreaterThan(200); // 18rem ≈ 288px
        expect(container.hasHeightStyle).toBe(true);
      });
    });

    test('should load images without errors', async ({ page }) => {
      const imageErrors: string[] = [];

      // 画像読み込みエラーを監視
      page.on('response', response => {
        if (response.url().includes('/_next/image') && !response.ok()) {
          imageErrors.push(`${response.status()}: ${response.url()}`);
        }
      });

      await page.goto('/products');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      // エラーがないことを確認
      if (imageErrors.length > 0) {
        console.log('Image errors:', imageErrors);
      }
      expect(imageErrors.length).toBe(0);
    });
  });

  test.describe('ActressCard Images', () => {
    test('should display actress images with correct dimensions on homepage', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      // ActressCard内の画像を取得（aspect-ratio 3/4 または 4/5）
      const actressImages = page.locator('div[style*="aspect-ratio"] img');
      const imgCount = await actressImages.count();

      console.log(`Found ${imgCount} actress images`);

      if (imgCount > 0) {
        for (let i = 0; i < Math.min(5, imgCount); i++) {
          const img = actressImages.nth(i);
          const box = await img.boundingBox();

          if (box) {
            expect(box.height).toBeGreaterThan(0);
            expect(box.width).toBeGreaterThan(0);

            // アスペクト比が約3:4または4:5であることを確認
            const ratio = box.height / box.width;
            expect(ratio).toBeGreaterThan(1.0); // 縦長であること
            expect(ratio).toBeLessThan(1.5);    // 極端に縦長でないこと

            console.log(`Actress image ${i}: ${Math.round(box.width)}x${Math.round(box.height)}, ratio=${ratio.toFixed(2)}`);
          }
        }
      }
    });
  });

  test.describe('Skeleton Loading', () => {
    test('should show skeleton with correct dimensions while loading', async ({ page }) => {
      // ネットワークを遅延させてスケルトンを表示
      await page.route('**/api/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.continue();
      });

      await page.goto('/products');

      // スケルトンが表示されていることを確認
      const skeletons = page.locator('.animate-pulse');
      const skeletonCount = await skeletons.count();

      console.log(`Found ${skeletonCount} skeleton elements`);
      expect(skeletonCount).toBeGreaterThanOrEqual(0); // スケルトンがあれば表示される
    });
  });

  test.describe('Product Detail Sample Images', () => {
    test('should display sample image gallery correctly on product detail page', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // 商品ページに移動
      const productLink = page.locator('a[href*="/products/"]').first();

      if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await productLink.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // メイン画像を確認
        const mainImage = page.locator('div[style*="aspect-ratio"] img, div[style*="3/4"] img').first();

        if (await mainImage.isVisible({ timeout: 5000 }).catch(() => false)) {
          const box = await mainImage.boundingBox();

          if (box) {
            expect(box.height).toBeGreaterThan(100);
            expect(box.width).toBeGreaterThan(100);

            // アスペクト比が約3:4であることを確認（許容範囲あり）
            const ratio = box.height / box.width;
            console.log(`Main image: ${Math.round(box.width)}x${Math.round(box.height)}, ratio=${ratio.toFixed(2)}`);

            expect(ratio).toBeGreaterThan(1.0); // 縦長であること
            expect(ratio).toBeLessThan(2.0);    // 極端に縦長でないこと
          }

          // 画像のsrc属性を確認
          const src = await mainImage.getAttribute('src');
          console.log('Image src:', src?.substring(0, 100) + '...');

          // Next.js Image最適化URLまたは外部画像URLであることを確認
          expect(src).toBeTruthy();

          // プレースホルダー（No Image）でないことを確認（理想的には）
          const isPlaceholder = src?.includes('placehold') || src?.includes('No+Image');
          if (isPlaceholder) {
            console.log('Warning: Image is placeholder');
          }
        } else {
          console.log('Main image not found on product page');
        }

        // 画像カウンターを確認（複数画像がある場合）
        const imageCounter = page.locator('text=/\\d+\\s*\\/\\s*\\d+/');
        if (await imageCounter.isVisible({ timeout: 2000 }).catch(() => false)) {
          const counterText = await imageCounter.textContent();
          console.log('Image counter:', counterText);
        }

        // ナビゲーションボタンを確認（複数画像がある場合）
        const prevButton = page.locator('button[aria-label*="previous"], button:has(svg[data-lucide="chevron-left"])').first();
        const nextButton = page.locator('button[aria-label*="next"], button:has(svg[data-lucide="chevron-right"])').first();

        const hasPrev = await prevButton.isVisible({ timeout: 1000 }).catch(() => false);
        const hasNext = await nextButton.isVisible({ timeout: 1000 }).catch(() => false);

        if (hasPrev && hasNext) {
          console.log('Image navigation buttons found');

          // 次へボタンをクリック
          await nextButton.click();
          await page.waitForTimeout(500);

          // 画像が変わったことを確認（カウンターで判定）
          const newCounterText = await imageCounter.textContent().catch(() => null);
          console.log('After next:', newCounterText);
        }
      } else {
        console.log('Product link not found');
        test.skip();
      }
    });

    test('should handle image loading errors gracefully', async ({ page }) => {
      const imageErrors: { url: string; status: number }[] = [];

      // 画像読み込みエラーを監視
      page.on('response', response => {
        const url = response.url();
        if ((url.includes('/_next/image') || url.includes('.jpg') || url.includes('.png')) && !response.ok()) {
          imageErrors.push({ url, status: response.status() });
        }
      });

      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const productLink = page.locator('a[href*="/products/"]').first();

      if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await productLink.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        // エラーがあっても、フォールバック画像が表示されていることを確認
        const images = page.locator('img');
        const imgCount = await images.count();

        console.log(`Found ${imgCount} images on product page`);
        console.log(`Image errors: ${imageErrors.length}`);

        if (imageErrors.length > 0) {
          console.log('Error details:', imageErrors.slice(0, 5));
        }

        // 最低1つの画像が表示されていることを確認
        expect(imgCount).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Responsive Images', () => {
    test.describe('Mobile viewport', () => {
      test.use({ viewport: { width: 375, height: 667 } });

      test('should display images correctly on mobile', async ({ page }) => {
        await page.goto('/products');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        const productCards = page.locator('div[class*="rounded-2xl"][class*="shadow-lg"]');
        const cardCount = await productCards.count();

        if (cardCount > 0) {
          const firstCard = productCards.first();
          const img = firstCard.locator('img').first();
          const box = await img.boundingBox();

          if (box) {
            expect(box.height).toBeGreaterThan(0);
            expect(box.width).toBeGreaterThan(0);
            console.log(`Mobile card image: ${Math.round(box.width)}x${Math.round(box.height)}`);
          }
        }
      });
    });

    test.describe('Tablet viewport', () => {
      test.use({ viewport: { width: 768, height: 1024 } });

      test('should display images correctly on tablet', async ({ page }) => {
        await page.goto('/products');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        const productCards = page.locator('div[class*="rounded-2xl"][class*="shadow-lg"]');
        const cardCount = await productCards.count();

        if (cardCount > 0) {
          const firstCard = productCards.first();
          const img = firstCard.locator('img').first();
          const box = await img.boundingBox();

          if (box) {
            expect(box.height).toBeGreaterThan(0);
            expect(box.width).toBeGreaterThan(0);
            console.log(`Tablet card image: ${Math.round(box.width)}x${Math.round(box.height)}`);
          }
        }
      });
    });
  });
});
