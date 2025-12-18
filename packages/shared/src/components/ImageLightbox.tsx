'use client';

import { useState, useCallback, useEffect, useRef, TouchEvent, ReactNode } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
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

export default function ImageLightbox({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
  alt,
  detailsUrl,
  children,
}: ImageLightboxProps) {
  const t = useTranslations('imageLightbox');
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageError, setImageError] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

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
    }
  }, [isOpen, initialIndex]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setImageError(false);
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setImageError(false);
  }, [images.length]);

  // スワイプハンドラー
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
    setIsTransitioning(false);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
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
    const threshold = 50;

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
  const handleZoneClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const screenWidth = window.innerWidth;
    const clickX = e.clientX;

    if (hasMultipleImages && clickX < screenWidth / 3) {
      goToPrevious();
    } else if (hasMultipleImages && clickX > (screenWidth * 2) / 3) {
      goToNext();
    } else {
      onClose();
    }
  }, [hasMultipleImages, goToPrevious, goToNext, onClose]);

  // キーボードナビゲーション & スクロール無効化
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasMultipleImages) {
        goToPrevious();
      } else if (e.key === 'ArrowRight' && hasMultipleImages) {
        goToNext();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, hasMultipleImages, goToPrevious, goToNext, onClose]);

  if (!isOpen) return null;

  const fullSizeImage = getFullSizeImageUrl(currentImage);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer select-none lightbox-backdrop"
      onClick={handleZoneClick}
      style={{
        backgroundColor: '#000000',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    >
      {/* 閉じるボタン */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
        aria-label={t('close')}
      >
        <X className="w-8 h-8" />
      </button>

      {/* 画像カウンター */}
      {hasMultipleImages && (
        <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 rounded text-white text-lg z-10">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* クリックで閉じるヒント */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded text-white/70 text-sm pointer-events-none z-10">
        {t('clickToCloseEsc')}
      </div>

      {/* メイン画像 - スワイプ対応 */}
      <div
        className="relative max-w-5xl max-h-[85vh] mx-4 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative flex items-center justify-center"
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: isTransitioning ? 'transform 0.3s ease-out' : 'none',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageError ? currentImage : fullSizeImage}
            alt={alt}
            className={`max-w-full max-h-[85vh] object-contain ${isUncensored ? 'blur-[3px]' : ''}`}
            onError={() => {
              if (!imageError) {
                setImageError(true);
              }
            }}
            draggable={false}
          />
        </div>
      </div>

      {/* ナビゲーションボタン */}
      {hasMultipleImages && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
            aria-label={t('previousImage')}
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
            aria-label={t('nextImage')}
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      {/* 下部コンテンツエリア */}
      <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-3 z-10 pointer-events-none">
        {/* 詳細ページへのリンク */}
        {detailsUrl && (
          <Link
            href={detailsUrl}
            className="px-6 py-3 rounded-lg text-white font-semibold transition-colors pointer-events-auto flex items-center gap-2 whitespace-nowrap"
            style={{ backgroundColor: '#e11d48' }}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#be123c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#e11d48'; }}
          >
            {t('viewDetails')}
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* サムネイル一覧 */}
        {hasMultipleImages && (
          <div
            className="flex gap-2 p-2 rounded-lg max-w-[90vw] overflow-x-auto pointer-events-auto"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {images.map((imgUrl, idx) => (
              <button
                key={`thumb-${idx}`}
                type="button"
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); setImageError(false); }}
                className={`relative w-16 h-12 shrink-0 rounded overflow-hidden border-2 transition-all ${
                  currentIndex === idx
                    ? 'border-rose-600'
                    : 'border-transparent hover:border-gray-500'
                }`}
                style={{ backgroundColor: '#374151' }}
              >
                {/* フォールバック番号 */}
                <span className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: '#9ca3af' }}>
                  {idx + 1}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl}
                  alt={`${t('thumbnailAlt')} ${idx + 1}`}
                  className={`absolute inset-0 w-full h-full object-cover ${isDtiUncensoredSite(imgUrl) ? 'blur-[2px]' : ''}`}
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
