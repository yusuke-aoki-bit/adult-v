import React from 'react';

interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  className?: string;
  sizes?: string;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  [key: string]: unknown;
}

const Image = ({ src, alt, width, height, fill, ...props }: ImageProps) => {
  // Remove Next.js specific props
  const { priority, sizes, quality, placeholder, blurDataURL, ...htmlProps } = props;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} {...htmlProps} />
  );
};

export default Image;
