'use client';

import { useState } from 'react';
import { useHomeSections, HomeSection } from '../hooks/useHomeSections';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, homeSectionManagerTranslations } from '../lib/translations';

interface HomeSectionManagerProps {
  locale: string;
  theme?: 'dark' | 'light';
  /** ページ固有のID（セクション設定を分離するため） */
  pageId?: string;
  /** カスタムセクション定義（デフォルトを上書き） */
  customSections?: HomeSection[];
  /** モーダルのタイトル */
  title?: string;
}

export function HomeSectionManager({
  locale,
  theme: themeProp,
  pageId = 'home',
  customSections,
  title,
}: HomeSectionManagerProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const { sections, toggleVisibility, reorderSections, resetToDefault } = useHomeSections({
    locale,
    pageId,
    ...(customSections && { customSections }),
  });
  const [isOpen, setIsOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const isDark = theme === 'dark';

  const tt = getTranslation(homeSectionManagerTranslations, locale);
  const t = { ...tt, title: title || tt.defaultTitle };

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
    <>
      {/* トリガーボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`fixed right-4 bottom-36 z-40 hidden rounded-full p-3 shadow-lg transition-colors md:block ${
          isDark
            ? 'border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
        }`}
        title={t.title}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* モーダル */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* オーバーレイ */}
          <div
            className={`absolute inset-0 ${isDark ? 'bg-black/60' : 'bg-black/40'}`}
            onClick={() => setIsOpen(false)}
          />

          {/* モーダルコンテンツ */}
          <div
            className={`relative max-h-[80vh] w-full overflow-hidden rounded-t-xl sm:max-w-md sm:rounded-xl ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            {/* ヘッダー */}
            <div className={`border-b p-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.title}</h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className={`rounded-lg p-2 transition-colors ${
                    isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* セクションリスト */}
            <div className="max-h-[50vh] overflow-y-auto p-4">
              <p className={`mb-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t.dragHint}</p>
              <div className="space-y-2">
                {sections.map((section, index) => (
                  <div
                    key={section.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex cursor-move items-center gap-3 rounded-lg p-3 transition-colors ${
                      draggedIndex === index
                        ? isDark
                          ? 'border border-blue-600 bg-blue-600/20'
                          : 'border border-pink-300 bg-pink-50'
                        : isDark
                          ? 'bg-gray-700/50 hover:bg-gray-700'
                          : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    {/* ドラッグハンドル */}
                    <div className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>

                    {/* ラベル */}
                    <span
                      className={`flex-1 text-sm font-medium ${
                        section.visible
                          ? isDark
                            ? 'text-white'
                            : 'text-gray-900'
                          : isDark
                            ? 'text-gray-500'
                            : 'text-gray-400'
                      }`}
                    >
                      {section.label}
                    </span>

                    {/* トグル */}
                    <button
                      type="button"
                      onClick={() => toggleVisibility(section.id)}
                      className={`relative h-5 w-10 rounded-full transition-colors ${
                        section.visible
                          ? isDark
                            ? 'bg-blue-600'
                            : 'bg-pink-600'
                          : isDark
                            ? 'bg-gray-600'
                            : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          section.visible ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* フッター */}
            <div className={`border-t p-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                type="button"
                onClick={resetToDefault}
                className={`w-full rounded-lg py-2 text-sm font-medium transition-colors ${
                  isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.reset}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default HomeSectionManager;
