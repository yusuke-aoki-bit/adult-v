/**
 * Cron認証ヘルパーのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// NextRequestのモック
function createMockRequest(headers: Record<string, string> = {}, url = 'http://localhost/api/cron/test') {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
    url,
  } as any;
}

describe('Cron Auth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('verifyCronRequest', () => {
    it('should accept Bearer token in Authorization header', async () => {
      const { verifyCronRequest } = await import('@adult-v/shared/lib/cron-auth');
      const request = createMockRequest({
        authorization: 'Bearer some-oidc-token',
      });

      expect(verifyCronRequest(request)).toBe(true);
    });

    it('should reject requests without auth in production', async () => {
      process.env.NODE_ENV = 'production';
      const { verifyCronRequest } = await import('@adult-v/shared/lib/cron-auth');
      const request = createMockRequest({});

      expect(verifyCronRequest(request)).toBe(false);
    });

    it('should accept X-Cron-Secret header in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.CRON_SECRET = 'test-secret';
      const { verifyCronRequest } = await import('@adult-v/shared/lib/cron-auth');
      const request = createMockRequest({
        'x-cron-secret': 'test-secret',
      });

      expect(verifyCronRequest(request)).toBe(true);
    });

    it('should reject wrong X-Cron-Secret', async () => {
      process.env.NODE_ENV = 'development';
      process.env.CRON_SECRET = 'correct-secret';
      const { verifyCronRequest } = await import('@adult-v/shared/lib/cron-auth');
      const request = createMockRequest({
        'x-cron-secret': 'wrong-secret',
      });

      expect(verifyCronRequest(request)).toBe(false);
    });

    it('should not accept query parameter auth', async () => {
      const { verifyCronRequest } = await import('@adult-v/shared/lib/cron-auth');
      const request = createMockRequest(
        {},
        'http://localhost/api/cron/test?secret=my-secret'
      );

      expect(verifyCronRequest(request)).toBe(false);
    });
  });

  describe('verifyAdminRequest', () => {
    it('should accept Bearer token matching ADMIN_SECRET', async () => {
      process.env.ADMIN_SECRET = 'admin-secret';
      const { verifyAdminRequest } = await import('@adult-v/shared/lib/cron-auth');
      const request = createMockRequest({
        authorization: 'Bearer admin-secret',
      });

      expect(verifyAdminRequest(request)).toBe(true);
    });

    it('should accept X-Admin-Secret header', async () => {
      process.env.ADMIN_SECRET = 'admin-secret';
      const { verifyAdminRequest } = await import('@adult-v/shared/lib/cron-auth');
      const request = createMockRequest({
        'x-admin-secret': 'admin-secret',
      });

      expect(verifyAdminRequest(request)).toBe(true);
    });

    it('should reject wrong admin secret', async () => {
      process.env.ADMIN_SECRET = 'correct-secret';
      process.env.NODE_ENV = 'production';
      const { verifyAdminRequest } = await import('@adult-v/shared/lib/cron-auth');
      const request = createMockRequest({
        'x-admin-secret': 'wrong-secret',
      });

      expect(verifyAdminRequest(request)).toBe(false);
    });
  });

  describe('unauthorizedResponse', () => {
    it('should return 401 status with error message', async () => {
      const { unauthorizedResponse } = await import('@adult-v/shared/lib/cron-auth');
      const response = unauthorizedResponse();

      expect(response.status).toBe(401);
    });
  });
});
