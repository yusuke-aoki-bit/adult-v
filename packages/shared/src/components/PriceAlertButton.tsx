'use client';

import { useState } from 'react';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, priceAlertTranslations } from '../lib/translations';


interface PriceAlertButtonProps {
  productId: string | number;
  title: string;
  thumbnail?: string;
  provider?: string;
  currentPrice?: number;
  hasAlert: boolean;
  existingTargetPrice?: number;
  isLoaded: boolean;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'light' | 'dark';
  locale?: string;
  onSetAlert: (targetPrice: number) => void;
  onRemoveAlert: () => void;
}

export default function PriceAlertButton({
  productId,
  title,
  thumbnail,
  provider,
  currentPrice,
  hasAlert,
  existingTargetPrice,
  isLoaded,
  size = 'md',
  theme: themeProp,
  locale = 'ja',
  onSetAlert,
  onRemoveAlert,
}: PriceAlertButtonProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const at = getTranslation(priceAlertTranslations, locale);
  const [showModal, setShowModal] = useState(false);
  const [targetPrice, setTargetPrice] = useState(
    existingTargetPrice?.toString() || (currentPrice ? Math.floor(currentPrice * 0.8).toString() : ''),
  );

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseInt(targetPrice, 10);
    if (!isNaN(price) && price > 0) {
      onSetAlert(price);
      setShowModal(false);
    }
  };

  if (!isLoaded) {
    return (
      <button
        className={`${sizeClasses[size]} rounded-lg ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
        } cursor-not-allowed opacity-50`}
        disabled
      >
        <svg
          className={`${iconSizes[size]} ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
          fill="none"
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
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => (hasAlert ? onRemoveAlert() : setShowModal(true))}
        className={`${sizeClasses[size]} rounded-lg transition-colors ${
          hasAlert
            ? theme === 'dark'
              ? 'bg-yellow-600 text-white hover:bg-yellow-700'
              : 'bg-yellow-500 text-white hover:bg-yellow-600'
            : theme === 'dark'
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
        }`}
        title={hasAlert ? `${at.removeAlert} (¥${existingTargetPrice?.toLocaleString()})` : at.setAlert}
      >
        <svg
          className={iconSizes[size]}
          fill={hasAlert ? 'currentColor' : 'none'}
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
      </button>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className={`w-full max-w-md rounded-lg p-6 ${
              theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold">{at.setAlert}</h3>

            <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{at.description}</p>

            {currentPrice && (
              <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {at.currentPrice}
                <span className="font-semibold">¥{currentPrice.toLocaleString()}</span>
              </p>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label
                  className={`mb-2 block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {at.targetPrice}
                </label>
                <input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder={at.placeholder}
                  className={`w-full rounded-lg border px-4 py-2 focus:ring-2 focus:outline-none ${
                    theme === 'dark'
                      ? 'border-gray-600 bg-gray-700 text-white focus:ring-blue-500'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-pink-500'
                  }`}
                  min="1"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={`flex-1 rounded-lg px-4 py-2 transition-colors ${
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {at.cancel}
                </button>
                <button
                  type="submit"
                  className={`flex-1 rounded-lg px-4 py-2 transition-colors ${
                    theme === 'dark'
                      ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                      : 'bg-yellow-500 text-white hover:bg-yellow-600'
                  }`}
                >
                  {at.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
