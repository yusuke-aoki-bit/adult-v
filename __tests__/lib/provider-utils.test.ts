import { describe, it, expect } from 'vitest';
import {
  isValidProviderId,
  mapLegacyProvider,
  mapLegacyServices,
} from '@/lib/provider-utils';

describe('provider-utils', () => {
  describe('isValidProviderId', () => {
    it('should return true for valid provider IDs', () => {
      expect(isValidProviderId('dmm')).toBe(true);
      expect(isValidProviderId('duga')).toBe(true);
      expect(isValidProviderId('sokmil')).toBe(true);
      expect(isValidProviderId('dti')).toBe(true);
    });

    it('should return false for invalid provider IDs', () => {
      expect(isValidProviderId('apex')).toBe(false);
      expect(isValidProviderId('unknown')).toBe(false);
      expect(isValidProviderId('')).toBe(false);
    });
  });

  describe('mapLegacyProvider', () => {
    it('should map "apex" to "duga"', () => {
      expect(mapLegacyProvider('apex')).toBe('duga');
    });

    it('should return valid providers unchanged', () => {
      expect(mapLegacyProvider('dmm')).toBe('dmm');
      expect(mapLegacyProvider('duga')).toBe('duga');
      expect(mapLegacyProvider('sokmil')).toBe('sokmil');
      expect(mapLegacyProvider('dti')).toBe('dti');
    });

    it('should default to "duga" for unknown providers', () => {
      expect(mapLegacyProvider('unknown')).toBe('duga');
    });
  });

  describe('mapLegacyServices', () => {
    it('should map array of services', () => {
      const input = ['apex', 'dmm', 'sokmil'];
      const result = mapLegacyServices(input);
      expect(result).toEqual(['duga', 'dmm', 'sokmil']);
    });

    it('should remove duplicates', () => {
      const input = ['apex', 'duga', 'dmm'];
      const result = mapLegacyServices(input);
      expect(result).toEqual(['duga', 'dmm']);
    });

    it('should handle empty array', () => {
      expect(mapLegacyServices([])).toEqual([]);
    });
  });
});
