'use client';

import Image from 'next/image';
import { useState } from 'react';

const PLACEHOLDER_IMAGE = 'https://placehold.co/64x64/1f2937/ffffff?text=No+Image';

interface ActressHeroImageProps {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  priority?: boolean;
}

export default function ActressHeroImage({
  src,
  alt,
  size = 64,
  className = '',
  priority = false,
}: ActressHeroImageProps) {
  const [imgSrc, setImgSrc] = useState(src || PLACEHOLDER_IMAGE);
  const [hasError, setHasError] = useState(false);

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(PLACEHOLDER_IMAGE);
    }
  };

  // External images (placeholder) need unoptimized, internal images can be optimized
  const isExternal = imgSrc.includes('placehold.co');

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      onError={handleImageError}
      quality={75}
      sizes={`${size}px`}
      priority={priority}
      unoptimized={isExternal}
    />
  );
}
