import {
  HeroSection,
  FeaturesSection,
  ResourcesSection,
  UCATSection,
  CommunitySection,
  ScrollIndicator,
} from '@/features/landing';
import { GetStartedSectionWithAuth } from './GetStartedSectionWithAuth';

export default function HomePage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': 'https://student.altitutor.com/',
        url: 'https://student.altitutor.com/',
        name: 'Altitutor Student Portal | SACE & IB Online Resources',
        isPartOf: {
          '@id': 'https://student.altitutor.com/#website',
        },
        about: {
          '@id': 'https://student.altitutor.com/#organization',
        },
        inLanguage: 'en-AU',
      },
      {
        '@type': 'WebSite',
        '@id': 'https://student.altitutor.com/#website',
        url: 'https://student.altitutor.com/',
        name: 'Altitutor Student Portal',
        description: 'SACE & IB Online Resources',
        publisher: {
          '@id': 'https://student.altitutor.com/#organization',
        },
        alternateName: 'Alti Student Portal',
        inLanguage: 'en-AU',
      },
      {
        '@type': 'Organization',
        '@id': 'https://student.altitutor.com/#organization',
        name: 'Altitutor',
        alternateName: 'Alti',
        url: 'https://student.altitutor.com/',
        sameAs: [
          'https://www.facebook.com/altitutoreducation/',
          'https://twitter.com/Altitutor',
          'https://www.instagram.com/altitutor/',
          'https://www.tiktok.com/@altitutor',
          'https://www.linkedin.com/company/altitutor/',
          'https://www.youtube.com/@altitutor',
        ],
      },
      {
        '@type': 'BreadcrumbList',
        '@id': 'https://student.altitutor.com/#breadcrumb',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HeroSection />
      <FeaturesSection />
      <ResourcesSection />
      <UCATSection />
      <CommunitySection />
      <GetStartedSectionWithAuth />
      <ScrollIndicator />
    </>
  );
}
