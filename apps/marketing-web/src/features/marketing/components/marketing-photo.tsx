import Image from "next/image";

export function MarketingPhoto({
  name,
  alt,
  priority = false,
  className = "",
}: {
  name: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={`/images/marketing/${name}.webp`}
      alt={alt}
      width={1200}
      height={800}
      sizes="(max-width: 800px) 92vw, (max-width: 1280px) 45vw, 580px"
      priority={priority}
      className={`block aspect-[3/2] h-auto w-full rounded-3xl object-cover ${className}`}
    />
  );
}
