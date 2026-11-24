import { useEffect, useState } from 'react';

/** Desktop sidebar width, or zero when the sidebar is hidden. */
export function useSidebarWidth(): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const sidebar = document.querySelector<HTMLElement>('[data-admin-sidebar]');
    if (!sidebar) return;
    const measure = () => setWidth(sidebar.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(sidebar);
    return () => observer.disconnect();
  }, []);
  return width;
}
