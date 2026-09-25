export type SiteLogoVariant = "light" | "dark";

const logoSrc: Record<SiteLogoVariant, string> = {
  light: "/images/logo-banner-light.svg?v=4",
  dark: "/images/logo-banner-dark.svg?v=4",
};

type SiteLogoProps = {
  variant: SiteLogoVariant;
  className?: string;
  priority?: boolean;
};

/** Banner logo: `light` for light backgrounds, `dark` for dark backgrounds. */
export function SiteLogo({ variant, className, priority }: SiteLogoProps) {
  return (
    <img
      src={logoSrc[variant]}
      alt="Altitutor"
      className={className}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
