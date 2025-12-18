import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getFavorites, addFavorite, removeFavorite, isFavorite, toggleFavorite } from '@/lib/favorites';

describe('favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  describe('getFavorites', () => {
    it('should return empty array when no favorites exist', () => {
      const result = getFavorites();
      expect(result).toEqual([]);
    });

    it('should return parsed favorites array', () => {
      const favorites = ['product-1', 'product-2'];
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(favorites)
      );

      const result = getFavorites();
      expect(result).toEqual(favorites);
    });

    it('should return empty array and clear invalid data', () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not-an-array');

      const result = getFavorites();
      expect(result).toEqual([]);
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('favorites');
    });

    it('should filter out non-string values', () => {
      const invalidData = ['valid-id', 123, null, 'another-valid'];
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(invalidData)
      );

      const result = getFavorites();
      expect(result).toEqual(['valid-id', 'another-valid']);
      expect(window.localStorage.setItem).toHaveBeenCalled();
    });

    it('should handle JSON parse errors', () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('invalid-json{');

      const result = getFavorites();
      expect(result).toEqual([]);
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('favorites');
    });
  });

  describe('addFavorite', () => {
    it('should add a new favorite', () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify([]));

      addFavorite('new-product');

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'favorites',
        JSON.stringify(['new-product'])
      );
      expect(window.dispatchEvent).toHaveBeenCalled();
    });

    it('should not add duplicate favorites', () => {
      const existing = ['existing-product'];
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(existing)
      );

      addFavorite('existing-product');

      expect(window.localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('removeFavorite', () => {
    it('should remove an existing favorite', () => {
      const favorites = ['product-1', 'product-2', 'product-3'];
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(favorites)
      );

      removeFavorite('product-2');

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'favorites',
        JSON.stringify(['product-1', 'product-3'])
      );
    });
  });

  describe('isFavorite', () => {
    it('should return true for existing favorite', () => {
      const favorites = ['product-1'];
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(favorites)
      );

      expect(isFavorite('product-1')).toBe(true);
    });

    it('should return false for non-existing favorite', () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify([]));

      expect(isFavorite('product-1')).toBe(false);
    });
  });

  describe('toggleFavorite', () => {
    it('should add favorite if not exists and return true', () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify([]));

      const result = toggleFavorite('new-product');
      expect(result).toBe(true);
    });

    it('should remove favorite if exists and return false', () => {
      const favorites = ['existing-product'];
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(favorites)
      );

      const result = toggleFavorite('existing-product');
      expect(result).toBe(false);
    });
  });
});
