'use client';

import Image from 'next/image';
import { useState, useCallback, useEffect, useRef, TouchEvent, ReactNode } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getFullSizeImageUrl, isDtiUncensoredSite } from '@/lib/image-utils';
import { useTranslations } from 'next-intl';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  alt: string;
  children?: ReactNode; // 追加のコンテンツ（詳細ボタンなど）
  useNextImage?: boolean; // Next.js Imageを使うかどうか
}

export default function ImageLightbox({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
  alt,
  children,
  useNextImage = false,
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
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center cursor-pointer"
      onClick={onClose}
    >
      {/* 閉じるボタン */}
      <button
        type="button"
        onClick={onClose}
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
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded text-white/70 text-sm pointer-events-none">
        {t('clickToCloseEsc')}
      </div>

      {/* メイン画像 - スワイプ対応 */}
      <div
        className="relative w-full h-full max-w-5xl max-h-[85vh] mx-4 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative w-full h-full flex items-center justify-center"
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: isTransitioning ? 'transform 0.3s ease-out' : 'none',
          }}
        >
          {useNextImage ? (
            <Image
              src={imageError ? currentImage : fullSizeImage}
              alt={alt}
              fill
              className={`object-contain ${isUncensored ? 'blur-[3px]' : ''}`}
              sizes="100vw"
              priority
              onError={() => setImageError(true)}
              draggable={false}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
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
          )}
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

      {/* サムネイル一覧 */}
      {hasMultipleImages && (
        <div className={`absolute ${children ? 'bottom-24' : 'bottom-4'} left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/60 rounded-lg max-w-full overflow-x-auto`}>
          {images.map((imgUrl, idx) => (
            <button
              key={imgUrl}
              type="button"
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); setImageError(false); }}
              className={`relative w-16 h-20 shrink-0 rounded overflow-hidden border-2 transition-all ${
                currentIndex === idx
                  ? 'border-rose-600'
                  : 'border-transparent hover:border-gray-500'
              }`}
            >
              {useNextImage ? (
                <Image
                  src={imgUrl}
                  alt={`${t('thumbnailAlt')} ${idx + 1}`}
                  fill
                  className={`object-cover ${isUncensored ? 'blur-[3px]' : ''}`}
                  sizes="64px"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imgUrl}
                  alt={`${t('thumbnailAlt')} ${idx + 1}`}
                  className={`w-full h-full object-cover ${isDtiUncensoredSite(imgUrl) ? 'blur-[2px]' : ''}`}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* 追加コンテンツ（詳細ボタンなど） */}
      {children}
    </div>
  );
}
