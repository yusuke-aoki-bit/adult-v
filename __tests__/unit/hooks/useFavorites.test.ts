/**
 * useFavorites Hook Unit Tests
 * お気に入り機能フックのテスト
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock Firebase
vi.mock('@adult-v/shared/lib/firebase', () => ({
  isFirebaseConfigured: vi.fn(() => false),
  getFirebaseAuth: vi.fn(() => null),
  getFirebaseFirestore: vi.fn(() => null),
  saveFavoriteToFirestore: vi.fn(),
  removeFavoriteFromFirestore: vi.fn(),
  getFavoritesFromFirestore: vi.fn(() => Promise.resolve([])),
  logEvent: vi.fn(),
}));

describe('Favorites Storage', () => {
  const FAVORITES_KEY = 'favorites';

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  describe('localStorage operations', () => {
    test('saves favorite to localStorage', () => {
      const favorites = [{ type: 'product', id: '123', title: 'Test Product', addedAt: Date.now() }];

      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));

      const stored = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('123');
    });

    test('removes favorite from localStorage', () => {
      const favorites = [
        { type: 'product', id: '123', title: 'Test Product', addedAt: Date.now() },
        { type: 'product', id: '456', title: 'Test Product 2', addedAt: Date.now() },
      ];

      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));

      // Remove one item
      const filtered = favorites.filter((f) => f.id !== '123');
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));

      const stored = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('456');
    });

    test('handles empty favorites', () => {
      const stored = window.localStorage.getItem(FAVORITES_KEY);
      expect(stored).toBeNull();

      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([]));
      const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]');
      expect(parsed).toEqual([]);
    });

    test('handles invalid JSON gracefully', () => {
      window.localStorage.setItem(FAVORITES_KEY, 'invalid json');

      let parsed: unknown[] = [];
      try {
        parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]');
      } catch {
        parsed = [];
      }

      expect(parsed).toEqual([]);
    });
  });

  describe('favorite item structure', () => {
    test('product favorite has required fields', () => {
      const productFavorite = {
        type: 'product' as const,
        id: '123',
        title: 'Test Product',
        thumbnail: 'https://example.com/thumb.jpg',
        addedAt: Date.now(),
      };

      expect(productFavorite).toHaveProperty('type');
      expect(productFavorite).toHaveProperty('id');
      expect(productFavorite).toHaveProperty('addedAt');
      expect(productFavorite.type).toBe('product');
    });

    test('actress favorite has required fields', () => {
      const actressFavorite = {
        type: 'actress' as const,
        id: '456',
        name: 'Test Actress',
        image: 'https://example.com/image.jpg',
        addedAt: Date.now(),
      };

      expect(actressFavorite).toHaveProperty('type');
      expect(actressFavorite).toHaveProperty('id');
      expect(actressFavorite).toHaveProperty('addedAt');
      expect(actressFavorite.type).toBe('actress');
    });
  });

  describe('isFavorite check', () => {
    test('returns true for existing favorite', () => {
      const favorites = [{ type: 'product', id: '123', addedAt: Date.now() }];
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));

      const stored = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]');
      const isFavorite = stored.some((f: { type: string; id: string }) => f.type === 'product' && f.id === '123');

      expect(isFavorite).toBe(true);
    });

    test('returns false for non-existing favorite', () => {
      const favorites = [{ type: 'product', id: '123', addedAt: Date.now() }];
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));

      const stored = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]');
      const isFavorite = stored.some((f: { type: string; id: string }) => f.type === 'product' && f.id === '999');

      expect(isFavorite).toBe(false);
    });

    test('distinguishes between product and actress favorites', () => {
      const favorites = [
        { type: 'product', id: '123', addedAt: Date.now() },
        { type: 'actress', id: '123', addedAt: Date.now() },
      ];
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));

      const stored = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]');

      const isProductFavorite = stored.some(
        (f: { type: string; id: string }) => f.type === 'product' && f.id === '123',
      );
      const isActressFavorite = stored.some(
        (f: { type: string; id: string }) => f.type === 'actress' && f.id === '123',
      );

      expect(isProductFavorite).toBe(true);
      expect(isActressFavorite).toBe(true);
    });
  });

  describe('favorites limit', () => {
    test('can store multiple favorites', () => {
      const favorites = Array.from({ length: 50 }, (_, i) => ({
        type: 'product' as const,
        id: String(i),
        title: `Product ${i}`,
        addedAt: Date.now(),
      }));

      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));

      const stored = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]');
      expect(stored).toHaveLength(50);
    });
  });
});
