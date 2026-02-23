import { Page } from '@playwright/test';

/**
 * E2Eテスト用イベントトラッキングヘルパー
 * 全イベントの発火をキャプチャしてカバレッジを収集
 */

// 全イベント定義
export const ALL_EVENTS = {
  // Firebase Analytics Events
  analytics: [
    'page_view',
    'search',
    'view_product',
    'add_favorite',
    'remove_favorite',
    'click_affiliate_link',
    'filter_applied',
    'sort_changed',
    'age_verified',
    'theme_changed',
    'language_changed',
    'notification_permission_granted',
    'notification_permission_denied',
  ],
  // A/B Testing Events
  abTesting: ['cta_click', 'experiment_impression'],
  // Performance Events (Web Vitals)
  performance: ['web_vitals'],
} as const;

export type AnalyticsEventName = (typeof ALL_EVENTS.analytics)[number];
export type ABTestingEventName = (typeof ALL_EVENTS.abTesting)[number];
export type PerformanceEventName = (typeof ALL_EVENTS.performance)[number];
export type AllEventName = AnalyticsEventName | ABTestingEventName | PerformanceEventName;

export interface CapturedEvent {
  name: string;
  params: Record<string, unknown>;
  timestamp: number;
  source: 'analytics' | 'gtag';
}

export interface EventCoverage {
  total: number;
  captured: number;
  percentage: number;
  events: Record<string, { fired: boolean; count: number; lastParams?: Record<string, unknown> }>;
}

/**
 * イベントテストヘルパークラス
 */
export class EventTestHelper {
  private page: Page;
  private capturedEvents: CapturedEvent[] = [];
  private isIntercepting = false;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * イベントインターセプトを開始
   */
  async startCapturing(): Promise<void> {
    if (this.isIntercepting) return;

    // ページにイベントキャプチャ用のグローバル変数を注入
    await this.page.addInitScript(() => {
      // @ts-expect-error グローバル変数
      window.__capturedEvents = [];

      // gtagをラップ
      const originalGtag = (window as any).gtag;
      (window as any).gtag = function (...args: unknown[]) {
        if (args[0] === 'event' && typeof args[1] === 'string') {
          // @ts-expect-error グローバル変数
          window.__capturedEvents.push({
            name: args[1],
            params: args[2] || {},
            timestamp: Date.now(),
            source: 'gtag',
          });
        }
        if (originalGtag) {
          originalGtag.apply(this, args);
        }
      };

      // dataLayerのpushメソッドをラップ (GTM/GA4用)
      (window as any).dataLayer = (window as any).dataLayer || [];
      const originalPush = (window as any).dataLayer.push;
      (window as any).dataLayer.push = function (...args: unknown[]) {
        for (const arg of args) {
          if (arg && typeof arg === 'object' && 'event' in arg) {
            const eventObj = arg as { event: string; [key: string]: unknown };
            // @ts-expect-error グローバル変数
            window.__capturedEvents.push({
              name: eventObj.event,
              params: eventObj,
              timestamp: Date.now(),
              source: 'dataLayer',
            });
          }
        }
        return originalPush.apply(this, args);
      };

      // consoleにログを出力するカスタムイベントリスナー
      // @ts-expect-error グローバル変数
      window.__logEvent = function (eventName: string, params: Record<string, unknown>) {
        // @ts-expect-error グローバル変数
        window.__capturedEvents.push({
          name: eventName,
          params: params || {},
          timestamp: Date.now(),
          source: 'custom',
        });
      };
    });

    this.isIntercepting = true;
  }

  /**
   * キャプチャしたイベントを取得
   */
  async getCapturedEvents(): Promise<CapturedEvent[]> {
    const events = await this.page.evaluate(() => {
      // @ts-expect-error グローバル変数
      return window.__capturedEvents || [];
    });
    this.capturedEvents = [...this.capturedEvents, ...events];

    // ページ側のイベント配列をクリア
    await this.page.evaluate(() => {
      // @ts-expect-error グローバル変数
      window.__capturedEvents = [];
    });

    return this.capturedEvents;
  }

