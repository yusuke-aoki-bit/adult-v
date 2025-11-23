'use client';

import Image from 'next/image';
import { useState } from 'react';

const PLACEHOLDER_IMAGE = 'https://placehold.co/600x800/1f2937/ffffff?text=NO+IMAGE';

interface ProductImageGalleryProps {
  mainImage: string;
  sampleImages?: string[];
  productTitle: string;
}

export default function ProductImageGallery({ mainImage, sampleImages, productTitle }: ProductImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState(mainImage);
  const [imageError, setImageError] = useState(false);

  // メイン画像とサンプル画像を結合
  const allImages = [mainImage, ...(sampleImages || [])].filter(Boolean);
  const hasMultipleImages = allImages.length > 1;

  const handleImageError = () => {
    setImageError(true);
    setSelectedImage(PLACEHOLDER_IMAGE);
  };

  return (
    <div className="space-y-4">
      {/* メイン画像 */}
      <div className="relative aspect-[3/4] w-full bg-gray-800 rounded-lg overflow-hidden">
        <Image
          src={imageError ? PLACEHOLDER_IMAGE : selectedImage}
          alt={productTitle}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
          onError={handleImageError}
        />
      </div>

      {/* サムネイル一覧（複数画像がある場合のみ） */}
      {hasMultipleImages && (
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-4 gap-2">
          {allImages.map((imgUrl, index) => (
            <button
              key={index}
              onClick={() => setSelectedImage(imgUrl)}
              className={`relative aspect-[3/4] rounded overflow-hidden border-2 transition-all ${
                selectedImage === imgUrl
                  ? 'border-rose-600 ring-2 ring-rose-600/50'
                  : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              <Image
                src={imgUrl}
                alt={`${productTitle} - サンプル画像 ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 25vw, (max-width: 1024px) 16vw, 12vw"
              />
            </button>
          ))}
        </div>
      )}

      {/* 画像枚数表示 */}
      {hasMultipleImages && (
        <p className="text-sm text-gray-400 text-center">
          サンプル画像: {allImages.length}枚
        </p>
      )}
    </div>
  );
}
