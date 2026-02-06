import { useState, useEffect } from 'react';

/**
 * Hook to detect if there's enough horizontal space for expanded buttons
 * Returns true if buttons can be expanded, false if they should be icon-only
 */
export function useResponsiveButtons(containerRef: React.RefObject<HTMLElement>) {
  const [canExpand, setCanExpand] = useState(false); // Start false to be safe

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkSpace = () => {
      const container = containerRef.current;
      if (!container) return;

      // Get the actual available width of the button row
      const containerWidth = container.clientWidth;
      
      // Use a conservative threshold - need at least 480px to be safe
      // This accounts for:
      // - Template button expanded: ~120px
      // - Attachments button expanded: ~100px  
      // - Phone button expanded: ~140px
      // - Send button: ~80px
      // - Gaps: ~24px (3 gaps * 8px)
      // - Some buffer: ~16px
      setCanExpand(containerWidth >= 480);
    };

    // Check initially with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(checkSpace, 100);

    // Check on resize using ResizeObserver
    const resizeObserver = new ResizeObserver(checkSpace);
    resizeObserver.observe(container);

    // Also listen to window resize as a fallback
    window.addEventListener('resize', checkSpace);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkSpace);
    };
  }, [containerRef]);

  return canExpand;
}
