import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Altitutor Student Portal | SACE & IB Online Resources | Altitutor Student',
  description:
    "STUDENT PORTAL Get started Login Dashboard A learning system which moves with you Altitutor's Student Portal provides a seamless blend of personalised learning, expert support, and cutting-edge resources, all designed to propel you towards academic success.",
  keywords: [
    'Altitutor',
    'Student Portal',
    'SACE',
    'IB',
    'Online Resources',
    'Tutoring',
    'Education',
    'Study Materials',
    'UCAT',
    'Practice Tests',
    'Assignment Help',
  ],
  authors: [{ name: 'Altitutor' }],
  creator: 'Altitutor',
  publisher: 'Altitutor',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://student.altitutor.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Altitutor Student Portal | SACE & IB Online Resources',
    description:
      "STUDENT PORTAL Get started Login Dashboard A learning system which moves with you Altitutor's Student Portal provides a seamless blend of personalised learning, expert support, and cutting-edge resources, all designed to propel you towards academic success.",
    url: 'https://student.altitutor.com/',
    siteName: 'Altitutor Student',
    locale: 'en_AU',
    type: 'website',
    images: [
      {
        url: 'https://student.altitutor.com/wp-content/uploads/sites/2/2023/12/6.png',
        width: 1200,
        height: 675,
        alt: 'Altitutor Student Portal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Altitutor Student Portal | SACE & IB Online Resources',
    description:
      "A learning system which moves with you. Altitutor's Student Portal provides personalised learning, expert support, and cutting-edge resources.",
    site: '@Altitutor',
    images: ['https://student.altitutor.com/wp-content/uploads/sites/2/2023/12/6.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}
