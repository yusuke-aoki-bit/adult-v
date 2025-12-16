'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Settings,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useBudgetTracker } from '@/hooks';

const translations = {
  ja: {
    title: '今月の視聴予算',
    budget: '設定予算',
    spent: '使用済み',
    remaining: '残り',
    overBudget: '予算オーバー',
    onTrack: '予算内',
    recentPurchases: '購入履歴',
    noPurchases: '購入履歴がありません',
    setBudget: '予算を設定',
    editBudget: '予算を変更',
    save: '保存',
    cancel: 'キャンセル',
    clear: 'クリア',
    yen: '円',
    viewAll: 'すべて見る',
    collapse: '閉じる',
    tips: '節約のヒント',
    waitForSale: 'セール中の作品をチェック',
    checkCostPerformance: 'コスパの良い作品を探す',
  },
  en: {
    title: 'Monthly Budget',
    budget: 'Budget',
    spent: 'Spent',
    remaining: 'Remaining',
    overBudget: 'Over Budget',
    onTrack: 'On Track',
    recentPurchases: 'Recent Purchases',
    noPurchases: 'No purchases yet',
    setBudget: 'Set Budget',
    editBudget: 'Edit Budget',
    save: 'Save',
    cancel: 'Cancel',
    clear: 'Clear',
    yen: '',
    viewAll: 'View All',
    collapse: 'Collapse',
    tips: 'Saving Tips',
    waitForSale: 'Check for sales',
    checkCostPerformance: 'Find value picks',
  },
  zh: {
    title: '本月预算',
    budget: '预算',
    spent: '已花费',
    remaining: '剩余',
    overBudget: '超预算',
    onTrack: '在预算内',
    recentPurchases: '最近购买',
    noPurchases: '暂无购买记录',
    setBudget: '设置预算',
    editBudget: '修改预算',
    save: '保存',
    cancel: '取消',
    clear: '清除',
    yen: '日元',
    viewAll: '查看全部',
    collapse: '收起',
    tips: '省钱技巧',
    waitForSale: '查看打折商品',
    checkCostPerformance: '寻找高性价比',
  },
  ko: {
    title: '이번 달 예산',
    budget: '예산',
    spent: '사용',
    remaining: '남음',
    overBudget: '예산 초과',
    onTrack: '예산 내',
    recentPurchases: '최근 구매',
    noPurchases: '구매 내역 없음',
    setBudget: '예산 설정',
    editBudget: '예산 수정',
    save: '저장',
    cancel: '취소',
    clear: '지우기',
    yen: '엔',
    viewAll: '전체 보기',
    collapse: '접기',
    tips: '절약 팁',
    waitForSale: '세일 상품 확인',
    checkCostPerformance: '가성비 좋은 작품 찾기',
  },
} as const;

interface BudgetTrackerProps {
  locale: string;
  className?: string;
}

export default function BudgetTracker({ locale, className = '' }: BudgetTrackerProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const {
    stats,
    isLoading,
    setMonthlyBudget,
    removePurchase,
    clearPurchases,
  } = useBudgetTracker();

  const [isEditing, setIsEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(stats.monthlyBudget));
  const [showAllPurchases, setShowAllPurchases] = useState(false);

  const handleSaveBudget = () => {
    const amount = parseInt(budgetInput, 10);
    if (!isNaN(amount) && amount >= 0) {
      setMonthlyBudget(amount);
    }
    setIsEditing(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : locale === 'zh' ? 'zh-CN' : locale === 'ko' ? 'ko-KR' : 'en-US', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 w-40 bg-gray-700 rounded mb-4" />
          <div className="h-24 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  const isOverBudget = stats.remaining < 0;
  const progressColor = isOverBudget
    ? 'from-red-600 to-red-400'
    : stats.percentUsed > 80
      ? 'from-yellow-600 to-yellow-400'
      : 'from-green-600 to-green-400';

  const displayedPurchases = showAllPurchases ? stats.purchases : stats.purchases.slice(-3);

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-green-400" />
          {t.title}
        </h3>
        <button
          onClick={() => {
            setBudgetInput(String(stats.monthlyBudget));
            setIsEditing(!isEditing);
          }}
          className="text-gray-400 hover:text-white transition-colors p-1"
          aria-label={t.editBudget}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Budget Edit Mode */}
      {isEditing && (
        <div className="mb-4 p-3 bg-gray-750 rounded-lg">
          <label className="text-sm text-gray-400 mb-2 block">{t.setBudget}</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none"
              min="0"
              step="1000"
            />
            <button
              onClick={handleSaveBudget}
              className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              {t.save}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Budget Stats */}
      <div className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">{t.spent}</span>
            <span className={`text-sm font-medium ${isOverBudget ? 'text-red-400' : 'text-green-400'}`}>
              {stats.percentUsed}%
            </span>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${progressColor} rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(stats.percentUsed, 100)}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-750 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">{t.budget}</p>
            <p className="text-lg font-bold text-white">{formatPrice(stats.monthlyBudget)}</p>
          </div>
          <div className="bg-gray-750 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">{t.spent}</p>
            <p className="text-lg font-bold text-white flex items-center justify-center gap-1">
              <TrendingDown className="w-4 h-4 text-red-400" />
              {formatPrice(stats.spent)}
            </p>
          </div>
          <div className="bg-gray-750 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">{t.remaining}</p>
            <p className={`text-lg font-bold flex items-center justify-center gap-1 ${
              isOverBudget ? 'text-red-400' : 'text-green-400'
            }`}>
              {isOverBudget ? (
                <TrendingDown className="w-4 h-4" />
              ) : (
                <TrendingUp className="w-4 h-4" />
              )}
              {formatPrice(Math.abs(stats.remaining))}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`flex items-center gap-2 p-2 rounded-lg ${
          isOverBudget ? 'bg-red-900/30' : 'bg-green-900/30'
        }`}>
          {isOverBudget ? (
            <>
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400">{t.overBudget}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">{t.onTrack}</span>
            </>
          )}
        </div>

        {/* Recent Purchases */}
        {stats.purchases.length > 0 && (
          <div className="border-t border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-400">{t.recentPurchases}</h4>
              {stats.purchases.length > 0 && (
                <button
                  onClick={clearPurchases}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  {t.clear}
                </button>
              )}
            </div>

            <div className="space-y-2">
              {displayedPurchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex items-center justify-between p-2 bg-gray-750 rounded-lg group"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/${locale}/products/${purchase.productId}`}
                      className="text-sm text-gray-300 hover:text-white truncate block transition-colors"
                    >
                      {purchase.title}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {new Date(purchase.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {formatPrice(purchase.price)}
                    </span>
                    <button
                      onClick={() => removePurchase(purchase.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                      aria-label="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {stats.purchases.length > 3 && (
              <button
                onClick={() => setShowAllPurchases(!showAllPurchases)}
                className="w-full mt-2 py-1 text-sm text-gray-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
              >
                {showAllPurchases ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    {t.collapse}
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    {t.viewAll} ({stats.purchases.length})
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Saving Tips */}
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2">{t.tips}</h4>
          <div className="space-y-2">
            <Link
              href={`/${locale}/products?sale=true`}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-green-400 transition-colors"
            >
              <span className="text-green-400">•</span>
              {t.waitForSale}
            </Link>
            <Link
              href={`/${locale}/products?sort=cost-performance`}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-green-400 transition-colors"
            >
              <span className="text-green-400">•</span>
              {t.checkCostPerformance}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
