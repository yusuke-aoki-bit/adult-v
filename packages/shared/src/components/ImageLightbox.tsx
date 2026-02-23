'use client';

import { useState, useCallback, useEffect, useRef, memo, TouchEvent, ReactNode } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getFullSizeImageUrl, isDtiUncensoredSite } from '../lib/image-utils';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  alt: string;
  detailsUrl?: string; // 詳細ページへのリンク（オプション）
  children?: ReactNode; // 追加のコンテンツ
}

function ImageLightbox({ images, initialIndex = 0, isOpen, onClose, alt, detailsUrl, children }: ImageLightboxProps) {
  const t = useTranslations('imageLightbox');
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageError, setImageError] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const preloadedImages = useRef<Set<string>>(new Set());

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const hasMultipleImages = images.length > 1;
  const currentImage = images[currentIndex] || '';
  const isUncensored = isDtiUncensoredSite(currentImage);

  // インデックスが変わったらリセット
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setImageError(false);
      setIsImageLoaded(false);
    }
  }, [isOpen, initialIndex]);

  // 画像プリロード関数
  const preloadImage = useCallback((url: string) => {
    if (!url || preloadedImages.current.has(url)) return;
    const fullUrl = getFullSizeImageUrl(url);
    if (preloadedImages.current.has(fullUrl)) return;

    const img = new window.Image();
    img.src = fullUrl;
    preloadedImages.current.add(fullUrl);
  }, []);

  // 現在の画像と前後の画像をプリロード
  useEffect(() => {
    if (!isOpen || images.length === 0) return;

    // 現在の画像をプリロード
    const currentImg = images[currentIndex];
    if (currentImg) {
      preloadImage(currentImg);
    }

    // 前後の画像をプリロード
    if (images.length > 1) {
      const prevIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
      const nextIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
      const prevImg = images[prevIndex];
      const nextImg = images[nextIndex];
      if (prevImg) preloadImage(prevImg);
      if (nextImg) preloadImage(nextImg);
    }
  }, [isOpen, currentIndex, images, preloadImage]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setImageError(false);
    setIsImageLoaded(false);
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setImageError(false);
    setIsImageLoaded(false);
  }, [images.length]);

  // スワイプハンドラー
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchEndX.current = null;
    setIsTransitioning(false);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartX.current === null) return;
    const currentX = e.touches[0]?.clientX;
    if (currentX === undefined) return;
    touchEndX.current = currentX;
    const diff = currentX - touchStartX.current;
    setSwipeOffset(diff);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current === null || touchEndX.current === null) {
      setSwipeOffset(0);
      return;
    }

    const diff = touchEndX.current - touchStartX.current;
    const threshold = 80;

    setIsTransitioning(true);
    setSwipeOffset(0);

    if (diff > threshold && hasMultipleImages) {
      goToPrevious();
    } else if (diff < -threshold && hasMultipleImages) {
      goToNext();
    }

    touchStartX.current = null;
    touchEndX.current = null;

    setTimeout(() => setIsTransitioning(false), 300);
  }, [hasMultipleImages, goToPrevious, goToNext]);

  // 3ゾーンクリックハンドラー（画面左1/3: 前へ、中央1/3: 閉じる、右1/3: 次へ）
  const handleZoneClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const screenWidth = window.innerWidth;
      const clickX = e.clientX;

      if (hasMultipleImages && clickX < screenWidth / 3) {
        goToPrevious();
      } else if (hasMultipleImages && clickX > (screenWidth * 2) / 3) {
        goToNext();
      } else {
        onClose();
      }
    },
    [hasMultipleImages, goToPrevious, goToNext, onClose],
  );

  // Memoized click handlers to avoid recreating on each render
  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handlePreviousClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      goToPrevious();
    },
    [goToPrevious],
  );

  const handleNextClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      goToNext();
    },
    [goToNext],
  );

  const handleCloseClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose],
  );

  const handleThumbnailClick = useCallback(
    (idx: number) => (e: React.MouseEvent) => {
      e.stopPropagation();
      setCurrentIndex(idx);
      setImageError(false);
      setIsImageLoaded(false);
    },
    [],
  );

  // ダイアログのrefを取得してフォーカストラップを実装
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // キーボードナビゲーション & スクロール無効化 & フォーカストラップ
  useEffect(() => {
    if (!isOpen) return;

    // 開く前のフォーカス要素を保存
    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasMultipleImages) {
        goToPrevious();
      } else if (e.key === 'ArrowRight' && hasMultipleImages) {
        goToNext();
      } else if (e.key === 'Tab') {
        // フォーカストラップ: ダイアログ内にフォーカスを閉じ込める
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusableElements = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: 最初の要素から最後へ
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab: 最後の要素から最初へ
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    // スクロールバー幅分のpaddingを補填してレイアウトシフトを防止
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    window.addEventListener('keydown', handleKeyDown);

    // ダイアログを開いた時、最初のフォーカス可能な要素にフォーカス
    requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (dialog) {
        const firstFocusable = dialog.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        firstFocusable?.focus();
      }
    });

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      window.removeEventListener('keydown', handleKeyDown);
      // 閉じた時、元のフォーカスを復元
      previousActiveElement.current?.focus();
    };
  }, [isOpen, hasMultipleImages, goToPrevious, goToNext, onClose]);

  if (!isOpen) return null;

  const fullSizeImage = getFullSizeImageUrl(currentImage);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('lightboxTitle')}
      className="lightbox-backdrop fixed inset-0 z-50 flex cursor-pointer flex-col select-none"
      onClick={handleZoneClick}
      style={{
        backgroundColor: '#000000',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* ナビゲーションバー - 最上部に固定配置（1枚でも複数枚でも同じレイアウト） */}
      <div className="z-20 flex shrink-0 items-center justify-center bg-black/90 py-3" onClick={stopPropagation}>
        <div className="flex items-center gap-2 rounded-xl bg-black/60 px-2 py-1.5">
          {hasMultipleImages && (
            <button
              type="button"
              onClick={handlePreviousClick}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
              aria-label={t('previousImage')}
            >
              <ChevronLeft className="h-5 w-5" />
              {t('previous')}
            </button>
          )}
          {hasMultipleImages && (
            <span className="px-2 py-1 text-sm text-white/80">
              {currentIndex + 1} / {images.length}
            </span>
          )}
          <button
            type="button"
            onClick={handleCloseClick}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            aria-label={t('closeLightbox')}
          >
            {t('close')}
          </button>
          {hasMultipleImages && (
            <button
              type="button"
              onClick={handleNextClick}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
              aria-label={t('nextImage')}
            >
              {t('next')}
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* メイン画像エリア - 残りのスペースを使用 */}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative mx-4 flex max-w-5xl items-center justify-center"
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: isTransitioning ? 'transform 0.3s ease-out' : 'none',
            maxHeight: '100%',
            width: '100%',
            height: '80vh',
          }}
        >
          {/* ローディングスピナー */}
          {!isImageLoaded && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            </div>
          )}
          <Image
            src={imageError ? currentImage : fullSizeImage}
            alt={alt}
            fill
            className={`object-contain transition-opacity duration-200 ${isUncensored ? 'blur-[1px]' : ''} ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
            quality={85}
            priority
            unoptimized={currentImage.includes('placeholder.co')}
            onLoad={() => setIsImageLoaded(true)}
            onError={() => {
              if (!imageError) {
                setImageError(true);
              }
            }}
            draggable={false}
          />
        </div>
      </div>

      {/* 下部コンテンツエリア */}
      <div className="pointer-events-none absolute right-0 bottom-4 left-0 z-10 flex flex-col items-center gap-3">
        {/* 詳細ページへのリンク */}
        {detailsUrl && (
          <Link
            href={detailsUrl}
            className="pointer-events-auto flex items-center gap-2 rounded-lg px-6 py-3 font-semibold whitespace-nowrap text-white transition-colors"
            style={{ backgroundColor: '#e11d48' }}
            onClick={stopPropagation}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#be123c';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#e11d48';
            }}
          >
            {t('viewDetails')}
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* サムネイル一覧 */}
        {hasMultipleImages && (
          <div
            className="pointer-events-auto flex max-w-[90vw] touch-pan-x gap-2 overflow-x-auto rounded-lg p-2"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            onClick={stopPropagation}
          >
            {images.map((imgUrl, idx) => (
              <button
                key={`thumb-${idx}`}
                type="button"
                onClick={handleThumbnailClick(idx)}
                className={`relative h-12 w-16 shrink-0 overflow-hidden rounded border-2 transition-all ${
                  currentIndex === idx ? 'border-rose-600' : 'border-transparent hover:border-gray-500'
                }`}
                style={{ backgroundColor: '#374151' }}
                aria-label={`${t('thumbnailAlt')} ${idx + 1}`}
                aria-current={currentIndex === idx ? 'true' : undefined}
              >
                {/* フォールバック番号 */}
                <span
                  className="absolute inset-0 flex items-center justify-center text-xs"
                  style={{ color: '#9ca3af' }}
                >
                  {idx + 1}
                </span>
                <Image
                  src={imgUrl}
                  alt={`${t('thumbnailAlt')} ${idx + 1}`}
                  fill
                  sizes="64px"
                  className={`object-cover ${isDtiUncensoredSite(imgUrl) ? 'blur-[2px]' : ''}`}
                  quality={60}
                  unoptimized={imgUrl.includes('placeholder.co')}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.opacity = '0';
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 追加コンテンツ（詳細ボタンなど） */}
      {children}
    </div>
  );
}

export default memo(ImageLightbox);
