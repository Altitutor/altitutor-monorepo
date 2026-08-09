'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { Button, Label, Slider } from '@altitutor/ui';
import { RotateCcw } from 'lucide-react';
import {
  DEFAULT_PROFILE_IMAGE_CROP,
  profileImageCropStyle,
  type ProfileImageCrop,
} from '../types/profile-image';

interface ProfileImageCropperProps {
  imageUrl: string;
  crop: ProfileImageCrop;
  onCropChange: (crop: ProfileImageCrop) => void;
}

interface DragState {
  pointerId: number;
  x: number;
  y: number;
}

const clampPercentage = (value: number) => Math.min(100, Math.max(0, value));

export function ProfileImageCropper({
  imageUrl,
  crop,
  onCropChange,
}: ProfileImageCropperProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const viewport = viewportRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || !viewport) return;

    const { width, height } = viewport.getBoundingClientRect();
    if (!width || !height) return;

    const deltaX = event.clientX - dragState.x;
    const deltaY = event.clientY - dragState.y;
    dragStateRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };

    onCropChange({
      ...crop,
      x: clampPercentage(crop.x - (deltaX / width) * (100 / crop.zoom)),
      y: clampPercentage(crop.y - (deltaY / height) * (100 / crop.zoom)),
    });
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
    }
  };

  return (
    <div className="space-y-4">
      <div
        ref={viewportRef}
        role="application"
        aria-label="Profile picture crop preview. Drag to reposition."
        className="relative mx-auto aspect-square w-full max-w-72 touch-none cursor-move overflow-hidden rounded-full bg-muted select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <Image
          src={imageUrl}
          alt="Profile picture crop preview"
          fill
          sizes="288px"
          className="pointer-events-none object-cover"
          style={profileImageCropStyle(crop)}
          unoptimized
        />
        <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-inset ring-white/90" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="profile-image-zoom">Zoom</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onCropChange(DEFAULT_PROFILE_IMAGE_CROP)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
        <Slider
          id="profile-image-zoom"
          min={1}
          max={3}
          step={0.05}
          value={[crop.zoom]}
          onValueChange={([value]) => onCropChange({ ...crop, zoom: value ?? 1 })}
          aria-label="Profile picture zoom"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-image-horizontal-position">Horizontal position</Label>
          <Slider
            id="profile-image-horizontal-position"
            min={0}
            max={100}
            step={1}
            value={[crop.x]}
            onValueChange={([value]) => onCropChange({ ...crop, x: value ?? 50 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-image-vertical-position">Vertical position</Label>
          <Slider
            id="profile-image-vertical-position"
            min={0}
            max={100}
            step={1}
            value={[crop.y]}
            onValueChange={([value]) => onCropChange({ ...crop, y: value ?? 50 })}
          />
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Drag to reposition or use the sliders for precise framing. Your full original image is retained.
      </p>
    </div>
  );
}
