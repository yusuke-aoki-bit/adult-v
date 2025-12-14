/**
 * ブラウザベースクローラー
 *
 * Puppeteer + Stealth プラグインを使用したクローラー基底クラス
 * JavaScript レンダリングが必要なサイト向け
 */

import puppeteer, { Browser, Page, LaunchOptions, HTTPResponse } from 'puppeteer';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
import puppeteerExtra from 'puppeteer-extra';

import { BaseCrawler, BaseCrawlerOptions, ParsedProductData, CrawlerStats } from './base-crawler';
import { CrawlResult } from './types';
import { randomDelay } from './rate-limiter';

// Stealth Plugin を有効化
puppeteerExtra.use(StealthPlugin());

// ============================================================
// Types
// ============================================================

/**
 * ブラウザクローラーオプション
 */
export interface BrowserCrawlerOptions extends BaseCrawlerOptions {
  /** ヘッドレスモード（デフォルト: true） */
  headless?: boolean;
  /** ブラウザ起動オプション */
  launchOptions?: LaunchOptions;
  /** ページ読み込みタイムアウト（ミリ秒） */
  pageTimeout?: number;
  /** ページ間の最小遅延（ミリ秒） */
  minDelay?: number;
  /** ページ間の最大遅延（ミリ秒） */
  maxDelay?: number;
  /** User-Agent */
  userAgent?: string;
  /** ビューポート幅 */
  viewportWidth?: number;
  /** ビューポート高さ */
  viewportHeight?: number;
}

/**
 * ページコンテキスト（サブクラスで使用）
 */
export interface PageContext {
  page: Page;
  browser: Browser;
  url: string;
}

// ============================================================
// Browser Crawler Class
// ============================================================

/**
 * Puppeteerベースのクローラー抽象クラス
 *
 * 使用例:
 * ```typescript
 * class FanzaCrawler extends BrowserCrawler {
 *   protected getTargetUrls(): string[] {
 *     return ['https://www.dmm.co.jp/...'];
 *   }
 *
 *   protected async scrapePage(context: PageContext): Promise<ParsedProductData | null> {
 *     const { page } = context;
 *     const title = await page.$eval('h1', el => el.textContent);
 *     return { ... };
 *   }
 * }
 * ```
 */
export abstract class BrowserCrawler<TRawItem = unknown> extends BaseCrawler<TRawItem> {
  protected browser: Browser | null = null;
  protected browserOptions: BrowserCrawlerOptions;

  constructor(options: BrowserCrawlerOptions) {
    super(options);
    this.browserOptions = {
      headless: true,
      pageTimeout: 30000,
      minDelay: 2000,
      maxDelay: 5000,
      viewportWidth: 1920,
      viewportHeight: 1080,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...options,
    };
  }

  // ============================================================
  // Abstract Methods (Must be implemented by subclasses)
  // ============================================================

  /**
   * クロール対象のURLリストを取得
   */
  protected abstract getTargetUrls(): Promise<string[]> | string[];

  /**
   * ページをスクレイピングして商品データを抽出
   */
  protected abstract scrapePage(context: PageContext): Promise<ParsedProductData | null>;

  // ============================================================
  // Override Methods
  // ============================================================

  /**
   * fetchItems をオーバーライド（ブラウザベースの場合は使用しない）
   */
  protected async fetchItems(): Promise<TRawItem[]> {
    // BrowserCrawlerではrunメソッドをオーバーライドするため、これは呼ばれない
    return [];
  }

  /**
   * parseItem をオーバーライド（ブラウザベースの場合は使用しない）
   */
  protected parseItem(_rawItem: TRawItem): ParsedProductData | null {
    // BrowserCrawlerではrunメソッドをオーバーライドするため、これは呼ばれない
    return null;
  }

