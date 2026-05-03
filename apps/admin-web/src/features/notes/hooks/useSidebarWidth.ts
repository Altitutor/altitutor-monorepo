import { useEffect, useState } from 'react';

/**
 * Hook to detect the width of the left navigation sidebar.
 * Returns 0 on mobile (when sidebar is hidden).
 */
export function useSidebarWidth(): number {
  const [sidebarWidth, setSidebarWidth] = useState(0);

  useEffect(() => {
    const detectSidebarWidth = () => {
      // Find the left navigation sidebar - it's the first child of the main layout container
      // and has classes: hidden md:flex flex-col border-r
      const layoutContainer = document.querySelector(
        'div.flex.h-\\[calc\\(100dvh-var\\(--navbar-height\\)\\)\\].overflow-hidden'
      );
      if (!layoutContainer) return;

      // The sidebar is the first child of the layout container
      const sidebar = layoutContainer.firstElementChild as HTMLElement | null;
      if (sidebar) {
        const computedStyle = window.getComputedStyle(sidebar);
        // Check if sidebar is visible (on desktop it should be visible)
        if (computedStyle.display !== 'none' && sidebar.offsetWidth > 0) {
          setSidebarWidth(sidebar.offsetWidth);
        } else {
          // On mobile, sidebar is hidden
          setSidebarWidth(0);
        }
      } else {
        setSidebarWidth(0);
      }
    };

    // Initial detection with delay to ensure DOM is ready
    const timeoutId = setTimeout(detectSidebarWidth, 100);
    detectSidebarWidth();

    // Watch for sidebar width changes using ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      detectSidebarWidth();
    });

    // Observe the layout container and its first child (sidebar)
    const layoutContainer = document.querySelector(
      'div.flex.h-\\[calc\\(100dvh-var\\(--navbar-height\\)\\)\\].overflow-hidden'
    );
    if (layoutContainer) {
      resizeObserver.observe(layoutContainer);
      if (layoutContainer.firstElementChild) {
        resizeObserver.observe(layoutContainer.firstElementChild);
      }
    }

    // Also listen for window resize and transition end (for sidebar collapse animation)
    window.addEventListener('resize', detectSidebarWidth);

    // Listen for transition end to catch sidebar collapse/expand animations
    const handleTransitionEnd = () => {
      detectSidebarWidth();
    };
    document.addEventListener('transitionend', handleTransitionEnd);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', detectSidebarWidth);
      document.removeEventListener('transitionend', handleTransitionEnd);
    };
  }, []);

  return sidebarWidth;
}
