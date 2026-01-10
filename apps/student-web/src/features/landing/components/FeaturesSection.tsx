import Image from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@altitutor/ui';
import { SectionWrapper } from './SectionWrapper';
import { StatCounter } from './StatCounter';
import { stats } from '../constants/stats';
import { images } from '../constants/images';
import { AccordionItem as AccordionItemType } from '../types';

const accordionItems: AccordionItemType[] = [
  {
    title: 'Student portal',
    content:
      'The Altitutor Student Portal is your gateway to a comprehensive suite of learning resources. Access study materials, seek at-home support, and manage your academic journey with ease, all in one convenient online space.',
  },
  {
    title: 'Altitutor app',
    content:
      'The Altitutor app is your ultimate study partner, offering instant messaging with tutors, practice questions, and timely announcements, ensuring you have the support and resources you need, right at your fingertips.',
  },
  {
    title: '24/7 Support',
    content:
      "Access round-the-clock assistance with our online question board and messaging system. Whether you're studying late at night or over the weekend, get your questions answered anytime, ensuring continuous support and guidance in your learning journey.",
  },
  {
    title: 'Altitutor community',
    content:
      "The Altitutor community is more than study; it's a vibrant hub where academics blend with fun and friendship. Enjoy interactive competitions, rewards, and supportive sessions that make learning enjoyable. Here, education is about connecting, sharing, and experiencing joy in every step of your academic journey.",
  },
];

export function FeaturesSection() {
  return (
    <SectionWrapper id="features" shapeDividerBottom>
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground dark:text-foreground">
          A learning system which moves with you
        </h2>
        <p className="text-lg md:text-xl text-landing-dark-grey dark:text-muted-foreground max-w-3xl mx-auto">
          Altitutor&apos;s <strong>Student Portal</strong> provides a seamless blend of{' '}
          <strong>personalised learning</strong>, <strong>expert support</strong>, and cutting-edge{' '}
          <strong>resources</strong>, all designed to propel you towards academic success. Engage
          with a community dedicated to excellence and access all the tools you need to thrive.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12 mb-16">
        <div className="flex items-center justify-center">
          <Image
            src={images.featuresImage.src}
            alt={images.featuresImage.alt}
            width={images.featuresImage.width}
            height={images.featuresImage.height}
            className="w-full h-auto rounded-lg"
            loading="lazy"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
        <div>
          <Accordion type="single" collapsible className="w-full">
            {accordionItems.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-b">
                <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline text-landing-dark-grey dark:text-foreground">
                  {item.title}
                </AccordionTrigger>
                <AccordionContent className="text-landing-dark-grey dark:text-muted-foreground pb-4">
                  {item.content}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
        {stats.map((stat, index) => (
          <StatCounter key={index} {...stat} />
        ))}
      </div>
    </SectionWrapper>
  );
}

