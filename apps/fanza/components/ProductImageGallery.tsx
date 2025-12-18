'use client';

import Image from 'next/image';
import { useState, useCallback, useMemo, useRef, TouchEvent } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { isDtiUncensoredSite, getFullSizeImageUrl } from '@/lib/image-utils';
import { useTranslations } from 'next-intl';
import ImageLightbox from './ImageLightbox';

const PLACEHOLDER_IMAGE = 'https://placehold.co/600x800/1f2937/ffffff?text=NO+IMAGE';

// 有効な画像URLかどうかをチェック（プロトコル相対URL対応）
function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  // HTMLタグが含まれている場合は無効
  if (url.includes('<') || url.includes('>')) return false;
  // 基本的なURL形式をチェック（プロトコル相対URLも許可）
  try {
    const urlToCheck = url.startsWith('//') ? `https:${url}` : url;
    const parsed = new URL(urlToCheck);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// URLを正規化（プロトコル相対URL → https://）
function normalizeUrl(url: string): string {
  if (!url) return PLACEHOLDER_IMAGE;
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  return url;
}

interface ProductImageGalleryProps {
  mainImage: string | null;
  sampleImages?: string[];
  productTitle: string;
}

export default function ProductImageGallery({ mainImage, sampleImages, productTitle }: ProductImageGalleryProps) {
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
  const allImagesWithDuplicates = [mainImage, ...(sampleImages || [])]
    .filter((img): img is string => typeof img === 'string' && Boolean(img) && isValidImageUrl(img))
    .map((img) => normalizeUrl(img)); // プロトコル相対URLを絶対URLに変換
  // 重複する画像URLを除外（Set を使用）
  const allImages = Array.from(new Set(allImagesWithDuplicates));
  const hasMultipleImages = allImages.length > 1;

  const selectedImage = allImages[selectedIndex] || PLACEHOLDER_IMAGE;

  // 高解像度画像URL（scap -> sample等の変換）- メイン表示とライトボックス両方で使用
  const fullSizeImage = useMemo(() => {
    return getFullSizeImageUrl(selectedImage);
  }, [selectedImage]);

  // 全画像の高解像度URL版（ライトボックス用）
  const fullSizeImages = useMemo(() => {
    return allImages.map(img => getFullSizeImageUrl(img));
  }, [allImages]);

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
          className="relative aspect-[3/4] w-full bg-gray-100 rounded-lg overflow-hidden cursor-pointer group select-none"
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
              src={imageError ? PLACEHOLDER_IMAGE : fullSizeImage}
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

        {/* サムネイル一覧（複数画像がある場合のみ） */}
        {hasMultipleImages && (
          <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-5 gap-2">
            {allImages.map((imgUrl, idx) => (
              <button
                key={imgUrl}
                onClick={() => setSelectedIndex(idx)}
                className={`relative aspect-[3/4] rounded overflow-hidden border-2 transition-all ${
                  selectedIndex === idx
                    ? 'border-rose-700 ring-2 ring-rose-700/50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Image
                  src={imgUrl}
                  alt={`${productTitle} - ${t('sampleImageAlt')} ${idx + 1}`}
                  fill
                  className={`object-cover ${isUncensored ? 'blur-[1px]' : ''}`}
                  sizes="(max-width: 768px) 20vw, (max-width: 1024px) 16vw, 10vw"
                />
              </button>
            ))}
          </div>
        )}

        {/* 画像枚数表示 */}
        {hasMultipleImages && (
          <p className="text-sm text-gray-500 text-center">
            {t('sampleImageCount', { count: allImages.length })}
          </p>
        )}
      </div>

      {/* ライトボックス */}
      <ImageLightbox
        images={fullSizeImages}
        initialIndex={selectedIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        alt={productTitle}
      />
    </>
  );
}
