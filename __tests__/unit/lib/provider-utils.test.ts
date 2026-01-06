/**
 * プロバイダーユーティリティのテスト
 * ASP名からProviderIdへの変換、メーカーマッピングなど
 */
import { describe, it, expect } from 'vitest';
import {
  ASP_DISPLAY_ORDER,
  ASP_TO_PROVIDER_ID,
  getProviderId,
  HIRAGANA_GROUPS,
  HIRAGANA_KEYS,
  ALPHABET,
  SORT_OPTIONS,
  PRICE_RANGES,
  parsePriceRange,
} from '@adult-v/shared/constants/filters';
import { providerMeta, type ProviderId } from '@adult-v/shared/providers';

describe('ASP to Provider Mapping', () => {
  describe('ASP_DISPLAY_ORDER', () => {
    it('should contain all major ASP names', () => {
      expect(ASP_DISPLAY_ORDER).toContain('fanza');
      expect(ASP_DISPLAY_ORDER).toContain('mgs');
      expect(ASP_DISPLAY_ORDER).toContain('duga');
      expect(ASP_DISPLAY_ORDER).toContain('sokmil');
      expect(ASP_DISPLAY_ORDER).toContain('fc2');
    });

    it('should not contain duplicates', () => {
      const uniqueSet = new Set(ASP_DISPLAY_ORDER);
      expect(uniqueSet.size).toBe(ASP_DISPLAY_ORDER.length);
    });
  });

  describe('getProviderId', () => {
    it('should map uppercase ASP names correctly', () => {
      expect(getProviderId('FANZA')).toBe('fanza');
      expect(getProviderId('MGS')).toBe('mgs');
      expect(getProviderId('DUGA')).toBe('duga');
      expect(getProviderId('SOKMIL')).toBe('sokmil');
    });

    it('should map lowercase ASP names correctly', () => {
      expect(getProviderId('fanza')).toBe('fanza');
      expect(getProviderId('mgs')).toBe('mgs');
      expect(getProviderId('duga')).toBe('duga');
    });

    it('should map DTI sub-services correctly', () => {
      expect(getProviderId('caribbeancom')).toBe('caribbeancom');
      expect(getProviderId('caribbeancompr')).toBe('caribbeancompr');
      expect(getProviderId('1pondo')).toBe('1pondo');
      expect(getProviderId('heyzo')).toBe('heyzo');
    });

    it('should map Japanese ASP names correctly', () => {
      expect(getProviderId('カリビアンコム')).toBe('caribbeancom');
      expect(getProviderId('一本道')).toBe('1pondo');
      expect(getProviderId('ソクミル')).toBe('sokmil');
      expect(getProviderId('MGS動画')).toBe('mgs');
    });

    it('should return undefined for unknown ASP names', () => {
      expect(getProviderId('unknown')).toBeUndefined();
      expect(getProviderId('')).toBeUndefined();
    });
  });

  describe('ASP_TO_PROVIDER_ID completeness', () => {
    it('should have all display order items in the mapping', () => {
      for (const asp of ASP_DISPLAY_ORDER) {
        const providerId = ASP_TO_PROVIDER_ID[asp];
        expect(providerId).toBeDefined();
      }
    });
  });
});

describe('Provider Metadata', () => {
  describe('providerMeta', () => {
    const providerIds: ProviderId[] = [
      'fanza', 'mgs', 'duga', 'sokmil', 'fc2', 'b10f', 'japanska',
      'caribbeancom', 'caribbeancompr', '1pondo', 'heyzo',
    ];

    it('should have metadata for all major providers', () => {
      for (const id of providerIds) {
        expect(providerMeta[id]).toBeDefined();
        expect(providerMeta[id].label).toBeDefined();
      }
    });

    it('should have valid color classes', () => {
      for (const id of providerIds) {
        const meta = providerMeta[id];
        if (meta.accentClass) {
          expect(meta.accentClass).toMatch(/^from-/);
        }
      }
    });

    it('should have required properties for all providers', () => {
      // すべてのプロバイダーはlabel必須
      for (const id of providerIds) {
        expect(providerMeta[id].label).toBeDefined();
        expect(typeof providerMeta[id].label).toBe('string');
      }
    });
  });
});

describe('Hiragana Groups', () => {
  it('should have all hiragana rows', () => {
    expect(HIRAGANA_KEYS).toHaveLength(10);
    expect(HIRAGANA_KEYS).toContain('あ');
    expect(HIRAGANA_KEYS).toContain('わ');
  });

  it('should have correct characters in each group', () => {
    expect(HIRAGANA_GROUPS['あ']).toEqual(['あ', 'い', 'う', 'え', 'お']);
    expect(HIRAGANA_GROUPS['か']).toEqual(['か', 'き', 'く', 'け', 'こ']);
    expect(HIRAGANA_GROUPS['や']).toEqual(['や', 'ゆ', 'よ']);
    expect(HIRAGANA_GROUPS['わ']).toEqual(['わ', 'を', 'ん']);
  });

  it('should have all keys in HIRAGANA_GROUPS', () => {
    for (const key of HIRAGANA_KEYS) {
      expect(HIRAGANA_GROUPS[key]).toBeDefined();
      expect(HIRAGANA_GROUPS[key]!.length).toBeGreaterThan(0);
    }
  });
});

describe('Alphabet', () => {
  it('should have all 26 letters', () => {
    expect(ALPHABET).toHaveLength(26);
  });

  it('should start with A and end with Z', () => {
    expect(ALPHABET[0]).toBe('A');
    expect(ALPHABET[25]).toBe('Z');
  });

  it('should be in order', () => {
    for (let i = 1; i < ALPHABET.length; i++) {
      expect(ALPHABET[i]!.charCodeAt(0)).toBe(ALPHABET[i - 1]!.charCodeAt(0) + 1);
    }
  });
});

describe('Sort Options', () => {
  it('should have release date options', () => {
    const values = SORT_OPTIONS.map(o => o.value);
    expect(values).toContain('releaseDateDesc');
    expect(values).toContain('releaseDateAsc');
  });

  it('should have price options', () => {
    const values = SORT_OPTIONS.map(o => o.value);
    expect(values).toContain('priceAsc');
    expect(values).toContain('priceDesc');
  });

  it('should have all options with labels', () => {
    for (const option of SORT_OPTIONS) {
      expect(option.value).toBeDefined();
      expect(option.label).toBeDefined();
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});

describe('Price Ranges', () => {
  it('should have an "all" option', () => {
    const allOption = PRICE_RANGES.find(r => r.value === '');
    expect(allOption).toBeDefined();
    expect(allOption!.label).toBe('すべて');
  });

  it('should have valid min/max values', () => {
    for (const range of PRICE_RANGES) {
      if (range.value) {
        // 価格帯がある場合
        if (range.min !== undefined && range.max !== undefined) {
          expect(range.min).toBeLessThan(range.max);
        }
      }
    }
  });

  describe('parsePriceRange', () => {
    it('should parse empty value', () => {
      expect(parsePriceRange('')).toEqual({});
    });

    it('should parse range with both values', () => {
      expect(parsePriceRange('1000-3000')).toEqual({ min: 1000, max: 3000 });
    });

    it('should parse range with only min', () => {
      expect(parsePriceRange('5000-')).toEqual({ min: 5000, max: undefined });
    });

    it('should parse range with only max', () => {
      expect(parsePriceRange('-1000')).toEqual({ min: undefined, max: 1000 });
    });
  });
});
