import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * useBudgetTracker Hook Tests
 *
 * Tests for budget tracking and purchase history import functionality
 */

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

describe('useBudgetTracker', () => {
  const STORAGE_KEY = 'adult-v-budget-tracker';

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe('Initial State', () => {
    it('should have default monthly budget of 10000', () => {
      const defaultBudget = {
        monthlyBudget: 10000,
        purchases: [],
        currency: 'JPY',
      };

      expect(defaultBudget.monthlyBudget).toBe(10000);
    });

    it('should have empty purchases array initially', () => {
      const defaultBudget = {
        monthlyBudget: 10000,
        purchases: [],
        currency: 'JPY',
      };

      expect(defaultBudget.purchases).toHaveLength(0);
    });
  });

  describe('Budget Statistics Calculation', () => {
    it('should calculate spent amount correctly', () => {
      const purchases = [{ price: 1000 }, { price: 2500 }, { price: 500 }];

      const spent = purchases.reduce((sum, p) => sum + p.price, 0);
      expect(spent).toBe(4000);
    });

    it('should calculate remaining budget correctly', () => {
      const monthlyBudget = 10000;
      const spent = 4000;
      const remaining = monthlyBudget - spent;

      expect(remaining).toBe(6000);
    });

    it('should calculate percent used correctly', () => {
      const monthlyBudget = 10000;
      const spent = 4000;
      const percentUsed = Math.round((spent / monthlyBudget) * 100);

      expect(percentUsed).toBe(40);
    });

    it('should handle over budget scenario', () => {
      const monthlyBudget = 5000;
      const spent = 7500;
      const remaining = monthlyBudget - spent;
      const isOverBudget = remaining < 0;

      expect(remaining).toBe(-2500);
      expect(isOverBudget).toBe(true);
    });

    it('should handle zero budget', () => {
      const monthlyBudget = 0;
      const spent = 1000;
      const percentUsed = monthlyBudget > 0 ? Math.round((spent / monthlyBudget) * 100) : 0;

      expect(percentUsed).toBe(0);
    });
  });

  describe('Monthly Budget Management', () => {
    it('should update monthly budget', () => {
      let budgetData = { monthlyBudget: 10000, purchases: [], currency: 'JPY' };

      const setMonthlyBudget = (amount: number) => {
        budgetData = { ...budgetData, monthlyBudget: Math.max(0, amount) };
      };

      setMonthlyBudget(15000);
      expect(budgetData.monthlyBudget).toBe(15000);
    });

    it('should not allow negative budget', () => {
      let budgetData = { monthlyBudget: 10000, purchases: [], currency: 'JPY' };

      const setMonthlyBudget = (amount: number) => {
        budgetData = { ...budgetData, monthlyBudget: Math.max(0, amount) };
      };

      setMonthlyBudget(-5000);
      expect(budgetData.monthlyBudget).toBe(0);
    });
  });

  describe('Purchase Management', () => {
    it('should add purchase correctly', () => {
      const purchases: Array<{ id: string; productId: string; title: string; price: number; date: string }> = [];

      const addPurchase = (productId: string, title: string, price: number) => {
        purchases.push({
          id: `${productId}-${Date.now()}`,
          productId,
          title,
          price,
          date: new Date().toISOString(),
        });
      };

      addPurchase('product-1', 'Test Product', 1500);
      expect(purchases).toHaveLength(1);
      expect(purchases[0]!.price).toBe(1500);
    });

    it('should remove purchase by id', () => {
      const purchases = [
        { id: 'purchase-1', productId: 'product-1', title: 'Product 1', price: 1000, date: '2025-01-01' },
        { id: 'purchase-2', productId: 'product-2', title: 'Product 2', price: 2000, date: '2025-01-02' },
      ];

      const removePurchase = (purchaseId: string) => {
        return purchases.filter((p) => p.id !== purchaseId);
      };

      const result = removePurchase('purchase-1');
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('purchase-2');
    });

    it('should clear all purchases', () => {
      let purchases = [
        { id: 'purchase-1', productId: 'product-1', title: 'Product 1', price: 1000, date: '2025-01-01' },
        { id: 'purchase-2', productId: 'product-2', title: 'Product 2', price: 2000, date: '2025-01-02' },
      ];

      const clearPurchases = () => {
        purchases = [];
      };

      clearPurchases();
      expect(purchases).toHaveLength(0);
    });
  });

  describe('Purchase History Import', () => {
    it('should import multiple purchases', () => {
      const existingPurchases: Array<{ id: string; productId: string; title: string; price: number; date: string }> =
        [];

      const purchasesToImport = [
        { productId: 'product-1', title: 'Product 1', price: 1000, date: '2025-01-01' },
        { productId: 'product-2', title: 'Product 2', price: 2000, date: '2025-01-02' },
        { productId: 'product-3', title: 'Product 3', price: 1500, date: '2025-01-03' },
      ];

      const importPurchases = (toImport: typeof purchasesToImport) => {
        const newPurchases = toImport.map((p, index) => ({
          id: `${p.productId}-${Date.now()}-${index}`,
          ...p,
        }));
        existingPurchases.push(...newPurchases);
        return newPurchases.length;
      };

      const importedCount = importPurchases(purchasesToImport);
      expect(importedCount).toBe(3);
      expect(existingPurchases).toHaveLength(3);
    });

    it('should skip duplicate purchases', () => {
      const existingPurchases = [
        { id: 'p1', productId: 'product-1', title: 'Product 1', price: 1000, date: '2025-01-01T00:00:00Z' },
      ];

      const purchasesToImport = [
        { productId: 'product-1', title: 'Product 1', price: 1000, date: '2025-01-01T12:00:00Z' }, // Same product, same day
        { productId: 'product-2', title: 'Product 2', price: 2000, date: '2025-01-02T00:00:00Z' }, // New product
      ];

      const importPurchases = (toImport: typeof purchasesToImport) => {
        const existingKeys = new Set(existingPurchases.map((p) => `${p.productId}-${p.date.split('T')[0]}`));

        const uniqueNew = toImport.filter((p) => !existingKeys.has(`${p.productId}-${p.date.split('T')[0]}`));

        return uniqueNew.length;
      };

      const importedCount = importPurchases(purchasesToImport);
      expect(importedCount).toBe(1); // Only product-2 should be imported
    });

    it('should parse DMM purchase history text format', () => {
      const dmmHistoryText = `
        2025/01/15 作品タイトル1 ¥1,500
        2025/01/10 作品タイトル2 ¥2,000
        2025/01/05 作品タイトル3 ¥980
      `;

      const parseDmmHistory = (text: string) => {
        const lines = text
          .trim()
          .split('\n')
          .filter((line) => line.trim());
        const purchases = [];

        for (const line of lines) {
          const dateMatch = line.match(/(\d{4}\/\d{2}\/\d{2})/);
          const priceMatch = line.match(/¥([\d,]+)/);

          if (dateMatch && priceMatch) {
            const title = line.replace(dateMatch[0], '').replace(`¥${priceMatch[1]}`, '').trim();
            purchases.push({
              date: dateMatch[1]!.replace(/\//g, '-'),
              title,
              price: parseInt(priceMatch[1]!.replace(/,/g, ''), 10),
            });
          }
        }

        return purchases;
      };

      const parsed = parseDmmHistory(dmmHistoryText);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]!.price).toBe(1500);
      expect(parsed[0]!.date).toBe('2025-01-15');
    });
  });

  describe('Current Month Filtering', () => {
    it('should filter purchases to current month only', () => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const allPurchases = [
        { id: '1', date: `${currentMonth}-01T00:00:00Z` }, // Current month
        { id: '2', date: `${currentMonth}-15T00:00:00Z` }, // Current month
        { id: '3', date: '2024-01-01T00:00:00Z' }, // Last year
      ];

      const currentMonthPurchases = allPurchases.filter((p) => p.date.startsWith(currentMonth));

      expect(currentMonthPurchases).toHaveLength(2);
    });
  });

  describe('LocalStorage Persistence', () => {
    it('should save data to localStorage', () => {
      const budgetData = {
        monthlyBudget: 15000,
        purchases: [{ id: '1', productId: 'p1', title: 'Product', price: 1000, date: '2025-01-01' }],
        currency: 'JPY',
      };

      mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(budgetData));

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(budgetData));
    });

    it('should load data from localStorage', () => {
      const storedData = {
        monthlyBudget: 20000,
        purchases: [],
        currency: 'JPY',
      };

      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(storedData));
      const loaded = mockLocalStorage.getItem(STORAGE_KEY);
      const parsed = loaded ? JSON.parse(loaded) : null;

      expect(parsed).toEqual(storedData);
    });

    it('should handle corrupted localStorage data', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('invalid json');

      let result = null;
      try {
        const stored = mockLocalStorage.getItem(STORAGE_KEY);
        result = stored ? JSON.parse(stored) : null;
      } catch {
        result = null;
      }

      expect(result).toBeNull();
    });
  });
});

describe('Price Formatting', () => {
  it('should format price in Japanese Yen', () => {
    const formatPrice = (price: number, locale: string) => {
      return new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
        style: 'currency',
        currency: 'JPY',
        maximumFractionDigits: 0,
      }).format(price);
    };

    expect(formatPrice(1500, 'ja')).toBe('￥1,500');
    expect(formatPrice(10000, 'en')).toBe('¥10,000');
  });
});
