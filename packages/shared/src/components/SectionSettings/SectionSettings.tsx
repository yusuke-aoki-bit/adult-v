'use client';

import { useState } from 'react';
import { useHomeSections, HomeSection } from '../../hooks/useHomeSections';

export interface SectionSettingsProps {
  locale: string;
  theme?: 'dark' | 'light';
}

type PageId = 'home' | 'products' | 'product' | 'actress' | 'statistics' | 'categories' | 'discover' | 'series' | 'maker' | 'compare';

interface PageTab {
  id: PageId;
  label: { ja: string; en: string };
}

const pageTabs: PageTab[] = [
  { id: 'home', label: { ja: 'トップページ', en: 'Home' } },
  { id: 'products', label: { ja: '作品一覧', en: 'Products' } },
  { id: 'product', label: { ja: '作品詳細', en: 'Product Detail' } },
  { id: 'actress', label: { ja: '女優詳細', en: 'Actress Detail' } },
  { id: 'statistics', label: { ja: '統計', en: 'Statistics' } },
  { id: 'categories', label: { ja: 'カテゴリ', en: 'Categories' } },
  { id: 'discover', label: { ja: '発掘モード', en: 'Discover' } },
  { id: 'series', label: { ja: 'シリーズ', en: 'Series' } },
  { id: 'maker', label: { ja: 'メーカー', en: 'Maker' } },
  { id: 'compare', label: { ja: '比較', en: 'Compare' } },
];

const translations = {
  ja: {
    title: 'セクション設定',
    description: '各ページに表示するセクションを設定できます',
    reset: 'リセット',
    resetAll: 'すべてリセット',
    dragHint: 'ドラッグして並び替え',
    visible: '表示',
    hidden: '非表示',
  },
  en: {
    title: 'Section Settings',
    description: 'Configure which sections to display on each page',
    reset: 'Reset',
    resetAll: 'Reset All',
    dragHint: 'Drag to reorder',
    visible: 'Visible',
    hidden: 'Hidden',
  },
};

function SectionList({
  pageId,
  locale,
  theme,
}: {
  pageId: PageId;
  locale: string;
  theme: 'dark' | 'light';
}) {
  const {
    sections,
    toggleVisibility,
    reorderSections,
    resetToDefault,
  } = useHomeSections({ locale, pageId });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const isDark = theme === 'dark';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    reorderSections(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {t.dragHint}
        </p>
        <button
          type="button"
          onClick={resetToDefault}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            isDark
              ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          {t.reset}
        </button>
      </div>
      <div className="space-y-2">
        {sections.map((section, index) => (
          <div
            key={section.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 p-3 rounded-lg cursor-move transition-colors ${
              draggedIndex === index
                ? isDark ? 'bg-blue-600/20 border border-blue-600' : 'bg-pink-50 border border-pink-300'
                : isDark ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            {/* ドラッグハンドル */}
            <div className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>

            {/* ラベル */}
            <span className={`flex-1 text-sm font-medium ${
              section.visible
                ? isDark ? 'text-white' : 'text-gray-900'
                : isDark ? 'text-gray-500' : 'text-gray-400'
            }`}>
              {section.label}
            </span>

            {/* トグル */}
            <button
              type="button"
              onClick={() => toggleVisibility(section.id)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                section.visible
                  ? isDark ? 'bg-blue-600' : 'bg-pink-600'
                  : isDark ? 'bg-gray-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  section.visible ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionSettings({ locale, theme = 'dark' }: SectionSettingsProps) {
  const [activeTab, setActiveTab] = useState<PageId>('home');
  const isDark = theme === 'dark';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  return (
    <div className={`rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
      {/* ヘッダー */}
      <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t.title}
        </h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {t.description}
        </p>
      </div>

      {/* タブナビゲーション */}
      <div className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-x-auto`}>
        <div className="flex min-w-max px-4">
          {pageTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? isDark
                    ? 'border-blue-500 text-blue-400'
                    : 'border-pink-500 text-pink-600'
                  : isDark
                    ? 'border-transparent text-gray-400 hover:text-gray-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {locale === 'ja' ? tab.label.ja : tab.label.en}
            </button>
          ))}
        </div>
      </div>

      {/* セクションリスト */}
      <div className="p-6">
        <SectionList
          key={activeTab}
          pageId={activeTab}
          locale={locale}
          theme={theme}
        />
      </div>
    </div>
  );
}

export default SectionSettings;
