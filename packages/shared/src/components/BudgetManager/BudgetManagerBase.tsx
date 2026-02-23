'use client';

import { useState, memo } from 'react';
import { Wallet, AlertTriangle, Check, Edit2 } from 'lucide-react';
import { getTranslation, budgetManagerTranslations } from '../../lib/translations';

export type BudgetStatus = 'good' | 'caution' | 'warning' | 'critical' | 'exceeded';

export interface BudgetManagerTheme {
  container: string;
  skeleton: string;
  skeletonBar: string;
  title: string;
  walletIcon: string;
  editButton: string;
  editButtonHover: string;
  input: string;
  inputFocus: string;
  saveButton: string;
  saveButtonHover: string;
  cancelButton: string;
  cancelButtonHover: string;
  statBox: string;
  statLabel: string;
  statValue: string;
  progressBg: string;
  percentText: string;
  yenText: string;
  watchlistBorder: string;
  watchlistLabel: string;
  watchlistValue: string;
}

export interface BudgetManagerBaseProps {
  locale?: string;
  showRecommendations?: boolean;
  watchlistTotal?: number;
  theme: BudgetManagerTheme;
  // Budget hook data passed from parent
  settings: {
    monthlyBudget: number;
    currentSpent: number;
  };
  isLoaded: boolean;
  setBudget: (value: number) => void;
  remaining: number;
  usedPercent: number;
  getStatus: () => BudgetStatus;
}

// Static color mappings - status badge colors (same across themes)
export const statusColors = {
  good: 'text-green-400 bg-green-900/30',
  caution: 'text-yellow-400 bg-yellow-900/30',
  warning: 'text-orange-400 bg-orange-900/30',
  critical: 'text-red-400 bg-red-900/30',
  exceeded: 'text-red-500 bg-red-900/50',
} as const;

// Static progress bar colors (same across themes)
export const progressColors = {
  good: 'bg-green-500',
  caution: 'bg-yellow-500',
  warning: 'bg-orange-500',
  critical: 'bg-red-500',
  exceeded: 'bg-red-600',
} as const;

export const BudgetManagerBase = memo(function BudgetManagerBase({
  locale = 'ja',
  showRecommendations = true,
  watchlistTotal = 0,
  theme,
  settings,
  isLoaded,
  setBudget,
  remaining,
  usedPercent,
  getStatus,
}: BudgetManagerBaseProps) {
  const t = getTranslation(budgetManagerTranslations, locale);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  if (!isLoaded) {
    return (
      <div className={`${theme.container} animate-pulse`}>
        <div className={`h-6 ${theme.skeletonBar} mb-4 w-1/3 rounded`} />
        <div className={`h-4 ${theme.skeletonBar} mb-2 w-full rounded`} />
        <div className={`h-4 ${theme.skeletonBar} w-2/3 rounded`} />
      </div>
    );
  }

  const status = getStatus();

  const handleSave = () => {
    const value = parseInt(editValue, 10);
    if (!isNaN(value) && value > 0) {
      setBudget(value);
    }
    setIsEditing(false);
  };

  return (
    <div className={theme.container}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className={`font-semibold ${theme.title} flex items-center gap-2`}>
          <Wallet className={`h-5 w-5 ${theme.walletIcon}`} />
          {t.title}
        </h3>
        {!isEditing && (
          <button
            onClick={() => {
              setEditValue(String(settings.monthlyBudget));
              setIsEditing(true);
            }}
            className={`${theme.editButton} ${theme.editButtonHover}`}
          >
            <Edit2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Budget Edit */}
      {isEditing ? (
        <div className="mb-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className={`flex-1 rounded-lg px-3 py-2 focus:outline-none ${theme.input} ${theme.inputFocus}`}
              placeholder="10000"
            />
            <span className={`flex items-center ${theme.yenText}`}>{t.yen}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className={`flex-1 rounded-lg py-2 font-medium ${theme.saveButton} ${theme.saveButtonHover}`}
            >
              {t.save}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className={`flex-1 rounded-lg py-2 ${theme.cancelButton} ${theme.cancelButtonHover}`}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Budget Stats */}
          <div className="mb-4 grid grid-cols-3 gap-2 text-center text-sm">
            <div className={`${theme.statBox} rounded-lg p-2`}>
              <p className={theme.statLabel}>{t.budget}</p>
              <p className={`${theme.statValue} font-semibold`}>¥{settings.monthlyBudget.toLocaleString()}</p>
            </div>
            <div className={`${theme.statBox} rounded-lg p-2`}>
              <p className={theme.statLabel}>{t.spent}</p>
              <p className={`${theme.statValue} font-semibold`}>¥{settings.currentSpent.toLocaleString()}</p>
            </div>
            <div className={`${theme.statBox} rounded-lg p-2`}>
              <p className={theme.statLabel}>{t.remaining}</p>
              <p className={`font-semibold ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ¥{remaining.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[status]}`}>{t.status[status]}</span>
              <span className={`text-sm ${theme.percentText}`}>{usedPercent}%</span>
            </div>
            <div className={`h-2 ${theme.progressBg} overflow-hidden rounded-full`}>
              <div
                className={`h-full transition-all ${progressColors[status]}`}
                style={{ width: `${Math.min(usedPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* Watchlist Analysis */}
          {showRecommendations && watchlistTotal > 0 && (
            <div className={`border-t ${theme.watchlistBorder} pt-4`}>
              <div className="flex items-center justify-between text-sm">
                <span className={theme.watchlistLabel}>{t.watchlistTotal}</span>
                <span className={`${theme.watchlistValue} font-medium`}>¥{watchlistTotal.toLocaleString()}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {watchlistTotal <= remaining ? (
                  <>
                    <Check className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-green-400">{t.withinBudget}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <span className="text-sm text-red-400">
                      {t.overBudget} (¥{(watchlistTotal - remaining).toLocaleString()})
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});
