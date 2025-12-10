'use client';

import FavoriteButton from './FavoriteButton';

interface ActressFavoriteButtonProps {
  id: string | number;
  name: string;
  thumbnail?: string;
}

export default function ActressFavoriteButton({
  id,
  name,
  thumbnail,
}: ActressFavoriteButtonProps) {
  return (
    <FavoriteButton
      type="actress"
      id={id}
      name={name}
      thumbnail={thumbnail}
      size="md"
    />
  );
}
