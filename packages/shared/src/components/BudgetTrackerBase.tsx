'use client';

import { useState, useCallback, useMemo } from 'react';
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
  Upload,
} from 'lucide-react';
import { useBudgetTracker } from '../hooks/useBudgetTracker';
import { localizedHref } from '../i18n';
import PurchaseHistoryImporter from './PurchaseHistoryImporter';
import { localeMap } from '../lib/utils/formatDate';
import { useSiteTheme, type SiteTheme } from '../contexts/SiteThemeContext';

const themeClasses = {
  dark: {
    container: 'bg-gray-800',
    skeleton: 'bg-gray-700',
    surface: 'bg-gray-750',
    textPrimary: 'text-white',
    textMuted: 'text-gray-400',
    textSubtle: 'text-gray-500',
    textSecondary: 'text-gray-300',
    accentGreen: 'text-green-400',
    accentRed: 'text-red-400',
    iconHover: 'text-gray-400 hover:text-white',
    inputBg: 'bg-gray-700 text-white border-gray-600',
    btnPrimary: 'bg-green-600 hover:bg-green-500 text-white',
    btnSecondary: 'bg-gray-700 hover:bg-gray-600 text-gray-300',
    statusOverBg: 'bg-red-900/30',
    statusOkBg: 'bg-green-900/30',
    statusOverIcon: 'text-red-400',
    statusOverText: 'text-red-400',
    statusOkIcon: 'text-green-400',
    statusOkText: 'text-green-400',
    progressTrack: 'bg-gray-700',
    progressOver: 'from-red-600 to-red-400',
    progressWarn: 'from-yellow-600 to-yellow-400',
    progressOk: 'from-green-600 to-green-400',
    border: 'border-gray-700',
    purchaseLink: 'text-gray-300 hover:text-white',
    purchasePrice: 'text-white',
    deleteHover: 'text-gray-500 hover:text-red-400',
    clearBtn: 'text-gray-500 hover:text-red-400',
    expandBtn: 'text-gray-400 hover:text-white',
    tipLink: 'text-gray-300 hover:text-green-400',
    tipDot: 'text-green-400',
  },
  light: {
    container: 'bg-white shadow',
    skeleton: 'bg-gray-200',
    surface: 'bg-gray-50',
    textPrimary: 'text-gray-900',
    textMuted: 'text-gray-500',
    textSubtle: 'text-gray-400',
    textSecondary: 'text-gray-700',
    accentGreen: 'text-green-500',
    accentRed: 'text-red-500',
    iconHover: 'text-gray-400 hover:text-gray-600',
    inputBg: 'bg-white text-gray-900 border-gray-300',
    btnPrimary: 'bg-green-500 hover:bg-green-600 text-white',
    btnSecondary: 'bg-gray-200 hover:bg-gray-300 text-gray-700',
    statusOverBg: 'bg-red-50',
    statusOkBg: 'bg-green-50',
    statusOverIcon: 'text-red-500',
    statusOverText: 'text-red-600',
    statusOkIcon: 'text-green-500',
    statusOkText: 'text-green-600',
    progressTrack: 'bg-gray-200',
    progressOver: 'from-red-500 to-red-400',
    progressWarn: 'from-yellow-500 to-yellow-400',
    progressOk: 'from-green-500 to-green-400',
    border: 'border-gray-200',
    purchaseLink: 'text-gray-700 hover:text-rose-600',
    purchasePrice: 'text-gray-900',
    deleteHover: 'text-gray-400 hover:text-red-500',
    clearBtn: 'text-gray-400 hover:text-red-500',
    expandBtn: 'text-gray-500 hover:text-gray-700',
    tipLink: 'text-gray-600 hover:text-green-600',
    tipDot: 'text-green-500',
  },
} as const;

function getTheme(theme: SiteTheme) {
  return themeClasses[theme];
}

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
    import: 'インポート',
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
    import: 'Import',
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
    import: '导入',
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
    import: '가져오기',
  },
} as const;

interface BudgetTrackerBaseProps {
  locale: string;
  className?: string;
}

