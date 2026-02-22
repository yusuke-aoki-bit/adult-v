'use client';

import Image from 'next/image';
import { useState, useCallback, useMemo, useRef, TouchEvent } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { isDtiUncensoredSite, getFullSizeImageUrl } from '@adult-v/shared/lib/image-utils';
import { normalizeImageUrl } from '@adult-v/shared/lib/image-utils';
import { useTranslations } from 'next-intl';
import ImageLightbox from './ImageLightbox';

const PLACEHOLDER_IMAGE = 'https://placehold.co/600x800/1f2937/ffffff?text=NO+IMAGE';
const SHARED_PLACEHOLDER = 'https://placehold.co/400x520/052e16/ffffff?text=No+Image';

interface ProductImageGalleryProps {
  mainImage: string | null;
  sampleImages?: string[];
  productTitle: string;
  /** 品番ベースで統合した全ASPのサンプル画像（名寄せ用） */
  crossAspImages?: Array<{ imageUrl: string; aspName?: string | null }>;
}

export default function ProductImageGallery({ mainImage, sampleImages, productTitle, crossAspImages }: ProductImageGalleryProps) {
  const t = useTranslations('productImageGallery');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // スワイプ用の状態
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 無修正サイトかどうかをチェック（ブラーを適用するため）
  const isUncensored = isDtiUncensoredSite(mainImage || '');

  // メイン画像とサンプル画像を結合し、重複を除外、無効なURLをフィルタリング、正規化
  const allImagesWithDuplicates = useMemo(() => {
    const baseImages = [mainImage, ...(sampleImages || [])]
      .filter((img): img is string => typeof img === 'string' && Boolean(img))
      .map((img) => normalizeImageUrl(img))
      .filter(img => img !== SHARED_PLACEHOLDER);

    // 品番ベースで統合した他ASPのサンプル画像を追加
    const crossAspImageUrls = (crossAspImages || [])
      .filter(img => img.imageUrl)
      .map(img => normalizeImageUrl(img.imageUrl))
      .filter(img => img !== SHARED_PLACEHOLDER);

    return [...baseImages, ...crossAspImageUrls];
  }, [mainImage, sampleImages, crossAspImages]);

  // 重複する画像URLを除外（Set を使用）
  const allImages = useMemo(() => Array.from(new Set(allImagesWithDuplicates)), [allImagesWithDuplicates]);
  const hasMultipleImages = allImages.length > 1;

  const selectedImage = allImages[selectedIndex] || PLACEHOLDER_IMAGE;

  // ライトボックス用の高解像度画像URL（scap -> sample等の変換）
  const _fullSizeImage = useMemo(() => {
    return getFullSizeImageUrl(selectedImage);
  }, [selectedImage]);

  const handleImageError = () => {
    setImageError(true);
  };

  const goToPrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  }, [allImages.length]);

  const goToNext = useCallback(() => {
    setSelectedIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  }, [allImages.length]);

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
    const threshold = 50; // スワイプ閾値

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

  return (
    <>
      <div className="space-y-4">
        {/* メイン画像 */}
        <div
          className="relative w-full bg-gray-800 rounded-lg overflow-hidden cursor-pointer group select-none"
          style={{ aspectRatio: '3/4' }}
          onClick={() => setLightboxOpen(true)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="relative w-full h-full"
            style={{
              transform: `translateX(${swipeOffset}px)`,
              transition: isTransitioning ? 'transform 0.3s ease-out' : 'none',
            }}
          >
            <Image
              src={imageError ? PLACEHOLDER_IMAGE : selectedImage}
              alt={productTitle}
              fill
              className={`object-cover transition-transform group-hover:scale-105 ${isUncensored ? 'blur-[1px]' : ''}`}
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
              onError={handleImageError}
              draggable={false}
            />
          </div>
          {/* 拡大アイコン */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {/* ナビゲーションボタン（複数画像の場合） */}
          {hasMultipleImages && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                aria-label={t('previousImage')}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                aria-label={t('nextImage')}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          {/* 画像カウンター */}
          {hasMultipleImages && (
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-white text-sm">
              {selectedIndex + 1} / {allImages.length}
            </div>
          )}
        </div>

        {/* 画像情報表示 */}
        <div className="flex items-center justify-center gap-3 text-sm text-gray-400">
          {hasMultipleImages && (
            <span>{t('sampleImageCount', { count: allImages.length })}</span>
          )}
          <span className="flex items-center gap-1">
            <ZoomIn className="w-4 h-4" />
            {t('tapToZoom')}
          </span>
        </div>
      </div>

      {/* ライトボックス */}
      <ImageLightbox
        images={allImages}
        initialIndex={selectedIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        alt={productTitle}
      />
    </>
  );
}
