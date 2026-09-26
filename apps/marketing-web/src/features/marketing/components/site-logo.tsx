export type SiteLogoVariant = "light" | "dark";
export type SiteLogoLayout = "banner" | "mark";

const logoSrc: Record<SiteLogoLayout, Record<SiteLogoVariant, string>> = {
  banner: {
    light: "/images/logo-banner-light.svg?v=4",
    dark: "/images/logo-banner-dark.svg?v=4",
  },
  mark: {
    light: "/images/logo-icon-light.svg",
    dark: "/images/logo-icon-dark.svg",
  },
};

type SiteLogoProps = {
  variant: SiteLogoVariant;
  layout?: SiteLogoLayout;
  className?: string;
  priority?: boolean;
};

/** `light` / `dark` matches the background; `banner` is the wordmark, `mark` is the icon only. */
export function SiteLogo({
  variant,
  layout = "banner",
  className,
  priority,
}: SiteLogoProps) {
  return (
    <img
      src={logoSrc[layout][variant]}
      alt="Altitutor"
      className={className}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
