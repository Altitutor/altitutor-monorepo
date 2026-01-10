import Image from 'next/image';
import { images } from '../constants/images';

export function HeroSection() {
  return (
    <section 
      id="hero"
      className="min-h-screen flex items-center justify-center py-20 relative"
      style={{
        backgroundImage: 'url(/images/landing/background-alt-scaled.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="mb-8 flex justify-center">
          <Image
            src={images.heroLogo.src}
            alt={images.heroLogo.alt}
            width={images.heroLogo.width}
            height={images.heroLogo.height}
            priority={images.heroLogo.priority}
            className="h-auto w-full max-w-2xl"
            sizes="(max-width: 768px) 100vw, 80vw"
          />
        </div>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
          STUDENT PORTAL
        </h1>
      </div>
    </section>
  );
}

