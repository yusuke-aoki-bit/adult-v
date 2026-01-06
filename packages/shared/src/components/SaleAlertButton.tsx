'use client';

import { useState, useCallback } from 'react';
import { usePriceAlerts, type PriceAlert } from '../hooks/usePriceAlerts';

interface SaleAlertButtonProps {
  productId: string;
  normalizedProductId: string;
  title: string;
  thumbnailUrl?: string;
  currentPrice: number;
  locale?: string;
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const TRANSLATIONS = {
  ja: {
    notifyOnSale: 'セール通知',
    notifying: '通知ON',
    addAlert: 'セールになったら通知',
    removeAlert: '通知を解除',
    targetPrice: '希望価格',
    notifyWhenBelow: '以下になったら通知',
    save: '保存',
    cancel: 'キャンセル',
    yen: '円',
    alertSet: '通知を設定しました',
    alertRemoved: '通知を解除しました',
  },
  en: {
    notifyOnSale: 'Sale Alert',
    notifying: 'Alert ON',
    addAlert: 'Notify me when on sale',
    removeAlert: 'Remove alert',
    targetPrice: 'Target price',
    notifyWhenBelow: 'Notify when below',
    save: 'Save',
    cancel: 'Cancel',
    yen: 'yen',
    alertSet: 'Alert set',
    alertRemoved: 'Alert removed',
  },
  zh: {
    notifyOnSale: '降价通知',
    notifying: '通知已开启',
    addAlert: '降价时通知我',
    removeAlert: '取消通知',
    targetPrice: '期望价格',
    notifyWhenBelow: '低于此价格时通知',
    save: '保存',
    cancel: '取消',
    yen: '日元',
    alertSet: '已设置通知',
    alertRemoved: '已取消通知',
  },
  ko: {
    notifyOnSale: '세일 알림',
    notifying: '알림 ON',
    addAlert: '세일 시 알림',
    removeAlert: '알림 해제',
    targetPrice: '희망 가격',
    notifyWhenBelow: '이하일 때 알림',
    save: '저장',
    cancel: '취소',
    yen: '엔',
    alertSet: '알림이 설정되었습니다',
    alertRemoved: '알림이 해제되었습니다',
  },
};

export default function SaleAlertButton({
  productId,
  normalizedProductId,
  title,
  thumbnailUrl,
  currentPrice,
  locale = 'ja',
  theme = 'dark',
  size = 'md',
  className = '',
}: SaleAlertButtonProps) {
  const { hasAlert, getAlert, addAlert, removeAlert, updateAlert } = usePriceAlerts();
  const [showModal, setShowModal] = useState(false);
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [showToast, setShowToast] = useState<string | null>(null);

  const t = TRANSLATIONS[locale as keyof typeof TRANSLATIONS] || TRANSLATIONS.ja;
  const isAlertSet = hasAlert(productId);
  const existingAlert = getAlert(productId);

  const handleClick = useCallback(() => {
    if (isAlertSet) {
      removeAlert(productId);
      setShowToast(t.alertRemoved);
      setTimeout(() => setShowToast(null), 2000);
    } else {
      setTargetPrice(existingAlert?.targetPrice?.toString() || '');
      setShowModal(true);
    }
  }, [isAlertSet, productId, removeAlert, existingAlert, t.alertRemoved]);

  const handleSave = useCallback(() => {
    const alert: Omit<PriceAlert, 'createdAt'> = {
      productId,
      normalizedProductId,
      title,
      ...(thumbnailUrl && { thumbnailUrl }),
      currentPrice,
      ...(targetPrice && { targetPrice: parseInt(targetPrice, 10) }),
      notifyOnAnySale: true,
    };
    addAlert(alert);
    setShowModal(false);
    setShowToast(t.alertSet);
    setTimeout(() => setShowToast(null), 2000);
  }, [productId, normalizedProductId, title, thumbnailUrl, currentPrice, targetPrice, addAlert, t.alertSet]);

  const isDark = theme === 'dark';

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`
          inline-flex items-center gap-1.5 rounded-lg font-medium transition-all
          ${sizeClasses[size]}
          ${isAlertSet
            ? isDark
              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 ring-1 ring-yellow-500/50'
              : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 ring-1 ring-yellow-300'
            : isDark
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }
          ${className}
        `}
        title={isAlertSet ? t.removeAlert : t.addAlert}
      >
        {/* Bell Icon */}
        <svg
          className={`${iconSize[size]} ${isAlertSet ? 'animate-pulse' : ''}`}
          fill={isAlertSet ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <span>{isAlertSet ? t.notifying : t.notifyOnSale}</span>
      </button>

      {/* Target Price Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowModal(false)}
        >
          <div
            className={`
              max-w-sm w-full rounded-xl p-6 shadow-xl
              ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {t.addAlert}
            </h3>

            <div className="mb-4">
              <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {title}
              </p>
              <p className="font-medium">
                現在価格: ¥{currentPrice.toLocaleString()}
              </p>
            </div>

            <div className="mb-6">
              <label className={`block text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t.targetPrice}（{t.notifyWhenBelow}）
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
                <input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder={Math.floor(currentPrice * 0.7).toString()}
                  className={`
                    w-full pl-8 pr-4 py-2 rounded-lg border
                    ${isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }
                    focus:outline-none focus:ring-2 focus:ring-yellow-500
                  `}
                />
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                空欄の場合、セールになったら通知します
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className={`
                  flex-1 py-2 rounded-lg font-medium transition-colors
                  ${isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2 rounded-lg font-medium bg-yellow-500 text-black hover:bg-yellow-400 transition-colors"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div
          className={`
            fixed bottom-20 left-1/2 -translate-x-1/2 z-50
            px-4 py-2 rounded-lg shadow-lg
            ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
            animate-fade-in-up
          `}
        >
          {showToast}
        </div>
      )}
    </>
  );
}
