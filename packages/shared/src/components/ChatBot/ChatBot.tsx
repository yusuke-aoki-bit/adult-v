'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// Translations
const translations = {
  ja: {
    title: 'AIアシスタント',
    placeholder: '作品を探すお手伝いをします...',
    send: '送信',
    close: '閉じる',
    typing: '入力中...',
    error: 'エラーが発生しました。もう一度お試しください。',
    greeting: 'こんにちは！どんな作品をお探しですか？\n\n例えば：\n・「巨乳の人妻作品」\n・「癒し系の女優」\n・「オフィスもの」\nなど、お気軽にどうぞ！',
    searchResults: '検索結果を見る',
  },
  en: {
    title: 'AI Assistant',
    placeholder: 'Let me help you find content...',
    send: 'Send',
    close: 'Close',
    typing: 'Typing...',
    error: 'An error occurred. Please try again.',
    greeting: 'Hello! What kind of content are you looking for?\n\nFor example:\n・"Busty mature women"\n・"Cute actresses"\n・"Office setting"\nFeel free to ask!',
    searchResults: 'View search results',
  },
  zh: {
    title: 'AI助手',
    placeholder: '让我帮您找到内容...',
    send: '发送',
    close: '关闭',
    typing: '输入中...',
    error: '发生错误。请重试。',
    greeting: '您好！您在找什么样的内容？\n\n例如：\n・"巨乳人妻"\n・"可爱的女优"\n・"办公室"\n随时问我！',
    searchResults: '查看搜索结果',
  },
  ko: {
    title: 'AI 어시스턴트',
    placeholder: '콘텐츠 찾기를 도와드릴게요...',
    send: '보내기',
    close: '닫기',
    typing: '입력 중...',
    error: '오류가 발생했습니다. 다시 시도해 주세요.',
    greeting: '안녕하세요! 어떤 콘텐츠를 찾고 계신가요?\n\n예를 들어:\n・"글래머 유부녀"\n・"귀여운 여배우"\n・"사무실 설정"\n편하게 물어보세요!',
    searchResults: '검색 결과 보기',
  },
} as const;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  searchParams?: {
    query?: string;
    genres?: string[];
    performers?: string[];
  };
}

interface ChatBotProps {
  locale?: string;
  onSearch?: (params: { query?: string; genres?: string[]; performers?: string[] }) => void;
  apiEndpoint?: string;
}

// ChatBotの開閉状態を通知するカスタムイベント
const CHATBOT_STATE_EVENT = 'chatbot-state-change';

export function dispatchChatBotState(isOpen: boolean) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHATBOT_STATE_EVENT, { detail: { isOpen } }));
  }
}

export { CHATBOT_STATE_EVENT };

export function ChatBot({
  locale = 'ja',
  onSearch,
  apiEndpoint = '/api/chat'
}: ChatBotProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // クライアントサイドでのみレンダリング（Hydration対策）
  useEffect(() => {
    setMounted(true);
  }, []);

  // チャット開閉時にカスタムイベントを発火
  useEffect(() => {
    dispatchChatBotState(isOpen);
  }, [isOpen]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = translations[locale as keyof typeof translations] || translations.ja;

  // Initialize with greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: t.greeting,
      }]);
    }
  }, [t.greeting, messages.length]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error('API error');

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        searchParams: data.searchParams,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: t.error,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, apiEndpoint, t.error]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSearchClick = (searchParams: Message['searchParams']) => {
    if (searchParams && onSearch) {
      onSearch(searchParams);
      setIsOpen(false);
    }
  };

  // SSR時とマウント前は何も表示しない（Hydration対策）
  if (!mounted) {
    return null;
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-linear-to-r from-rose-500 to-pink-500 text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center ${isOpen ? 'scale-0' : 'scale-100'}`}
        aria-label={t.title}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 h-[500px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-rose-500 to-pink-500 text-white">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="font-semibold">{t.title}</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
              aria-label={t.close}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-rose-500 text-white rounded-br-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.searchParams && (message.searchParams.query || message.searchParams.genres?.length || message.searchParams.performers?.length) && (
                    <button
                      onClick={() => handleSearchClick(message.searchParams)}
                      className="mt-2 text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {t.searchResults}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t.placeholder}
                disabled={isLoading}
                className="flex-1 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-full transition-colors disabled:cursor-not-allowed"
                aria-label={t.send}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
