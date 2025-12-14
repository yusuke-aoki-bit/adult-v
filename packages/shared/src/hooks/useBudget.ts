'use client';

import { useState, useEffect, useCallback } from 'react';

export interface BudgetSettings {
  monthlyBudget: number;
  currentSpent: number;
  month: string; // 'YYYY-MM' format
  notifications: {
    at50: boolean;
    at75: boolean;
    at90: boolean;
    at100: boolean;
  };
}

const STORAGE_KEY = 'adult-v-budget';

const getDefaultSettings = (): BudgetSettings => ({
  monthlyBudget: 10000,
  currentSpent: 0,
  month: new Date().toISOString().slice(0, 7),
  notifications: {
    at50: true,
    at75: true,
    at90: true,
    at100: true,
  },
});

export function useBudget() {
  const [settings, setSettings] = useState<BudgetSettings>(getDefaultSettings());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as BudgetSettings;
        const currentMonth = new Date().toISOString().slice(0, 7);

        // Reset spent if month changed
        if (parsed.month !== currentMonth) {
          parsed.currentSpent = 0;
          parsed.month = currentMonth;
        }

        setSettings(parsed);
      }
    } catch (error) {
      console.error('Failed to load budget settings:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  const saveSettings = useCallback((newSettings: BudgetSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save budget settings:', error);
    }
  }, []);

  // Set monthly budget
  const setBudget = useCallback((amount: number) => {
    const newSettings = { ...settings, monthlyBudget: amount };
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Add spending
  const addSpending = useCallback((amount: number) => {
    const newSettings = {
      ...settings,
      currentSpent: settings.currentSpent + amount,
    };
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Reset current month spending
  const resetSpending = useCallback(() => {
    const newSettings = { ...settings, currentSpent: 0 };
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Calculate remaining budget
  const remaining = settings.monthlyBudget - settings.currentSpent;
  const usedPercent = settings.monthlyBudget > 0
    ? Math.round((settings.currentSpent / settings.monthlyBudget) * 100)
    : 0;

  // Check if purchase is within budget
  const canAfford = useCallback((price: number) => {
    return remaining >= price;
  }, [remaining]);

  // Get budget status
  const getStatus = useCallback(() => {
    if (usedPercent >= 100) return 'exceeded';
    if (usedPercent >= 90) return 'critical';
    if (usedPercent >= 75) return 'warning';
    if (usedPercent >= 50) return 'caution';
    return 'good';
  }, [usedPercent]);

  return {
    settings,
    isLoaded,
    setBudget,
    addSpending,
    resetSpending,
    remaining,
    usedPercent,
    canAfford,
    getStatus,
  };
}
