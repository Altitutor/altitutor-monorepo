import { SectionWrapper } from './SectionWrapper';
import { ResourceCard } from './ResourceCard';
import { socialLinks } from '../constants/socialLinks';
import { Instagram, Facebook, Youtube, Twitter } from 'lucide-react';
import Link from 'next/link';

const communityFeatures = [
  {
    icon: '📚',
    title: 'Alti study sessions',
    description:
      'Need a place to study during the week? Alti Study Sessions offer a welcoming space for collaborative study at the Altitutor office in a supportive, academic environment.\n\nStudy session times are updated weekly on the office noticeboard or our social media.',
  },
  {
    icon: '🤝',
    title: 'Homework help',
    description:
      'Free for all in-person students. Come to get help with your assignments and study with your friends.\n\nIf students need additional assessment preparation, we can give you even more practice tests during our free 3-hour homework help session. We\'ll also draft your assignments in person for free!',
    gradient: true,
  },
  {
    icon: '📢',
    title: 'Announcements',
    description:
      'Keep up-to-date with all things Altitutor whether it\'s upcoming events, study session schedules, giveaways, or the latest news, you\'ll get all the essential information through the app or our social media channels.',
  },
  {
    icon: '💝',
    title: 'Loyalty cards',
    description:
      'Earn stamps for A+ work or referring friends with our Loyalty Cards. Collect and redeem them for rewards like free bubble tea or food for your class!',
    gradient: true,
  },
  {
    icon: '❤️',
    title: 'Alti events',
    description:
      'Join the Altitutor community at our regular events. From focused study sessions and informative workshops to relaxed meals at the office, end-of-year parties, and games nights, there\'s something for everyone!',
    gradient: true,
  },
  {
    icon: '🎮',
    title: 'Weekly competitions',
    description:
      'Engage in our ongoing weekly competitions for a chance to score high and win prizes! Each week brings a new challenge and opportunity to showcase your skills and earn rewards.',
  },
];

const getSocialIcon = (iconName: string) => {
  switch (iconName) {
    case 'instagram':
      return <Instagram className="w-5 h-5" />;
    case 'facebook':
      return <Facebook className="w-5 h-5" />;
    case 'youtube':
      return <Youtube className="w-5 h-5" />;
    case 'twitter':
      return <Twitter className="w-5 h-5" />;
    case 'tiktok':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
      );
    default:
      return null;
  }
};

export function CommunitySection() {
  return (
    <SectionWrapper id="community" className="bg-landing-light-grey dark:bg-background">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-landing-dark-grey dark:text-foreground">
          Community
        </h2>
        <p className="text-lg md:text-xl text-landing-dark-grey dark:text-muted-foreground max-w-3xl mx-auto">
          Our vibrant <strong>community</strong> is a place where students <strong>collaborate</strong>
          , forge <strong>friendships</strong>, and enjoy a rich <strong>social experience</strong>{' '}
          alongside their academic pursuits. Engage, connect, and grow in an environment that values{' '}
          <strong>personal development</strong> as much as <strong>academic success</strong>.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {communityFeatures.slice(0, 2).map((feature, index) => (
          <ResourceCard key={index} {...feature} />
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {communityFeatures.slice(2, 5).map((feature, index) => (
          <ResourceCard key={index} {...feature} />
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <ResourceCard {...communityFeatures[5]} />
        <div className="rounded-lg p-6 md:p-8 bg-white dark:bg-card">
          <div className="flex items-start gap-4 mb-4">
            <div className="text-3xl md:text-4xl">📱</div>
            <div className="flex-1">
              <h3 className="text-xl md:text-2xl font-semibold mb-2 text-landing-dark-grey dark:text-foreground">
                Social media
              </h3>
              <p className="text-landing-dark-grey dark:text-muted-foreground mb-6">
                Follow us on social media to get invites to Alti events, updates on charities we
                support, study tips, and keep up with the Alti community during the week.
              </p>
              <div className="flex flex-wrap gap-4">
                {socialLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                    aria-label={`Follow us on ${link.name}`}
                  >
                    {getSocialIcon(link.icon)}
                    <span className="text-sm font-medium">{link.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

