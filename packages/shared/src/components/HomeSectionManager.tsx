'use client';

import { useState } from 'react';
import { useHomeSections, HomeSection } from '../hooks/useHomeSections';

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
  theme = 'dark',
  pageId = 'home',
  customSections,
  title,
}: HomeSectionManagerProps) {
  const {
    sections,
    toggleVisibility,
    reorderSections,
    resetToDefault,
  } = useHomeSections({
    locale,
    pageId,
    ...(customSections && { customSections }),
  });
  const [isOpen, setIsOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const isDark = theme === 'dark';

  const defaultTitle = locale === 'ja' ? 'セクションをカスタマイズ' : 'Customize Sections';

  const t = {
    title: title || defaultTitle,
    description: locale === 'ja' ? 'セクションの表示/非表示と順序を変更できます' : 'Show/hide and reorder sections',
    reset: locale === 'ja' ? 'リセット' : 'Reset',
    close: locale === 'ja' ? '閉じる' : 'Close',
    dragHint: locale === 'ja' ? 'ドラッグして並び替え' : 'Drag to reorder',
  };

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
        className={`fixed bottom-36 right-4 z-40 p-3 rounded-full shadow-lg transition-colors ${
          isDark
            ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
            : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
        }`}
        title={t.title}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* モーダル */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* オーバーレイ */}
          <div
            className={`absolute inset-0 ${isDark ? 'bg-black/60' : 'bg-black/40'}`}
            onClick={() => setIsOpen(false)}
          />

          {/* モーダルコンテンツ */}
          <div className={`relative w-full sm:max-w-md max-h-[80vh] overflow-hidden rounded-t-xl sm:rounded-xl ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            {/* ヘッダー */}
            <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t.title}
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* セクションリスト */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              <p className={`text-xs mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {t.dragHint}
              </p>
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

            {/* フッター */}
            <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                type="button"
                onClick={resetToDefault}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
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
