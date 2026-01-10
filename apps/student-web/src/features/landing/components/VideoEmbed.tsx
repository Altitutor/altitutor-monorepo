'use client';

import { useState } from 'react';
import Image from 'next/image';

interface VideoEmbedProps {
  videoId: string;
  startTime?: number;
  endTime?: number;
  className?: string;
}

export function VideoEmbed({ videoId, startTime = 360, endTime = 380, className }: VideoEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?start=${startTime}&end=${endTime}&autoplay=1&rel=0`;

  if (isPlaying) {
    return (
      <div className={className}>
        <div className="relative w-full aspect-video rounded-lg overflow-hidden">
          <iframe
            src={embedUrl}
            title="Video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="relative w-full aspect-video rounded-lg overflow-hidden cursor-pointer group" onClick={() => setIsPlaying(true)}>
        <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors flex items-center justify-center z-10">
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg
              className="w-8 h-8 text-brand-darkBlue ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        <Image
          src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
          alt="Video thumbnail"
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
    </div>
  );
}

