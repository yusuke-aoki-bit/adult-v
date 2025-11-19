import { describe, it, expect } from 'vitest';
import {
  validatePagination,
  validateId,
  validateSearchQuery,
  validatePriceRange,
} from '@/lib/api-utils';

describe('api-utils', () => {
  describe('validatePagination', () => {
    it('should return default values when params are empty', () => {
      const params = new URLSearchParams();
      const result = validatePagination(params);

      expect(result.valid).toBe(true);
      expect(result.params).toEqual({ limit: 100, offset: 0 });
    });

    it('should parse valid limit and offset', () => {
      const params = new URLSearchParams({ limit: '50', offset: '10' });
      const result = validatePagination(params);

      expect(result.valid).toBe(true);
      expect(result.params).toEqual({ limit: 50, offset: 10 });
    });

    it('should reject limit greater than 100', () => {
      const params = new URLSearchParams({ limit: '200' });
      const result = validatePagination(params);

      expect(result.valid).toBe(false);
    });

    it('should reject limit less than 1', () => {
      const params = new URLSearchParams({ limit: '0' });
      const result = validatePagination(params);

      expect(result.valid).toBe(false);
    });

    it('should reject negative offset', () => {
      const params = new URLSearchParams({ offset: '-5' });
      const result = validatePagination(params);

      expect(result.valid).toBe(false);
    });

    it('should reject NaN values', () => {
      const params = new URLSearchParams({ limit: 'abc' });
      const result = validatePagination(params);

      expect(result.valid).toBe(false);
    });
  });

  describe('validateId', () => {
    it('should accept valid alphanumeric ID', () => {
      const result = validateId('product-123');
      expect(result.valid).toBe(true);
    });

    it('should accept ID with underscores', () => {
      const result = validateId('product_123_abc');
      expect(result.valid).toBe(true);
    });

    it('should reject empty string', () => {
      const result = validateId('');
      expect(result.valid).toBe(false);
    });

    it('should reject undefined', () => {
      const result = validateId(undefined);
      expect(result.valid).toBe(false);
    });

    it('should reject IDs with invalid characters', () => {
      const result = validateId('product<script>');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSearchQuery', () => {
    it('should return undefined for null', () => {
      expect(validateSearchQuery(null)).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(validateSearchQuery('')).toBeUndefined();
    });

    it('should return undefined for whitespace only', () => {
      expect(validateSearchQuery('   ')).toBeUndefined();
    });

    it('should trim the query', () => {
      expect(validateSearchQuery('  test  ')).toBe('test');
    });

    it('should truncate long queries to 200 characters', () => {
      const longQuery = 'a'.repeat(300);
      const result = validateSearchQuery(longQuery);
      expect(result?.length).toBe(200);
    });
  });

  describe('validatePriceRange', () => {
    it('should return empty object for null', () => {
      expect(validatePriceRange(null)).toEqual({});
    });

    it('should return empty object for "all"', () => {
      expect(validatePriceRange('all')).toEqual({});
    });

    it('should return minPrice only for "3000"', () => {
      expect(validatePriceRange('3000')).toEqual({ minPrice: 3000 });
    });

    it('should parse range correctly', () => {
      expect(validatePriceRange('500-1000')).toEqual({ minPrice: 500, maxPrice: 1000 });
    });

    it('should return empty object for invalid range format', () => {
      expect(validatePriceRange('invalid')).toEqual({});
    });

    it('should return empty object for non-numeric range', () => {
      expect(validatePriceRange('abc-def')).toEqual({});
    });
  });
});
