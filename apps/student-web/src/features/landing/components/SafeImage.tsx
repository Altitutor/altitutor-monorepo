'use client';

import { useState } from 'react';
import Image, { ImageProps } from 'next/image';

interface SafeImageProps extends Omit<ImageProps, 'onError'> {
  fallback?: React.ReactNode;
}

/**
 * Image component that gracefully handles missing images
 * Hides the image if it fails to load instead of showing broken image icon
 */
export function SafeImage({ fallback, ...props }: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  if (hasError) {
    return null;
  }

  return (
    <Image
      {...props}
      onError={() => setHasError(true)}
    />
  );
}

