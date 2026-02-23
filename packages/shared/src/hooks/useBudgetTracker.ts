'use client';

import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';

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

const defaultBudget: BudgetData = {
  monthlyBudget: 10000,
  purchases: [],
  currency: 'JPY',
};

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export function useBudgetTracker() {
  const [budgetData, setBudgetData] = useLocalStorage<BudgetData>(BUDGET_STORAGE_KEY, defaultBudget);

  const currentMonth = useMemo(() => getCurrentMonth(), []);

  // Filter purchases to current month
  const currentMonthPurchases = useMemo(
    () => budgetData.purchases.filter((p) => p.date.startsWith(currentMonth)),
    [budgetData.purchases, currentMonth],
  );

  // Set monthly budget
  const setMonthlyBudget = useCallback(
    (amount: number) => {
      setBudgetData((prev) => ({
        ...prev,
        monthlyBudget: Math.max(0, amount),
      }));
    },
    [setBudgetData],
  );

  // Add purchase
  const addPurchase = useCallback(
    (productId: string, title: string, price: number, date?: string) => {
      const purchase: Purchase = {
        id: `${productId}-${Date.now()}`,
        productId,
        title,
        price,
        date: date || new Date().toISOString(),
      };

      setBudgetData((prev) => ({
        ...prev,
        purchases: [...prev.purchases, purchase],
      }));
    },
    [setBudgetData],
  );

  // Import multiple purchases (for bulk import from DMM/FANZA)
  const importPurchases = useCallback(
    (
      purchasesToImport: Array<{
        productId: string;
        title: string;
        price: number;
        date: string;
      }>,
    ) => {
      const newPurchases: Purchase[] = purchasesToImport.map((p) => ({
        id: `${p.productId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        productId: p.productId,
        title: p.title,
        price: p.price,
        date: p.date,
      }));

      let addedCount = 0;

      setBudgetData((prev) => {
        const existingKeys = new Set(prev.purchases.map((p) => `${p.productId}-${p.date.split('T')[0]}`));
        const uniqueNewPurchases = newPurchases.filter(
          (p) => !existingKeys.has(`${p.productId}-${p.date.split('T')[0]}`),
        );
        addedCount = uniqueNewPurchases.length;

        return {
          ...prev,
          purchases: [...prev.purchases, ...uniqueNewPurchases],
        };
      });

      return addedCount;
    },
    [setBudgetData],
  );

  // Remove purchase
  const removePurchase = useCallback(
    (purchaseId: string) => {
      setBudgetData((prev) => ({
        ...prev,
        purchases: prev.purchases.filter((p) => p.id !== purchaseId),
      }));
    },
    [setBudgetData],
  );

  // Clear all purchases for current month
  const clearPurchases = useCallback(() => {
    setBudgetData((prev) => ({
      ...prev,
      purchases: prev.purchases.filter((p) => !p.date.startsWith(currentMonth)),
    }));
  }, [setBudgetData, currentMonth]);

  // Calculate stats from current month purchases
  const spent = currentMonthPurchases.reduce((sum, p) => sum + p.price, 0);
  const remaining = budgetData.monthlyBudget - spent;
  const percentUsed = budgetData.monthlyBudget > 0 ? Math.round((spent / budgetData.monthlyBudget) * 100) : 0;

  const stats: BudgetStats = {
    monthlyBudget: budgetData.monthlyBudget,
    spent,
    remaining,
    percentUsed,
    purchases: currentMonthPurchases,
    currency: budgetData.currency,
  };

  return {
    stats,
    isLoading: false,
    setMonthlyBudget,
    addPurchase,
    importPurchases,
    removePurchase,
    clearPurchases,
  };
}
