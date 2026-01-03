/**
 * Formatter Utility Unit Tests
 * フォーマッター関数のテスト
 */

import { describe, test, expect } from 'vitest';

describe('Price Formatters', () => {
  describe('formatPrice', () => {
    const formatPrice = (price: number, currency = 'JPY') => {
      if (currency === 'JPY') {
        return `¥${price.toLocaleString()}`;
      }
      return `$${price.toFixed(2)}`;
    };

    test('formats Japanese Yen correctly', () => {
      expect(formatPrice(1980)).toBe('¥1,980');
      expect(formatPrice(100)).toBe('¥100');
      expect(formatPrice(10000)).toBe('¥10,000');
      expect(formatPrice(0)).toBe('¥0');
    });

    test('formats large prices with commas', () => {
      expect(formatPrice(1000000)).toBe('¥1,000,000');
      expect(formatPrice(999999)).toBe('¥999,999');
    });

    test('handles USD currency', () => {
      expect(formatPrice(19.99, 'USD')).toBe('$19.99');
      expect(formatPrice(100, 'USD')).toBe('$100.00');
    });
  });

  describe('formatDiscount', () => {
    const formatDiscount = (discount: number) => `${discount}%OFF`;

    test('formats discount percentage', () => {
      expect(formatDiscount(10)).toBe('10%OFF');
      expect(formatDiscount(25)).toBe('25%OFF');
      expect(formatDiscount(50)).toBe('50%OFF');
    });
  });

  describe('calculateDiscount', () => {
    const calculateDiscount = (original: number, sale: number) => {
      return Math.round((1 - sale / original) * 100);
    };

    test('calculates discount percentage correctly', () => {
      expect(calculateDiscount(1000, 800)).toBe(20);
      expect(calculateDiscount(2000, 1500)).toBe(25);
      expect(calculateDiscount(100, 50)).toBe(50);
    });

    test('handles edge cases', () => {
      expect(calculateDiscount(100, 100)).toBe(0);
      expect(calculateDiscount(100, 0)).toBe(100);
    });
  });
});

describe('Date Formatters', () => {
  describe('formatDate', () => {
    const formatDate = (dateStr: string, locale = 'ja-JP') => {
      const date = new Date(dateStr);
      return date.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    test('formats date in Japanese locale', () => {
      const result = formatDate('2024-01-15', 'ja-JP');
      expect(result).toContain('2024');
      expect(result).toContain('1');
      expect(result).toContain('15');
    });

    test('formats date in English locale', () => {
      const result = formatDate('2024-01-15', 'en-US');
      expect(result).toContain('2024');
      expect(result).toContain('January');
      expect(result).toContain('15');
    });
  });

  describe('formatRelativeDate', () => {
    const formatRelativeDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return '今日';
      if (diffDays === 1) return '昨日';
      if (diffDays < 7) return `${diffDays}日前`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前`;
      return `${Math.floor(diffDays / 365)}年前`;
    };

    test('formats today correctly', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(formatRelativeDate(today)).toBe('今日');
    });

    test('formats yesterday correctly', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      expect(formatRelativeDate(yesterday)).toBe('昨日');
    });

    test('formats days ago correctly', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      expect(formatRelativeDate(threeDaysAgo)).toBe('3日前');
    });
  });
});

describe('Text Formatters', () => {
  describe('truncateText', () => {
    const truncateText = (text: string, maxLength: number) => {
      if (text.length <= maxLength) return text;
      return text.slice(0, maxLength) + '...';
    };

    test('returns original text if shorter than max', () => {
      expect(truncateText('Short text', 50)).toBe('Short text');
    });

    test('truncates long text with ellipsis', () => {
      const longText = 'This is a very long text that should be truncated';
      expect(truncateText(longText, 20)).toBe('This is a very long ...');
    });

    test('handles exact length', () => {
      expect(truncateText('12345', 5)).toBe('12345');
    });
  });

  describe('sanitizeTitle', () => {
    const sanitizeTitle = (title: string) => {
      return title
        .replace(/【.*?】/g, '')
        .replace(/\[.*?\]/g, '')
        .trim();
    };

    test('removes Japanese brackets', () => {
      expect(sanitizeTitle('【期間限定】商品タイトル')).toBe('商品タイトル');
    });

    test('removes square brackets', () => {
      expect(sanitizeTitle('[SALE] Product Title')).toBe('Product Title');
    });

    test('removes multiple brackets', () => {
      expect(sanitizeTitle('【NEW】[HD] タイトル【限定】')).toBe('タイトル');
    });

    test('preserves text without brackets', () => {
      expect(sanitizeTitle('Normal Title')).toBe('Normal Title');
    });
  });
});

describe('Number Formatters', () => {
  describe('formatNumber', () => {
    const formatNumber = (num: number) => {
      if (num >= 10000) {
        return `${(num / 10000).toFixed(1)}万`;
      }
      return num.toLocaleString();
    };

    test('formats small numbers normally', () => {
      expect(formatNumber(100)).toBe('100');
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(9999)).toBe('9,999');
    });

    test('formats large numbers with 万', () => {
      expect(formatNumber(10000)).toBe('1.0万');
      expect(formatNumber(15000)).toBe('1.5万');
      expect(formatNumber(100000)).toBe('10.0万');
    });
  });

  describe('formatRating', () => {
    const formatRating = (rating: number) => {
      return rating.toFixed(1);
    };

    test('formats rating to one decimal place', () => {
      expect(formatRating(4.5)).toBe('4.5');
      expect(formatRating(3)).toBe('3.0');
      expect(formatRating(4.99)).toBe('5.0');
    });
  });
});

describe('URL Formatters', () => {
  describe('buildProductUrl', () => {
    const buildProductUrl = (productId: string | number, locale = 'ja') => {
      return `/${locale}/products/${productId}`;
    };

    test('builds product URL with default locale', () => {
      expect(buildProductUrl('12345')).toBe('/ja/products/12345');
    });

    test('builds product URL with specified locale', () => {
      expect(buildProductUrl('12345', 'en')).toBe('/en/products/12345');
    });

    test('handles numeric product ID', () => {
      expect(buildProductUrl(12345)).toBe('/ja/products/12345');
    });
  });

  describe('buildActressUrl', () => {
    const buildActressUrl = (actressId: string | number, locale = 'ja') => {
      return `/${locale}/actresses/${actressId}`;
    };

    test('builds actress URL correctly', () => {
      expect(buildActressUrl('456')).toBe('/ja/actresses/456');
      expect(buildActressUrl('456', 'en')).toBe('/en/actresses/456');
    });
  });
});
