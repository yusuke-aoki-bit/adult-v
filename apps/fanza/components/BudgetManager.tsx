'use client';

import { memo } from 'react';
import { BudgetManagerBase, BudgetManagerTheme } from '@adult-v/shared/components';
import { useBudget } from '@/hooks';

interface BudgetManagerProps {
  locale?: string;
  showRecommendations?: boolean;
  watchlistTotal?: number;
}

// Dark theme with rose accent for fanza app (static, defined outside component)
const darkRoseTheme: BudgetManagerTheme = {
  container: 'bg-gray-800 rounded-xl p-4',
  skeleton: 'bg-gray-800 rounded-xl p-4',
  skeletonBar: 'bg-gray-700',
  title: 'text-white',
  walletIcon: 'text-rose-400',
  editButton: 'text-gray-400',
  editButtonHover: 'hover:text-white',
  input: 'bg-gray-700 text-white',
  inputFocus: 'focus:ring-2 focus:ring-rose-500',
  saveButton: 'bg-rose-600 text-white',
  saveButtonHover: 'hover:bg-rose-500',
  cancelButton: 'bg-gray-700 text-gray-300',
  cancelButtonHover: 'hover:bg-gray-600',
  statBox: 'bg-gray-700/50',
  statLabel: 'text-gray-400',
  statValue: 'text-white',
  progressBg: 'bg-gray-700',
  percentText: 'text-gray-400',
  yenText: 'text-gray-400',
  watchlistBorder: 'border-gray-700',
  watchlistLabel: 'text-gray-400',
  watchlistValue: 'text-white',
};

const BudgetManager = memo(function BudgetManager({
  locale = 'ja',
  showRecommendations = true,
  watchlistTotal = 0,
}: BudgetManagerProps) {
  const { settings, isLoaded, setBudget, remaining, usedPercent, getStatus } = useBudget();

  return (
    <BudgetManagerBase
      locale={locale}
      showRecommendations={showRecommendations}
      watchlistTotal={watchlistTotal}
      theme={darkRoseTheme}
      settings={settings}
      isLoaded={isLoaded}
      setBudget={setBudget}
      remaining={remaining}
      usedPercent={usedPercent}
      getStatus={getStatus}
    />
  );
});

export default BudgetManager;
