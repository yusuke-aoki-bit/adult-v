'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronUp } from 'lucide-react';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // 300px以上スクロールしたら表示
      const shouldBeVisible = window.scrollY > 300;
      setIsVisible(shouldBeVisible);
      if (shouldBeVisible) {
        setIsRendered(true);
      }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  // フェードアウト完了後にDOMから削除
  useEffect(() => {
    if (!isVisible && isRendered) {
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, isRendered]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  if (!isRendered) return null;

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-6 right-6 z-50 p-3 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 active:scale-95 hover:scale-105 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      aria-label="ページトップへ戻る"
    >
      <ChevronUp className="w-6 h-6" />
    </button>
  );
}