  /**
   * runメソッドをオーバーライドしてブラウザベースの処理を実装
   */
  async run(): Promise<CrawlResult> {
    this.printHeader();

    try {
      // 1. ブラウザを起動
      await this.launchBrowser();

      // 2. ターゲットURLを取得
      const urls = await this.getTargetUrls();
      this.stats.totalFetched = urls.length;
      this.log('info', `${urls.length}件のURLをクロール予定`);

      // 3. 各URLを処理
      for (const [index, url] of urls.entries()) {
        await this.processUrl(url, index, urls.length);
      }

      // 4. 完了処理
      this.stats.completedAt = new Date();
      this.stats.durationMs = this.stats.completedAt.getTime() - this.stats.startedAt.getTime();

      this.printSummary();

      return {
        success: true,
        stats: this.stats,
      };
    } catch (error) {
      this.log('error', `クローラーエラー: ${error instanceof Error ? error.message : error}`);
      return {
        success: false,
        stats: this.stats,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    } finally {
      // 5. ブラウザを閉じる
      await this.closeBrowser();
    }
  }

  // ============================================================
  // Browser Management
  // ============================================================

  /**
   * ブラウザを起動
   */
  protected async launchBrowser(): Promise<void> {
    this.log('info', 'ブラウザを起動中...');

    const defaultArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      `--window-size=${this.browserOptions.viewportWidth},${this.browserOptions.viewportHeight}`,
    ];

    const launchOptions: LaunchOptions = {
      headless: this.browserOptions.headless,
      args: [
        ...defaultArgs,
        ...(this.browserOptions.launchOptions?.args || []),
      ],
      ...this.browserOptions.launchOptions,
    };

    this.browser = await puppeteerExtra.launch(launchOptions);
    this.log('success', 'ブラウザ起動完了');
  }

