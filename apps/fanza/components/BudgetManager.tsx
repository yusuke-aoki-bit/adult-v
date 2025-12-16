'use client';

import { useState } from 'react';
import { Wallet, AlertTriangle, Check, Edit2 } from 'lucide-react';
import { useBudget } from '@/hooks';

const translations = {
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
  },
} as const;

type TranslationKey = keyof typeof translations;

interface BudgetManagerProps {
  locale?: string;
  showRecommendations?: boolean;
  watchlistTotal?: number;
}

export default function BudgetManager({
  locale = 'ja',
  showRecommendations = true,
  watchlistTotal = 0,
}: BudgetManagerProps) {
  const t = translations[locale as TranslationKey] || translations.ja;
  const { settings, isLoaded, setBudget, remaining, usedPercent, getStatus } = useBudget();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  if (!isLoaded) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-4 bg-gray-700 rounded w-full mb-2" />
        <div className="h-4 bg-gray-700 rounded w-2/3" />
      </div>
    );
  }

  const status = getStatus();
  const statusColors = {
    good: 'text-green-400 bg-green-900/30',
    caution: 'text-yellow-400 bg-yellow-900/30',
    warning: 'text-orange-400 bg-orange-900/30',
    critical: 'text-red-400 bg-red-900/30',
    exceeded: 'text-red-500 bg-red-900/50',
  };

  const progressColors = {
    good: 'bg-green-500',
    caution: 'bg-yellow-500',
    warning: 'bg-orange-500',
    critical: 'bg-red-500',
    exceeded: 'bg-red-600',
  };

  const handleSave = () => {
    const value = parseInt(editValue, 10);
    if (!isNaN(value) && value > 0) {
      setBudget(value);
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-rose-400" />
          {t.title}
        </h3>
        {!isEditing && (
          <button
            onClick={() => {
              setEditValue(String(settings.monthlyBudget));
              setIsEditing(true);
            }}
            className="text-gray-400 hover:text-white"
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
              className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              placeholder="10000"
            />
            <span className="flex items-center text-gray-400">{t.yen}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2 rounded-lg font-medium"
            >
              {t.save}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 rounded-lg"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Budget Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
            <div className="bg-gray-700/50 rounded-lg p-2">
              <p className="text-gray-400">{t.budget}</p>
              <p className="text-white font-semibold">
                ¥{settings.monthlyBudget.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-2">
              <p className="text-gray-400">{t.spent}</p>
              <p className="text-white font-semibold">
                ¥{settings.currentSpent.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-2">
              <p className="text-gray-400">{t.remaining}</p>
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
              <span className="text-sm text-gray-400">{usedPercent}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${progressColors[status]}`}
                style={{ width: `${Math.min(usedPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* Watchlist Analysis */}
          {showRecommendations && watchlistTotal > 0 && (
            <div className="border-t border-gray-700 pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">ウォッチリスト合計</span>
                <span className="text-white font-medium">
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
}
