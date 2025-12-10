'use client';

import Image from 'next/image';
import { useState } from 'react';

const PLACEHOLDER_IMAGE = 'https://placehold.co/64x64/1f2937/ffffff?text=No+Image';

interface ActressHeroImageProps {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
}

export default function ActressHeroImage({
  src,
  alt,
  size = 64,
  className = ''
}: ActressHeroImageProps) {
  const [imgSrc, setImgSrc] = useState(src || PLACEHOLDER_IMAGE);
  const [hasError, setHasError] = useState(false);

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(PLACEHOLDER_IMAGE);
    }
  };

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      onError={handleImageError}
      unoptimized
    />
  );
}
