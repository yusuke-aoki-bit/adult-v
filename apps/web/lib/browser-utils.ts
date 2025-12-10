import { chromium, Browser } from 'playwright';

let browser: Browser | null = null;

/**
 * Get or create a browser instance
 */
export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });
  }
  return browser;
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Fetch a page with JavaScript rendering support
 */
export async function fetchWithBrowser(url: string, options?: {
  waitForSelector?: string;
  waitForTimeout?: number;
  cookies?: Array<{ name: string; value: string; domain: string; path?: string }>;
}): Promise<string> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  // Add cookies if provided
  if (options?.cookies) {
    const cookiesWithPath = options.cookies.map(cookie => ({
      ...cookie,
      path: cookie.path || '/',
    }));
    await context.addCookies(cookiesWithPath);
  }

  const page = await context.newPage();

  try {
    // Navigate to URL
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for specific selector if provided
    if (options?.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, {
        timeout: 10000,
      });
    }

    // Wait for additional timeout if provided
    if (options?.waitForTimeout) {
      await page.waitForTimeout(options.waitForTimeout);
    }

    // Get the rendered HTML
    const html = await page.content();

    await context.close();
    return html;
  } catch (error) {
    await context.close();
    throw error;
  }
}

/**
 * Fetch images from a page
 */
export async function fetchImages(url: string, options?: {
  imageSelector?: string;
  waitForImages?: boolean;
  cookies?: Array<{ name: string; value: string; domain: string }>;
}): Promise<string[]> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  if (options?.cookies) {
    await context.addCookies(options.cookies);
  }

  const page = await context.newPage();
  const images: string[] = [];

  try {
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for images to load
    if (options?.waitForImages) {
      await page.waitForLoadState('load');
      await page.waitForTimeout(2000); // Additional wait for lazy-loaded images
    }

    // Get image URLs
    const selector = options?.imageSelector || 'img';
    const imageElements = await page.locator(selector).all();

    for (const img of imageElements) {
      const src = await img.getAttribute('src');
      const dataSrc = await img.getAttribute('data-src');
      const url = src || dataSrc;

      if (url && url.startsWith('http')) {
        images.push(url);
      } else if (url && url.startsWith('/')) {
        const baseUrl = new URL(page.url()).origin;
        images.push(`${baseUrl}${url}`);
      }
    }

    await context.close();
    return images;
  } catch (error) {
    await context.close();
    throw error;
  }
}
