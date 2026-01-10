'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/shared/utils';

const sections = [
  { id: 'hero', label: 'Student Portal' },
  { id: 'features', label: 'A learning system which moves with you' },
  { id: 'resources', label: 'All the resources you need' },
  { id: 'ucat', label: 'Ace the UCAT' },
  { id: 'community', label: 'Community' },
  { id: 'getstarted', label: 'Let\'s get started' },
];

export function ScrollIndicator() {
  const [activeSection, setActiveSection] = useState('hero');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 2;
      
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getScale = (index: number) => {
    if (hoveredIndex === null) {
      return activeSection === sections[index].id ? 1.25 : 1;
    }
    
    const distance = Math.abs(index - hoveredIndex);
    if (distance === 0) return 1.5; // Hovered item
    if (distance === 1) return 1.3; // Neighbors
    return 1;
  };

  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden lg:block">
      <div className="flex flex-col gap-2 items-end relative">
        {sections.map((section, index) => {
          const isActive = activeSection === section.id;
          const scale = getScale(index);
          const distance = hoveredIndex !== null ? Math.abs(index - hoveredIndex) : null;
          const labelOpacity = hoveredIndex !== null 
            ? (distance === 0 ? 1 : distance === 1 ? 0.7 : 0.4)
            : 0;
          
          return (
            <div
              key={section.id}
              className="relative"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <button
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  'w-3 h-3 rounded-full transition-all duration-300 relative z-10',
                  isActive
                    ? 'bg-brand-darkBlue dark:bg-brand-lightBlue'
                    : 'bg-gray-400 hover:bg-gray-600'
                )}
                style={{ transform: `scale(${scale})` }}
                aria-label={`Go to ${section.label} section`}
              />
              {hoveredIndex !== null && (
                <div 
                  className="absolute right-6 top-1/2 -translate-y-1/2 whitespace-nowrap bg-gray-900 text-white text-sm px-3 py-1.5 rounded transition-opacity duration-200 pointer-events-none"
                  style={{ opacity: labelOpacity }}
                >
                  {section.label}
                  <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

