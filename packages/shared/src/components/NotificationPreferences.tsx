'use client';

import { useState, useEffect } from 'react';

interface NotificationCategory {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface NotificationPreferencesProps {
  locale: string;
  theme?: 'dark' | 'light';
  onSave?: (preferences: Record<string, boolean>) => void;
}

const STORAGE_KEY = 'notification_preferences';

const defaultCategories: Record<string, Omit<NotificationCategory, 'enabled'>[]> = {
  ja: [
    { id: 'price_drop', label: '値下げ通知', description: 'お気に入り商品の価格が下がったとき' },
    { id: 'new_release', label: '新作通知', description: 'お気に入り女優の新作がリリースされたとき' },
    { id: 'sale_start', label: 'セール開始', description: '大型セールが始まったとき' },
    { id: 'restock', label: '再入荷通知', description: '売り切れ商品が再入荷したとき' },
    { id: 'recommendation', label: 'おすすめ通知', description: 'あなたへのおすすめ商品があるとき' },
  ],
  en: [
    { id: 'price_drop', label: 'Price Drop', description: 'When your favorite products go on sale' },
    { id: 'new_release', label: 'New Releases', description: 'When your favorite actresses have new releases' },
    { id: 'sale_start', label: 'Sale Alerts', description: 'When major sales begin' },
    { id: 'restock', label: 'Restock Alerts', description: 'When sold-out items are back in stock' },
    { id: 'recommendation', label: 'Recommendations', description: 'When we have personalized recommendations for you' },
  ],
};

export function NotificationPreferences({
  locale,
  theme = 'dark',
  onSave,
}: NotificationPreferencesProps) {
  const [categories, setCategories] = useState<NotificationCategory[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const isDark = theme === 'dark';
  const categoryDefs = defaultCategories[locale] ?? defaultCategories['en'] ?? [];

  const t = {
    title: locale === 'ja' ? '通知設定' : 'Notification Settings',
    subtitle: locale === 'ja' ? '受け取りたい通知を選択してください' : 'Choose which notifications you want to receive',
    save: locale === 'ja' ? '保存' : 'Save',
    saved: locale === 'ja' ? '保存しました' : 'Saved',
    enableAll: locale === 'ja' ? 'すべて有効' : 'Enable All',
    disableAll: locale === 'ja' ? 'すべて無効' : 'Disable All',
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const savedPrefs: Record<string, boolean> = stored ? JSON.parse(stored) : {};

      const loadedCategories = categoryDefs.map(cat => ({
        ...cat,
        enabled: savedPrefs[cat.id] ?? true, // デフォルトは有効
      }));

      setCategories(loadedCategories);
    } catch (e) {
      console.error('Failed to load notification preferences:', e);
      setCategories(categoryDefs.map(cat => ({ ...cat, enabled: true })));
    }
  }, [locale]);

  const handleToggle = (categoryId: string) => {
    setCategories(prev =>
      prev.map(cat =>
        cat.id === categoryId ? { ...cat, enabled: !cat.enabled } : cat
      )
    );
    setHasChanges(true);
  };

  const handleEnableAll = () => {
    setCategories(prev => prev.map(cat => ({ ...cat, enabled: true })));
    setHasChanges(true);
  };

  const handleDisableAll = () => {
    setCategories(prev => prev.map(cat => ({ ...cat, enabled: false })));
    setHasChanges(true);
  };

  const handleSave = () => {
    const prefs: Record<string, boolean> = {};
    categories.forEach(cat => {
      prefs[cat.id] = cat.enabled;
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setHasChanges(false);
      onSave?.(prefs);
    } catch (e) {
      console.error('Failed to save notification preferences:', e);
    }
  };

  return (
    <div className={`rounded-lg overflow-hidden ${
      isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
    }`}>
      {/* Header */}
      <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {t.title}
            </h3>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t.subtitle}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleEnableAll}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {t.enableAll}
            </button>
            <button
              type="button"
              onClick={handleDisableAll}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {t.disableAll}
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="p-4 space-y-3">
        {categories.map((category) => (
          <div
            key={category.id}
            className={`flex items-center justify-between p-3 rounded-lg ${
              isDark ? 'bg-gray-700/50' : 'bg-gray-50'
            }`}
          >
            <div className="flex-1">
              <p className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                {category.label}
              </p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {category.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle(category.id)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                category.enabled
                  ? isDark ? 'bg-blue-600' : 'bg-pink-600'
                  : isDark ? 'bg-gray-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  category.enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            type="button"
            onClick={handleSave}
            className={`w-full py-2 rounded-lg font-medium transition-colors ${
              isDark
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-pink-600 hover:bg-pink-700 text-white'
            }`}
          >
            {t.save}
          </button>
        </div>
      )}
    </div>
  );
}

export default NotificationPreferences;
