'use client';

import { useState, useEffect, useCallback } from 'react';

const BUDGET_STORAGE_KEY = 'adult-v-budget-tracker';

interface Purchase {
  id: string;
  productId: string;
  title: string;
  price: number;
  date: string;
}

interface BudgetData {
  monthlyBudget: number;
  purchases: Purchase[];
  currency: string;
}

export interface BudgetStats {
  monthlyBudget: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  purchases: Purchase[];
  currency: string;
}

const getDefaultBudget = (): BudgetData => ({
  monthlyBudget: 10000,
  purchases: [],
  currency: 'JPY',
});

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export function useBudgetTracker() {
  const [budgetData, setBudgetData] = useState<BudgetData>(getDefaultBudget());
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BUDGET_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as BudgetData;
        // Filter purchases to current month only
        const currentMonth = getCurrentMonth();
        const filteredPurchases = parsed.purchases.filter(p => p.date.startsWith(currentMonth));
        setBudgetData({
          ...parsed,
          purchases: filteredPurchases,
        });
      }
    } catch {
      console.error('Error loading budget data');
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage
  const saveBudgetData = useCallback((data: BudgetData) => {
    try {
      localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(data));
      setBudgetData(data);
    } catch {
      console.error('Error saving budget data');
    }
  }, []);

  // Set monthly budget
  const setMonthlyBudget = useCallback((amount: number) => {
    saveBudgetData({
      ...budgetData,
      monthlyBudget: Math.max(0, amount),
    });
  }, [budgetData, saveBudgetData]);

  // Add purchase
  const addPurchase = useCallback((productId: string, title: string, price: number, date?: string) => {
    const purchase: Purchase = {
      id: `${productId}-${Date.now()}`,
      productId,
      title,
      price,
      date: date || new Date().toISOString(),
    };

    saveBudgetData({
      ...budgetData,
      purchases: [...budgetData.purchases, purchase],
    });
  }, [budgetData, saveBudgetData]);

  // Import multiple purchases (for bulk import from DMM/FANZA)
  const importPurchases = useCallback((purchasesToImport: Array<{
    productId: string;
    title: string;
    price: number;
    date: string;
  }>) => {
    const newPurchases: Purchase[] = purchasesToImport.map((p) => ({
      id: `${p.productId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      productId: p.productId,
      title: p.title,
      price: p.price,
      date: p.date,
    }));

    // Merge with existing purchases and remove duplicates by productId+date
    const existingKeys = new Set(
      budgetData.purchases.map(p => `${p.productId}-${p.date.split('T')[0]}`)
    );
    const uniqueNewPurchases = newPurchases.filter(
      p => !existingKeys.has(`${p.productId}-${p.date.split('T')[0]}`)
    );

    saveBudgetData({
      ...budgetData,
      purchases: [...budgetData.purchases, ...uniqueNewPurchases],
    });

    return uniqueNewPurchases.length;
  }, [budgetData, saveBudgetData]);

  // Remove purchase
  const removePurchase = useCallback((purchaseId: string) => {
    saveBudgetData({
      ...budgetData,
      purchases: budgetData.purchases.filter(p => p.id !== purchaseId),
    });
  }, [budgetData, saveBudgetData]);

  // Clear all purchases for current month
  const clearPurchases = useCallback(() => {
    saveBudgetData({
      ...budgetData,
      purchases: [],
    });
  }, [budgetData, saveBudgetData]);

  // Calculate stats
  const spent = budgetData.purchases.reduce((sum, p) => sum + p.price, 0);
  const remaining = budgetData.monthlyBudget - spent;
  const percentUsed = budgetData.monthlyBudget > 0
    ? Math.round((spent / budgetData.monthlyBudget) * 100)
    : 0;

  const stats: BudgetStats = {
    monthlyBudget: budgetData.monthlyBudget,
    spent,
    remaining,
    percentUsed,
    purchases: budgetData.purchases,
    currency: budgetData.currency,
  };

  return {
    stats,
    isLoading,
    setMonthlyBudget,
    addPurchase,
    importPurchases,
    removePurchase,
    clearPurchases,
  };
}
