export interface StatData {
  value: number;
  suffix: string;
  description: string;
  duration?: number;
}

export interface SocialLink {
  name: string;
  url: string;
  icon: string;
}

export interface ImageData {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
}

export interface AccordionItem {
  title: string;
  content: string;
}

export interface ResourceCardData {
  icon: string | React.ReactNode;
  title: string;
  description: string;
  toggleContent?: string;
  image?: ImageData;
}

export interface CommunityCardData {
  icon: string;
  title: string;
  description: string;
  gradient?: boolean;
}