  /**
   * イベントカバレッジを計算
   */
  async getEventCoverage(): Promise<EventCoverage> {
    await this.getCapturedEvents();

    const allEventNames = [...ALL_EVENTS.analytics, ...ALL_EVENTS.abTesting, ...ALL_EVENTS.performance];
    const events: Record<string, { fired: boolean; count: number; lastParams?: Record<string, unknown> }> = {};

    // 全イベントを初期化
    for (const name of allEventNames) {
      events[name] = { fired: false, count: 0 };
    }

    // キャプチャしたイベントをカウント
    for (const event of this.capturedEvents) {
      if (events[event.name] !== undefined) {
        events[event.name]!.fired = true;
        events[event.name]!.count++;
        events[event.name]!.lastParams = event.params as Record<string, unknown>;
      }
    }

    const total = allEventNames.length;
    const captured = Object.values(events).filter((e) => e.fired).length;
    const percentage = Math.round((captured / total) * 100);

    return { total, captured, percentage, events };
  }

  /**
   * 特定のイベントが発火したかチェック
   */
  async hasEventFired(eventName: AllEventName): Promise<boolean> {
    await this.getCapturedEvents();
    return this.capturedEvents.some((e) => e.name === eventName);
  }

  /**
   * 特定のイベントの発火回数を取得
   */
  async getEventCount(eventName: AllEventName): Promise<number> {
    await this.getCapturedEvents();
    return this.capturedEvents.filter((e) => e.name === eventName).length;
  }

  /**
   * 特定のイベントのパラメータを取得
   */
  async getEventParams(eventName: AllEventName): Promise<Record<string, unknown>[]> {
    await this.getCapturedEvents();
    return this.capturedEvents.filter((e) => e.name === eventName).map((e) => e.params);
  }

  /**
   * キャプチャをリセット
   */
  async reset(): Promise<void> {
    this.capturedEvents = [];
    await this.page.evaluate(() => {
      // @ts-expect-error グローバル変数
      window.__capturedEvents = [];
    });
  }

  /**
   * カバレッジレポートを出力
   */
  async printCoverageReport(): Promise<string> {
    const coverage = await this.getEventCoverage();

    let report = '\n=== Event Coverage Report ===\n';
    report += `Total Events: ${coverage.total}\n`;
    report += `Captured: ${coverage.captured}\n`;
    report += `Coverage: ${coverage.percentage}%\n\n`;

    report += '--- Analytics Events ---\n';
    for (const name of ALL_EVENTS.analytics) {
      const event = coverage.events[name]!;
      const status = event.fired ? '✓' : '✗';
      report += `${status} ${name}: ${event.count} fires\n`;
    }

    report += '\n--- A/B Testing Events ---\n';
    for (const name of ALL_EVENTS.abTesting) {
      const event = coverage.events[name]!;
      const status = event.fired ? '✓' : '✗';
      report += `${status} ${name}: ${event.count} fires\n`;
    }

    report += '\n--- Performance Events ---\n';
    for (const name of ALL_EVENTS.performance) {
      const event = coverage.events[name]!;
      const status = event.fired ? '✓' : '✗';
      report += `${status} ${name}: ${event.count} fires\n`;
    }

    report += '\n=== End Report ===\n';

    console.log(report);
    return report;
  }

  /**
   * 期待されるイベントが発火するまで待機
   */
  async waitForEvent(eventName: AllEventName, timeout = 5000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await this.hasEventFired(eventName)) {
        return true;
      }
      await this.page.waitForTimeout(100);
    }

    return false;
  }
}

/**
 * age-verified cookieを設定
 */
export async function setAgeVerifiedCookie(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: 'age-verified',
      value: 'true',
      domain: 'localhost',
      path: '/',
    },
  ]);
}

/**
 * ローカルストレージをクリア
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
  });
}
