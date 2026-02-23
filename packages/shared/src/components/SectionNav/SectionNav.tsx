'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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

export function SectionNav({ sections, position = 'right', offset = 80 }: SectionNavProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);

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
  const scrollToSection = useCallback(
    (sectionId: string) => {
      const element = document.getElementById(sectionId);
      if (element) {
        const top = element.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
        setIsExpanded(false);
      }
    },
    [offset],
  );

  if (!isVisible || sections.length === 0) {
    return null;
  }

  return (
    <>
      {/* モバイル: 水平スクロールタブバー */}
      <div
        ref={mobileNavRef}
        className="theme-border theme-section-nav-bg sticky top-[60px] z-30 border-b backdrop-blur-sm md:hidden"
      >
        <div className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto">
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                data-section={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`shrink-0 snap-start border-b-2 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'theme-section-nav-active'
                    : 'theme-text-muted hover:theme-text-secondary border-transparent'
                }`}
              >
                {section.icon && <span className="mr-1 inline-block h-3.5 w-3.5 align-middle">{section.icon}</span>}
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* デスクトップ: 右サイドドットナビ */}
      <div
        className={`fixed hidden md:block ${position === 'right' ? 'right-4' : 'left-4'} top-1/2 z-40 -translate-y-1/2 transition-all duration-300`}
      >
        {/* 展開ボタン */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`theme-content theme-text-secondary theme-accordion-hover flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all ${isExpanded ? 'rotate-45' : ''} `}
          aria-label="Toggle section navigation"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* セクションリスト */}
        <div
          className={`absolute ${position === 'right' ? 'right-0' : 'left-0'} top-12 origin-top transition-all duration-300 ${isExpanded ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'} `}
        >
          <div className="theme-content theme-border min-w-[180px] overflow-hidden rounded-lg border shadow-xl">
            {sections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                    isActive ? 'theme-section-nav-active-bg' : 'theme-text-secondary theme-accordion-hover'
                  } `}
                >
                  {section.icon && <span className="h-4 w-4 shrink-0">{section.icon}</span>}
                  <span className="truncate">{section.label}</span>
                  {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current" />}
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
                  className="h-2 w-2 rounded-full transition-all"
                  style={{
                    backgroundColor: isActive ? 'var(--section-nav-active)' : 'var(--section-nav-dot-inactive)',
                    ...(isActive ? { width: '10px', height: '10px' } : {}),
                  }}
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
