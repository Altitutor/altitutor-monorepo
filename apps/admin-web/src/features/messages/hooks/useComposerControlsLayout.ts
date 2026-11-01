import { useState, useLayoutEffect } from 'react';

/** Measure the complete expanded toolbar, including sender text and optional controls. */
export function useComposerControlsLayout(containerRef: React.RefObject<HTMLElement | null>) {
  const [canExpand, setCanExpand] = useState(false);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const checkSpace = () => {
      // An invisible clone measures both layouts without briefly overflowing the live row.
      const measurement = container.cloneNode(true) as HTMLElement;
      measurement.removeAttribute('data-message-composer-controls');
      measurement.setAttribute('aria-hidden', 'true');
      measurement.inert = true;
      measurement.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;width:max-content;max-width:none;flex-wrap:nowrap;pointer-events:none';
      const left = measurement.firstElementChild as HTMLElement | null;
      if (left) { left.style.flex = 'none'; left.style.flexWrap = 'nowrap'; }
      measurement.querySelectorAll<HTMLButtonElement>('button[data-composer-label]').forEach(button => {
        const icon = button.querySelector('svg');
        button.replaceChildren();
        if (icon) { icon.style.marginRight = '8px'; button.append(icon); }
        button.append(document.createTextNode(button.dataset.composerLabel ?? ''));
        button.style.width = 'auto';
        button.style.paddingInline = '12px';
      });
      document.body.append(measurement);
      const expandedWidth = measurement.getBoundingClientRect().width;
      measurement.remove();
      setCanExpand(container.clientWidth >= Math.ceil(expandedWidth));
    };
    checkSpace();
    const resize = new ResizeObserver(checkSpace);
    resize.observe(container);
    const mutation = new MutationObserver(checkSpace);
    mutation.observe(container, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-composer-label'] });
    return () => { resize.disconnect(); mutation.disconnect(); };
  }, [containerRef]);
  return canExpand;
}
