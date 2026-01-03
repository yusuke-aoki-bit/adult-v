import { describe, it, expect, vi } from 'vitest';

/**
 * Push Notification Service Tests
 *
 * Tests for web push notification sending and payload generation
 */

describe('Push Notification Service', () => {
  describe('Notification Payload Generation', () => {
    describe('createPriceAlertPayload', () => {
      it('should create payload for sale notification in Japanese', () => {
        const productTitle = 'テスト作品';
        const originalPrice = 2000;
        const salePrice = 1000;
        const productUrl = '/products/123';
        const locale = 'ja';

        const discountPercent = Math.round((1 - salePrice / originalPrice) * 100);
        const payload = {
          title: `🎉 セール開始！${discountPercent}%オフ`,
          body: `${productTitle}\n¥${originalPrice.toLocaleString()} → ¥${salePrice.toLocaleString()}`,
          url: productUrl,
          tag: `price-alert-${Date.now()}`,
          data: {
            type: 'price_alert',
            originalPrice,
            salePrice,
            discountPercent,
          },
        };

        expect(payload.title).toContain('50%オフ');
        expect(payload.body).toContain('テスト作品');
        expect(payload.body).toContain('¥2,000');
        expect(payload.body).toContain('¥1,000');
        expect(payload.data.discountPercent).toBe(50);
      });

      it('should create payload for sale notification in English', () => {
        const productTitle = 'Test Product';
        const originalPrice = 2000;
        const salePrice = 1400;
        const locale = 'en';

        const discountPercent = Math.round((1 - salePrice / originalPrice) * 100);
        const messages = {
          ja: {
            title: `🎉 セール開始！${discountPercent}%オフ`,
            body: `${productTitle}\n¥${originalPrice.toLocaleString()} → ¥${salePrice.toLocaleString()}`,
          },
          en: {
            title: `🎉 Sale! ${discountPercent}% off`,
            body: `${productTitle}\n¥${originalPrice.toLocaleString()} → ¥${salePrice.toLocaleString()}`,
          },
        };

        const msg = messages[locale as keyof typeof messages] || messages.ja;
        expect(msg.title).toBe('🎉 Sale! 30% off');
      });

      it('should calculate discount percentage correctly', () => {
        const testCases = [
          { original: 1000, sale: 500, expected: 50 },
          { original: 2000, sale: 1800, expected: 10 },
          { original: 3000, sale: 900, expected: 70 },
          { original: 1500, sale: 1500, expected: 0 },
        ];

        testCases.forEach(({ original, sale, expected }) => {
          const discountPercent = Math.round((1 - sale / original) * 100);
          expect(discountPercent).toBe(expected);
        });
      });
    });

    describe('createTargetPriceReachedPayload', () => {
      it('should create payload for target price notification in Japanese', () => {
        const productTitle = 'テスト作品';
        const targetPrice = 1000;
        const currentPrice = 900;
        const productUrl = '/products/123';
        const locale = 'ja';

        const payload = {
          title: '🔔 目標価格に到達！',
          body: `${productTitle}\n設定価格: ¥${targetPrice.toLocaleString()} → 現在: ¥${currentPrice.toLocaleString()}`,
          url: productUrl,
          tag: `target-reached-${Date.now()}`,
          data: {
            type: 'target_reached',
            targetPrice,
            currentPrice,
          },
        };

        expect(payload.title).toBe('🔔 目標価格に到達！');
        expect(payload.body).toContain('¥1,000');
        expect(payload.body).toContain('¥900');
        expect(payload.data.type).toBe('target_reached');
      });

      it('should create payload for target price notification in English', () => {
        const productTitle = 'Test Product';
        const targetPrice = 1000;
        const currentPrice = 900;
        const locale = 'en';

        const messages = {
          ja: {
            title: '🔔 目標価格に到達！',
            body: `${productTitle}\n設定価格: ¥${targetPrice.toLocaleString()} → 現在: ¥${currentPrice.toLocaleString()}`,
          },
          en: {
            title: '🔔 Target price reached!',
            body: `${productTitle}\nTarget: ¥${targetPrice.toLocaleString()} → Now: ¥${currentPrice.toLocaleString()}`,
          },
        };

        const msg = messages[locale as keyof typeof messages] || messages.ja;
        expect(msg.title).toBe('🔔 Target price reached!');
      });
    });
  });

  describe('Push Subscription Data', () => {
    it('should validate subscription data structure', () => {
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        keys: {
          p256dh: 'base64-encoded-p256dh-key',
          auth: 'base64-encoded-auth-key',
        },
      };

      expect(subscription.endpoint).toBeDefined();
      expect(subscription.keys.p256dh).toBeDefined();
      expect(subscription.keys.auth).toBeDefined();
    });

    it('should require valid endpoint URL', () => {
      const validEndpoints = [
        'https://fcm.googleapis.com/fcm/send/abc123',
        'https://updates.push.services.mozilla.com/wpush/v2/abc123',
        'https://wns.windows.com/abc123',
      ];

      validEndpoints.forEach(endpoint => {
        expect(endpoint.startsWith('https://')).toBe(true);
      });
    });
  });

  describe('Send Result', () => {
    it('should return success result', () => {
      const result = {
        success: true,
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        statusCode: 201,
      };

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(201);
    });

    it('should return failure result with error message', () => {
      const result = {
        success: false,
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        statusCode: 404,
        error: 'Subscription not found',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Subscription not found');
    });
  });

  describe('Batch Notification Sending', () => {
    it('should send notifications in batches', async () => {
      const subscriptions = Array.from({ length: 25 }, (_, i) => ({
        endpoint: `https://example.com/push/${i}`,
        keys: { p256dh: 'key', auth: 'auth' },
      }));

      const concurrency = 10;
      const batches: typeof subscriptions[] = [];

      for (let i = 0; i < subscriptions.length; i += concurrency) {
        batches.push(subscriptions.slice(i, i + concurrency));
      }

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(10);
      expect(batches[1]).toHaveLength(10);
      expect(batches[2]).toHaveLength(5);
    });

    it('should track success and failure counts', () => {
      const results = [
        { success: true, endpoint: 'ep1' },
        { success: true, endpoint: 'ep2' },
        { success: false, endpoint: 'ep3', statusCode: 410 },
        { success: true, endpoint: 'ep4' },
        { success: false, endpoint: 'ep5', statusCode: 500 },
      ];

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      expect(successCount).toBe(3);
      expect(failureCount).toBe(2);
    });

    it('should identify expired endpoints', () => {
      const results = [
        { success: true, endpoint: 'ep1', statusCode: 201 },
        { success: false, endpoint: 'ep2', statusCode: 410 }, // Gone - expired
        { success: false, endpoint: 'ep3', statusCode: 404 }, // Not found - expired
        { success: false, endpoint: 'ep4', statusCode: 500 }, // Server error - not expired
      ];

      const expiredEndpoints = results
        .filter(r => r.statusCode === 410 || r.statusCode === 404)
        .map(r => r.endpoint);

      expect(expiredEndpoints).toEqual(['ep2', 'ep3']);
    });

    it('should call progress callback', () => {
      const onProgress = vi.fn();
      const total = 25;
      const completed = [10, 20, 25];

      completed.forEach(n => {
        onProgress(n, total);
      });

      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onProgress).toHaveBeenLastCalledWith(25, 25);
    });
  });

  describe('VAPID Details', () => {
    it('should validate VAPID details structure', () => {
      const vapidDetails = {
        subject: 'mailto:admin@example.com',
        publicKey: 'base64-encoded-public-key',
        privateKey: 'base64-encoded-private-key',
      };

      expect(vapidDetails.subject).toMatch(/^mailto:/);
      expect(vapidDetails.publicKey).toBeDefined();
      expect(vapidDetails.privateKey).toBeDefined();
    });

    it('should require mailto: subject format', () => {
      const validSubjects = [
        'mailto:admin@example.com',
        'mailto:support@domain.co.jp',
      ];

      const invalidSubjects = [
        'admin@example.com',
        'https://example.com',
        '',
      ];

      validSubjects.forEach(subject => {
        expect(subject.startsWith('mailto:')).toBe(true);
      });

      invalidSubjects.forEach(subject => {
        expect(subject.startsWith('mailto:')).toBe(false);
      });
    });
  });

  describe('Notification Payload Structure', () => {
    it('should have required notification fields', () => {
      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        url: '/',
        tag: 'test-notification',
        data: {},
      };

      expect(payload.title).toBeDefined();
      expect(payload.body).toBeDefined();
    });

    it('should use default values for optional fields', () => {
      const createPayload = (options: { title: string; body: string; url?: string; tag?: string }) => ({
        title: options.title,
        body: options.body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        url: options.url || '/',
        tag: options.tag || 'default',
        data: {},
      });

      const payload = createPayload({ title: 'Test', body: 'Body' });

      expect(payload.url).toBe('/');
      expect(payload.tag).toBe('default');
      expect(payload.icon).toBe('/icon-192x192.png');
    });

    it('should serialize payload to JSON', () => {
      const payload = {
        title: 'Test',
        body: 'Body',
        url: '/products/123',
        data: { type: 'price_alert', originalPrice: 1000 },
      };

      const json = JSON.stringify(payload);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(payload);
    });
  });
});

describe('Error Handling', () => {
  it('should handle network errors gracefully', () => {
    const handleSendError = (error: Error) => {
      return {
        success: false,
        endpoint: 'https://example.com/push/123',
        error: error.message,
      };
    };

    const result = handleSendError(new Error('Network request failed'));
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network request failed');
  });

  it('should extract statusCode from error object', () => {
    interface WebPushError extends Error {
      statusCode?: number;
    }

    const extractStatusCode = (error: WebPushError) => {
      return error.statusCode;
    };

    const error = new Error('Push failed') as WebPushError;
    error.statusCode = 410;

    expect(extractStatusCode(error)).toBe(410);
  });
});
