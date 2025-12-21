'use client';

import { useState, memo } from 'react';
import { Wallet, AlertTriangle, Check, Edit2 } from 'lucide-react';

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

export const budgetManagerTranslations = {
  ja: {
    title: '今月の予算',
    budget: '予算',
    spent: '使用済み',
    remaining: '残り',
    status: {
      good: '余裕あり',
      caution: '注意',
      warning: '警告',
      critical: '危険',
      exceeded: '超過',
    },
    editBudget: '予算を編集',
    save: '保存',
    cancel: 'キャンセル',
    reset: 'リセット',
    withinBudget: '予算内で購入可能',
    overBudget: '予算超過します',
    yen: '円',
    recommended: 'おすすめ購入順',
    saleSoon: 'セール終了間近',
    bestValue: 'コスパ良し',
    waitForSale: 'セール待ち推奨',
    watchlistTotal: 'ウォッチリスト合計',
  },
  en: {
    title: 'Monthly Budget',
    budget: 'Budget',
    spent: 'Spent',
    remaining: 'Remaining',
    status: {
      good: 'Good',
      caution: 'Caution',
      warning: 'Warning',
      critical: 'Critical',
      exceeded: 'Exceeded',
    },
    editBudget: 'Edit Budget',
    save: 'Save',
    cancel: 'Cancel',
    reset: 'Reset',
    withinBudget: 'Within budget',
    overBudget: 'Over budget',
    yen: 'JPY',
    recommended: 'Recommended Order',
    saleSoon: 'Sale ending soon',
    bestValue: 'Best value',
    waitForSale: 'Wait for sale',
    watchlistTotal: 'Watchlist Total',
  },
  zh: {
    title: '本月预算',
    budget: '预算',
    spent: '已花费',
    remaining: '剩余',
    status: {
      good: '充足',
      caution: '注意',
      warning: '警告',
      critical: '危险',
      exceeded: '超支',
    },
    editBudget: '编辑预算',
    save: '保存',
    cancel: '取消',
    reset: '重置',
    withinBudget: '预算内可购买',
    overBudget: '将超出预算',
    yen: '日元',
    recommended: '推荐购买顺序',
    saleSoon: '促销即将结束',
    bestValue: '性价比高',
    waitForSale: '建议等待促销',
    watchlistTotal: '愿望单总计',
  },
  ko: {
    title: '이번 달 예산',
    budget: '예산',
    spent: '사용',
    remaining: '남은',
    status: {
      good: '여유',
      caution: '주의',
      warning: '경고',
      critical: '위험',
      exceeded: '초과',
    },
    editBudget: '예산 편집',
    save: '저장',
    cancel: '취소',
    reset: '초기화',
    withinBudget: '예산 내',
    overBudget: '예산 초과',
    yen: '엔',
    recommended: '추천 구매 순서',
    saleSoon: '세일 종료 임박',
    bestValue: '가성비 좋음',
    waitForSale: '세일 대기 추천',
    watchlistTotal: '관심 목록 합계',
  },
} as const;

type TranslationKey = keyof typeof budgetManagerTranslations;

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
  const t = budgetManagerTranslations[locale as TranslationKey] || budgetManagerTranslations.ja;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  if (!isLoaded) {
    return (
      <div className={`${theme.container} animate-pulse`}>
        <div className={`h-6 ${theme.skeletonBar} rounded w-1/3 mb-4`} />
        <div className={`h-4 ${theme.skeletonBar} rounded w-full mb-2`} />
        <div className={`h-4 ${theme.skeletonBar} rounded w-2/3`} />
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
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold ${theme.title} flex items-center gap-2`}>
          <Wallet className={`w-5 h-5 ${theme.walletIcon}`} />
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
            <Edit2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Budget Edit */}
      {isEditing ? (
        <div className="space-y-3 mb-4">
          <div className="flex gap-2">
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className={`flex-1 px-3 py-2 rounded-lg focus:outline-none ${theme.input} ${theme.inputFocus}`}
              placeholder="10000"
            />
            <span className={`flex items-center ${theme.yenText}`}>{t.yen}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className={`flex-1 py-2 rounded-lg font-medium ${theme.saveButton} ${theme.saveButtonHover}`}
            >
              {t.save}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className={`flex-1 py-2 rounded-lg ${theme.cancelButton} ${theme.cancelButtonHover}`}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Budget Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
            <div className={`${theme.statBox} rounded-lg p-2`}>
              <p className={theme.statLabel}>{t.budget}</p>
              <p className={`${theme.statValue} font-semibold`}>
                ¥{settings.monthlyBudget.toLocaleString()}
              </p>
            </div>
            <div className={`${theme.statBox} rounded-lg p-2`}>
              <p className={theme.statLabel}>{t.spent}</p>
              <p className={`${theme.statValue} font-semibold`}>
                ¥{settings.currentSpent.toLocaleString()}
              </p>
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
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[status]}`}>
                {t.status[status]}
              </span>
              <span className={`text-sm ${theme.percentText}`}>{usedPercent}%</span>
            </div>
            <div className={`h-2 ${theme.progressBg} rounded-full overflow-hidden`}>
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
                <span className={`${theme.watchlistValue} font-medium`}>
                  ¥{watchlistTotal.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {watchlistTotal <= remaining ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400">{t.withinBudget}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-red-400" />
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