export default function BudgetTrackerBase({ locale, className = '' }: BudgetTrackerBaseProps) {
  const { theme } = useSiteTheme();
  const tc = getTheme(theme);
  const t = translations[locale as keyof typeof translations] || translations['ja'];
  const {
    stats,
    isLoading,
    setMonthlyBudget,
    importPurchases,
    removePurchase,
    clearPurchases,
  } = useBudgetTracker();
  const [showImporter, setShowImporter] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(stats.monthlyBudget));
  const [showAllPurchases, setShowAllPurchases] = useState(false);

  const handleSaveBudget = useCallback(() => {
    const amount = parseInt(budgetInput, 10);
    if (!isNaN(amount) && amount >= 0) {
      setMonthlyBudget(amount);
    }
    setIsEditing(false);
  }, [budgetInput, setMonthlyBudget]);

  const handleToggleEdit = useCallback(() => {
    setBudgetInput(String(stats.monthlyBudget));
    setIsEditing((prev) => !prev);
  }, [stats.monthlyBudget]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleTogglePurchases = useCallback(() => {
    setShowAllPurchases((prev) => !prev);
  }, []);

  const formatPrice = useCallback((price: number) => {
    return new Intl.NumberFormat(localeMap[locale] || 'ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(price);
  }, [locale]);

  const displayedPurchases = useMemo(
    () => showAllPurchases ? stats.purchases : stats.purchases.slice(-3),
    [showAllPurchases, stats.purchases]
  );

  if (isLoading) {
    return (
      <div className={`${tc.container} rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className={`h-6 w-40 ${tc.skeleton} rounded mb-4`} />
          <div className={`h-24 ${tc.skeleton} rounded`} />
        </div>
      </div>
    );
  }

  const isOverBudget = stats.remaining < 0;
  const progressColor = isOverBudget
    ? tc.progressOver
    : stats.percentUsed > 80
      ? tc.progressWarn
      : tc.progressOk;

  return (
    <div className={`${tc.container} rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-bold ${tc.textPrimary} flex items-center gap-2`}>
          <Wallet className={`w-5 h-5 ${tc.accentGreen}`} />
          {t.title}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImporter(true)}
            className={`${tc.iconHover} transition-colors p-1`}
            aria-label={t.import}
            title={t.import}
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={handleToggleEdit}
            className={`${tc.iconHover} transition-colors p-1`}
            aria-label={t.editBudget}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Budget Edit Mode */}
      {isEditing && (
        <div className={`mb-4 p-3 ${tc.surface} rounded-lg`}>
          <label className={`text-sm ${tc.textMuted} mb-2 block`}>{t.setBudget}</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className={`flex-1 ${tc.inputBg} px-3 py-2 rounded-lg border focus:border-green-500 focus:outline-none`}
              min="0"
              step="1000"
            />
            <button
              onClick={handleSaveBudget}
              className={`px-3 py-2 ${tc.btnPrimary} rounded-lg transition-colors`}
            >
              {t.save}
            </button>
            <button
              onClick={handleCancelEdit}
              className={`px-3 py-2 ${tc.btnSecondary} rounded-lg transition-colors`}
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
            <span className={`text-sm ${tc.textMuted}`}>{t.spent}</span>
            <span className={`text-sm font-medium ${isOverBudget ? tc.accentRed : tc.accentGreen}`}>
              {stats.percentUsed}%
            </span>
          </div>
          <div className={`h-3 ${tc.progressTrack} rounded-full overflow-hidden`}>
            <div
              className={`h-full bg-linear-to-r ${progressColor} rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(stats.percentUsed, 100)}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`${tc.surface} rounded-lg p-3 text-center`}>
            <p className={`text-xs ${tc.textMuted} mb-1`}>{t.budget}</p>
            <p className={`text-lg font-bold ${tc.textPrimary}`}>{formatPrice(stats.monthlyBudget)}</p>
          </div>
          <div className={`${tc.surface} rounded-lg p-3 text-center`}>
            <p className={`text-xs ${tc.textMuted} mb-1`}>{t.spent}</p>
            <p className={`text-lg font-bold ${tc.textPrimary} flex items-center justify-center gap-1`}>
              <TrendingDown className={`w-4 h-4 ${tc.accentRed}`} />
              {formatPrice(stats.spent)}
            </p>
          </div>
          <div className={`${tc.surface} rounded-lg p-3 text-center`}>
            <p className={`text-xs ${tc.textMuted} mb-1`}>{t.remaining}</p>
            <p className={`text-lg font-bold flex items-center justify-center gap-1 ${
              isOverBudget ? tc.accentRed : tc.accentGreen
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
          isOverBudget ? tc.statusOverBg : tc.statusOkBg
        }`}>
          {isOverBudget ? (
            <>
              <AlertTriangle className={`w-4 h-4 ${tc.statusOverIcon}`} />
              <span className={`text-sm ${tc.statusOverText}`}>{t.overBudget}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className={`w-4 h-4 ${tc.statusOkIcon}`} />
              <span className={`text-sm ${tc.statusOkText}`}>{t.onTrack}</span>
            </>
          )}
        </div>

        {/* Recent Purchases */}
        {stats.purchases.length > 0 && (
          <div className={`border-t ${tc.border} pt-4`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className={`text-sm font-medium ${tc.textMuted}`}>{t.recentPurchases}</h4>
              {stats.purchases.length > 0 && (
                <button
                  onClick={clearPurchases}
                  className={`text-xs ${tc.clearBtn} transition-colors flex items-center gap-1`}
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
                  className={`flex items-center justify-between p-2 ${tc.surface} rounded-lg group`}
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={localizedHref(`/products/${purchase.productId}`, locale)}
                      className={`text-sm ${tc.purchaseLink} truncate block transition-colors`}
                    >
                      {purchase.title}
                    </Link>
                    <p className={`text-xs ${tc.textSubtle}`}>
                      {new Date(purchase.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${tc.purchasePrice}`}>
                      {formatPrice(purchase.price)}
                    </span>
                    <button
                      onClick={() => removePurchase(purchase.id)}
                      className={`opacity-0 group-hover:opacity-100 ${tc.deleteHover} transition-all`}
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
                onClick={handleTogglePurchases}
                className={`w-full mt-2 py-1 text-sm ${tc.expandBtn} flex items-center justify-center gap-1 transition-colors`}
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
        <div className={`border-t ${tc.border} pt-4`}>
          <h4 className={`text-sm font-medium ${tc.textMuted} mb-2`}>{t.tips}</h4>
          <div className="space-y-2">
            <Link
              href={localizedHref('/products?sale=true', locale)}
              className={`flex items-center gap-2 text-sm ${tc.tipLink} transition-colors`}
            >
              <span className={tc.tipDot}>•</span>
              {t.waitForSale}
            </Link>
            <Link
              href={localizedHref('/products?sort=cost-performance', locale)}
              className={`flex items-center gap-2 text-sm ${tc.tipLink} transition-colors`}
            >
              <span className={tc.tipDot}>•</span>
              {t.checkCostPerformance}
            </Link>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImporter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <PurchaseHistoryImporter
            locale={locale}
            theme={theme}
            onImport={importPurchases}
            onClose={() => setShowImporter(false)}
          />
        </div>
      )}
    </div>
  );
}
