'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSiteTheme } from '../../contexts/SiteThemeContext';

export interface SectionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface SectionNavProps {
  sections: SectionItem[];
  theme?: 'light' | 'dark';
  position?: 'left' | 'right';
  offset?: number; // スクロール時のオフセット（ヘッダー分など）
}

export function SectionNav({
  sections,
  theme: themeProp,
  position = 'right',
  offset = 80,
}: SectionNavProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';

  // スクロール位置に基づいてアクティブセクションを更新
  useEffect(() => {
    const handleScroll = () => {
      // 100px以上スクロールしたら表示
      setIsVisible(window.scrollY > 100);

      // 各セクションの位置を確認
      let currentSection: string | null = null;
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= offset + 50) {
            currentSection = section.id;
          }
        }
      }
      setActiveSection(currentSection);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // 初期状態を設定

    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections, offset]);

  // アクティブタブをモバイルナビの中央にスクロール
  useEffect(() => {
    if (activeSection && mobileNavRef.current) {
      const activeTab = mobileNavRef.current.querySelector(`[data-section="${activeSection}"]`);
      if (activeTab) {
        (activeTab as HTMLElement).scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeSection]);

  // セクションにスクロール
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
      setIsExpanded(false);
    }
  }, [offset]);

  if (!isVisible || sections.length === 0) {
    return null;
  }

  return (
    <>
      {/* モバイル: 水平スクロールタブバー */}
      <div
        ref={mobileNavRef}
        className={`md:hidden sticky top-[60px] z-30 backdrop-blur-sm border-b ${
          isDark ? 'bg-gray-900/95 border-gray-700' : 'bg-white/95 border-gray-200'
        }`}
      >
        <div className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory">
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                data-section={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`shrink-0 snap-start px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? isDark
                      ? 'border-blue-500 text-blue-400'
                      : 'border-pink-500 text-pink-600'
                    : isDark
                      ? 'border-transparent text-gray-400 hover:text-gray-300'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {section.icon && <span className="inline-block w-3.5 h-3.5 mr-1 align-middle">{section.icon}</span>}
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* デスクトップ: 右サイドドットナビ */}
      <div
        className={`hidden md:block fixed ${position === 'right' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 z-40 transition-all duration-300`}
      >
        {/* 展開ボタン */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all
            ${isDark
              ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              : 'bg-white hover:bg-gray-100 text-gray-600'}
            ${isExpanded ? 'rotate-45' : ''}
          `}
          aria-label="Toggle section navigation"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* セクションリスト */}
        <div
          className={`
            absolute ${position === 'right' ? 'right-0' : 'left-0'} top-12
            transition-all duration-300 origin-top
            ${isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
          `}
        >
          <div
            className={`
              rounded-lg shadow-xl overflow-hidden min-w-[180px]
              ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}
            `}
          >
            {sections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`
                    w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors
                    ${isActive
                      ? isDark
                        ? 'bg-blue-600 text-white'
                        : 'bg-pink-600 text-white'
                      : isDark
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  {section.icon && <span className="w-4 h-4 shrink-0">{section.icon}</span>}
                  <span className="truncate">{section.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-current" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ドット表示（縮小時） */}
        {!isExpanded && (
          <div className="mt-3 flex flex-col items-center gap-1.5">
            {sections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`
                    w-2 h-2 rounded-full transition-all
                    ${isActive
                      ? isDark ? 'bg-blue-500 w-2.5 h-2.5' : 'bg-pink-500 w-2.5 h-2.5'
                      : isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400'
                    }
                  `}
                  title={section.label}
                  aria-label={`Go to ${section.label}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default SectionNav;
