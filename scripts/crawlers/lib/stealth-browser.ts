/**
 * puppeteer-extra + stealth プラグインを使用したブラウザユーティリティ
 * Bot検出を回避してWebスクレイピングを行うための共通モジュール
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page, LaunchOptions } from 'puppeteer';

// Stealth プラグインを有効化
puppeteer.use(StealthPlugin());

export interface BrowserOptions {
  headless?: boolean;
  timeout?: number;
  userAgent?: string;
  viewport?: { width: number; height: number };
}

export interface FetchResult {
  html: string;
  status: number;
  url: string;
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };

/**
 * Stealthブラウザインスタンスを作成
 */
export async function createStealthBrowser(options: BrowserOptions = {}): Promise<Browser> {
  const launchOptions: LaunchOptions = {
    headless: options.headless !== false ? 'shell' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
    ],
  };

  const browser = await puppeteer.launch(launchOptions);
  return browser;
}

/**
 * ページを設定（User-Agent、Viewport等）
 */
export async function setupPage(page: Page, options: BrowserOptions = {}): Promise<void> {
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;
  const viewport = options.viewport || DEFAULT_VIEWPORT;
  const timeout = options.timeout || 30000;

  await page.setUserAgent(userAgent);
  await page.setViewport(viewport);
  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout);

  // JavaScript実行時のWebDriver検出を回避
  await page.evaluateOnNewDocument(() => {
    // webdriver プロパティを削除
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // plugins配列を偽装
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ],
    });

    // languages を設定
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ja-JP', 'ja', 'en-US', 'en'],
    });
  });
}

/**
 * URLからHTMLを取得（Stealth対応）
 */
export async function fetchWithStealth(url: string, options: BrowserOptions = {}): Promise<FetchResult> {
  const browser = await createStealthBrowser(options);

  try {
    const page = await browser.newPage();
    await setupPage(page, options);

    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
    });

    const html = await page.content();
    const status = response?.status() || 0;
    const finalUrl = page.url();

    return { html, status, url: finalUrl };
  } finally {
    await browser.close();
  }
}

/**
 * 複数のURLを順次取得（レート制限付き）
 */
export async function fetchMultipleWithStealth(
  urls: string[],
  options: BrowserOptions & { delayMs?: number } = {},
): Promise<Map<string, FetchResult>> {
  const browser = await createStealthBrowser(options);
  const results = new Map<string, FetchResult>();
  const delayMs = options.delayMs || 2000;

  try {
    const page = await browser.newPage();
    await setupPage(page, options);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`[${i + 1}/${urls.length}] Fetching: ${url}`);

      try {
        const response = await page.goto(url, {
          waitUntil: 'networkidle0',
        });

        const html = await page.content();
        const status = response?.status() || 0;
        const finalUrl = page.url();

        results.set(url, { html, status, url: finalUrl });

        // レート制限
        if (i < urls.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        console.error(`  Error fetching ${url}:`, error);
        results.set(url, { html: '', status: 0, url });
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

/**
 * ブラウザを再利用するクローラークラス
 */
export class StealthCrawler {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private options: BrowserOptions;

  constructor(options: BrowserOptions = {}) {
    this.options = options;
  }

  async init(): Promise<void> {
    if (this.browser) return;

    this.browser = await createStealthBrowser(this.options);
    this.page = await this.browser.newPage();
    await setupPage(this.page, this.options);
  }

  async fetch(url: string): Promise<FetchResult> {
    if (!this.browser || !this.page) {
      await this.init();
    }

    const response = await this.page!.goto(url, {
      waitUntil: 'networkidle0',
    });

    const html = await this.page!.content();
    const status = response?.status() || 0;
    const finalUrl = this.page!.url();

    return { html, status, url: finalUrl };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * ページオブジェクトを直接取得（高度な操作用）
   */
  async getPage(): Promise<Page> {
    if (!this.browser || !this.page) {
      await this.init();
    }
    return this.page!;
  }
}

/**
 * 単純なfetch代替（ステルスブラウザ不要な場合）
 * レート制限とUser-Agent設定のみ
 */
export async function simpleFetch(
  url: string,
  options: { userAgent?: string } = {},
): Promise<{ html: string; status: number }> {
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;

  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  });

  const html = await response.text();
  return { html, status: response.status };
}
