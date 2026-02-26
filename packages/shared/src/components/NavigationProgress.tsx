'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // ナビゲーション開始を検出
  useEffect(() => {
    // クリックイベントでリンク遷移を検出
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (link && link.href && !link.target && link.href.startsWith(window.location.origin)) {
        const url = new URL(link.href);
        const currentUrl = new URL(window.location.href);
        // 同じページへの遷移は除外（ハッシュのみの変更など）
        if (url.pathname !== currentUrl.pathname || url.search !== currentUrl.search) {
          setIsNavigating(true);
          setProgress(30);
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // パスが変わったらナビゲーション完了
  useEffect(() => {
    if (isNavigating) {
      setProgress(100);
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // プログレスアニメーション
  useEffect(() => {
    if (isNavigating && progress < 90) {
      const timer = setTimeout(() => {
        setProgress((prev) => Math.min(prev + Math.random() * 10, 90));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isNavigating, progress]);

  if (!isNavigating && progress === 0) return null;

  return (
    <div className="fixed top-0 right-0 left-0 z-100 h-0.5 bg-transparent">
      <div
        className="h-full bg-linear-to-r from-fuchsia-500 to-fuchsia-400 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? 'width 0.2s, opacity 0.3s 0.1s' : 'width 0.3s ease-out',
        }}
      />
    </div>
  );
}
