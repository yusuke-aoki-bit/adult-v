'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronUp } from 'lucide-react';

// ChatBotの開閉イベント名
const CHATBOT_STATE_EVENT = 'chatbot-state-change';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [isChatBotOpen, setIsChatBotOpen] = useState(false);

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

  // ChatBotの開閉状態を監視
  useEffect(() => {
    const handleChatBotState = (e: CustomEvent<{ isOpen: boolean }>) => {
      setIsChatBotOpen(e.detail.isOpen);
    };

    window.addEventListener(CHATBOT_STATE_EVENT, handleChatBotState as EventListener);
    return () => window.removeEventListener(CHATBOT_STATE_EVENT, handleChatBotState as EventListener);
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

  // ChatBotが開いている時は非表示
  if (!isRendered || isChatBotOpen) return null;

  return (
    <button
      onClick={scrollToTop}
      className={`fixed right-3 bottom-20 z-40 rounded-full bg-rose-600 p-2 text-white shadow-lg transition-all duration-300 hover:scale-105 hover:bg-rose-700 hover:shadow-xl active:scale-95 md:right-4 md:bottom-20 md:p-3 ${
        isVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
      aria-label="ページトップへ戻る"
    >
      <ChevronUp className="h-6 w-6" />
    </button>
  );
}