  /**
   * ブラウザを閉じる
   */
  protected async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.log('info', 'ブラウザを閉じました');
    }
  }

  /**
   * 新しいページを作成
   */
  protected async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('ブラウザが起動していません');
    }

    const page = await this.browser.newPage();

    // User-Agent を設定
    if (this.browserOptions.userAgent) {
      await page.setUserAgent(this.browserOptions.userAgent);
    }

    // ビューポートを設定
    await page.setViewport({
      width: this.browserOptions.viewportWidth!,
      height: this.browserOptions.viewportHeight!,
    });

    // タイムアウトを設定
    page.setDefaultNavigationTimeout(this.browserOptions.pageTimeout!);
    page.setDefaultTimeout(this.browserOptions.pageTimeout!);

    // 不要なリソースをブロック（オプション）
    await this.setupRequestInterception(page);

    return page;
  }

  /**
   * リクエストインターセプションを設定（不要なリソースをブロック）
   */
  protected async setupRequestInterception(page: Page): Promise<void> {
    await page.setRequestInterception(true);

    page.on('request', (request) => {
      const resourceType = request.resourceType();
      const blockTypes = ['image', 'stylesheet', 'font', 'media'];

      // 画像などをブロックしてパフォーマンスを向上
      // サブクラスで変更可能
      if (this.shouldBlockResource(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
  }

  /**
   * リソースをブロックするかどうか判定（オーバーライド可能）
   */
  protected shouldBlockResource(resourceType: string): boolean {
    // デフォルトでは画像と動画のみブロック
    return ['media'].includes(resourceType);
  }

  // ============================================================
  // URL Processing
  // ============================================================

  /**
   * 単一URLを処理
   */
  protected async processUrl(url: string, index: number, total: number): Promise<void> {
    const page = await this.createPage();

    try {
      this.logProgress(index + 1, total, `アクセス中: ${url.slice(0, 60)}...`);

      // ページにアクセス
      const response = await this.navigateToPage(page, url);

      if (!response) {
        this.log('warn', 'ページの読み込みに失敗しました');
        this.stats.errors++;
        return;
      }

      // ステータスコードをチェック
      if (response.status() >= 400) {
        this.log('warn', `HTTP ${response.status()}: ${url}`);
        this.stats.errors++;
        return;
      }

      // ページをスクレイピング
      const context: PageContext = { page, browser: this.browser!, url };
      const parsed = await this.scrapePage(context);

      if (!parsed) {
        this.stats.skippedInvalid++;
        return;
      }

      // 検証
      const validation = this.validateProduct({
        title: parsed.title,
        description: parsed.description,
        originalId: parsed.originalId,
      });

      if (!validation.isValid) {
        this.log('warn', `スキップ(無効): ${validation.reason}`);
        this.stats.skippedInvalid++;
        return;
      }

      // 商品を保存
      const productId = await this.saveProduct(parsed);

      // 関連データを保存
      await this.saveRelatedData(productId, parsed);

      // AI処理
      if (this.getEffectiveEnableAI()) {
        await this.processAI(productId, parsed);
      }

      console.log();

      // ランダム遅延
      await this.delayBetweenPages();
    } catch (error) {
      this.log('error', `処理エラー: ${error instanceof Error ? error.message : error}`);
      this.stats.errors++;
    } finally {
      await page.close();
    }
  }

  /**
   * ページにナビゲート
   */
  protected async navigateToPage(page: Page, url: string): Promise<HTTPResponse | null> {
    try {
      return await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.browserOptions.pageTimeout,
      });
    } catch (error) {
      // タイムアウトの場合は部分的に読み込まれている可能性があるため続行
      if (error instanceof Error && error.message.includes('timeout')) {
        this.log('warn', 'ページ読み込みタイムアウト、続行します...');
        return null;
      }
      throw error;
    }
  }

  /**
   * ページ間の遅延
   */
  protected async delayBetweenPages(): Promise<void> {
    const { minDelay, maxDelay } = this.browserOptions;
    await randomDelay(minDelay!, maxDelay!);
  }

  // ============================================================
  // Helper Methods for Page Scraping
  // ============================================================

  /**
   * セレクタのテキストを取得
   */
  protected async getTextContent(page: Page, selector: string): Promise<string | null> {
    try {
      return await page.$eval(selector, (el) => el.textContent?.trim() || null);
    } catch {
      return null;
    }
  }

  /**
   * セレクタの属性を取得
   */
  protected async getAttribute(page: Page, selector: string, attribute: string): Promise<string | null> {
    try {
      return await page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
    } catch {
      return null;
    }
  }

  /**
   * 複数要素のテキストを取得
   */
  protected async getAllTextContents(page: Page, selector: string): Promise<string[]> {
    try {
      return await page.$$eval(selector, (els) =>
        els.map((el) => el.textContent?.trim()).filter((t): t is string => !!t)
      );
    } catch {
      return [];
    }
  }

  /**
   * 複数要素の属性を取得
   */
  protected async getAllAttributes(page: Page, selector: string, attribute: string): Promise<string[]> {
    try {
      return await page.$$eval(
        selector,
        (els, attr) => els.map((el) => el.getAttribute(attr)).filter((a): a is string => !!a),
        attribute
      );
    } catch {
      return [];
    }
  }

  /**
   * 要素が存在するかチェック
   */
  protected async elementExists(page: Page, selector: string): Promise<boolean> {
    try {
      const element = await page.$(selector);
      return element !== null;
    } catch {
      return false;
    }
  }

  /**
   * 要素が表示されるまで待機
   */
  protected async waitForElement(page: Page, selector: string, timeout?: number): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout: timeout || this.browserOptions.pageTimeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * JavaScriptを実行
   */
  protected async evaluateScript<T>(page: Page, script: string): Promise<T | null> {
    try {
      return await page.evaluate(script) as T | null;
    } catch {
      return null;
    }
  }

  /**
   * ページのHTMLを取得
   */
  protected async getPageHtml(page: Page): Promise<string> {
    return await page.content();
  }

  /**
   * スクリーンショットを撮影（デバッグ用）
   */
  protected async takeScreenshot(page: Page, path: string): Promise<void> {
    await page.screenshot({ path, fullPage: true });
    this.log('info', `スクリーンショット保存: ${path}`);
  }
}

// ============================================================
// Export
// ============================================================

export { puppeteerExtra as puppeteer };
